// src/firebase.js
// Firebase client SDK — anon auth + RTDB.
// VITE_ prefixed env vars are safe to expose in the client bundle
// because they only enable anonymous auth (no privileged access).

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
// Returns a promise that resolves with { user, idToken } once signed in.
let _authPromise = null;
export function ensureAuth() {
  if (_authPromise) return _authPromise;
  _authPromise = new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const idToken = await user.getIdToken();
        resolve({ user, idToken });
      }
    });
    signInAnonymously(auth).catch(reject);
  });
  return _authPromise;
}

// ── Presence system ────────────────────────────────────────────────────────
// Writes to /presence/{uid} on connect, auto-removes on disconnect.
// /analytics/activeSessions is maintained as a count via server-side rules
// or a Cloud Function — here we just manage the presence node.
let _presenceSetup = false;
export async function setupPresence() {
  if (_presenceSetup) return;
  _presenceSetup = true;

  const { user } = await ensureAuth();

  // Use Firebase's special .info/connected path
  const connectedRef = ref(db, '.info/connected');
  const presenceRef  = ref(db, `presence/${user.uid}`);
  const analyticsRef = ref(db, 'analytics');

  onValue(connectedRef, async (snap) => {
    if (!snap.val()) return;

    // On disconnect: remove presence + decrement active count
    await onDisconnect(presenceRef).remove();
    await onDisconnect(ref(db, 'analytics/activeSessions')).set(
      // Can't do decrement in onDisconnect easily — use a separate counter path
      // We'll handle this via security rules instead; just remove presence node
      null // placeholder — see Firebase rules note in README
    );

    // Write presence
    await set(presenceRef, { connectedAt: serverTimestamp(), uid: user.uid });

    // Increment total sessions + daily
    const today = new Date().toISOString().split('T')[0];
    await update(analyticsRef, {
      [`daily/${today}/sessions`]: increment(1),
      totalSessions: increment(1),
    });
  });
}

// ── ID token getter (for API calls) ───────────────────────────────────────
export async function getIdToken() {
  const { idToken } = await ensureAuth();
  return idToken;
}

// ── Active session count listener ─────────────────────────────────────────
// Counts children under /presence to get live viewer count.
export function onActiveSessionsChange(callback) {
  return onValue(ref(db, 'presence'), (snap) => {
    const count = snap.exists() ? Object.keys(snap.val() || {}).length : 0;
    callback(count);
  });
}

// ── Analytics daily count ──────────────────────────────────────────────────
export function onTotalSessionsChange(callback) {
  return onValue(ref(db, 'analytics/totalSessions'), (snap) => {
    callback(snap.val() || 0);
  });
}
