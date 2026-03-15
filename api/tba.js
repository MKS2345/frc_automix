// api/tba.js
import { requireAuth } from './_firebase-admin.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-app-password, x-firebase-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const authed = await requireAuth(req, res);
  if (!authed) return;

  const tbaKey = process.env.TBA_API_KEY;
  if (!tbaKey) return res.status(500).json({ error: 'TBA_API_KEY not configured' });

  const { path } = req.query;
  if (!path) return res.status(400).json({ error: 'Missing path' });

  const tbaPath = Array.isArray(path) ? path.join('/') : path;

  try {
    const response = await fetch(`https://www.thebluealliance.com/api/v3/${tbaPath}`, {
      headers: { 'X-TBA-Auth-Key': tbaKey },
    });
    if (!response.ok) return res.status(response.status).json({ error: `TBA ${response.status}` });
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
