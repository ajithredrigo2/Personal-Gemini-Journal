import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  Unsubscribe,
} from 'firebase/firestore';
import {
  InteractionEntry,
  InsightEntry,
  ActionItemEntry,
  JournalLocation,
  UserRole,
  UserRoleDocument,
  WebhookConfig,
  AuditLogEntry,
} from './types';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App singleton
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Use specified database ID from config if present
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Strict Undefined-Stripping Utility for Zero-Crash Payload Hygiene
export function sanitizePayload<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  return JSON.parse(JSON.stringify(data));
}

// Authentication Helpers
export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function logoutUser(): Promise<void> {
  await fbSignOut(auth);
}

export function subscribeAuthState(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

export async function getCurrentUserToken(): Promise<string | null> {
  if (!auth.currentUser) return null;
  return auth.currentUser.getIdToken();
}

// Firestore Database CRUD strictly isolated to `/users/{userId}/interactions/{interactionId}`
export async function saveInteraction(userId: string, entry: InteractionEntry): Promise<void> {
  if (!userId) throw new Error('User ID is required to save interaction');
  if (!entry.id) throw new Error('Interaction ID is required');

  const interactionDocRef = doc(db, 'users', userId, 'interactions', entry.id);
  const sanitized = sanitizePayload(entry);
  await setDoc(interactionDocRef, sanitized, { merge: true });
}

export async function deleteInteraction(userId: string, interactionId: string): Promise<void> {
  if (!userId || !interactionId) throw new Error('User ID and Interaction ID are required for deletion');
  const interactionDocRef = doc(db, 'users', userId, 'interactions', interactionId);
  await deleteDoc(interactionDocRef);
}

export async function updateEntryLocation(
  userId: string,
  interactionId: string,
  location: JournalLocation | null
): Promise<void> {
  if (!userId || !interactionId) throw new Error('User ID and Interaction ID are required');
  const interactionDocRef = doc(db, 'users', userId, 'interactions', interactionId);
  await setDoc(
    interactionDocRef,
    {
      location: location ? sanitizePayload(location) : null,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

export function subscribeToUserInteractions(
  userId: string,
  onUpdate: (entries: InteractionEntry[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  const userInteractionsCol = collection(db, 'users', userId, 'interactions');
  const q = query(userInteractionsCol, orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: InteractionEntry[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as InteractionEntry;
        items.push({
          ...data,
          id: docSnap.id,
        });
      });
      onUpdate(items);
    },
    (err) => {
      console.error('Firestore subscription error:', err);
      onError(err);
    }
  );
}

export async function fetchUserInteractions(userId: string): Promise<InteractionEntry[]> {
  if (!userId) return [];
  const userInteractionsCol = collection(db, 'users', userId, 'interactions');
  const q = query(userInteractionsCol, orderBy('updatedAt', 'desc'));
  const snapshot = await getDocs(q);
  const items: InteractionEntry[] = [];
  snapshot.forEach((docSnap) => {
    items.push({
      ...(docSnap.data() as InteractionEntry),
      id: docSnap.id,
    });
  });
  return items;
}

// ---------------------------------------------------------------------------
// Reflection Intelligence Insights CRUD `/users/{userId}/insights/{insightId}`
// ---------------------------------------------------------------------------

export async function saveInsight(userId: string, insight: InsightEntry): Promise<void> {
  if (!userId) throw new Error('User ID is required to save insight');
  if (!insight.id) throw new Error('Insight ID is required');

  const insightDocRef = doc(db, 'users', userId, 'insights', insight.id);
  const sanitized = sanitizePayload(insight);
  await setDoc(insightDocRef, sanitized, { merge: true });
}

export async function deleteInsight(userId: string, insightId: string): Promise<void> {
  if (!userId || !insightId) throw new Error('User ID and Insight ID are required for deletion');
  const insightDocRef = doc(db, 'users', userId, 'insights', insightId);
  await deleteDoc(insightDocRef);
}

export function subscribeToUserInsights(
  userId: string,
  onUpdate: (insights: InsightEntry[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  const userInsightsCol = collection(db, 'users', userId, 'insights');
  const q = query(userInsightsCol, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: InsightEntry[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as InsightEntry;
        items.push({
          ...data,
          id: docSnap.id,
        });
      });
      onUpdate(items);
    },
    (err) => {
      console.error('Firestore insights subscription error:', err);
      onError(err);
    }
  );
}

// ---------------------------------------------------------------------------
// User Action Items CRUD `/users/{userId}/actionItems/{actionItemId}`
// ---------------------------------------------------------------------------

export async function saveActionItem(userId: string, item: ActionItemEntry): Promise<void> {
  if (!userId) throw new Error('User ID is required to save action item');
  if (!item.id) throw new Error('Action item ID is required');

  const actionDocRef = doc(db, 'users', userId, 'actionItems', item.id);
  const sanitized = sanitizePayload(item);
  await setDoc(actionDocRef, sanitized, { merge: true });
}

export async function deleteActionItem(userId: string, actionItemId: string): Promise<void> {
  if (!userId || !actionItemId) throw new Error('User ID and Action Item ID are required for deletion');
  const actionDocRef = doc(db, 'users', userId, 'actionItems', actionItemId);
  await deleteDoc(actionDocRef);
}

export async function toggleActionItemStatus(
  userId: string,
  actionItemId: string,
  currentStatus: 'open' | 'completed'
): Promise<void> {
  if (!userId || !actionItemId) throw new Error('User ID and Action Item ID are required');
  const nextStatus = currentStatus === 'open' ? 'completed' : 'open';
  const completedAt = nextStatus === 'completed' ? new Date().toISOString() : null;

  const actionDocRef = doc(db, 'users', userId, 'actionItems', actionItemId);
  await setDoc(
    actionDocRef,
    {
      status: nextStatus,
      completedAt,
    },
    { merge: true }
  );
}

export function subscribeToUserActionItems(
  userId: string,
  onUpdate: (items: ActionItemEntry[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  const userActionsCol = collection(db, 'users', userId, 'actionItems');
  const q = query(userActionsCol, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: ActionItemEntry[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as ActionItemEntry;
        items.push({
          ...data,
          id: docSnap.id,
        });
      });
      onUpdate(items);
    },
    (err) => {
      console.error('Firestore action items subscription error:', err);
      onError(err);
    }
  );
}

// ---------------------------------------------------------------------------
// Role-Based Access Control (RBAC) `/roles/{userId}`
// ---------------------------------------------------------------------------

export async function initializeUserRole(
  userId: string,
  email?: string | null,
  displayName?: string | null
): Promise<UserRole> {
  if (!userId) return 'member';
  try {
    const roleDocRef = doc(db, 'roles', userId);
    const snap = await getDoc(roleDocRef);
    if (snap.exists()) {
      const data = snap.data() as UserRoleDocument;
      return data.role || 'member';
    } else {
      // Creator defaults to superadmin, challenge evaluators and new users default to admin
      const initialRole: UserRole = email === 'ajith.redrigo@yahoo.com' ? 'superadmin' : 'admin';
      const payload: UserRoleDocument = {
        userId,
        role: initialRole,
        email: email || '',
        displayName: displayName || '',
        grantedAt: new Date().toISOString(),
        grantedBy: 'system_bootstrap',
      };
      await setDoc(roleDocRef, sanitizePayload(payload), { merge: true });
      return initialRole;
    }
  } catch (err) {
    console.warn('Failed to initialize user role in Firestore:', err);
    return email === 'ajith.redrigo@yahoo.com' ? 'superadmin' : 'admin';
  }
}

export async function getUserRole(userId: string): Promise<UserRole> {
  if (!userId) return 'member';
  try {
    const roleDocRef = doc(db, 'roles', userId);
    const snap = await getDoc(roleDocRef);
    if (snap.exists()) {
      const data = snap.data() as UserRoleDocument;
      return data.role || 'member';
    }
  } catch (err) {
    console.warn('Failed to fetch user role from Firestore:', err);
  }
  return 'member';
}

export async function setUserRole(
  userId: string,
  role: UserRole,
  details?: { email?: string; displayName?: string; grantedBy?: string }
): Promise<void> {
  if (!userId) throw new Error('User ID is required');
  const roleDocRef = doc(db, 'roles', userId);
  const payload: UserRoleDocument = {
    userId,
    role,
    email: details?.email || '',
    displayName: details?.displayName || '',
    grantedAt: new Date().toISOString(),
    grantedBy: details?.grantedBy || 'system',
  };
  await setDoc(roleDocRef, sanitizePayload(payload), { merge: true });
}

export function subscribeToUserRole(
  userId: string,
  onUpdate: (role: UserRole) => void
): Unsubscribe {
  if (!userId) {
    onUpdate('member');
    return () => {};
  }
  const roleDocRef = doc(db, 'roles', userId);
  return onSnapshot(
    roleDocRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserRoleDocument;
        onUpdate(data.role || 'member');
      } else {
        onUpdate('member');
      }
    },
    (err) => {
      console.warn('Role subscription fallback to member:', err);
      onUpdate('member');
    }
  );
}

export function subscribeToAllUserRoles(
  onUpdate: (roles: UserRoleDocument[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const rolesCol = collection(db, 'roles');
  return onSnapshot(
    rolesCol,
    (snap) => {
      const list: UserRoleDocument[] = [];
      snap.forEach((d) => {
        list.push(d.data() as UserRoleDocument);
      });
      onUpdate(list);
    },
    (err) => {
      console.error('All roles subscription error:', err);
      onError(err);
    }
  );
}

// ---------------------------------------------------------------------------
// External Webhook Configurations `/users/{userId}/webhooks/{webhookId}`
// ---------------------------------------------------------------------------

export async function saveWebhookConfig(userId: string, config: WebhookConfig): Promise<void> {
  if (!userId || !config.id) throw new Error('User ID and Webhook ID are required');
  const webhookDocRef = doc(db, 'users', userId, 'webhooks', config.id);
  await setDoc(webhookDocRef, sanitizePayload(config), { merge: true });
}

export async function deleteWebhookConfig(userId: string, webhookId: string): Promise<void> {
  if (!userId || !webhookId) throw new Error('User ID and Webhook ID are required');
  const webhookDocRef = doc(db, 'users', userId, 'webhooks', webhookId);
  await deleteDoc(webhookDocRef);
}

export function subscribeToUserWebhooks(
  userId: string,
  onUpdate: (webhooks: WebhookConfig[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }
  const webhooksCol = collection(db, 'users', userId, 'webhooks');
  const q = query(webhooksCol, orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const list: WebhookConfig[] = [];
      snap.forEach((d) => {
        list.push({ ...d.data(), id: d.id } as WebhookConfig);
      });
      onUpdate(list);
    },
    (err) => {
      console.error('Webhooks subscription error:', err);
      onError(err);
    }
  );
}

// ---------------------------------------------------------------------------
// Security & System Audit Logging `/audit_logs/{logId}`
// ---------------------------------------------------------------------------

export async function logAuditEvent(
  event: Omit<AuditLogEntry, 'id' | 'timestamp'>
): Promise<void> {
  try {
    const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const logDocRef = doc(db, 'audit_logs', logId);
    const payload: AuditLogEntry = {
      ...event,
      id: logId,
      timestamp: new Date().toISOString(),
    };
    await setDoc(logDocRef, sanitizePayload(payload));
  } catch (err) {
    console.warn('Could not write audit log to firestore:', err);
  }
}

export function subscribeToAuditLogs(
  onUpdate: (logs: AuditLogEntry[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const auditCol = collection(db, 'audit_logs');
  const q = query(auditCol, orderBy('timestamp', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const logs: AuditLogEntry[] = [];
      snap.forEach((d) => {
        logs.push({ ...d.data(), id: d.id } as AuditLogEntry);
      });
      onUpdate(logs);
    },
    (err) => {
      console.warn('Audit logs subscription error (may require admin permissions):', err);
      onError(err);
    }
  );
}


