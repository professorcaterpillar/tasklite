import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  GripVertical, 
  CheckCircle2, 
  Circle, 
  Clock, 
  AlignLeft, 
  ChevronLeft, 
  ChevronRight,
  AlertCircle,
  X,
  Edit2,
  Printer,
  Calendar,
  RefreshCw,
  ArrowRight
} from 'lucide-react';

// --- Helper Functions ---
const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const toDateStr = (dateObj) => {
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
};

const addDays = (dateStr, days) => {
  const d = new Date(dateStr + 'T12:00:00'); // Use noon to avoid timezone shift issues
  d.setDate(d.getDate() + days);
  return toDateStr(d);
};

const getColumns = (startDate) => {
  return Array.from({ length: 7 }, (_, i) => {
    const dateStr = addDays(startDate, i);
    const dateObj = new Date(dateStr + 'T12:00:00');
    
    let label = '';
    if (dateStr === getTodayStr()) label = 'Today';
    else if (dateStr === addDays(getTodayStr(), 1)) label = 'Tomorrow';
    else label = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

    return {
      dateStr,
      label,
      shortDate: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isToday: dateStr === getTodayStr()
    };
  });
};

const matchesRecurrence = (dateStr, rule, origDateStr, interval = 1) => {
  if (rule === 'none') return dateStr === origDateStr;
  if (dateStr < origDateStr) return false;

  const d = new Date(dateStr + 'T12:00:00');
  const orig = new Date(origDateStr + 'T12:00:00');
  
  // Normalize time to midnight for accurate day diffs
  const dTime = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const origTime = Date.UTC(orig.getFullYear(), orig.getMonth(), orig.getDate());

  if (rule === 'daily') {
      const diffDays = Math.floor((dTime - origTime) / (1000 * 60 * 60 * 24));
      return diffDays % interval === 0;
  }
  if (rule === 'weekly') {
      if (d.getDay() !== orig.getDay()) return false;
      const diffDays = Math.floor((dTime - origTime) / (1000 * 60 * 60 * 24));
      const diffWeeks = Math.round(diffDays / 7);
      return diffWeeks % interval === 0;
  }
  if (rule === 'monthly') {
      const monthDiff = (d.getFullYear() - orig.getFullYear()) * 12 + (d.getMonth() - orig.getMonth());
      if (monthDiff % interval !== 0) return false;
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const targetDay = Math.min(orig.getDate(), daysInMonth);
      return d.getDate() === targetDay;
  }
  if (rule === 'yearly') {
      const yearDiff = d.getFullYear() - orig.getFullYear();
      if (yearDiff % interval !== 0) return false;
      if (d.getMonth() !== orig.getMonth()) return false;
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const targetDay = Math.min(orig.getDate(), daysInMonth);
      return d.getDate() === targetDay;
  }
  if (rule === 'weekdays') return d.getDay() >= 1 && d.getDay() <= 5;
  if (rule === 'weekends') return d.getDay() === 0 || d.getDay() === 6;
  if (rule === 'last_weekday') {
      const isWeekday = d.getDay() >= 1 && d.getDay() <= 5;
      if (!isWeekday) return false;
      
      let daysToAdd = 1;
      if (d.getDay() === 5) daysToAdd = 3; 
      
      const nextTarget = new Date(d);
      nextTarget.setDate(d.getDate() + daysToAdd);
      return nextTarget.getMonth() !== d.getMonth();
  }
  if (rule === 'last_of_day') {
      if (d.getDay() !== orig.getDay()) return false;
      const nextWeek = new Date(d);
      nextWeek.setDate(d.getDate() + 7);
      return nextWeek.getMonth() !== d.getMonth();
  }
  return false;
};

const getProjectedTasksForColumn = (colDateStr, allTasks, todayStr) => {
  let results = [];
  
  allTasks.forEach(task => {
      const isRecur = task.recurrence && task.recurrence !== 'none';
      const interval = task.recurrenceInterval || 1;
      
      if (!isRecur) {
          let effectiveDate = task.dueDate;
          let isOverdue = false;
          if (!task.completed && task.dueDate < todayStr) {
              effectiveDate = todayStr;
              isOverdue = true;
          }
          if (effectiveDate === colDateStr) {
              results.push({ ...task, instanceId: task.id, instanceDate: task.dueDate, isOverdue });
          }
      } else {
          if (matchesRecurrence(colDateStr, task.recurrence, task.dueDate, interval)) {
              const isCompleted = task.completedDates?.includes(colDateStr);
              if (colDateStr < todayStr && !isCompleted) {
                  // Rolled over to today (handled by Case B)
              } else {
                  results.push({
                      ...task,
                      instanceId: `${task.id}_${colDateStr}`,
                      instanceDate: colDateStr,
                      completed: !!isCompleted,
                      isOverdue: false
                  });
              }
          }
          
          if (colDateStr === todayStr) {
              let lookbackStart = new Date(todayStr + 'T12:00:00');
              lookbackStart.setDate(lookbackStart.getDate() - 30); 
              const origDate = new Date(task.dueDate + 'T12:00:00');
              if (origDate > lookbackStart) lookbackStart = origDate;
              
              let current = new Date(lookbackStart);
              const end = new Date(todayStr + 'T12:00:00');
              
              while (current < end) {
                  const dStr = toDateStr(current);
                  if (matchesRecurrence(dStr, task.recurrence, task.dueDate, interval)) {
                      const isCompleted = task.completedDates?.includes(dStr);
                      if (!isCompleted) {
                          results.push({
                              ...task,
                              instanceId: `${task.id}_${dStr}`,
                              instanceDate: dStr,
                              completed: false,
                              isOverdue: true
                          });
                      }
                  }
                  current.setDate(current.getDate() + 1);
              }
          }
      }
  });
  return results;
};

const PRIORITIES = {
  High: { color: 'bg-red-900/40 text-red-300 border-red-800', dot: 'bg-red-500' },
  Medium: { color: 'bg-amber-900/40 text-amber-300 border-amber-800', dot: 'bg-amber-500' },
  Low: { color: 'bg-green-900/40 text-green-300 border-green-800', dot: 'bg-green-500' },
  Info: { color: 'bg-blue-900/40 text-blue-300 border-blue-800', dot: 'bg-blue-500' },
};

const sortTaskHierarchy = (a, b) => {
  if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
  const pSort = { High: 1, Medium: 2, Low: 3, Info: 4 };
  if (pSort[a.priority] !== pSort[b.priority]) return pSort[a.priority] - pSort[b.priority];
  const timeA = parseFloat(a.timeEstimate) || 0;
  const timeB = parseFloat(b.timeEstimate) || 0;
  if (timeA !== timeB) return timeB - timeA;
  return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
};

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [useServer, setUseServer] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [printTargetDate, setPrintTargetDate] = useState(addDays(getTodayStr(), 1)); // Default to Tomorrow
  const [boardStartDate, setBoardStartDate] = useState(getTodayStr());
  const [colWidth, setColWidth] = useState(300);
  const containerRef = useRef(null);

  const columns = getColumns(boardStartDate);
  const todayStr = getTodayStr();

  // Keyboard Shortcuts (N for New Task)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
      if (!isInput && (e.key === 'n' || e.key === 'N') && !isModalOpen) {
        e.preventDefault();
        setEditingTask({
          name: '', completed: false, completedDates: [], recurrence: 'none', recurrenceInterval: 1, timeEstimate: 1.0, priority: 'Medium', notes: '', dueDate: addDays(todayStr, 1) // Default to tomorrow
        });
        setIsModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [todayStr, isModalOpen]);

  // Fetch initial tasks (With graceful fallback to LocalStorage)
  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      if (res.ok) {
        const data = await res.json();
        
        // --- NEW: Client-Side Rollover ---
        // Process rollovers using the local browser's timezone
        let needsBackendSync = false;
        const processedTasks = data.map(t => {
          if (t.recurrence === 'none' && !t.completed && t.dueDate < todayStr) {
            needsBackendSync = true;
            return { ...t, dueDate: todayStr };
          }
          return t;
        });

        setTasks(processedTasks);
        setUseServer(true);

        // Silently sync any rolled-over tasks back to the server
        if (needsBackendSync) {
          processedTasks.forEach(t => {
            if (t.recurrence === 'none' && !t.completed && t.dueDate === todayStr) {
              fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t) });
            }
          });
        }
        return;
      }
    } catch (err) {
      // Server not found, let it fall through to local storage
    }
    
    setUseServer(false);
    const localData = localStorage.getItem('task_tracker_data');
    if (localData) {
        const parsedData = JSON.parse(localData);
        // Apply client-side rollover for local fallback too
        let needsLocalSync = false;
        const processedLocal = parsedData.map(t => {
          if (t.recurrence === 'none' && !t.completed && t.dueDate < todayStr) {
            needsLocalSync = true;
            return { ...t, dueDate: todayStr };
          }
          return t;
        });
        setTasks(processedLocal);
        if (needsLocalSync) {
            localStorage.setItem('task_tracker_data', JSON.stringify(processedLocal));
        }
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 10000); // Sync every 10s
    return () => clearInterval(interval);
  }, [todayStr]);

  // Auto-save to LocalStorage ONLY if the server is offline
  useEffect(() => {
    if (!useServer && tasks.length > 0) {
      localStorage.setItem('task_tracker_data', JSON.stringify(tasks));
    }
  }, [tasks, useServer]);

  // Responsive column width calculation
  useEffect(() => {
    const updateWidth = () => {
      if (!containerRef.current) return;
      const availableWidth = containerRef.current.clientWidth - 32;
      const winW = window.innerWidth;
      let count = winW >= 1280 ? 7 : winW >= 1024 ? 5 : winW >= 768 ? 3 : 1;
      const gapSpace = (count - 1) * 16; 
      setColWidth((availableWidth - gapSpace) / count);
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const saveTaskBackend = async (updatedTask) => {
    if (!useServer) return;
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTask)
      });
    } catch (err) {
      console.error('Error saving task:', err);
    }
  };

  // Move Forward Button Logic
  const advanceUncompletedTasks = () => {
    const todaysProjected = getProjectedTasksForColumn(todayStr, tasks, todayStr);
    const uncompleted = todaysProjected.filter(t => !t.completed);

    if (uncompleted.length === 0) return;

    let modifiedExisting = [];
    let newlyCreated = [];
    const tomorrowStr = addDays(todayStr, 1);

    setTasks(prev => {
      let nextTasks = [...prev];
      uncompleted.forEach(instance => {
        const baseId = instance.id;
        const originalTaskIndex = nextTasks.findIndex(t => t.id === baseId);
        if (originalTaskIndex === -1) return;
        
        const originalTask = nextTasks[originalTaskIndex];

        if (!originalTask.recurrence || originalTask.recurrence === 'none') {
          // Push standard tasks to tomorrow
          const updated = { ...originalTask, dueDate: tomorrowStr };
          nextTasks[originalTaskIndex] = updated;
          
          const existingModIndex = modifiedExisting.findIndex(t => t.id === baseId);
          if (existingModIndex >= 0) modifiedExisting[existingModIndex] = updated;
          else modifiedExisting.push(updated);
        } else {
          // For Recurring tasks: 
          // 1. We mark today's instance as "completed" (skipped) so it stops rolling forward 
          const dates = originalTask.completedDates || [];
          const dateToMark = instance.instanceDate;
          let updatedTask = originalTask;
          if (!dates.includes(dateToMark)) {
            updatedTask = { ...originalTask, completedDates: [...dates, dateToMark] };
            nextTasks[originalTaskIndex] = updatedTask;
            
            const existingModIndex = modifiedExisting.findIndex(t => t.id === baseId);
            if (existingModIndex >= 0) modifiedExisting[existingModIndex] = updatedTask;
            else modifiedExisting.push(updatedTask);
          }
          
          // 2. Determine if it naturally occurs tomorrow anyway. 
          const occursTomorrow = matchesRecurrence(tomorrowStr, originalTask.recurrence, originalTask.dueDate, originalTask.recurrenceInterval || 1);
          
          // 3. If it doesn't naturally happen tomorrow, duplicate a 1-off task for tomorrow so it still gets done
          if (!occursTomorrow) {
            const clone = {
              ...originalTask,
              id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
              dueDate: tomorrowStr,
              recurrence: 'none',
              completedDates: [],
              completed: false
            };
            nextTasks.push(clone);
            newlyCreated.push(clone);
          }
        }
      });
      return nextTasks;
    });

    if (useServer) {
      setTimeout(() => {
        [...modifiedExisting, ...newlyCreated].forEach(t => saveTaskBackend(t));
      }, 100);
    }
  };

  const handleDragStart = (e, instanceId) => {
    e.dataTransfer.setData('taskId', instanceId);
  };

  const handleDrop = async (e, targetDate) => {
    e.preventDefault();
    const instanceId = e.dataTransfer.getData('taskId');
    if (instanceId) {
      const baseId = instanceId.split('_')[0];
      const task = tasks.find(t => t.id === baseId);
      if (task) {
        const updatedTask = { ...task, dueDate: targetDate };
        setTasks(prev => prev.map(t => t.id === baseId ? updatedTask : t)); // Optimistic Update
        await saveTaskBackend(updatedTask);
      }
    }
  };

  const toggleCompletion = async (instance) => {
    const baseId = instance.id;
    const task = tasks.find(t => t.id === baseId);
    if (!task) return;

    let updatedTask;
    const isRecur = task.recurrence && task.recurrence !== 'none';
    
    if (isRecur) {
        const dates = task.completedDates || [];
        const dateToToggle = instance.instanceDate; 
        if (dates.includes(dateToToggle)) {
            updatedTask = { ...task, completedDates: dates.filter(d => d !== dateToToggle) };
        } else {
            updatedTask = { ...task, completedDates: [...dates, dateToToggle] };
        }
    } else {
        updatedTask = { ...task, completed: !task.completed };
    }

    setTasks(prev => prev.map(t => t.id === baseId ? updatedTask : t));
    await saveTaskBackend(updatedTask);
  };

  const moveTask = async (instanceId, days) => {
    const baseId = instanceId.split('_')[0];
    const task = tasks.find(t => t.id === baseId);
    if (!task) return;
    
    const updatedTask = { ...task, dueDate: addDays(task.dueDate, days) };
    setTasks(prev => prev.map(t => t.id === baseId ? updatedTask : t));
    await saveTaskBackend(updatedTask);
  };

  const saveTask = async (taskData) => {
    const id = taskData.id || Date.now().toString();
    const cleanedData = {
        ...taskData,
        id,
        completedDates: taskData.completedDates || []
    };
    
    if (taskData.id) setTasks(prev => prev.map(t => t.id === id ? cleanedData : t));
    else setTasks(prev => [...prev, cleanedData]);
    
    await saveTaskBackend(cleanedData);
    setIsModalOpen(false);
  };

  const deleteTask = async (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    if (useServer) {
        try { await fetch(`/api/tasks/${id}`, { method: 'DELETE' }); } 
        catch (err) { console.error('Error deleting task:', err); }
    }
    setIsModalOpen(false);
  };

  const openNewTaskModal = (dateStr) => {
    setEditingTask({
      name: '', completed: false, completedDates: [], recurrence: 'none', recurrenceInterval: 1, timeEstimate: 1.0, priority: 'Medium', notes: '', dueDate: dateStr
    });
    setIsModalOpen(true);
  };

  const editTask = (instance) => {
    const baseTask = tasks.find(t => t.id === instance.id);
    setEditingTask(baseTask);
    setIsModalOpen(true);
  };

  const handlePrint = () => {
    setIsPrintModalOpen(false);
    setTimeout(() => window.print(), 100);
  };

  const printTasks = getProjectedTasksForColumn(printTargetDate, tasks, todayStr).sort(sortTaskHierarchy);

  return (
    <>
      {/* Printable Area */}
      <div className="hidden print:block print:p-8 text-black bg-white min-h-screen" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
        <h1 className="text-2xl font-bold mb-6 border-b-2 border-black pb-2">
          Daily Tasks - {new Date(printTargetDate + 'T12:00:00').toLocaleDateString()}
        </h1>
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-black p-1.5 text-center w-12">Done?</th>
              <th className="border border-black p-1.5 text-left">Task</th>
              <th className="border border-black p-1.5 text-left w-20">Priority</th>
              <th className="border border-black p-1.5 text-center w-20">Time (Hours)</th>
              <th className="border border-black p-1.5 text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            {printTasks.map((task, index) => {
              let printBg = index % 2 === 0 ? 'bg-white' : 'bg-gray-50'; // Default subtle alternating for info/none
              if (task.priority === 'High') printBg = 'bg-gray-300 font-bold';
              else if (task.priority === 'Medium') printBg = 'bg-gray-200 font-semibold';
              else if (task.priority === 'Low') printBg = 'bg-gray-100';

              return (
                <tr key={task.instanceId} className={printBg}>
                  <td className="border border-black p-1.5 text-center">
                    <div className={`w-4 h-4 border border-black mx-auto ${task.completed ? 'bg-black' : ''}`}></div>
                  </td>
                  <td className={`border border-black p-1.5 ${task.completed ? 'line-through text-gray-500 font-normal' : ''}`}>
                    {task.name} {task.recurrence !== 'none' && '(R)'}
                  </td>
                  <td className="border border-black p-1.5">{task.priority}</td>
                  <td className="border border-black p-1.5 text-center">{Number(parseFloat(task.timeEstimate).toFixed(2))}</td>
                  <td className="border border-black p-1.5">{task.notes}</td>
                </tr>
              );
            })}
            {Array.from({ length: Math.max(0, 22 - printTasks.length) }).map((_, i) => {
              const globalIndex = printTasks.length + i;
              return (
                <tr key={`empty-${i}`} className={`h-8 ${globalIndex % 2 === 0 ? 'bg-white' : 'bg-gray-100'}`}>
                  <td className="border border-black p-1.5 text-center">
                    <div className="w-4 h-4 border border-black mx-auto"></div>
                  </td>
                  <td className="border border-black p-1.5"></td>
                  <td className="border border-black p-1.5"></td>
                  <td className="border border-black p-1.5"></td>
                  <td className="border border-black p-1.5"></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Screen UI */}
      <div className="min-h-screen bg-slate-900 flex flex-col font-sans print:hidden">
        {/* Header */}
        <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Task Tracker</h1>
            <p className="text-sm text-slate-400">Plan your week down to the decimal</p>
          </div>
          <div className="flex gap-2">
            {boardStartDate !== todayStr && (
              <button 
                type="button"
                onClick={() => setBoardStartDate(todayStr)}
                className="bg-slate-800 border border-slate-600 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-medium flex items-center transition-colors shadow-sm"
              >
                Today
              </button>
            )}
            <button 
              type="button"
              onClick={advanceUncompletedTasks}
              title="Move today's incomplete tasks to tomorrow"
              className="bg-slate-800 border border-slate-600 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-medium flex items-center transition-colors shadow-sm"
            >
              <ArrowRight size={20} className="mr-2 sm:mr-0 lg:mr-1" /> <span className="hidden lg:inline">Move Forward</span>
            </button>
            <button 
              type="button"
              onClick={() => setIsCalendarModalOpen(true)}
              className="bg-slate-800 border border-slate-600 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-medium flex items-center transition-colors shadow-sm"
            >
              <Calendar size={20} className="mr-2 sm:mr-0 lg:mr-1" /> <span className="hidden lg:inline">Jump</span>
            </button>
            <button 
              type="button"
              onClick={() => {
                setPrintTargetDate(addDays(todayStr, 1));
                setIsPrintModalOpen(true);
              }}
              className="bg-slate-800 border border-slate-600 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-medium flex items-center transition-colors shadow-sm"
            >
              <Printer size={20} className="mr-2 sm:mr-1" /> <span className="hidden sm:inline">Print</span>
            </button>
            <button 
              type="button"
              onClick={() => openNewTaskModal(addDays(todayStr, 1))}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors shadow-sm"
            >
              <Plus size={20} className="mr-1" /> <span className="hidden sm:inline">Add Task</span>
            </button>
          </div>
        </header>

        {/* Main Board */}
        <main ref={containerRef} className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex h-full p-4 gap-4 snap-x snap-mandatory items-start w-max min-h-[calc(100vh-80px)]">
            {columns.map(col => {
              const columnTasks = getProjectedTasksForColumn(col.dateStr, tasks, todayStr);
              const totalHours = columnTasks
                .filter(t => t.priority !== 'Info')
                .reduce((sum, t) => sum + parseFloat(t.timeEstimate || 0), 0);

              return (
                <div 
                  key={col.dateStr}
                  style={{ width: `${colWidth}px` }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, col.dateStr)}
                  className="bg-slate-800/50 border border-slate-700 rounded-xl flex flex-col max-h-full shrink-0 snap-center shadow-sm transition-all"
                >
                  {/* Column Header */}
                  <div className={`p-3 border-b border-slate-700 rounded-t-xl ${col.isToday ? 'bg-blue-900/20' : 'bg-slate-800'}`}>
                    <div className="flex justify-between items-end mb-1">
                      <h2 className="font-bold text-slate-200 flex items-center gap-2">
                        {col.label}
                        {col.isToday && <span className="text-[10px] uppercase tracking-wider bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">Current</span>}
                      </h2>
                      <span className="text-sm font-medium text-slate-400">{col.shortDate}</span>
                    </div>
                    <div className="text-sm font-medium text-slate-300 bg-slate-700/50 inline-block px-2 py-1 rounded-md mt-1 border border-slate-600/50">
                      {Number(totalHours.toFixed(2))} hrs planned
                    </div>
                  </div>

                  {/* Task List */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {columnTasks.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 text-sm border-2 border-dashed border-slate-700 rounded-lg">
                        No tasks scheduled
                      </div>
                    ) : (
                      columnTasks.sort(sortTaskHierarchy).map(task => (
                        <TaskCard 
                          key={task.instanceId}
                          task={task}
                          isPastDue={task.isOverdue}
                          onToggle={() => toggleCompletion(task)}
                          onEdit={() => editTask(task)}
                          onDragStart={(e) => handleDragStart(e, task.instanceId)}
                          onMove={(days) => moveTask(task.instanceId, days)}
                        />
                      ))
                    )}
                    
                    <button 
                      onClick={() => openNewTaskModal(col.dateStr)}
                      className="w-full py-2 flex items-center justify-center text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors border border-transparent hover:border-slate-600 dashed"
                    >
                      <Plus size={16} className="mr-1" /> Add to {col.isToday ? 'Today' : col.label}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        {/* Edit/Add Modal */}
        {isModalOpen && (
          <TaskModal 
            task={editingTask} 
            onSave={saveTask} 
            onClose={() => setIsModalOpen(false)} 
            onDelete={deleteTask}
          />
        )}

        {/* Print Selection Modal */}
        {isPrintModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex justify-center items-center p-4 z-50">
            <div className="bg-slate-800 rounded-xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-700">
              <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-900/50">
                <h2 className="text-lg font-bold text-slate-100">Print Tasks</h2>
                <button onClick={() => setIsPrintModalOpen(false)} className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-700 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-sm text-slate-400 mb-4">Select which day's tasks you would like to print in a tabular format.</p>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Day to Print</label>
                  <select 
                    value={printTargetDate}
                    onChange={(e) => setPrintTargetDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={addDays(todayStr, 1)}>Tomorrow</option>
                    <option value={todayStr}>Today</option>
                  </select>
                </div>
                <div className="pt-4 flex justify-end gap-2 border-t border-slate-700 mt-6">
                  <button 
                    onClick={() => setIsPrintModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handlePrint}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm flex items-center"
                  >
                    <Printer size={16} className="mr-2" /> Print Page
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Calendar Selection Modal */}
        {isCalendarModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex justify-center items-center p-4 z-50">
            <div className="bg-slate-800 rounded-xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-700">
              <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-900/50">
                <h2 className="text-lg font-bold text-slate-100">Jump to Date</h2>
                <button onClick={() => setIsCalendarModalOpen(false)} className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-700 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-sm text-slate-400 mb-4">Select the starting date for your 7-day board view.</p>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Start Date</label>
                  <input 
                    type="date"
                    value={boardStartDate}
                    onChange={(e) => setBoardStartDate(e.target.value)}
                    style={{ colorScheme: 'dark' }}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="pt-4 flex justify-end gap-2 border-t border-slate-700 mt-6">
                  <button 
                    onClick={() => {
                      setBoardStartDate(todayStr);
                      setIsCalendarModalOpen(false);
                    }}
                    className="px-4 py-2 text-sm font-medium text-blue-400 hover:bg-slate-700 rounded-lg transition-colors mr-auto"
                  >
                    Reset to Today
                  </button>
                  <button 
                    onClick={() => setIsCalendarModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                  >
                    View Date
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// --- Task Card Component ---
function TaskCard({ task, isPastDue, onToggle, onEdit, onDragStart, onMove }) {
  const pStyle = PRIORITIES[task.priority];

  return (
    <div 
      draggable
      onDragStart={onDragStart}
      className={`bg-slate-800 border p-3 rounded-lg shadow-sm group cursor-grab active:cursor-grabbing transition-all ${task.completed ? 'opacity-60 border-slate-700' : isPastDue ? 'border-red-500/50' : 'border-slate-700 hover:border-blue-500'}`}
    >
      <div className="flex items-start gap-3">
        <button onClick={onToggle} className="mt-0.5 text-slate-500 hover:text-blue-400 transition-colors shrink-0">
          {task.completed ? <CheckCircle2 className="text-green-500" size={20} /> : <Circle size={20} />}
        </button>
        
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-1 gap-2">
            <h3 className={`font-semibold text-sm leading-tight break-words flex items-start gap-1.5 ${task.completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
              {task.recurrence !== 'none' && <RefreshCw size={12} className="text-blue-400 mt-1 shrink-0" />}
              {task.name}
            </h3>
            <button onClick={onEdit} className="text-slate-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
              <Edit2 size={14} />
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2 mt-2 items-center">
            <span className={`text-xs px-2 py-0.5 rounded-md font-medium border flex items-center gap-1 ${pStyle.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${pStyle.dot}`}></span>
              {task.priority}
            </span>
            
            <span className="text-xs flex items-center text-slate-300 bg-slate-700/50 px-2 py-0.5 rounded-md font-medium border border-slate-600">
              <Clock size={12} className="mr-1" />
              {Number(parseFloat(task.timeEstimate).toFixed(2))}h
            </span>

            {isPastDue && (
              <span className="text-xs flex items-center text-red-400 bg-red-900/30 px-2 py-0.5 rounded-md font-medium border border-red-800/50">
                <AlertCircle size={12} className="mr-1" /> Overdue
              </span>
            )}
          </div>
          
          {task.notes && (
            <p className="text-xs text-slate-400 mt-2 line-clamp-2 flex items-start">
              <AlignLeft size={12} className="mr-1 mt-0.5 shrink-0" />
              {task.notes}
            </p>
          )}
        </div>
      </div>

      {/* Mobile Move Controls */}
      <div className="mt-3 pt-2 border-t border-slate-700 flex justify-between opacity-0 group-hover:opacity-100 lg:hidden group-hover:flex transition-opacity">
        <button onClick={() => onMove(-1)} className="p-1 text-slate-500 hover:text-blue-400 hover:bg-blue-900/30 rounded"><ChevronLeft size={16}/></button>
        <div className="text-[10px] text-slate-500 font-medium uppercase tracking-widest flex items-center">Shift Schedule</div>
        <button onClick={() => onMove(1)} className="p-1 text-slate-500 hover:text-blue-400 hover:bg-blue-900/30 rounded"><ChevronRight size={16}/></button>
      </div>
    </div>
  );
}

// --- Task Modal Component ---
function TaskModal({ task, onSave, onClose, onDelete }) {
  const [formData, setFormData] = useState(task || {
    name: '', completed: false, completedDates: [], recurrence: 'none', recurrenceInterval: 1, timeEstimate: 1.0, priority: 'Medium', notes: '', dueDate: getTodayStr()
  });
  
  const inputRef = useRef(null);

  // Auto-focus logic for text box
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanedData = {
      ...formData,
      timeEstimate: Math.max(0, parseFloat(formData.timeEstimate) || 0),
      recurrenceInterval: Math.max(1, parseInt(formData.recurrenceInterval, 10) || 1)
    };
    onSave(cleanedData);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex justify-center items-center p-4 z-50">
      <div className="bg-slate-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-700">
        <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-900/50">
          <h2 className="text-lg font-bold text-slate-100">{formData.id ? 'Edit' : 'New'} Task</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form 
          onSubmit={handleSubmit} 
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              handleSubmit(e);
            }
          }}
          className="p-5 space-y-4"
        >
          {/* 1. Task Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1">Task Name</label>
            <input 
              ref={inputRef}
              required
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              placeholder="What needs to be done?"
            />
          </div>

          {/* 2. Priority & Time Estimate */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-300 mb-1">Priority</label>
              <select 
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
                <option value="Info">Info</option>
              </select>
            </div>
            
            <div className="w-1/3">
              <label className="block text-sm font-semibold text-slate-300 mb-1">Est. Hours</label>
              <input 
                type="number"
                required
                step="0.01"
                min="0"
                name="timeEstimate"
                value={formData.timeEstimate}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 3. Notes */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1">Notes</label>
            <textarea 
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Add any extra details here..."
            ></textarea>
          </div>

          {/* 4. Start Date & Recurrence */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-300 mb-1">Start Date</label>
              <input 
                type="date"
                required
                name="dueDate"
                value={formData.dueDate}
                onChange={handleChange}
                style={{ colorScheme: 'dark' }}
                className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-300 mb-1">Recurrence</label>
              <select 
                name="recurrence"
                value={formData.recurrence || 'none'}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">None (One-time)</option>
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays</option>
                <option value="weekends">Weekends</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="last_weekday">Last Weekday of Month</option>
                <option value="last_of_day">Last {formData.dueDate ? new Date(formData.dueDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }) : 'Day'} of Month</option>
              </select>

              {['daily', 'weekly', 'monthly', 'yearly'].includes(formData.recurrence) && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-slate-400">Every</span>
                  <input 
                    type="number" 
                    min="1" 
                    name="recurrenceInterval" 
                    value={formData.recurrenceInterval || 1} 
                    onChange={handleChange}
                    className="w-16 bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                  />
                  <span className="text-sm text-slate-400">
                    {formData.recurrence === 'daily' ? 'days' : formData.recurrence === 'weekly' ? 'weeks' : formData.recurrence === 'monthly' ? 'months' : 'years'}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 flex justify-between items-center border-t border-slate-700 mt-6">
            {formData.id ? (
              <button 
                type="button"
                onClick={() => onDelete(formData.id)}
                className="text-red-400 text-sm font-medium hover:text-red-300 hover:bg-red-900/30 px-3 py-1.5 rounded-lg transition-colors"
              >
                Delete Task
              </button>
            ) : <div></div>}
            
            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
              >
                Save Task
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
