// api/analytics.js
// Read current analytics snapshot (active sessions, total, daily).
// Writes are done client-side via Firebase RTDB presence system.
// This endpoint just exposes a read for non-Firebase contexts.

import { getDb, requireAuth } from './_firebase-admin.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-app-password, x-firebase-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const authed = await requireAuth(req, res);
  if (!authed) return;

  try {
    const db = getDb();
    const snap = await db.ref('analytics').get();
    return res.status(200).json(snap.val() || {});
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
