import { initializeApp, getApps, getApp } from 'firebase/app';
import {
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

// Initialize Firestore with custom databaseId if configured
export const db: Firestore = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Test connection on boot as recommended by Firebase instructions
(async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client appears offline:', error.message);
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
 * Listen to realtime updates on a project
 */
export function subscribeToProject(
  projectId: string,
  onUpdate: (data: CloudProjectData) => void,
  onError?: (err: Error) => void
) {
  const projectRef = doc(db, 'projects', projectId);

  return onSnapshot(
    projectRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as CloudProjectData;
        onUpdate(data);
      }
    },
    (error) => {
      console.error(`Error subscribing to project ${projectId}:`, error);
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
  const projectRef = doc(db, 'projects', projectId);
  const currentUser = auth.currentUser;

  const payload: CloudProjectData = {
    ...data,
    updatedAt: new Date().toISOString(),
    lastEditedBy: currentUser ? currentUser.uid.substring(0, 6) : getCollaboratorId(),
  };

  await setDoc(projectRef, payload, { merge: true });
}
