const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Setup directories and JSON path
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'tasks.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

// Helper: Read tasks
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

// Helper: Save tasks
function saveTasks(tasks) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2), 'utf8');
}

// Date helper
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// DB Pruning and Auto Rollover Service
function runDatabaseMaintenance() {
  const tasks = getTasks();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const sevenDaysAgoStr = addDays(todayStr, -7);
  const thirtyDaysAgoStr = addDays(todayStr, -30);
  
  let databaseChanged = false;

  const cleanedTasks = tasks.filter(task => {
    if (task.recurrence === 'none' && task.completed && task.dueDate < sevenDaysAgoStr) {
      databaseChanged = true;
      return false; 
    }
    return true;
  }).map(task => {
    let updated = { ...task };
    
    if (task.recurrence !== 'none' && task.completedDates && task.completedDates.length > 0) {
      const trimmed = task.completedDates.filter(d => d >= thirtyDaysAgoStr);
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

// Run automated cleanup routine on every fetch to keep the DB perfectly clean
app.use((req, res, next) => {
  try {
    runDatabaseMaintenance();
  } catch (e) {
    console.error("Database maintenance error:", e);
  }
  next();
});

// API Endpoints
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

// Serve frontend build static files
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Task Tracker running locally at http://localhost:${PORT}`);
});
