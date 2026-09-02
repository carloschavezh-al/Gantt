import { Task } from '../types';

/**
 * Returns the 1-based end day of a task
 */
export function getTaskEndDay(task: Task): number {
  if (task.isMilestone) {
    return task.startDay;
  }
  return task.startDay + Math.max(1, task.duration) - 1;
}

/**
 * Checks whether setting potentialPredecessorId as predecessor of taskId would cause a cycle
 */
export function wouldCreateCycle(
  tasks: Task[],
  taskId: string,
  potentialPredecessorId: string
): boolean {
  if (taskId === potentialPredecessorId) return true;
  
  let currentId: string | undefined = potentialPredecessorId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === taskId) return true;
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const curr = tasks.find((t) => t.id === currentId);
    currentId = curr?.dependsOn;
  }

  return false;
}

/**
 * Returns a list of tasks that can safely be selected as predecessors
 */
export function getValidPredecessors(tasks: Task[], currentTaskId?: string): Task[] {
  if (!currentTaskId) return tasks;
  return tasks.filter((t) => !wouldCreateCycle(tasks, currentTaskId, t.id));
}

/**
 * Cascades dependency updates across all tasks.
 * If a predecessor moves or resizes, any dependent task's startDay is updated
 * so it starts immediately on predecessor's endDay + 1.
 */
export function recalculateDependencies(tasks: Task[]): Task[] {
  let updated = [...tasks];
  let changed = true;
  let iterations = 0;
  const maxIterations = Math.max(10, tasks.length * 2);

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;
    const taskMap = new Map<string, Task>(updated.map((t) => [t.id, t]));

    for (let i = 0; i < updated.length; i++) {
      const task = updated[i];
      if (task.dependsOn && taskMap.has(task.dependsOn)) {
        const pred = taskMap.get(task.dependsOn)!;
        const predEnd = getTaskEndDay(pred);
        const requiredStart = Math.max(1, predEnd + 1);

        if (task.startDay !== requiredStart) {
          updated[i] = {
            ...task,
            startDay: requiredStart,
          };
          taskMap.set(task.id, updated[i]);
          changed = true;
        }
      }
    }
  }

  return updated;
}
