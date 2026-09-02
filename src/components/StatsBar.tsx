import React from 'react';
import { Task } from '../types';
import { Calendar, ListTodo, Layers, Sparkles } from 'lucide-react';

interface StatsBarProps {
  tasks: Task[];
  totalDays: number;
  currentDay: number | null;
}

export const StatsBar: React.FC<StatsBarProps> = ({ tasks, totalDays, currentDay }) => {
  const totalTasks = tasks.length;
  const uniqueCategories = new Set(tasks.map((t) => t.category)).size;
  const milestonesCount = tasks.filter((t) => t.isMilestone).length;

  return (
    <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-700">
            <ListTodo className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-slate-500">Actividades:</span>
            <span className="font-semibold text-slate-900">{totalTasks}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-700">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500">Fases:</span>
            <span className="font-semibold text-slate-800">{uniqueCategories}</span>
          </div>

          {milestonesCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50/70 border border-amber-200/80 text-amber-800">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-amber-700">Hitos:</span>
              <span className="font-semibold text-amber-900">{milestonesCount}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400">
            <span>Arrastra barras o usa flechas para definir el orden</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-slate-500">Plazo total:</span>
            <span className="font-bold text-slate-900">{totalDays} días</span>
            {currentDay && (
              <span className="ml-1 px-1.5 py-0.2 rounded bg-indigo-600 text-white text-[11px] font-semibold">
                Día {currentDay}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

