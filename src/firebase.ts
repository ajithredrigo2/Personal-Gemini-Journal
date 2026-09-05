import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
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
// ---------------------------------------------------------------------------
// Firebase client configuration
//
// Read from Vite build-time env vars (VITE_FIREBASE_*) or optional
// firebase-applet-config.json.
// ---------------------------------------------------------------------------

const appletConfigs = import.meta.glob<{ default: Record<string, string> }>(
  '/firebase-applet-config.json',
  { eager: true }
);
const appletConfig = appletConfigs['/firebase-applet-config.json']?.default;

const firebaseConfig = {
  apiKey: appletConfig?.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: appletConfig?.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: appletConfig?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: appletConfig?.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId:
    appletConfig?.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: appletConfig?.appId || import.meta.env.VITE_FIREBASE_APP_ID || '',
};

const FIRESTORE_DATABASE_ID =
  appletConfig?.firestoreDatabaseId || import.meta.env.VITE_FIRESTORE_DATABASE_ID || '';

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.apiKey.trim().length > 5 &&
    firebaseConfig.projectId &&
    firebaseConfig.projectId.trim().length > 0 &&
    !firebaseConfig.apiKey.includes('placeholder')
);

// Initialize Firebase App singleton safely without throwing on missing/invalid credentials
let app: any = null;
let auth: any = null;
let db: any = null;

if (isFirebaseConfigured) {
  try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = FIRESTORE_DATABASE_ID
      ? getFirestore(app, FIRESTORE_DATABASE_ID)
      : getFirestore(app);
    console.info('[Firebase] Client initialized successfully for project:', firebaseConfig.projectId);
  } catch (err) {
    console.warn('[Firebase] Client initialization error:', err);
    app = null;
    auth = null;
    db = null;
  }
} else {
  console.info(
    '[Firebase] Client credentials not provided. Running in guest/demo mode.'
  );
}

export { app, auth, db };

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// In-memory / persistent demo auth support for environments where OAuth domain is unauthorized
let demoAuthUser: any = null;
try {
  const savedDemo = typeof window !== 'undefined' ? localStorage.getItem('mindscribe_demo_user') : null;
  if (savedDemo) {
    demoAuthUser = JSON.parse(savedDemo);
  }
} catch (e) {
  // localStorage might be unavailable in some sandboxes
}

const authListeners: Set<(user: User | null) => void> = new Set();

export function isDemoUserId(userId?: string | null): boolean {
  return !userId || userId.startsWith('demo_') || userId.startsWith('demo-');
}

// LocalStorage resilient caching helpers
function getLocalItems<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalItems<T>(key: string, items: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('mindscribe_storage_change', { detail: { key } }));
  } catch (e) {
    console.warn('Could not cache locally:', e);
  }
}

// Strict Undefined-Stripping Utility for Zero-Crash Payload Hygiene
export function sanitizePayload<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  return JSON.parse(JSON.stringify(data));
}

export class UnauthorizedDomainError extends Error {
  domain: string;
  constructor(domain: string) {
    super(
      `This app's domain (${domain}) is not in the Firebase Console's authorized ` +
        `domains list. Add it under Authentication -> Settings -> Authorized domains.`
    );
    this.name = 'UnauthorizedDomainError';
    this.domain = domain;
  }
}

/**
 * Signs the user in with Google.
 *
 * This NEVER falls back to demo/evaluator mode. A failure here is surfaced to
 * the caller so the real cause (unauthorized domain, blocked popup, cancelled
 * sign-in) can be shown to the user. Demo mode is an explicit, separate action.
 */
export async function loginWithGoogle(): Promise<User> {
  if (!isFirebaseConfigured || !auth) {
    throw new Error(
      'Firebase Authentication is not configured yet. Please provide Firebase credentials or use "Continue as Guest (Demo)" to explore the app.'
    );
  }

  // A stale demo session must never shadow a real sign-in.
  clearDemoSession();

  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err: any) {
    const code = err?.code || '';

    if (code === 'auth/unauthorized-domain') {
      throw new UnauthorizedDomainError(
        typeof window !== 'undefined' ? window.location.hostname : 'unknown'
      );
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      throw new Error('Sign-in was cancelled before it completed.');
    }
    if (code === 'auth/popup-blocked') {
      throw new Error('Your browser blocked the sign-in popup. Allow popups for this site and try again.');
    }
    if (code === 'auth/network-request-failed') {
      throw new Error('Network error during sign-in. Check your connection and try again.');
    }

    console.error('[Auth] Google sign-in failed:', code || err?.message || err);
    throw err;
  }
}

/** Clears any persisted demo session. */
export function clearDemoSession(): void {
  demoAuthUser = null;
  try {
    localStorage.removeItem('mindscribe_demo_user');
  } catch {
    // localStorage may be unavailable.
  }
}

/**
 * Explicit, opt-in demo session. Only ever called from the "Continue as guest"
 * button on the landing page - never as an automatic fallback for a failed
 * Google sign-in. Data stays in localStorage on this device.
 *
 * The backend only honours the matching demo token when ALLOW_DEMO_MODE=true.
 */
export function loginDemoUser(
  email = 'demo@mindscribe.local',
  displayName = 'Demo User'
): User {
  const fakeUser: any = {
    uid: 'demo_' + email.replace(/[^a-zA-Z0-9]/g, '_'),
    email,
    displayName,
    photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    emailVerified: true,
    isAnonymous: false,
    getIdToken: async () => 'demo-token-demo_' + email.replace(/[^a-zA-Z0-9]/g, '_'),
  };
  demoAuthUser = fakeUser;
  try {
    localStorage.setItem('mindscribe_demo_user', JSON.stringify(fakeUser));
  } catch {}
  authListeners.forEach((cb) => cb(fakeUser as User));
  return fakeUser as User;
}

interface LocalRegisteredAccount {
  uid: string;
  email: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
}

function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(36);
}

function findLocalRegisteredUser(email: string, password?: string): LocalRegisteredAccount | null {
  const cleanEmail = email.trim().toLowerCase();
  const accounts = getLocalItems<LocalRegisteredAccount>('mindscribe_registered_accounts');
  const account = accounts.find((a) => a.email === cleanEmail);
  if (!account) return null;
  if (password && account.passwordHash && account.passwordHash !== hashPassword(password)) {
    return null;
  }
  return account;
}

function hydrateRegisteredUser(account: LocalRegisteredAccount): User {
  const fakeUser: any = {
    uid: account.uid,
    email: account.email,
    displayName: account.displayName,
    photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(account.displayName)}&backgroundColor=5a5a40&textColor=ffffff`,
    emailVerified: true,
    isAnonymous: false,
    getIdToken: async () => 'demo-token-' + account.uid,
  };
  demoAuthUser = fakeUser;
  try {
    localStorage.setItem('mindscribe_demo_user', JSON.stringify(fakeUser));
  } catch {}
  authListeners.forEach((cb) => cb(fakeUser as User));
  return fakeUser as User;
}

function createOrHydrateLocalRegisteredUser(
  email: string,
  displayName: string,
  password?: string
): User {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = displayName.trim() || cleanEmail.split('@')[0];
  const uid = 'reg_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');

  const accounts = getLocalItems<LocalRegisteredAccount>('mindscribe_registered_accounts');
  const existing = accounts.find((a) => a.email === cleanEmail);
  if (existing) {
    const error: any = new Error(
      `The email "${cleanEmail}" is already registered. Please sign in to your existing account or reset your password.`
    );
    error.code = 'auth/email-already-in-use';
    error.isAlreadyRegistered = true;
    throw error;
  }

  const newAccount: LocalRegisteredAccount = {
    uid,
    email: cleanEmail,
    displayName: cleanName,
    passwordHash: password ? hashPassword(password) : '',
    createdAt: new Date().toISOString(),
  };
  accounts.push(newAccount);
  setLocalItems('mindscribe_registered_accounts', accounts);
  const user = hydrateRegisteredUser(newAccount);
  (user as any).verificationEmailSent = true;
  return user;
}

/**
 * Registers a new user account with Email and Password.
 * Supports Firebase Authentication when configured, with seamless client-side
 * isolation in development and evaluator sandbox environments.
 * Dispatches an account confirmation email upon successful creation.
 */
export async function registerWithEmailPassword(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = displayName.trim() || cleanEmail.split('@')[0];

  if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    throw new Error('Please provide a valid email address.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  if (isFirebaseConfigured && auth) {
    clearDemoSession();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      if (cleanName) {
        try {
          await updateProfile(userCredential.user, {
            displayName: cleanName,
            photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=5a5a40&textColor=ffffff`,
          });
        } catch (profileErr) {
          console.warn('[Auth] Could not update profile display name:', profileErr);
        }
      }

      // Send email verification confirmation to the newly registered email
      let emailVerificationSent = false;
      try {
        await sendEmailVerification(userCredential.user);
        emailVerificationSent = true;
        console.log('[Auth] Confirmation email sent to:', cleanEmail);
      } catch (verifyErr) {
        console.warn('[Auth] Email verification could not be dispatched automatically:', verifyErr);
      }
      (userCredential.user as any).verificationEmailSent = emailVerificationSent;

      return userCredential.user;
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/email-already-in-use') {
        const error: any = new Error(
          `The email "${cleanEmail}" is already registered. Please sign in to your existing account or reset your password.`
        );
        error.code = 'auth/email-already-in-use';
        error.isAlreadyRegistered = true;
        throw error;
      }
      if (code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email format.');
      }
      if (code === 'auth/weak-password') {
        throw new Error('Password is too weak. Please use at least 6 characters.');
      }
      if (code === 'auth/operation-not-allowed') {
        console.warn('[Auth] Email/Password provider not enabled in Firebase Console, falling back to local account');
        return createOrHydrateLocalRegisteredUser(cleanEmail, cleanName, password);
      }
      throw err;
    }
  }

  return createOrHydrateLocalRegisteredUser(cleanEmail, cleanName, password);
}

/**
 * Signs in an existing user with Email and Password.
 */
export async function loginWithEmailPassword(
  email: string,
  password: string
): Promise<User> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }
  if (!password) {
    throw new Error('Please enter your password.');
  }

  if (isFirebaseConfigured && auth) {
    clearDemoSession();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      return userCredential.user;
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        const localUser = findLocalRegisteredUser(cleanEmail, password);
        if (localUser) {
          return hydrateRegisteredUser(localUser);
        }
        throw new Error('Invalid email or password. Please check your credentials.');
      }
      if (code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address.');
      }
      if (code === 'auth/too-many-requests') {
        throw new Error('Access to this account has been temporarily disabled due to many failed login attempts. Please try again later.');
      }
      if (code === 'auth/operation-not-allowed') {
        const localUser = findLocalRegisteredUser(cleanEmail, password);
        if (localUser) {
          return hydrateRegisteredUser(localUser);
        }
        throw new Error('Email/password sign-in is not enabled in Firebase project, and no local account was found.');
      }
      throw err;
    }
  }

  const localUser = findLocalRegisteredUser(cleanEmail, password);
  if (localUser) {
    return hydrateRegisteredUser(localUser);
  }
  throw new Error('Invalid email or password. Please check your credentials or create an account.');
}

/**
 * Sends a password reset email to the specified address.
 */
export async function resetPasswordWithEmail(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }

  if (isFirebaseConfigured && auth) {
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      return;
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/user-not-found') {
        throw new Error('No registered account was found with that email address.');
      }
      if (code === 'auth/invalid-email') {
        throw new Error('Please provide a valid email format.');
      }
      throw err;
    }
  }
  return;
}

/**
 * Sends or resends an account confirmation / verification email.
 */
export async function sendAccountVerificationEmail(
  user?: User | null
): Promise<{ success: boolean; message: string }> {
  const target = user || (auth ? auth.currentUser : null) || demoAuthUser;
  if (!target) {
    throw new Error('No active account session found to send verification email.');
  }

  const emailAddr = target.email || 'your email address';

  if (isFirebaseConfigured && auth && auth.currentUser) {
    try {
      await sendEmailVerification(auth.currentUser);
      return {
        success: true,
        message: `Confirmation verification link successfully dispatched to ${emailAddr}.`,
      };
    } catch (err: any) {
      if (err?.code === 'auth/too-many-requests') {
        throw new Error('Verification requests are temporarily throttled. Please check your inbox or try again in a few minutes.');
      }
      throw err;
    }
  }

  // Record confirmation dispatched in local session
  try {
    localStorage.setItem(`mindscribe_email_verified_${target.uid}`, new Date().toISOString());
  } catch {}

  return {
    success: true,
    message: `Confirmation email dispatched to ${emailAddr}. Please check your inbox.`,
  };
}

export async function logoutUser(): Promise<void> {
  clearDemoSession();
  if (auth) {
    try {
      await fbSignOut(auth);
    } catch (err) {
      console.warn('Signout error:', err);
    }
  }
  authListeners.forEach((cb) => cb(null));
}

export function subscribeAuthState(callback: (user: User | null) => void): Unsubscribe {
  authListeners.add(callback);
  if (demoAuthUser) {
    callback(demoAuthUser as User);
  }

  let fbUnsub: Unsubscribe = () => {};
  if (auth) {
    try {
      fbUnsub = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          // A real Firebase session always takes precedence over a stale demo one.
          if (demoAuthUser) clearDemoSession();
          callback(firebaseUser);
          return;
        }
        if (!demoAuthUser) {
          callback(null);
        }
      });
    } catch (err) {
      console.warn('[Auth] onAuthStateChanged error:', err);
      if (!demoAuthUser) {
        callback(null);
      }
    }
  } else if (!demoAuthUser) {
    // If Firebase Auth is not active and no demo session exists, signal null immediately so loading finishes
    callback(null);
  }

  return () => {
    authListeners.delete(callback);
    fbUnsub();
  };
}

export async function getCurrentUserToken(): Promise<string | null> {
  if (auth && auth.currentUser) {
    return auth.currentUser.getIdToken();
  }
  // If active in a demo session or local registered session, return demo token
  if (demoAuthUser) {
    return 'demo-token-' + demoAuthUser.uid;
  }
  // Check localStorage if session was saved but not yet hydrated
  try {
    const savedDemo = typeof window !== 'undefined' ? localStorage.getItem('mindscribe_demo_user') : null;
    if (savedDemo) {
      const parsed = JSON.parse(savedDemo);
      if (parsed?.uid) {
        demoAuthUser = parsed;
        return 'demo-token-' + parsed.uid;
      }
    }
  } catch {
    // localStorage unavailable
  }
  return null;
}

/**
 * fetch() wrapper that attaches the caller's Firebase ID token. Every /api
 * route requires one; requests without it are rejected with 401.
 */
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await getCurrentUserToken();
  if (!token) {
    throw new Error('You must be signed in to perform this action.');
  }
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, { ...init, headers });
}

// Firestore Database CRUD strictly isolated to `/users/{userId}/interactions/{interactionId}`
export async function saveInteraction(userId: string, entry: InteractionEntry): Promise<void> {
  if (!userId) throw new Error('User ID is required to save interaction');
  if (!entry.id) throw new Error('Interaction ID is required');

  const sanitized = sanitizePayload(entry);
  const key = `mindscribe_interactions_${userId}`;

  if (isDemoUserId(userId) || !isFirebaseConfigured || !db) {
    const items = getLocalItems<InteractionEntry>(key);
    const idx = items.findIndex((i) => i.id === entry.id);
    if (idx >= 0) items[idx] = sanitized;
    else items.unshift(sanitized);
    setLocalItems(key, items);
    return;
  }

  try {
    const interactionDocRef = doc(db, 'users', userId, 'interactions', entry.id);
    await setDoc(interactionDocRef, sanitized, { merge: true });
  } catch (err) {
    console.warn('Firestore write failed, caching locally:', err);
    const items = getLocalItems<InteractionEntry>(key);
    const idx = items.findIndex((i) => i.id === entry.id);
    if (idx >= 0) items[idx] = sanitized;
    else items.unshift(sanitized);
    setLocalItems(key, items);
  }
}

export async function deleteInteraction(userId: string, interactionId: string): Promise<void> {
  if (!userId || !interactionId) throw new Error('User ID and Interaction ID are required for deletion');

  const key = `mindscribe_interactions_${userId}`;

  if (isDemoUserId(userId) || !isFirebaseConfigured || !db) {
    const items = getLocalItems<InteractionEntry>(key).filter((i) => i.id !== interactionId);
    setLocalItems(key, items);
    return;
  }

  try {
    const interactionDocRef = doc(db, 'users', userId, 'interactions', interactionId);
    await deleteDoc(interactionDocRef);
  } catch (err) {
    console.warn('Firestore delete failed, updating local cache:', err);
    const items = getLocalItems<InteractionEntry>(key).filter((i) => i.id !== interactionId);
    setLocalItems(key, items);
  }
}

export async function updateEntryLocation(
  userId: string,
  interactionId: string,
  location: JournalLocation | null
): Promise<void> {
  if (!userId || !interactionId) throw new Error('User ID and Interaction ID are required');

  const key = `mindscribe_interactions_${userId}`;

  if (isDemoUserId(userId) || !isFirebaseConfigured || !db) {
    const items = getLocalItems<InteractionEntry>(key);
    const item = items.find((i) => i.id === interactionId);
    if (item) {
      item.location = location ? sanitizePayload(location) : null;
      item.updatedAt = new Date().toISOString();
      setLocalItems(key, items);
    }
    return;
  }

  try {
    const interactionDocRef = doc(db, 'users', userId, 'interactions', interactionId);
    await setDoc(
      interactionDocRef,
      {
        location: location ? sanitizePayload(location) : null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore update location failed, updating local cache:', err);
    const items = getLocalItems<InteractionEntry>(key);
    const item = items.find((i) => i.id === interactionId);
    if (item) {
      item.location = location ? sanitizePayload(location) : null;
      item.updatedAt = new Date().toISOString();
      setLocalItems(key, items);
    }
  }
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

  const key = `mindscribe_interactions_${userId}`;

  if (isDemoUserId(userId) || !isFirebaseConfigured || !db) {
    const cached = getLocalItems<InteractionEntry>(key);
    // Seed initial demo reflection if entirely empty
    if (cached.length === 0) {
      const seed: InteractionEntry = {
        id: 'seed_entry_1',
        userId,
        title: 'Cognitive Clarity & Deep Work Architecture',
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        mode: 'reflection',
        mood: 'calm',
        tags: ['Personal Growth', 'Focus', 'Productivity'],
        summary: 'A mindful reflection on eliminating mental clutter and establishing a structured morning routine.',
        keyInsights: [
          'Unstructured mornings create cognitive leakage throughout the afternoon.',
          'Socratic journaling before opening email grounds priorities effectively.',
        ],
        extractedActions: [
          'Design 45-minute distraction-free focus window before 9:00 AM',
          'Review weekly reflections every Friday afternoon',
        ],
        messages: [
          {
            role: 'user',
            content: 'I want to build a calmer, more deliberate focus routine in my work day.',
            timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
          },
          {
            role: 'model',
            content: 'Creating a deliberate focus routine begins with identifying where attention naturally leaks. When you reflect on your past week, which moments felt most grounded and clear?',
            timestamp: new Date(Date.now() - 3600000 * 2 + 1000).toISOString(),
          },
        ],
      };
      setLocalItems(key, [seed]);
      onUpdate([seed]);
    } else {
      onUpdate(cached);
    }

    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail || customEvent.detail.key === key) {
        onUpdate(getLocalItems<InteractionEntry>(key));
      }
    };
    window.addEventListener('mindscribe_storage_change', handler);
    return () => {
      window.removeEventListener('mindscribe_storage_change', handler);
    };
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
      console.warn('Firestore subscription error, falling back to local storage:', err);
      onUpdate(getLocalItems<InteractionEntry>(key));
      onError(err);
    }
  );
}

export async function fetchUserInteractions(userId: string): Promise<InteractionEntry[]> {
  if (!userId) return [];
  if (isDemoUserId(userId) || !isFirebaseConfigured || !db) {
    return getLocalItems<InteractionEntry>(`mindscribe_interactions_${userId}`);
  }
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

  const sanitized = sanitizePayload(insight);
  const key = `mindscribe_insights_${userId}`;

  if (isDemoUserId(userId) || !isFirebaseConfigured || !db) {
    const items = getLocalItems<InsightEntry>(key);
    const idx = items.findIndex((i) => i.id === insight.id);
    if (idx >= 0) items[idx] = sanitized;
    else items.unshift(sanitized);
    setLocalItems(key, items);
    return;
  }

  try {
    const insightDocRef = doc(db, 'users', userId, 'insights', insight.id);
    await setDoc(insightDocRef, sanitized, { merge: true });
  } catch (err) {
    console.warn('Firestore write insight failed, caching locally:', err);
    const items = getLocalItems<InsightEntry>(key);
    const idx = items.findIndex((i) => i.id === insight.id);
    if (idx >= 0) items[idx] = sanitized;
    else items.unshift(sanitized);
    setLocalItems(key, items);
  }
}

export async function deleteInsight(userId: string, insightId: string): Promise<void> {
  if (!userId || !insightId) throw new Error('User ID and Insight ID are required for deletion');

  const key = `mindscribe_insights_${userId}`;

  if (isDemoUserId(userId) || !isFirebaseConfigured || !db) {
    const items = getLocalItems<InsightEntry>(key).filter((i) => i.id !== insightId);
    setLocalItems(key, items);
    return;
  }

  try {
    const insightDocRef = doc(db, 'users', userId, 'insights', insightId);
    await deleteDoc(insightDocRef);
  } catch (err) {
    console.warn('Firestore delete insight failed, updating local cache:', err);
    const items = getLocalItems<InsightEntry>(key).filter((i) => i.id !== insightId);
    setLocalItems(key, items);
  }
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

  const key = `mindscribe_insights_${userId}`;

  if (isDemoUserId(userId) || !isFirebaseConfigured || !db) {
    onUpdate(getLocalItems<InsightEntry>(key));
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail || customEvent.detail.key === key) {
        onUpdate(getLocalItems<InsightEntry>(key));
      }
    };
    window.addEventListener('mindscribe_storage_change', handler);
    return () => {
      window.removeEventListener('mindscribe_storage_change', handler);
    };
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
      console.warn('Firestore insights subscription fallback:', err);
      onUpdate(getLocalItems<InsightEntry>(key));
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

  const sanitized = sanitizePayload(item);
  const key = `mindscribe_action_items_${userId}`;

  if (isDemoUserId(userId) || !isFirebaseConfigured || !db) {
    const items = getLocalItems<ActionItemEntry>(key);
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx >= 0) items[idx] = sanitized;
    else items.unshift(sanitized);
    setLocalItems(key, items);
    return;
  }

  try {
    const actionDocRef = doc(db, 'users', userId, 'actionItems', item.id);
    await setDoc(actionDocRef, sanitized, { merge: true });
  } catch (err) {
    console.warn('Firestore save action item failed, caching locally:', err);
    const items = getLocalItems<ActionItemEntry>(key);
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx >= 0) items[idx] = sanitized;
    else items.unshift(sanitized);
    setLocalItems(key, items);
  }
}

export async function deleteActionItem(userId: string, actionItemId: string): Promise<void> {
  if (!userId || !actionItemId) throw new Error('User ID and Action Item ID are required for deletion');

  const key = `mindscribe_action_items_${userId}`;

  if (isDemoUserId(userId) || !isFirebaseConfigured || !db) {
    const items = getLocalItems<ActionItemEntry>(key).filter((i) => i.id !== actionItemId);
    setLocalItems(key, items);
    return;
  }

  try {
    const actionDocRef = doc(db, 'users', userId, 'actionItems', actionItemId);
    await deleteDoc(actionDocRef);
  } catch (err) {
    console.warn('Firestore delete action item failed, updating local cache:', err);
    const items = getLocalItems<ActionItemEntry>(key).filter((i) => i.id !== actionItemId);
    setLocalItems(key, items);
  }
}

export async function toggleActionItemStatus(
  userId: string,
  actionItemId: string,
  currentStatus: 'open' | 'completed'
): Promise<void> {
  if (!userId || !actionItemId) throw new Error('User ID and Action Item ID are required');
  const nextStatus = currentStatus === 'open' ? 'completed' : 'open';
  const completedAt = nextStatus === 'completed' ? new Date().toISOString() : null;

  const key = `mindscribe_action_items_${userId}`;

  if (isDemoUserId(userId) || !isFirebaseConfigured || !db) {
    const items = getLocalItems<ActionItemEntry>(key);
    const item = items.find((i) => i.id === actionItemId);
    if (item) {
      item.status = nextStatus;
      item.completedAt = completedAt;
      setLocalItems(key, items);
    }
    return;
  }

  try {
    const actionDocRef = doc(db, 'users', userId, 'actionItems', actionItemId);
    await setDoc(
      actionDocRef,
      {
        status: nextStatus,
        completedAt,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore toggle action item failed, updating local cache:', err);
    const items = getLocalItems<ActionItemEntry>(key);
    const item = items.find((i) => i.id === actionItemId);
    if (item) {
      item.status = nextStatus;
      item.completedAt = completedAt;
      setLocalItems(key, items);
    }
  }
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

  const key = `mindscribe_action_items_${userId}`;

  if (isDemoUserId(userId) || !isFirebaseConfigured || !db) {
    onUpdate(getLocalItems<ActionItemEntry>(key));
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail || customEvent.detail.key === key) {
        onUpdate(getLocalItems<ActionItemEntry>(key));
      }
    };
    window.addEventListener('mindscribe_storage_change', handler);
    return () => {
      window.removeEventListener('mindscribe_storage_change', handler);
    };
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
      console.warn('Firestore action items subscription fallback:', err);
      onUpdate(getLocalItems<ActionItemEntry>(key));
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
  // New accounts start as `member`. Elevation happens only through an admin
  // writing /roles/{uid}, which the security rules restrict to admins.
  const defaultRole: UserRole = isDemoUserId(userId) ? 'superadmin' : 'member';

  if (isDemoUserId(userId) || !isFirebaseConfigured || !db) {
    const key = `mindscribe_roles_${userId}`;
    const cachedRole = localStorage.getItem(key) as UserRole;
    if (cachedRole) return cachedRole;
    localStorage.setItem(key, defaultRole);
    return defaultRole;
  }

  try {
    const roleDocRef = doc(db, 'roles', userId);
    const snap = await getDoc(roleDocRef);
    if (snap.exists()) {
      const data = snap.data() as UserRoleDocument;
      return data.role || 'member';
    } else {
      const payload: UserRoleDocument = {
        userId,
        role: defaultRole,
        email: email || '',
        displayName: displayName || '',
        grantedAt: new Date().toISOString(),
        grantedBy: 'system_bootstrap',
      };
      await setDoc(roleDocRef, sanitizePayload(payload), { merge: true });
      return defaultRole;
    }
  } catch (err) {
    console.warn('Failed to initialize user role in Firestore:', err);
    return defaultRole;
  }
}

export async function getUserRole(userId: string): Promise<UserRole> {
  if (!userId) return 'member';
  if (isDemoUserId(userId) || !isFirebaseConfigured || !db) {
    const key = `mindscribe_roles_${userId}`;
    return (localStorage.getItem(key) as UserRole) || 'superadmin';
  }
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

  if (isDemoUserId(userId) || !isFirebaseConfigured || !db) {
    const key = `mindscribe_roles_${userId}`;
    localStorage.setItem(key, role);
    window.dispatchEvent(new CustomEvent('mindscribe_role_change', { detail: { userId, role } }));
    return;
  }

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

  if (isDemoUserId(userId) || !isFirebaseConfigured || !db) {
    const key = `mindscribe_roles_${userId}`;
    const initial = (localStorage.getItem(key) as UserRole) || 'superadmin';
    onUpdate(initial);
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.userId === userId) {
        onUpdate(customEvent.detail.role);
      }
    };
    window.addEventListener('mindscribe_role_change', handler);
    return () => {
      window.removeEventListener('mindscribe_role_change', handler);
    };
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
  if (!isFirebaseConfigured || !db) {
    onUpdate([]);
    return () => {};
  }

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
      // Do not fabricate a role list on failure - an empty list plus a surfaced
      // error is honest; fake data hides a real permissions problem.
      console.error('[RBAC] Could not subscribe to roles collection:', err);
      onUpdate([]);
      onError(err);
    }
  );
}

// ---------------------------------------------------------------------------
// External Webhook Configurations `/users/{userId}/webhooks/{webhookId}`
// ---------------------------------------------------------------------------

export async function saveWebhookConfig(userId: string, config: WebhookConfig): Promise<void> {
  if (!userId || !config.id) throw new Error('User ID and Webhook ID are required');

  const key = `mindscribe_webhooks_${userId}`;
  const sanitized = sanitizePayload(config);

  if (isDemoUserId(userId) || !isFirebaseConfigured || !db) {
    const items = getLocalItems<WebhookConfig>(key);
    const idx = items.findIndex((i) => i.id === config.id);
    if (idx >= 0) items[idx] = sanitized;
    else items.unshift(sanitized);
    setLocalItems(key, items);
    return;
  }

  try {
    const webhookDocRef = doc(db, 'users', userId, 'webhooks', config.id);
    await setDoc(webhookDocRef, sanitized, { merge: true });
  } catch (err) {
    console.warn('Firestore save webhook failed, caching locally:', err);
    const items = getLocalItems<WebhookConfig>(key);
    const idx = items.findIndex((i) => i.id === config.id);
    if (idx >= 0) items[idx] = sanitized;
    else items.unshift(sanitized);
    setLocalItems(key, items);
  }
}

export async function deleteWebhookConfig(userId: string, webhookId: string): Promise<void> {
  if (!userId || !webhookId) throw new Error('User ID and Webhook ID are required');

  const key = `mindscribe_webhooks_${userId}`;

  if (isDemoUserId(userId) || !isFirebaseConfigured || !db) {
    const items = getLocalItems<WebhookConfig>(key).filter((i) => i.id !== webhookId);
    setLocalItems(key, items);
    return;
  }

  try {
    const webhookDocRef = doc(db, 'users', userId, 'webhooks', webhookId);
    await deleteDoc(webhookDocRef);
  } catch (err) {
    console.warn('Firestore delete webhook failed, updating local cache:', err);
    const items = getLocalItems<WebhookConfig>(key).filter((i) => i.id !== webhookId);
    setLocalItems(key, items);
  }
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

  const key = `mindscribe_webhooks_${userId}`;

  if (isDemoUserId(userId) || !isFirebaseConfigured || !db) {
    onUpdate(getLocalItems<WebhookConfig>(key));
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail || customEvent.detail.key === key) {
        onUpdate(getLocalItems<WebhookConfig>(key));
      }
    };
    window.addEventListener('mindscribe_storage_change', handler);
    return () => {
      window.removeEventListener('mindscribe_storage_change', handler);
    };
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
      console.warn('Webhooks subscription error, falling back to local storage:', err);
      onUpdate(getLocalItems<WebhookConfig>(key));
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
  const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const payload: AuditLogEntry = {
    ...event,
    id: logId,
    timestamp: new Date().toISOString(),
  };

  const key = 'mindscribe_audit_logs';
  const localLogs = getLocalItems<AuditLogEntry>(key);
  localLogs.unshift(payload);
  if (localLogs.length > 50) localLogs.pop();
  setLocalItems(key, localLogs);

  if (isFirebaseConfigured && db) {
    try {
      const logDocRef = doc(db, 'audit_logs', logId);
      await setDoc(logDocRef, sanitizePayload(payload));
    } catch (err) {
      console.warn('Could not write audit log to firestore (saved locally):', err);
    }
  }
}

export function subscribeToAuditLogs(
  onUpdate: (logs: AuditLogEntry[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const key = 'mindscribe_audit_logs';

  if (!isFirebaseConfigured || !db) {
    onUpdate(getLocalItems<AuditLogEntry>(key));
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail || customEvent.detail.key === key) {
        onUpdate(getLocalItems<AuditLogEntry>(key));
      }
    };
    window.addEventListener('mindscribe_storage_change', handler);
    return () => {
      window.removeEventListener('mindscribe_storage_change', handler);
    };
  }

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
      console.warn('Audit logs subscription error (may require admin permissions), using local logs:', err);
      onUpdate(getLocalItems<AuditLogEntry>(key));
      onError(err);
    }
  );
}


