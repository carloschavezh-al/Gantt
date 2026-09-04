import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Task, ZoomLevel } from '../types';
import { TASK_COLORS } from '../data/initialData';
import {
  Edit2,
  Trash2,
  Copy,
  Scissors,
  MoreVertical,
  CornerDownLeft,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Search,
  Filter,
  MoveRight,
  PlusCircle,
  Link2,
  FileText,
  Calendar,
  User,
} from 'lucide-react';

interface GanttChartProps {
  tasks: Task[];
  totalDays: number;
  currentDay: number | null;
  zoom: ZoomLevel;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onDuplicateTask: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onReorderTasks: (tasks: Task[]) => void;
  onAddTaskAtDay?: (day: number) => void;
  readOnly?: boolean;
}

export const GanttChart: React.FC<GanttChartProps> = ({
  tasks,
  totalDays,
  currentDay,
  zoom,
  onUpdateTask,
  onDeleteTask,
  onDuplicateTask,
  onEditTask,
  onReorderTasks,
  onAddTaskAtDay,
  readOnly = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [activeDropdownTaskId, setActiveDropdownTaskId] = useState<string | null>(null);
  const [cutTaskId, setCutTaskId] = useState<string | null>(null);
  const [hoveredLineId, setHoveredLineId] = useState<string | null>(null);
  const [showDependencies, setShowDependencies] = useState(true);
  const [notesTooltip, setNotesTooltip] = useState<{
    task: Task;
    x: number;
    y: number;
  } | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!activeDropdownTaskId) return;
    const handleClickOutside = () => setActiveDropdownTaskId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [activeDropdownTaskId]);

  const pasteAfterTask = (sourceId: string, targetId: string) => {
    const sourceIndex = tasks.findIndex((t) => t.id === sourceId);
    const targetIndex = tasks.findIndex((t) => t.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return;

    const newTasks = [...tasks];
    const [removed] = newTasks.splice(sourceIndex, 1);
    const newTargetIndex = newTasks.findIndex((t) => t.id === targetId);
    newTasks.splice(newTargetIndex + 1, 0, removed);
    onReorderTasks(newTasks);
  };

  // Ref for the unified Gantt scroll container and left column measurement
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [leftColWidth, setLeftColWidth] = useState<number>(360);

  // Measure visible timeline area with ResizeObserver to fit the chart to the screen
  useEffect(() => {
    const el = timelineContainerRef.current;
    if (!el) return;

    const updateWidth = () => {
      if (el.clientWidth > 0) {
        setContainerWidth(el.clientWidth);
      }
    };

    updateWidth();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) {
          setContainerWidth(w);
        }
      }
    });

    resizeObserver.observe(el);
    window.addEventListener('resize', updateWidth);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  // Measure left column width to accurately distribute timeline days
  useEffect(() => {
    const el = leftColRef.current;
    if (!el) return;
    const update = () => {
      if (el.offsetWidth > 0) {
        setLeftColWidth(el.offsetWidth);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Column width dynamically calculated to fit the registered Plazo (totalDays) to the screen
  const colWidth = useMemo(() => {
    const days = Math.max(1, totalDays);
    const availableWidth =
      containerWidth > 0
        ? Math.max(260, containerWidth - leftColWidth)
        : typeof window !== 'undefined'
        ? Math.max(260, window.innerWidth - leftColWidth)
        : 800;

    const naturalFitWidth = availableWidth / days;

    // Minimum column width so day labels stay legible
    const minColWidth = zoom === 'compact' ? 32 : zoom === 'wide' ? 68 : 38;

    if (zoom === 'wide') {
      return Math.max(minColWidth, Math.max(76, naturalFitWidth * 1.35));
    }

    if (zoom === 'compact') {
      return Math.max(minColWidth, Math.max(40, naturalFitWidth * 0.8));
    }

    // Default 'normal': auto-fit to 100% of the visible container width!
    // If totalDays is high and naturalFitWidth < minColWidth, clamp to minColWidth and enable smooth scroll.
    return Math.max(minColWidth, naturalFitWidth);
  }, [totalDays, containerWidth, leftColWidth, zoom]);

  const rowHeight = 52; // Height in px for both tables

  // Dragging state for Gantt bars
  const [dragging, setDragging] = useState<{
    taskId: string;
    type: 'move' | 'resize-start' | 'resize-end';
    initialMouseX: number;
    initialStartDay: number;
    initialDuration: number;
    currentStartDay: number;
    currentDuration: number;
  } | null>(null);

  // Categories list
  const categories = Array.from(new Set(tasks.map((t) => t.category).filter(Boolean)));

  // Filtered tasks
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.assignee && t.assignee.toLowerCase().includes(searchQuery.toLowerCase())) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Tooltip mouse handlers for task notes and details
  const handleTaskMouseEnter = (task: Task, e: React.MouseEvent) => {
    setHoveredTaskId(task.id);
    if (!dragging) {
      setNotesTooltip({ task, x: e.clientX, y: e.clientY });
    }
  };

  const handleTaskMouseMove = (task: Task, e: React.MouseEvent) => {
    if (!dragging) {
      setNotesTooltip((prev) =>
        prev && prev.task.id === task.id
          ? { ...prev, x: e.clientX, y: e.clientY }
          : { task, x: e.clientX, y: e.clientY }
      );
    }
  };

  const handleTaskMouseLeave = () => {
    setHoveredTaskId(null);
    setNotesTooltip(null);
  };

  // Smooth orthogonal path generator with rounded corners
  const generateRoundedPath = (points: Array<{ x: number; y: number }>, r = 6): string => {
    if (points.length < 2) return '';
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];

      const dPrev = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      const dNext = Math.hypot(next.x - curr.x, next.y - curr.y);
      if (dPrev === 0 || dNext === 0) continue;

      const actualR = Math.min(r, dPrev / 2, dNext / 2);

      const vPrevX = (prev.x - curr.x) / dPrev;
      const vPrevY = (prev.y - curr.y) / dPrev;
      const vNextX = (next.x - curr.x) / dNext;
      const vNextY = (next.y - curr.y) / dNext;

      const arcStartX = curr.x + vPrevX * actualR;
      const arcStartY = curr.y + vPrevY * actualR;
      const arcEndX = curr.x + vNextX * actualR;
      const arcEndY = curr.y + vNextY * actualR;

      d += ` L ${arcStartX.toFixed(1)} ${arcStartY.toFixed(1)}`;
      d += ` Q ${curr.x.toFixed(1)} ${curr.y.toFixed(1)} ${arcEndX.toFixed(1)} ${arcEndY.toFixed(1)}`;
    }
    const last = points[points.length - 1];
    d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
    return d;
  };

  // Dependency lines between tasks with smart rounded routing
  const dependencyLines = useMemo(() => {
    const lines: Array<{
      id: string;
      predId: string;
      predName: string;
      taskId: string;
      taskName: string;
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      pathD: string;
      labelX: number;
      labelY: number;
      isHovered: boolean;
      isDimmed: boolean;
    }> = [];

    const taskIndexMap = new Map<string, number>();
    filteredTasks.forEach((t, i) => taskIndexMap.set(t.id, i));

    filteredTasks.forEach((task) => {
      if (!task.dependsOn) return;
      const pred = filteredTasks.find((t) => t.id === task.dependsOn);
      if (!pred) return;

      const predIdx = taskIndexMap.get(pred.id);
      const taskIdx = taskIndexMap.get(task.id);
      if (predIdx === undefined || taskIdx === undefined) return;

      const predIsDragging = dragging?.taskId === pred.id;
      const taskIsDragging = dragging?.taskId === task.id;

      const predStartDay = predIsDragging ? dragging.currentStartDay : pred.startDay;
      const predDuration = predIsDragging ? dragging.currentDuration : pred.duration;
      const taskStartDay = taskIsDragging ? dragging.currentStartDay : task.startDay;

      // Calculate exact right edge of predecessor bar
      let startX: number;
      if (pred.isMilestone) {
        const diamondCenter = (predStartDay - 1) * colWidth + colWidth / 2;
        startX = diamondCenter + 14;
      } else {
        const predLeft = (predStartDay - 1) * colWidth + 4;
        const predWidth = Math.max(24, predDuration * colWidth - 8);
        startX = predLeft + predWidth;
      }
      const startY = predIdx * rowHeight + rowHeight / 2;

      // Calculate exact left edge of successor bar
      let endX: number;
      if (task.isMilestone) {
        const diamondCenter = (taskStartDay - 1) * colWidth + colWidth / 2;
        endX = diamondCenter - 14;
      } else {
        endX = (taskStartDay - 1) * colWidth + 4;
      }
      const endY = taskIdx * rowHeight + rowHeight / 2;

      const deltaX = endX - startX;
      const deltaY = endY - startY;

      let points: Array<{ x: number; y: number }> = [];
      let labelX = 0;
      let labelY = 0;

      // Path routing
      if (deltaX >= 28) {
        // Standard forward step with comfortable gap
        const midX = Math.round(startX + deltaX / 2);
        points = [
          { x: startX, y: startY },
          { x: midX, y: startY },
          { x: midX, y: endY },
          { x: endX, y: endY },
        ];
        labelX = midX;
        labelY = (startY + endY) / 2;
      } else {
        // Sequential close tasks or backward: clean S-route around bars
        const xExit = startX + 14;
        const xEntry = endX - 14;
        const passY = deltaY >= 0 ? startY + rowHeight / 2 : startY - rowHeight / 2;

        points = [
          { x: startX, y: startY },
          { x: xExit, y: startY },
          { x: xExit, y: passY },
          { x: xEntry, y: passY },
          { x: xEntry, y: endY },
          { x: endX, y: endY },
        ];
        labelX = (xExit + xEntry) / 2;
        labelY = passY;
      }

      const pathD = generateRoundedPath(points, 6);
      const lineId = `${pred.id}->${task.id}`;

      const isHovered =
        hoveredLineId === lineId ||
        hoveredTaskId === task.id ||
        hoveredTaskId === pred.id;

      const hasAnyFocus = hoveredLineId !== null || hoveredTaskId !== null;
      const isDimmed = hasAnyFocus && !isHovered;

      lines.push({
        id: lineId,
        predId: pred.id,
        predName: pred.name,
        taskId: task.id,
        taskName: task.name,
        startX,
        startY,
        endX,
        endY,
        pathD,
        labelX,
        labelY,
        isHovered,
        isDimmed,
      });
    });

    return lines;
  }, [filteredTasks, dragging, colWidth, rowHeight, hoveredTaskId, hoveredLineId]);

  // Find task currently hovered or dragged to highlight its day columns
  const hoveredTask = useMemo(() => {
    const targetId = dragging ? dragging.taskId : hoveredTaskId;
    if (!targetId) return null;
    return tasks.find((t) => t.id === targetId) || null;
  }, [dragging, hoveredTaskId, tasks]);

  // Compute active day span for column highlighting
  const hoveredDaysRange = useMemo(() => {
    if (!hoveredTask) return null;
    const isBeingDragged = dragging?.taskId === hoveredTask.id;
    const start = isBeingDragged ? dragging.currentStartDay : hoveredTask.startDay;
    const duration = isBeingDragged ? dragging.currentDuration : hoveredTask.duration;
    const end = hoveredTask.isMilestone ? start : start + duration - 1;
    return {
      start: Math.max(1, Math.min(totalDays, start)),
      end: Math.max(1, Math.min(totalDays, end)),
      name: hoveredTask.name,
      isMilestone: hoveredTask.isMilestone,
    };
  }, [hoveredTask, dragging, totalDays]);

  // Mouse handlers for resizing/moving bars
  const handleMouseDown = (
    e: React.MouseEvent,
    task: Task,
    type: 'move' | 'resize-start' | 'resize-end'
  ) => {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault();
    setNotesTooltip(null);
    setDragging({
      taskId: task.id,
      type,
      initialMouseX: e.clientX,
      initialStartDay: task.startDay,
      initialDuration: task.duration,
      currentStartDay: task.startDay,
      currentDuration: task.duration,
    });
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragging.initialMouseX;
      const dayDelta = Math.round(deltaX / colWidth);

      if (dragging.type === 'move') {
        const maxStart = totalDays - dragging.initialDuration + 1;
        const newStart = Math.max(1, Math.min(maxStart, dragging.initialStartDay + dayDelta));
        setDragging((prev) => (prev ? { ...prev, currentStartDay: newStart } : null));
      } else if (dragging.type === 'resize-end') {
        const maxDuration = totalDays - dragging.initialStartDay + 1;
        const newDuration = Math.max(1, Math.min(maxDuration, dragging.initialDuration + dayDelta));
        setDragging((prev) => (prev ? { ...prev, currentDuration: newDuration } : null));
      } else if (dragging.type === 'resize-start') {
        const proposedStart = dragging.initialStartDay + dayDelta;
        const endDay = dragging.initialStartDay + dragging.initialDuration - 1;
        const boundedStart = Math.max(1, Math.min(endDay, proposedStart));
        const newDuration = endDay - boundedStart + 1;
        setDragging((prev) =>
          prev
            ? {
                ...prev,
                currentStartDay: boundedStart,
                currentDuration: newDuration,
              }
            : null
        );
      }
    };

    const handleMouseUp = () => {
      if (dragging) {
        const targetTask = tasks.find((t) => t.id === dragging.taskId);
        if (targetTask) {
          if (
            targetTask.startDay !== dragging.currentStartDay ||
            targetTask.duration !== dragging.currentDuration
          ) {
            onUpdateTask({
              ...targetTask,
              startDay: dragging.currentStartDay,
              duration: dragging.currentDuration,
            });
          }
        }
      }
      setDragging(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, colWidth, totalDays, tasks, onUpdateTask]);

  // Move task up/down in list
  const moveTask = (index: number, direction: 'up' | 'down') => {
    if (readOnly) return;
    const newTasks = [...tasks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newTasks.length) return;
    const temp = newTasks[index];
    newTasks[index] = newTasks[targetIndex];
    newTasks[targetIndex] = temp;
    onReorderTasks(newTasks);
  };

  return (
    <div className="flex flex-col flex-1 bg-white overflow-hidden select-none">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-8 py-2.5 bg-slate-50/70 border-b border-slate-200 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por actividad, responsable o fase..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-md text-slate-800 text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400"
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-slate-400 hover:text-slate-600 text-xs px-1"
            >
              Limpiar
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle dependencies visibility */}
          <button
            onClick={() => setShowDependencies((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              showDependencies
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
            }`}
            title="Mostrar u ocultar flechas de dependencias en el gráfico"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Flechas ({dependencyLines.length})</span>
          </button>

          <div className="flex items-center gap-1.5 text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Fase:</span>
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-white border border-slate-200 rounded-md px-2.5 py-1 text-slate-700 text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
          >
            <option value="ALL">Todas las fases ({tasks.length})</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat} ({tasks.filter((t) => t.category === cat).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Banner when a task is cut */}
      {cutTaskId && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <Scissors className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="truncate">
              Cortada: <strong>{tasks.find((t) => t.id === cutTaskId)?.name}</strong>
            </span>
          </div>
          <button
            onClick={() => setCutTaskId(null)}
            className="text-[11px] underline text-amber-700 hover:text-amber-900 shrink-0 font-medium"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Main Gantt Grid: Single Unified Scroll Container (moves both activities and timeline together vertically) */}
      <div
        ref={timelineContainerRef}
        className="flex-1 overflow-auto bg-white relative select-none"
      >
        <div className="inline-flex flex-col min-w-full min-h-full">
          {/* Unified Sticky Header Row */}
          <div className="sticky top-0 z-30 flex bg-slate-50 border-b border-slate-200 shrink-0">
            {/* Left Header: Sticky Top and Sticky Left */}
            <div
              ref={leftColRef}
              className="sticky left-0 z-40 w-[260px] sm:w-[340px] lg:w-[420px] shrink-0 bg-slate-50 border-r border-slate-200 h-[48px] px-3 sm:px-5 flex items-center justify-between text-xs font-bold text-slate-600 uppercase tracking-wider shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]"
            >
              <span className="flex items-center gap-1.5">
                <span>Actividades / Tareas</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  ({filteredTasks.length})
                </span>
              </span>
            </div>

            {/* Days Header */}
            <div
              className="flex h-[48px] bg-slate-50/80 select-none shrink-0"
              style={{ width: `${totalDays * colWidth}px` }}
            >
              {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
                const isHoveredDay =
                  hoveredDaysRange && day >= hoveredDaysRange.start && day <= hoveredDaysRange.end;
                const isDayStart = hoveredDaysRange && day === hoveredDaysRange.start;
                const isDayEnd = hoveredDaysRange && day === hoveredDaysRange.end;

                return (
                  <div
                    key={day}
                    style={{ width: `${colWidth}px` }}
                    className={`h-full border-r flex flex-col items-center justify-center text-center shrink-0 transition-colors duration-150 ${
                      isHoveredDay
                        ? 'bg-slate-100/90 border-r-slate-200 border-b-2 border-b-slate-400'
                        : 'border-slate-200/70 hover:bg-slate-100/50'
                    }`}
                  >
                    <span
                      className={`text-xs uppercase tracking-tight transition-colors ${
                        isHoveredDay ? 'text-slate-900 font-bold' : 'text-slate-600 font-bold'
                      }`}
                    >
                      {colWidth < 44 ? `${day}` : `Día ${day}`}
                    </span>
                    {isHoveredDay && (
                      <span className="text-[9px] text-slate-500 font-semibold tracking-tighter leading-none mt-0.5">
                        {hoveredDaysRange.isMilestone
                          ? 'Hito'
                          : isDayStart && isDayEnd
                          ? '1 día'
                          : isDayStart
                          ? 'Inicio'
                          : isDayEnd
                          ? 'Fin'
                          : 'Activo'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Unified Body Rows: Left Tasks and Right Grid side by side */}
          <div className="flex flex-1 relative">
            {/* Left Side: Task List (Sticky Left) */}
            <div className="sticky left-0 z-20 w-[260px] sm:w-[340px] lg:w-[420px] shrink-0 bg-white border-r border-slate-200 divide-y divide-slate-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
            {filteredTasks.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No se encontraron actividades con ese criterio.
              </div>
            ) : (
              filteredTasks.map((task, idx) => {
                const colorConfig = TASK_COLORS[task.color] || TASK_COLORS.indigo;
                const isLineConnected =
                  hoveredLineId &&
                  (hoveredLineId.startsWith(task.id + '->') || hoveredLineId.endsWith('->' + task.id));
                const isHovered = hoveredTaskId === task.id || isLineConnected;
                const isCut = cutTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    onMouseEnter={(e) => handleTaskMouseEnter(task, e)}
                    onMouseMove={(e) => handleTaskMouseMove(task, e)}
                    onMouseLeave={handleTaskMouseLeave}
                    style={{ height: `${rowHeight}px` }}
                    className={`px-4 sm:px-6 flex items-center justify-between gap-2 text-xs transition-colors group ${
                      isCut
                        ? 'bg-amber-50/60 border-l-4 border-l-amber-500'
                        : isHovered
                        ? 'bg-slate-100/50'
                        : idx % 2 === 0
                        ? 'bg-white'
                        : 'bg-slate-50/40'
                    }`}
                  >
                    {/* Left: Reorder buttons, Status indicator, Task Name & Note Badge */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 py-1">
                      {/* Reorder arrows - solo en modo editable */}
                      {!readOnly && (
                        <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity -ml-2 shrink-0">
                          <button
                            onClick={() => moveTask(idx, 'up')}
                            disabled={idx === 0}
                            className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-20"
                            title="Subir tarea"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => moveTask(idx, 'down')}
                            disabled={idx === tasks.length - 1}
                            className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-20"
                            title="Bajar tarea"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {/* Task status indicator or milestone diamond */}
                      {task.isMilestone ? (
                        <span className="w-3 h-3 rotate-45 bg-amber-500 shrink-0 rounded-xs shadow-xs" />
                      ) : (
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${colorConfig.bg}`}
                        />
                      )}

                      {/* Task name: clean description without badges or native title tooltip */}
                      <div
                        onClick={() => {
                          if (!readOnly) onEditTask(task);
                        }}
                        className={`font-medium text-slate-900 break-words whitespace-normal leading-snug flex-1 min-w-0 text-xs sm:text-[13px] tracking-tight pr-1 ${
                          readOnly
                            ? 'cursor-default'
                            : 'hover:text-indigo-600 cursor-pointer'
                        }`}
                      >
                        {task.name}
                      </div>
                    </div>

                    {/* Action Dropdown Menu (Solo en modo editable) */}
                    {!readOnly && (
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownTaskId(activeDropdownTaskId === task.id ? null : task.id);
                          }}
                          className={`p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ${
                            activeDropdownTaskId === task.id
                              ? 'bg-slate-100 text-slate-800 opacity-100'
                              : 'opacity-0 group-hover:opacity-100'
                          }`}
                          title="Opciones de actividad"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {activeDropdownTaskId === task.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className={`absolute right-0 ${
                              idx >= Math.max(0, filteredTasks.length - 3) ? 'bottom-full mb-1' : 'top-full mt-1'
                            } z-50 w-48 bg-white rounded-lg shadow-xl border border-slate-200 py-1 text-xs text-slate-700 divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100`}
                          >
                            <div className="py-1">
                              <button
                                onClick={() => {
                                  setCutTaskId(task.id);
                                  setActiveDropdownTaskId(null);
                                }}
                                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 hover:text-amber-600 transition-colors"
                              >
                                <Scissors className="w-3.5 h-3.5 text-slate-400" />
                                <span>Cortar actividad</span>
                              </button>
                              <button
                                onClick={() => {
                                  setActiveDropdownTaskId(null);
                                  onDuplicateTask(task);
                                }}
                                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                              >
                                <Copy className="w-3.5 h-3.5 text-slate-400" />
                                <span>Copiar actividad</span>
                              </button>
                              <button
                                onClick={() => {
                                  setActiveDropdownTaskId(null);
                                  onEditTask(task);
                                }}
                                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                <span>Editar actividad</span>
                              </button>
                            </div>

                            {cutTaskId && cutTaskId !== task.id && (
                              <div className="py-1 bg-amber-50/70">
                                <button
                                  onClick={() => {
                                    pasteAfterTask(cutTaskId, task.id);
                                    setCutTaskId(null);
                                    setActiveDropdownTaskId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-amber-100 text-amber-900 transition-colors font-semibold"
                                >
                                  <CornerDownLeft className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Pegar aquí (después)</span>
                                </button>
                              </div>
                            )}

                            <div className="py-1">
                              <button
                                onClick={() => {
                                  setActiveDropdownTaskId(null);
                                  onDeleteTask(task.id);
                                }}
                                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-rose-50 text-rose-600 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                <span>Eliminar actividad</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Right Side: Gantt Timeline Columns & Bars */}
          <div
            className="relative shrink-0"
            style={{ width: `${totalDays * colWidth}px` }}
          >
            {/* Background Column Grid Lines */}
              <div className="absolute inset-0 flex pointer-events-none">
                {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
                  return (
                    <div
                      key={day}
                      style={{ width: `${colWidth}px` }}
                      className={`h-full border-r border-slate-100 shrink-0 ${
                        day % 5 === 0 ? 'bg-slate-50/30' : ''
                      }`}
                    />
                  );
                })}
              </div>

              {/* Shaded vertical column band for the hovered activity's day range (very light soft gray) */}
              {hoveredDaysRange && (
                <div
                  className="absolute top-0 bottom-0 pointer-events-none z-5 transition-all duration-150 border-x border-slate-300/40 bg-slate-100/35"
                  style={{
                    left: `${(hoveredDaysRange.start - 1) * colWidth}px`,
                    width: `${(hoveredDaysRange.end - hoveredDaysRange.start + 1) * colWidth}px`,
                  }}
                >
                  {/* Subtle top indicator bar in soft slate */}
                  <div className="h-0.5 w-full bg-slate-400/40" />
                </div>
              )}

              {/* SVG Connectors for Task Dependencies */}
              {showDependencies && (
                <svg
                  className="absolute inset-0 pointer-events-none z-15 overflow-visible"
                  style={{
                    width: `${totalDays * colWidth}px`,
                    height: `${filteredTasks.length * rowHeight}px`,
                  }}
                >
                  <defs>
                    {/* Shadow filter for active dependency glow */}
                    <filter id="dep-glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#4f46e5" floodOpacity="0.4" />
                    </filter>

                    {/* Default high-contrast arrow marker */}
                    <marker
                      id="dep-arrow-default"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="7.5"
                      markerHeight="7.5"
                      orient="auto"
                    >
                      <path d="M 1.5 2 L 8.5 5 L 1.5 8 z" fill="#475569" />
                    </marker>

                    {/* Hover/Active highlighted arrow marker */}
                    <marker
                      id="dep-arrow-active"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="8.5"
                      markerHeight="8.5"
                      orient="auto"
                    >
                      <path d="M 1.5 1.5 L 9 5 L 1.5 8.5 z" fill="#4f46e5" />
                    </marker>

                    {/* Dimmed arrow marker when another task is focused */}
                    <marker
                      id="dep-arrow-dimmed"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto"
                    >
                      <path d="M 1.5 2 L 8.5 5 L 1.5 8 z" fill="#94a3b8" />
                    </marker>
                  </defs>

                  {dependencyLines.map((line) => {
                    return (
                      <g key={line.id} className="group/dep">
                        {/* Underline halo for clean contrast against any background/grid */}
                        <path
                          d={line.pathD}
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth={line.isHovered ? 5.5 : 4}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity="0.95"
                        />

                        {/* Foreground crisp dependency connector line */}
                        <path
                          d={line.pathD}
                          fill="none"
                          stroke={line.isHovered ? '#4f46e5' : line.isDimmed ? '#94a3b8' : '#475569'}
                          strokeWidth={line.isHovered ? 2.5 : 1.75}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeDasharray={line.isDimmed ? '3 3' : undefined}
                          markerEnd={
                            line.isHovered
                              ? 'url(#dep-arrow-active)'
                              : line.isDimmed
                              ? 'url(#dep-arrow-dimmed)'
                              : 'url(#dep-arrow-default)'
                          }
                          filter={line.isHovered ? 'url(#dep-glow)' : undefined}
                          className="transition-all duration-150"
                        />

                        {/* Origin anchor dot on the predecessor bar right edge */}
                        <circle
                          cx={line.startX}
                          cy={line.startY}
                          r={line.isHovered ? 4 : 3}
                          fill={line.isHovered ? '#4f46e5' : line.isDimmed ? '#94a3b8' : '#475569'}
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        />

                        {/* Transparent wider stroke for hover and click interaction */}
                        <path
                          d={line.pathD}
                          fill="none"
                          stroke="transparent"
                          strokeWidth="18"
                          className="pointer-events-auto cursor-pointer"
                          onMouseEnter={() => setHoveredLineId(line.id)}
                          onMouseLeave={() => setHoveredLineId(null)}
                        >
                          <title>{`Dependencia: "${line.predName}" ➔ "${line.taskName}"`}</title>
                        </path>
                      </g>
                    );
                  })}
                </svg>
              )}

              {/* Task Rows */}
              <div className="relative divide-y divide-slate-100">
                {filteredTasks.map((task, idx) => {
                  const isLineConnected =
                    hoveredLineId &&
                    (hoveredLineId.startsWith(task.id + '->') || hoveredLineId.endsWith('->' + task.id));
                  const isHovered = hoveredTaskId === task.id || isLineConnected;
                  const isBeingDragged = dragging?.taskId === task.id;
                  const activeStartDay = isBeingDragged ? dragging.currentStartDay : task.startDay;
                  const activeDuration = isBeingDragged ? dragging.currentDuration : task.duration;
                  const colorConfig = TASK_COLORS[task.color] || TASK_COLORS.indigo;
                  const endDay = activeStartDay + activeDuration - 1;

                  // Bar position calculation
                  const barLeft = (activeStartDay - 1) * colWidth + 4;
                  const barWidth = task.isMilestone
                    ? 32
                    : Math.max(24, activeDuration * colWidth - 8);

                  return (
                    <div
                      key={task.id}
                      style={{ height: `${rowHeight}px` }}
                      onMouseEnter={(e) => handleTaskMouseEnter(task, e)}
                      onMouseMove={(e) => handleTaskMouseMove(task, e)}
                      onMouseLeave={handleTaskMouseLeave}
                      className={`relative flex items-center transition-colors ${
                        isHovered ? 'bg-slate-100/30' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'
                      }`}
                    >
                      {/* Clickable background cells to quickly move or start task on clicked day */}
                      <div className="absolute inset-0 flex">
                        {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
                          const isHoveredDay =
                            hoveredDaysRange &&
                            day >= hoveredDaysRange.start &&
                            day <= hoveredDaysRange.end;

                          return (
                            <div
                              key={day}
                              style={{ width: `${colWidth}px` }}
                              onClick={() => {
                                if (!readOnly && !dragging) {
                                  onUpdateTask({
                                    ...task,
                                    startDay: day,
                                  });
                                }
                              }}
                              className={`h-full shrink-0 transition-colors ${
                                readOnly
                                  ? 'cursor-default'
                                  : isHoveredDay
                                  ? 'cursor-pointer bg-slate-100/40'
                                  : 'cursor-pointer hover:bg-slate-100/50'
                              }`}
                              title={readOnly ? undefined : `Mover "${task.name}" para iniciar en Día ${day}`}
                            />
                          );
                        })}
                      </div>

                      {/* Gantt Bar / Milestone Marker */}
                      {task.isMilestone ? (
                        /* Milestone Diamond Marker without text label */
                        <div
                          style={{
                            left: `${(activeStartDay - 1) * colWidth + colWidth / 2 - 15}px`,
                          }}
                          onMouseEnter={(e) => handleTaskMouseEnter(task, e)}
                          onMouseMove={(e) => handleTaskMouseMove(task, e)}
                          onMouseDown={(e) => handleMouseDown(e, task, 'move')}
                          onDoubleClick={(e) => {
                            if (!readOnly) {
                              e.stopPropagation();
                              onEditTask(task);
                            }
                          }}
                          className={`absolute z-10 group/milestone flex items-center justify-center transition-transform ${
                            readOnly ? 'cursor-default' : 'cursor-move hover:scale-110'
                          }`}
                        >
                          <div className="w-7 h-7 rotate-45 bg-amber-500 border-2 border-white/40 rounded-xs shadow-xs flex items-center justify-center">
                            <Sparkles className="w-3.5 h-3.5 text-white -rotate-45" />
                          </div>
                        </div>
                      ) : (
                        /* Standard Activity Bar - Clean visual bar without text */
                        <div
                          style={{
                            left: `${barLeft}px`,
                            width: `${barWidth}px`,
                          }}
                          onMouseEnter={(e) => handleTaskMouseEnter(task, e)}
                          onMouseMove={(e) => handleTaskMouseMove(task, e)}
                          onMouseDown={(e) => handleMouseDown(e, task, 'move')}
                          onDoubleClick={(e) => {
                            if (!readOnly) {
                              e.stopPropagation();
                              onEditTask(task);
                            }
                          }}
                          className={`absolute h-8 rounded-lg shadow-xs z-10 transition-all flex items-center overflow-hidden border-2 border-white/20 ${colorConfig.bar} ${
                            readOnly ? 'cursor-default' : 'cursor-move hover:shadow-sm'
                          } ${
                            isBeingDragged
                              ? 'ring-2 ring-slate-600 ring-offset-1 scale-[1.01] shadow-md opacity-90'
                              : ''
                          }`}
                        >
                          {/* Left resize handle - only when not readOnly */}
                          {!readOnly && (
                            <div
                              onMouseDown={(e) => handleMouseDown(e, task, 'resize-start')}
                              className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-white/40 z-20 transition-colors"
                              title="Arrastrar para ajustar día de inicio"
                            />
                          )}

                          {/* Right resize handle - only when not readOnly */}
                          {!readOnly && (
                            <div
                              onMouseDown={(e) => handleMouseDown(e, task, 'resize-end')}
                              className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-white/40 z-20 transition-colors"
                              title="Arrastrar para ajustar duración en días"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Activity Notes Tooltip (shows notes on hover over activities or chart) */}
      {notesTooltip && !dragging && (
        <div
          className="fixed z-50 pointer-events-none transition-transform duration-75 select-none"
          style={{
            left: `${Math.max(
              12,
              Math.min(
                typeof window !== 'undefined' ? window.innerWidth - 340 : 1000,
                notesTooltip.x + 16 > (typeof window !== 'undefined' ? window.innerWidth - 340 : 1000)
                  ? notesTooltip.x - 336
                  : notesTooltip.x + 16
              )
            )}px`,
            top: `${Math.max(
              12,
              Math.min(
                typeof window !== 'undefined' ? window.innerHeight - 240 : 800,
                notesTooltip.y + 16 > (typeof window !== 'undefined' ? window.innerHeight - 240 : 800)
                  ? notesTooltip.y - 210
                  : notesTooltip.y + 16
              )
            )}px`,
          }}
        >
          <div className="w-80 sm:w-84 rounded-xl bg-slate-900/95 text-white p-3.5 shadow-2xl border border-slate-700/80 backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-100">
            {/* Top timing and milestone badge (no category) */}
            <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800">
              {notesTooltip.task.isMilestone ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300 bg-amber-950/80 border border-amber-500/40 px-2 py-0.5 rounded-full shrink-0">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Hito</span>
                </span>
              ) : (
                <span className="text-[10px] font-medium text-slate-400">Detalles de Actividad</span>
              )}
              <span className="text-[10px] font-semibold text-indigo-300 shrink-0">
                {notesTooltip.task.isMilestone
                  ? `Día ${notesTooltip.task.startDay}`
                  : `Día ${notesTooltip.task.startDay} al ${
                      notesTooltip.task.startDay + notesTooltip.task.duration - 1
                    }`}
              </span>
            </div>

            {/* Task Name */}
            <h4 className="font-semibold text-white text-[13px] leading-snug mb-2 break-words">
              {notesTooltip.task.name}
            </h4>

            {/* Quick Metadata (Assignee, Duration - no progress) */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2.5 text-[10px] text-slate-300">
              {notesTooltip.task.assignee && (
                <span className="inline-flex items-center gap-1 bg-slate-800/90 px-2 py-0.5 rounded border border-slate-700/60">
                  <User className="w-3 h-3 text-slate-400" />
                  <span className="text-slate-200">{notesTooltip.task.assignee}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1 bg-slate-800/90 px-2 py-0.5 rounded border border-slate-700/60">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>
                  {notesTooltip.task.duration}{' '}
                  {notesTooltip.task.duration === 1 ? 'día' : 'días'}
                </span>
              </span>
            </div>

            {/* Notas Adicionales Section */}
            <div className="rounded-lg p-2.5 bg-indigo-950/40 border border-indigo-500/30 text-slate-200">
              <div className="flex items-center gap-1.5 font-semibold text-[11px] text-indigo-300 mb-1">
                <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>Notas adicionales:</span>
              </div>
              {notesTooltip.task.notes && notesTooltip.task.notes.trim() ? (
                <p className="text-[11px] leading-relaxed text-slate-100 whitespace-pre-wrap break-words font-normal">
                  {notesTooltip.task.notes}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 italic">
                  Sin notas adicionales registradas en esta actividad.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer Info / Legend Bar */}
      <footer className="h-10 px-4 sm:px-8 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 font-medium flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-indigo-600 inline-block border border-white/20" />
            <span>{readOnly ? 'Barra de actividad' : 'Barra de actividad (Arrastrable)'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rotate-45 bg-amber-500 inline-block" />
            <span>Hito de 1 día</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center">
              <span className="w-3 h-0.5 bg-indigo-500 inline-block" />
              <span className="w-0 h-0 border-y-[3px] border-y-transparent border-l-[4px] border-l-indigo-500 inline-block -ml-0.5" />
            </span>
            <span>Dependencia (Precedencia)</span>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 text-slate-400">
          <span>
            {readOnly
              ? '* Modo consulta: pasa el cursor sobre las actividades o barras del gráfico para ver sus notas adicionales.'
              : '* Arrastra o haz clic para mover, ajusta extremos o haz doble clic para editar.'}
          </span>
        </div>
      </footer>
    </div>
  );
};
