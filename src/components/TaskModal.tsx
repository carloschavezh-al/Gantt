import React, { useState, useEffect } from 'react';
import { Task } from '../types';
import { TASK_COLORS, DEFAULT_CATEGORIES } from '../data/initialData';
import { X, Calendar, User, Tag, Sparkles, Check, Link2 } from 'lucide-react';
import { getValidPredecessors, getTaskEndDay } from '../utils/dependencyHelper';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: Omit<Task, 'id'> & { id?: string }) => void;
  initialTask?: Task | null;
  totalDays: number;
  allTasks?: Task[];
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTask,
  totalDays,
  allTasks = [],
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0].name);
  const [assignee, setAssignee] = useState('');
  const [startDay, setStartDay] = useState(1);
  const [duration, setDuration] = useState(3);
  const [color, setColor] = useState('indigo');
  const [isMilestone, setIsMilestone] = useState(false);
  const [notes, setNotes] = useState('');
  const [dependsOn, setDependsOn] = useState('');

  // Filter tasks that can be valid predecessors (avoiding cycles)
  const availablePredecessors = getValidPredecessors(allTasks, initialTask?.id);

  useEffect(() => {
    if (initialTask) {
      setName(initialTask.name);
      setCategory(initialTask.category);
      setAssignee(initialTask.assignee || '');
      setStartDay(initialTask.startDay);
      setDuration(initialTask.duration);
      setColor(initialTask.color);
      setIsMilestone(!!initialTask.isMilestone);
      setNotes(initialTask.notes || '');
      setDependsOn(initialTask.dependsOn || '');
    } else {
      setName('');
      setCategory(DEFAULT_CATEGORIES[0].name);
      setAssignee('');
      setStartDay(1);
      setDuration(3);
      setColor('indigo');
      setIsMilestone(false);
      setNotes('');
      setDependsOn('');
    }
  }, [initialTask, isOpen]);

  // Handle dependency selection change
  const handleDependencyChange = (predecessorId: string) => {
    setDependsOn(predecessorId);
    if (predecessorId) {
      const pred = allTasks.find((t) => t.id === predecessorId);
      if (pred) {
        const predEnd = getTaskEndDay(pred);
        setStartDay(Math.max(1, predEnd + 1));
      }
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      ...(initialTask ? { id: initialTask.id } : {}),
      name: name.trim(),
      category,
      assignee: assignee.trim() || undefined,
      startDay: Math.max(1, startDay),
      duration: isMilestone ? 1 : Math.max(1, duration),
      progress: initialTask ? initialTask.progress : 0,
      color,
      isMilestone,
      notes: notes.trim() || undefined,
      dependsOn: dependsOn || undefined,
    });
    onClose();
  };

  const endDay = isMilestone ? startDay : startDay + Math.max(1, duration) - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              {initialTask ? 'Editar Actividad' : 'Nueva Actividad'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configura el plazo en días y los detalles de la tarea
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-sm">
          {/* Nombre de la tarea */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Nombre de la Tarea / Actividad *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Elaborar cronograma de entrega"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-slate-900 text-sm focus:outline-hidden focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600"
              autoFocus
            />
          </div>

          {/* Categoría y Responsable */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                Categoría / Fase
              </label>
              <input
                type="text"
                list="category-suggestions"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Fase o grupo"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-slate-900 text-sm focus:outline-hidden focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600"
              />
              <datalist id="category-suggestions">
                {DEFAULT_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Responsable
              </label>
              <input
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Ej. Ana M. / Equipo"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-slate-900 text-sm focus:outline-hidden focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600"
              />
            </div>
          </div>

          {/* Tipo de hito */}
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-slate-50 border border-slate-200">
            <input
              type="checkbox"
              id="isMilestone"
              checked={isMilestone}
              onChange={(e) => setIsMilestone(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
            <label htmlFor="isMilestone" className="text-xs text-slate-700 cursor-pointer flex items-center gap-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Marcar como Hito / Entrega clave (Duración de 1 día)
            </label>
          </div>

          {/* Dependencia de otra Actividad */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-md p-3 space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Link2 className="w-4 h-4 text-indigo-600" />
                Dependencia de otra actividad (Predecesora)
              </span>
              {dependsOn && (
                <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  Vinculada
                </span>
              )}
            </label>

            <select
              value={dependsOn}
              onChange={(e) => handleDependencyChange(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-slate-900 text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600"
            >
              <option value="">Sin dependencia (Actividad independiente)</option>
              {availablePredecessors.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.name} • (Termina Día {getTaskEndDay(task)})
                </option>
              ))}
            </select>
          </div>

          {/* Plazos de Días (Día de inicio y duración) */}
          <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-600" />
                Plazos en Días (Columnas)
              </span>
              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                Día {startDay} → Día {endDay} ({isMilestone ? '1 día' : `${duration} ${duration === 1 ? 'día' : 'días'}`})
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Día de Inicio
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-semibold text-slate-500">
                    Día
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={totalDays}
                    value={startDay}
                    onChange={(e) => setStartDay(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full pl-12 pr-3 py-1.5 bg-white border border-slate-200 rounded-md text-slate-900 text-sm font-semibold focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
              </div>

              {!isMilestone && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Duración (Días)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={totalDays - startDay + 1}
                      value={duration}
                      onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-slate-900 text-sm font-semibold focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-500 pointer-events-none">
                      {duration === 1 ? 'día' : 'días'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Selector de Color */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Color Distintivo de la Barra
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {Object.keys(TASK_COLORS).map((colorKey) => {
                const colorConfig = TASK_COLORS[colorKey];
                const isSelected = color === colorKey;
                return (
                  <button
                    key={colorKey}
                    type="button"
                    onClick={() => setColor(colorKey)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                      colorConfig.bg
                    } ${isSelected ? 'ring-3 ring-offset-2 ring-indigo-500 scale-110 shadow-xs' : 'opacity-80 hover:opacity-100'}`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notas u observaciones */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Notas adicionales (opcional)
            </label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalles sobre entregables, dependencias o criterios de aceptación..."
              className="w-full min-h-[90px] px-3 py-2 bg-white border border-slate-200 rounded-md text-slate-900 text-xs leading-relaxed focus:outline-hidden focus:ring-1 focus:ring-indigo-600 resize-y"
            />
          </div>

          {/* Footer buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors shadow-xs"
            >
              {initialTask ? 'Guardar Cambios' : 'Crear Actividad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
