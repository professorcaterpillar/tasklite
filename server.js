const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'tasks.json');

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create data directory:', err);
  }
}

function getTasks() {
  if (!fs.existsSync(DATA_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse database file. Resetting.', err);
    return [];
  }
}

function saveTasks(tasks) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save tasks to file:', err);
  }
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function runDatabaseMaintenance() {
  const tasks = getTasks();
  const today = new Date();
  
  // Note: This runs in Docker's UTC time, which is fine because we are only
  // using it for long-term historical data cleanup (7 days / 1000 days), 
  // not sensitive day-to-day rollovers!
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const sevenDaysAgoStr = addDays(todayStr, -7);
  const historyCutoffStr = addDays(todayStr, -1000); 
  
  let databaseChanged = false;

  const cleanedTasks = tasks.filter(task => {
    // Clean up one-time completed tasks older than 7 days
    if (task.recurrence === 'none' && task.completed && task.dueDate < sevenDaysAgoStr) {
      databaseChanged = true;
      return false; 
    }
    return true;
  }).map(task => {
    let updated = { ...task };

    // Clean up recurring completion history older than 1000 days
    if (task.recurrence !== 'none' && task.completedDates && task.completedDates.length > 0) {
      const trimmed = task.completedDates.filter(d => d >= historyCutoffStr);
      if (trimmed.length !== task.completedDates.length) {
        updated.completedDates = trimmed;
        databaseChanged = true;
      }
    }
    return updated;
  });

  if (databaseChanged) {
    saveTasks(cleanedTasks);
  }
}

app.use(express.json());

app.use((req, res, next) => {
  try {
    runDatabaseMaintenance();
  } catch (e) {
    console.error("Database maintenance error:", e);
  }
  next();
});

app.get('/api/tasks', (req, res) => {
  res.json(getTasks());
});

app.post('/api/tasks', (req, res) => {
  const task = req.body;
  const tasks = getTasks();
  
  const index = tasks.findIndex(t => t.id === task.id);
  if (index !== -1) {
    tasks[index] = task;
  } else {
    tasks.push(task);
  }
  
  saveTasks(tasks);
  res.json({ success: true });
});

app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  let tasks = getTasks();
  tasks = tasks.filter(t => t.id !== id);
  saveTasks(tasks);
  res.json({ success: true });
});

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Task Tracker running locally at http://0.0.0.0:${PORT}`);
});