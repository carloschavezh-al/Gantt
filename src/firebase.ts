import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, Auth, User } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { Task } from './types';

// Initialize Firebase App singleton
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth: Auth = getAuth(app);

// Initialize Firestore with force long polling enabled to prevent WebChannel stream
// connection drops in sandboxed iframe / Cloud Run proxy environments.
export const db: Firestore = (() => {
  try {
    return initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true,
      },
      firebaseConfig.firestoreDatabaseId || undefined
    );
  } catch {
    // Fallback if already initialized
    return firebaseConfig.firestoreDatabaseId
      ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
      : getFirestore(app);
  }
})();

// Test connection on boot as recommended by Firebase instructions, safely handling initial offline states
(async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const code = (error as { code?: string })?.code;
    if (code === 'unavailable' || msg.includes('offline') || msg.includes('could not be completed')) {
      // Safe offline/connection-delay handling - client will use cache and sync when online
      console.info('[Firebase] Operating in resilient offline-sync mode until connection is confirmed.');
    } else {
      console.warn('[Firebase] Connection check info:', msg);
    }
  }
})();

// Generate or retrieve a lightweight client collaborator ID
function getCollaboratorId(): string {
  try {
    const key = 'gantt_collab_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = 'user_' + Math.random().toString(36).substring(2, 8);
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

// Optionally initialize anonymous auth if supported by the project, but never block Firestore
export async function ensureAuth(): Promise<User | null> {
  if (auth.currentUser) return auth.currentUser;
  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch {
    // If anonymous auth is disabled by project policy (auth/admin-restricted-operation),
    // Firestore rules permit unauthenticated public collaborative access directly.
    return null;
  }
}

export interface CloudProjectData {
  projectName: string;
  totalDays: number;
  currentDay: number | null;
  tasks: Task[];
  updatedAt: string;
  lastEditedBy?: string;
}

const DEFAULT_PROJECT_ID = 'cronograma_principal';

/**
 * Get project ID from URL search params or fallback to default
 */
export function getActiveProjectId(): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('project') || params.get('p');
    if (p && p.trim()) {
      return p.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    }
  }
  return DEFAULT_PROJECT_ID;
}

/**
 * Sanitize task before storing in Firestore to prevent unsupported undefined values
 */
export function sanitizeTask(task: Task): Task {
  const clean: Record<string, any> = {
    id: String(task.id),
    name: String(task.name || ''),
    category: String(task.category || 'General'),
    startDay: Number(task.startDay) || 1,
    duration: Math.max(1, Number(task.duration) || 1),
    progress: Math.min(100, Math.max(0, Number(task.progress) || 0)),
    color: task.color || 'indigo',
  };

  if (task.assignee && task.assignee.trim()) {
    clean.assignee = task.assignee.trim();
  }
  if (task.notes && task.notes.trim()) {
    clean.notes = task.notes.trim();
  }
  if (task.dependsOn && task.dependsOn.trim()) {
    clean.dependsOn = task.dependsOn.trim();
  }
  if (typeof task.isMilestone === 'boolean') {
    clean.isMilestone = task.isMilestone;
  }

  return clean as Task;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Listen to realtime updates on a project
 */
export function subscribeToProject(
  projectId: string,
  onUpdate: (data: CloudProjectData | null) => void,
  onError?: (err: Error) => void
) {
  const path = `projects/${projectId}`;
  const projectRef = doc(db, 'projects', projectId);

  return onSnapshot(
    projectRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const rawData = snapshot.data();
        const data: CloudProjectData = {
          projectName: rawData.projectName || 'Cronograma de Actividades',
          totalDays: Number(rawData.totalDays) || 30,
          currentDay: typeof rawData.currentDay === 'number' ? rawData.currentDay : null,
          tasks: Array.isArray(rawData.tasks) ? (rawData.tasks as Task[]) : [],
          updatedAt: rawData.updatedAt || new Date().toISOString(),
          lastEditedBy: rawData.lastEditedBy || 'anon',
        };
        onUpdate(data);
      } else {
        // Document does not exist yet on Firestore
        onUpdate(null);
      }
    },
    (error) => {
      const msg = error?.message || String(error);
      const code = (error as { code?: string })?.code;
      if (code === 'unavailable' || msg.includes('offline') || msg.includes('could not be completed')) {
        console.warn(`[Firebase] Offline or connecting to "${path}". Using local data.`);
      } else {
        console.error(`[Firebase] Error subscribing to project "${path}":`, error);
      }
      if (onError) onError(error);
    }
  );
}

/**
 * Save project data to cloud Firestore
 */
export async function saveProjectToCloud(
  projectId: string,
  data: Omit<CloudProjectData, 'updatedAt'>
): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    const projectRef = doc(db, 'projects', projectId);
    const currentUser = auth.currentUser;

    const sanitizedTasks = (data.tasks || []).map(sanitizeTask);

    const payload: CloudProjectData = {
      projectName: data.projectName || 'Cronograma de Actividades',
      totalDays: Number(data.totalDays) || 30,
      currentDay: typeof data.currentDay === 'number' ? data.currentDay : null,
      tasks: sanitizedTasks,
      updatedAt: new Date().toISOString(),
      lastEditedBy: currentUser ? currentUser.uid.substring(0, 6) : getCollaboratorId(),
    };

    await setDoc(projectRef, payload);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const code = (error as { code?: string })?.code;
    if (code === 'unavailable' || msg.includes('offline') || msg.includes('could not be completed')) {
      console.warn(`[Firebase] Write deferred while offline for "${path}".`);
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
