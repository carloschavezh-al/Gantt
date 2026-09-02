import React, { useState, useEffect } from 'react';
import { Task, ZoomLevel } from './types';
import { INITIAL_TASKS } from './data/initialData';
import { GanttHeader } from './components/GanttHeader';
import { GanttChart } from './components/GanttChart';
import { TaskModal } from './components/TaskModal';
import { recalculateDependencies, getTaskEndDay } from './utils/dependencyHelper';
import { exportGanttToExcel } from './utils/excelExport';

const STORAGE_KEY_TASKS = 'gantt_activities_tasks';
const STORAGE_KEY_CONFIG = 'gantt_activities_config';

export default function App() {
  // Initialize tasks from localStorage or default
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TASKS);
      if (saved) {
        return recalculateDependencies(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error loading saved tasks:', e);
    }
    return recalculateDependencies(INITIAL_TASKS);
  });

  // Project Configuration
  const [projectName, setProjectName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        const config = JSON.parse(saved);
        if (config.projectName) return config.projectName;
      }
    } catch {}
    return 'Cronograma de Actividades';
  });

  const [totalDays, setTotalDays] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        const config = JSON.parse(saved);
        if (typeof config.totalDays === 'number') return config.totalDays;
      }
    } catch {}
    return 20;
  });

  const [currentDay, setCurrentDay] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        const config = JSON.parse(saved);
        if (typeof config.currentDay !== 'undefined') return config.currentDay;
      }
    } catch {}
    return null;
  });

  const [zoom, setZoom] = useState<ZoomLevel>('normal');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Persist tasks to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
    } catch (e) {
      console.error('Error saving tasks:', e);
    }
  }, [tasks]);

  // Persist config to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY_CONFIG,
        JSON.stringify({ projectName, totalDays, currentDay })
      );
    } catch (e) {
      console.error('Error saving config:', e);
    }
  }, [projectName, totalDays, currentDay]);

  // Handlers
  const handleAddTask = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleSaveTask = (taskData: Omit<Task, 'id'> & { id?: string }) => {
    let updatedTasks: Task[];
    if (taskData.id) {
      // Update existing
      updatedTasks = tasks.map((t) =>
        t.id === taskData.id ? ({ ...t, ...taskData } as Task) : t
      );
    } else {
      // Create new
      const newTask: Task = {
        ...taskData,
        id: `task-${Date.now()}`,
      };
      updatedTasks = [...tasks, newTask];
    }

    const recalculated = recalculateDependencies(updatedTasks);
    setTasks(recalculated);

    // Auto-adjust totalDays if needed
    const maxEndDay = Math.max(...recalculated.map((t) => getTaskEndDay(t)), totalDays);
    if (maxEndDay > totalDays) {
      setTotalDays(Math.min(60, maxEndDay));
    }
  };

  const handleUpdateTask = (updatedTask: Task) => {
    const updated = tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t));
    const recalculated = recalculateDependencies(updated);
    setTasks(recalculated);

    const maxEndDay = Math.max(...recalculated.map((t) => getTaskEndDay(t)), totalDays);
    if (maxEndDay > totalDays) {
      setTotalDays(Math.min(60, maxEndDay));
    }
  };

  const handleDeleteTask = (taskId: string) => {
    // When deleting a task, clear dependsOn for tasks that depended on it
    const filtered = tasks
      .filter((t) => t.id !== taskId)
      .map((t) => (t.dependsOn === taskId ? { ...t, dependsOn: undefined } : t));
    setTasks(recalculateDependencies(filtered));
  };

  const handleDuplicateTask = (task: Task) => {
    const newTask: Task = {
      ...task,
      id: `task-${Date.now()}`,
      name: `${task.name} (Copia)`,
      startDay: Math.min(totalDays, task.startDay + 1),
      dependsOn: undefined, // duplicate is independent by default
    };
    setTasks((prev) => [...prev, newTask]);
  };

  const handleReorderTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
  };

  const handleResetData = () => {
    if (window.confirm('¿Deseas restablecer el cronograma con las actividades predeterminadas?')) {
      const reset = recalculateDependencies(INITIAL_TASKS);
      setTasks(reset);
      setTotalDays(20);
      setCurrentDay(null);
      setProjectName('Cronograma de Actividades');
    }
  };

  const handleExportExcel = () => {
    exportGanttToExcel(projectName, tasks, totalDays);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-800 font-sans antialiased overflow-hidden">
      {/* Header bar with controls */}
      <GanttHeader
        projectName={projectName}
        onProjectNameChange={setProjectName}
        totalDays={totalDays}
        onTotalDaysChange={setTotalDays}
        currentDay={currentDay}
        onCurrentDayChange={setCurrentDay}
        zoom={zoom}
        onZoomChange={setZoom}
        onAddTask={handleAddTask}
        onResetData={handleResetData}
        onExportExcel={handleExportExcel}
      />

      {/* Gantt Interactive Board */}
      <GanttChart
        tasks={tasks}
        totalDays={totalDays}
        currentDay={currentDay}
        zoom={zoom}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        onDuplicateTask={handleDuplicateTask}
        onEditTask={handleEditTask}
        onReorderTasks={handleReorderTasks}
      />

      {/* Task Creation & Editing Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTask}
        initialTask={editingTask}
        totalDays={totalDays}
        allTasks={tasks}
      />
    </div>
  );
}
