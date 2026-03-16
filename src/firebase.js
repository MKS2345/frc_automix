// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  getDatabase, ref, onValue, set, remove,
  serverTimestamp, onDisconnect, increment, update,
} from 'firebase/database';

const firebaseConfig = {
  apiKey:      import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:   import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);

export { auth, db, ref, onValue, serverTimestamp };

// ── Anonymous auth ─────────────────────────────────────────────────────────
let _authPromise = null;

export function ensureAuth() {
  if (_authPromise) return _authPromise;
  _authPromise = new Promise((resolve, reject) => {
    // Timeout after 10s so the app doesn't hang forever if Firebase is misconfigured
    const timeout = setTimeout(() => {
      reject(new Error('Firebase auth timeout — check Anonymous Auth is enabled in Firebase Console'));
    }, 10_000);

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        clearTimeout(timeout);
        try {
          const idToken = await user.getIdToken();
          resolve({ user, idToken });
        } catch (e) {
          reject(e);
        }
      }
    });

    signInAnonymously(auth).catch((err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
  return _authPromise;
}

// ── Presence ───────────────────────────────────────────────────────────────
let _presenceSetup = false;
export async function setupPresence() {
  if (_presenceSetup) return;
  _presenceSetup = true;

  let user;
  try {
    ({ user } = await ensureAuth());
  } catch {
    return; // Auth failed — skip presence silently
  }

  const connectedRef = ref(db, '.info/connected');
  const presenceRef  = ref(db, `presence/${user.uid}`);

  onValue(connectedRef, async (snap) => {
    if (!snap.val()) return;
    try {
      await onDisconnect(presenceRef).remove();
      await set(presenceRef, { connectedAt: serverTimestamp() });

      const today = new Date().toISOString().split('T')[0];
      await update(ref(db, 'analytics'), {
        [`daily/${today}/sessions`]: increment(1),
        totalSessions: increment(1),
      });
    } catch {}
  });
}

// ── ID token getter ────────────────────────────────────────────────────────
export async function getIdToken() {
  try {
    const { idToken } = await ensureAuth();
    return idToken;
  } catch {
    return '';
  }
}

// ── Active sessions listener ───────────────────────────────────────────────
export function onActiveSessionsChange(callback) {
  return onValue(ref(db, 'presence'), (snap) => {
    // Presence is small but fires frequently — worth tracking
    const bytes = snap.exists() ? new TextEncoder().encode(JSON.stringify(snap.val())).length : 0;
    console.log(`[Firebase ↓] presence (login screen)       ${(bytes/1024).toFixed(2).padStart(8)} KB`);
    callback(snap.exists() ? Object.keys(snap.val() || {}).length : 0);
  });
}

export function onTotalSessionsChange(callback) {
  return onValue(ref(db, 'analytics/totalSessions'), (snap) => {
    console.log(`[Firebase ↓] analytics/totalSessions        ${(0).toFixed(2).padStart(8)} KB`);
    callback(snap.val() || 0);
  });
}