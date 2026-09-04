import React, { useRef } from 'react';
import { ZoomLevel } from '../types';
import {
  Plus,
  RotateCcw,
  FileSpreadsheet,
  Printer,
  ChevronLeft,
  ChevronRight,
  Save,
  FolderOpen,
  Cloud,
  CloudOff,
  RefreshCw,
  Share2,
  Eye,
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
  onSaveProject: () => void;
  onLoadProject: (file: File) => void;
  cloudStatus?: 'synced' | 'saving' | 'offline' | 'error';
  lastSavedTime?: string | null;
  onShareLink?: () => void;
  readOnly?: boolean;
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
  onSaveProject,
  onLoadProject,
  cloudStatus = 'synced',
  lastSavedTime,
  onShareLink,
  readOnly = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onLoadProject(file);
      // Reset input so the same file can be selected again if needed
      e.target.value = '';
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 shadow-xs">
      {/* Hidden file input for loading project JSON */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Project title, subtitle & storage badge */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-xs shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {readOnly ? (
                <span className="text-lg font-bold text-slate-900 tracking-tight px-1 -ml-1 select-text">
                  {projectName}
                </span>
              ) : (
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => onProjectNameChange(e.target.value)}
                  className="text-lg font-bold text-slate-900 tracking-tight border-b border-transparent hover:border-slate-300 focus:border-indigo-600 focus:outline-hidden px-1 -ml-1 rounded transition-colors"
                  placeholder="Nombre del Proyecto"
                />
              )}

              {/* Read-Only Badge */}
              {readOnly && (
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-300 px-2.5 py-0.5 rounded-full shadow-2xs"
                  title="Modo de solo lectura: Consulta en tiempo real sin permisos de edición"
                >
                  <Eye className="w-3.5 h-3.5 text-amber-600" />
                  <span>Solo Consulta</span>
                </span>
              )}

              {/* Cloud Synchronization Status Badge */}
              {!readOnly && cloudStatus === 'saving' && (
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full animate-pulse"
                  title="Guardando cambios en la base de datos de Firebase..."
                >
                  <RefreshCw className="w-3 h-3 text-amber-600 animate-spin" />
                  <span>Guardando en la nube...</span>
                </span>
              )}

              {cloudStatus === 'synced' && (
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full"
                  title={`Sincronizado en tiempo real en la nube con Firebase.${lastSavedTime ? ' Última actualización: ' + lastSavedTime : ''}`}
                >
                  <Cloud className="w-3 h-3 text-emerald-600" />
                  <span>{readOnly ? 'En vivo' : 'Nube activa'}</span>
                </span>
              )}

              {cloudStatus === 'offline' && (
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full"
                  title="Conectando con la nube de Firebase..."
                >
                  <CloudOff className="w-3 h-3 text-slate-500" />
                  <span>Conectando...</span>
                </span>
              )}

              {cloudStatus === 'error' && (
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full"
                  title="Problema temporal de conexión con Firebase. Se conservan datos locales."
                >
                  <CloudOff className="w-3 h-3 text-rose-600" />
                  <span>Error de nube</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 px-1">
              {readOnly
                ? 'Visualización en tiempo real del cronograma con exportación a Excel disponible'
                : 'Plazos diarios con dependencias automáticas, base de datos en tiempo real y exportación'}
            </p>
          </div>
        </div>

        {/* Right: Actions toolbar */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Total Days control */}
          <div className="flex items-center bg-slate-50 rounded-md p-1 border border-slate-200 text-xs">
            <span className="text-slate-500 px-1.5 font-medium">Plazo:</span>
            {!readOnly && (
              <button
                onClick={() => onTotalDaysChange(Math.max(5, totalDays - 1))}
                className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded transition-colors disabled:opacity-30"
                disabled={totalDays <= 5}
                title="Reducir 1 día"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            )}
            <span className="px-2 font-bold text-slate-800 min-w-[48px] text-center">
              {totalDays} días
            </span>
            {!readOnly && (
              <button
                onClick={() => onTotalDaysChange(Math.min(60, totalDays + 1))}
                className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded transition-colors disabled:opacity-30"
                disabled={totalDays >= 60}
                title="Añadir 1 día"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Current Day selector */}
          <div className="flex items-center bg-slate-50 rounded-md p-1 border border-slate-200 text-xs">
            <span className="text-slate-500 px-1.5 font-medium">Hoy:</span>
            {readOnly ? (
              <span className="px-2 py-0.5 font-semibold text-slate-800">
                {currentDay ? `Día ${currentDay}` : 'Sin marcar'}
              </span>
            ) : (
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
            )}
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
              title="Columnas normales (autoajuste)"
            >
              Auto
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

          {/* Persistence / File Management (Guardar y Cargar Proyecto) */}
          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
            {!readOnly && (
              <>
                {/* Guardar Proyecto JSON */}
                <button
                  onClick={onSaveProject}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold transition-colors shadow-2xs"
                  title="Guardar archivo de proyecto (.json) en tu equipo para respaldar y no perder datos"
                >
                  <Save className="w-3.5 h-3.5 text-slate-600" />
                  <span className="hidden lg:inline">Guardar</span>
                </button>

                {/* Cargar Proyecto JSON */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold transition-colors shadow-2xs"
                  title="Cargar y abrir un archivo de proyecto (.json) guardado previamente"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-slate-600" />
                  <span className="hidden lg:inline">Cargar</span>
                </button>
              </>
            )}

            {/* Descargar en Excel - Siempre disponible */}
            <button
              onClick={onExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold transition-colors shadow-2xs active:scale-98"
              title="Descargar cronograma Gantt en formato Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel</span>
            </button>

            {/* Compartir enlace de consulta */}
            {onShareLink && (
              <button
                onClick={onShareLink}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md text-xs font-semibold transition-colors shadow-2xs"
                title="Copiar enlace de solo lectura para compartir este cronograma"
              >
                <Share2 className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Compartir</span>
              </button>
            )}

            {/* Imprimir / PDF */}
            <button
              onClick={() => window.print()}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
              title="Imprimir o guardar como PDF"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* Reset - Solo en modo edición */}
            {!readOnly && (
              <button
                onClick={onResetData}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                title="Restablecer plantilla inicial"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Nueva Tarea Primary Button - Solo en modo edición */}
          {!readOnly && (
            <button
              onClick={onAddTask}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-md shadow-sm hover:bg-indigo-700 transition-colors active:scale-98 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Actividad</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
