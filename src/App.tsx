import React, { useState, useEffect, useRef } from 'react';
import { Task, ZoomLevel } from './types';
import { INITIAL_TASKS } from './data/initialData';
import { GanttHeader } from './components/GanttHeader';
import { GanttChart } from './components/GanttChart';
import { TaskModal } from './components/TaskModal';
import { recalculateDependencies, getTaskEndDay } from './utils/dependencyHelper';
import { exportGanttToExcel } from './utils/excelExport';
import {
  getActiveProjectId,
  subscribeToProject,
  saveProjectToCloud,
  ensureAuth,
} from './firebase';

const STORAGE_KEY_TASKS = 'gantt_activities_tasks';
const STORAGE_KEY_CONFIG = 'gantt_activities_config';

export default function App() {
  const projectId = getActiveProjectId();

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

  // Cloud Sync & Realtime state
  const [cloudStatus, setCloudStatus] = useState<'synced' | 'saving' | 'offline' | 'error'>('offline');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Flags to avoid sync loops and ensure atomic updates
  const lastSyncedJson = useRef<string>('');
  const isInitialCloudLoaded = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Persist tasks to localStorage as local cache
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
    } catch (e) {
      console.error('Error saving tasks locally:', e);
    }
  }, [tasks]);

  // Persist config to localStorage as local cache
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY_CONFIG,
        JSON.stringify({ projectName, totalDays, currentDay })
      );
    } catch (e) {
      console.error('Error saving config locally:', e);
    }
  }, [projectName, totalDays, currentDay]);

  // Subscribe to Firebase Firestore real-time updates
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    async function initCloud() {
      try {
        await ensureAuth();
        setCloudStatus('saving');

        unsubscribe = subscribeToProject(
          projectId,
          (cloudData) => {
            if (cloudData !== null) {
              // Existing shared project in Firestore
              const serialized = JSON.stringify({
                projectName: cloudData.projectName,
                totalDays: cloudData.totalDays,
                currentDay: cloudData.currentDay,
                tasks: cloudData.tasks,
              });
              lastSyncedJson.current = serialized;

              setTasks(recalculateDependencies(cloudData.tasks));
              if (cloudData.projectName) setProjectName(cloudData.projectName);
              if (typeof cloudData.totalDays === 'number') setTotalDays(cloudData.totalDays);
              if (typeof cloudData.currentDay !== 'undefined') setCurrentDay(cloudData.currentDay);

              if (cloudData.updatedAt) {
                try {
                  const date = new Date(cloudData.updatedAt);
                  setLastSavedTime(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                } catch {}
              }
              setCloudStatus('synced');
              isInitialCloudLoaded.current = true;
              setIsInitialLoading(false);
            } else {
              // First time project on Firestore: create cloud document from initial tasks
              const initialPayload = {
                projectName,
                totalDays,
                currentDay,
                tasks,
              };
              saveProjectToCloud(projectId, initialPayload)
                .then(() => {
                  lastSyncedJson.current = JSON.stringify(initialPayload);
                  isInitialCloudLoaded.current = true;
                  setCloudStatus('synced');
                  setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                  setIsInitialLoading(false);
                })
                .catch((err) => {
                  console.error('Error creating initial project on Firebase:', err);
                  setCloudStatus('error');
                  setIsInitialLoading(false);
                });
            }
          },
          (err) => {
            console.error('Firebase subscription error:', err);
            setCloudStatus('error');
            setIsInitialLoading(false);
          }
        );
      } catch (err) {
        console.error('Failed to initialize Firebase Auth/Firestore:', err);
        setCloudStatus('error');
        setIsInitialLoading(false);
      }
    }

    initCloud();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [projectId]);

  // Flush any pending save before closing the window/tab
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isInitialCloudLoaded.current && saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveProjectToCloud(projectId, {
          projectName,
          totalDays,
          currentDay,
          tasks,
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [projectId, projectName, totalDays, currentDay, tasks]);

  // Automatically sync user modifications to Firestore
  useEffect(() => {
    if (!isInitialCloudLoaded.current) {
      return;
    }

    const currentJson = JSON.stringify({
      projectName,
      totalDays,
      currentDay,
      tasks,
    });

    // Avoid syncing if this state change came directly from Firestore
    if (currentJson === lastSyncedJson.current) {
      return;
    }

    setCloudStatus('saving');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveProjectToCloud(projectId, {
          projectName,
          totalDays,
          currentDay,
          tasks,
        });
        lastSyncedJson.current = currentJson;
        setCloudStatus('synced');
        setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } catch (err) {
        console.error('Error saving to Firebase Firestore:', err);
        setCloudStatus('error');
      }
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [tasks, projectName, totalDays, currentDay, projectId]);

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

      // Sync reset to cloud
      saveProjectToCloud(projectId, {
        projectName: 'Cronograma de Actividades',
        totalDays: 20,
        currentDay: null,
        tasks: reset,
      }).catch((err) => console.error('Error syncing reset to cloud:', err));
    }
  };

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const handleExportExcel = () => {
    exportGanttToExcel(projectName, tasks, totalDays);
  };

  // Guardar archivo de proyecto en JSON descargable y forzar guardado en la nube
  const handleSaveProject = async () => {
    try {
      setCloudStatus('saving');
      // Forzar guardado inmediato en Firebase Firestore
      await saveProjectToCloud(projectId, {
        projectName,
        totalDays,
        currentDay,
        tasks,
      });
      lastSyncedJson.current = JSON.stringify({ projectName, totalDays, currentDay, tasks });
      setCloudStatus('synced');
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

      // Descargar copia de respaldo local .json
      const projectData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        projectName: projectName.trim() || 'Cronograma de Actividades',
        totalDays,
        currentDay,
        tasks,
      };

      const jsonStr = JSON.stringify(projectData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      const safeName = (projectName.trim() || 'Proyecto')
        .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]/g, '_');
      
      link.href = url;
      link.download = `${safeName}_Gantt.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showNotification('¡Proyecto guardado en la nube y descargado como respaldo (.json)!');
    } catch (err) {
      console.error('Error al guardar proyecto:', err);
      showNotification('Error al guardar el proyecto en la nube', 'error');
      setCloudStatus('error');
    }
  };

  // Cargar archivo de proyecto desde JSON
  const handleLoadProject = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        if (!content) throw new Error('Archivo vacío');
        
        const data = JSON.parse(content);
        if (!data || !Array.isArray(data.tasks)) {
          throw new Error('El archivo no contiene un formato de cronograma válido');
        }

        const loadedTasks = recalculateDependencies(data.tasks);
        const loadedProjectName = typeof data.projectName === 'string' ? data.projectName : projectName;
        const loadedTotalDays = typeof data.totalDays === 'number' && data.totalDays >= 5 ? Math.min(60, data.totalDays) : totalDays;
        const loadedCurrentDay = typeof data.currentDay !== 'undefined' ? data.currentDay : currentDay;

        setTasks(loadedTasks);
        setProjectName(loadedProjectName);
        setTotalDays(loadedTotalDays);
        setCurrentDay(loadedCurrentDay);

        // Immediate cloud push so all connected users see the restored project
        await saveProjectToCloud(projectId, {
          projectName: loadedProjectName,
          totalDays: loadedTotalDays,
          currentDay: loadedCurrentDay,
          tasks: loadedTasks,
        });

        lastSyncedJson.current = JSON.stringify({
          projectName: loadedProjectName,
          totalDays: loadedTotalDays,
          currentDay: loadedCurrentDay,
          tasks: loadedTasks,
        });

        setCloudStatus('synced');
        setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        showNotification(`¡Proyecto "${loadedProjectName}" cargado y sincronizado en la nube!`);
      } catch (err) {
        console.error('Error al cargar proyecto:', err);
        showNotification('Error al leer el archivo. Asegúrate de seleccionar un archivo .json válido', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleShareLink = () => {
    try {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('project', projectId);
      const url = currentUrl.toString();

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url);
        showNotification('¡Enlace único del proyecto copiado! Todos los que accedan verán y modificarán la misma información.');
      } else {
        window.prompt('Copia este enlace para compartir el cronograma colaborativo:', url);
      }
    } catch (err) {
      console.error('Error copying link:', err);
      showNotification('No se pudo copiar el enlace automáticamente', 'error');
    }
  };

  if (isInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full bg-slate-50 text-slate-700">
        <div className="flex flex-col items-center gap-3 p-6 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-center">
            <h2 className="text-sm font-semibold text-slate-800">Conectando con la nube...</h2>
            <p className="text-xs text-slate-500 mt-0.5">Cargando el cronograma compartido en tiempo real</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-800 font-sans antialiased overflow-hidden relative">
      {/* Toast Notification */}
      {notification && (
        <div className="absolute top-16 right-6 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div
            className={`px-4 py-2.5 rounded-lg shadow-lg text-xs font-semibold flex items-center gap-2 border ${
              notification.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <span>{notification.message}</span>
          </div>
        </div>
      )}

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
        onSaveProject={handleSaveProject}
        onLoadProject={handleLoadProject}
        cloudStatus={cloudStatus}
        lastSavedTime={lastSavedTime}
        onShareLink={handleShareLink}
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
