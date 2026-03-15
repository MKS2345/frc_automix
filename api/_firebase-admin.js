// api/_firebase-admin.js
// Shared Firebase Admin init — imported by all serverless functions.
// Uses a module-level singleton so it's only initialized once per cold start.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getAuth } from 'firebase-admin/auth';

let app;

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  app = initializeApp({
    credential: cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
  return app;
}

export function getDb() {
  return getDatabase(getAdminApp());
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

// Verify a Firebase ID token from the client (proves anon auth session)
export async function verifyToken(req) {
  const token = req.headers['x-firebase-token'];
  if (!token) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return decoded;
  } catch {
    return null;
  }
}

// Also check APP_PASSWORD for the login gate
export function checkAppPassword(req) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return true;
  return req.headers['x-app-password'] === appPassword;
}

// Combined auth: must pass both app password AND have valid Firebase token
export async function requireAuth(req, res) {
  if (!checkAppPassword(req)) {
    res.status(401).json({ error: 'Invalid app password' });
    return false;
  }
  const token = await verifyToken(req);
  if (!token) {
    res.status(401).json({ error: 'Invalid Firebase token' });
    return false;
  }
  return true;
}
