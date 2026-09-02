import React from 'react';
import { ZoomLevel } from '../types';
import {
  Plus,
  RotateCcw,
  FileSpreadsheet,
  Printer,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface GanttHeaderProps {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  totalDays: number;
  onTotalDaysChange: (days: number) => void;
  currentDay: number | null;
  onCurrentDayChange: (day: number | null) => void;
  zoom: ZoomLevel;
  onZoomChange: (zoom: ZoomLevel) => void;
  onAddTask: () => void;
  onResetData: () => void;
  onExportExcel: () => void;
}

export const GanttHeader: React.FC<GanttHeaderProps> = ({
  projectName,
  onProjectNameChange,
  totalDays,
  onTotalDaysChange,
  currentDay,
  onCurrentDayChange,
  zoom,
  onZoomChange,
  onAddTask,
  onResetData,
  onExportExcel,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Project title & subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white shadow-xs shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={projectName}
                onChange={(e) => onProjectNameChange(e.target.value)}
                className="text-lg font-bold text-slate-900 tracking-tight border-b border-transparent hover:border-slate-300 focus:border-indigo-600 focus:outline-hidden px-1 -ml-1 rounded transition-colors"
                placeholder="Nombre del Proyecto"
              />
            </div>
            <p className="text-xs text-slate-500 px-1">
              Plazos diarios por columnas (Día 1, Día 2, etc.) con tareas a la izquierda
            </p>
          </div>
        </div>

        {/* Right: Actions toolbar */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Team Avatars indicator (Clean Minimalism) */}
          <div className="hidden xl:flex -space-x-1.5 mr-1 items-center" title="Miembros del equipo">
            <div className="w-6 h-6 rounded-full bg-blue-400 border-2 border-white shadow-2xs"></div>
            <div className="w-6 h-6 rounded-full bg-emerald-400 border-2 border-white shadow-2xs"></div>
            <div className="w-6 h-6 rounded-full bg-amber-400 border-2 border-white shadow-2xs"></div>
          </div>

          {/* Total Days control */}
          <div className="flex items-center bg-slate-50 rounded-md p-1 border border-slate-200 text-xs">
            <span className="text-slate-500 px-2 font-medium">Plazo:</span>
            <button
              onClick={() => onTotalDaysChange(Math.max(5, totalDays - 1))}
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded transition-colors disabled:opacity-30"
              disabled={totalDays <= 5}
              title="Reducir 1 día"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-bold text-slate-800 min-w-[48px] text-center">
              {totalDays} días
            </span>
            <button
              onClick={() => onTotalDaysChange(Math.min(60, totalDays + 1))}
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded transition-colors disabled:opacity-30"
              disabled={totalDays >= 60}
              title="Añadir 1 día"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Current Day selector */}
          <div className="flex items-center bg-slate-50 rounded-md p-1 border border-slate-200 text-xs">
            <span className="text-slate-500 px-1.5 font-medium">Hoy:</span>
            <select
              value={currentDay || ''}
              onChange={(e) => onCurrentDayChange(e.target.value ? parseInt(e.target.value) : null)}
              className="bg-white border border-slate-200 text-slate-800 text-xs rounded px-2 py-0.5 font-semibold focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Sin marcar</option>
              {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  Día {d}
                </option>
              ))}
            </select>
          </div>

          {/* Zoom Level */}
          <div className="flex items-center bg-slate-50 rounded-md p-0.5 border border-slate-200 text-xs">
            <button
              onClick={() => onZoomChange('compact')}
              className={`px-2 py-1 rounded transition-colors ${
                zoom === 'compact'
                  ? 'bg-white font-semibold text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Columnas compactas"
            >
              Compacto
            </button>
            <button
              onClick={() => onZoomChange('normal')}
              className={`px-2 py-1 rounded transition-colors ${
                zoom === 'normal'
                  ? 'bg-white font-semibold text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Columnas normales"
            >
              Normal
            </button>
            <button
              onClick={() => onZoomChange('wide')}
              className={`px-2 py-1 rounded transition-colors ${
                zoom === 'wide'
                  ? 'bg-white font-semibold text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Columnas amplias"
            >
              Amplio
            </button>
          </div>

          {/* Utilities & Export */}
          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
            <button
              onClick={() => window.print()}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
              title="Imprimir o guardar PDF"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onResetData}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
              title="Restablecer plantilla inicial"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Descargar en Excel */}
            <button
              onClick={onExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold transition-colors shadow-2xs active:scale-98"
              title="Descargar cronograma Gantt en formato Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Descargar Excel</span>
              <span className="sm:hidden">Excel</span>
            </button>
          </div>

          {/* Nueva Tarea Primary Button */}
          <button
            onClick={onAddTask}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-indigo-700 transition-colors active:scale-98 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Actividad</span>
          </button>
        </div>
      </div>
    </header>
  );
};
