export interface Task {
  id: string;
  name: string;
  category: string;
  assignee?: string;
  startDay: number; // 1-based day number, e.g. 1 for "Día 1"
  duration: number; // in days (min 1)
  progress: number; // 0 to 100
  color: string; // theme color key (e.g. 'indigo', 'emerald', 'sky', 'amber', 'rose', 'violet')
  isMilestone?: boolean;
  notes?: string;
  dependsOn?: string; // ID of predecessor task that this task depends on
}

export type ZoomLevel = 'compact' | 'normal' | 'wide';

export interface GanttConfig {
  totalDays: number;
  zoom: ZoomLevel;
  currentDay: number | null; // e.g. 5 for "Día 5"
  showProgress: boolean;
  showAssignee: boolean;
}

export interface TaskCategory {
  id: string;
  name: string;
  color: string;
}
