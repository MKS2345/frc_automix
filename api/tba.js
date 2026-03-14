// api/tba.js
// Serverless proxy for The Blue Alliance API
// API key is stored in Vercel env vars, never exposed to client

export default async function handler(req, res) {
  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Password check
  const authHeader = req.headers['x-app-password'];
  const appPassword = process.env.APP_PASSWORD;
  if (appPassword && authHeader !== appPassword) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tbaKey = process.env.TBA_API_KEY;
  if (!tbaKey) {
    return res.status(500).json({ error: 'TBA_API_KEY not configured' });
  }

  // The path after /api/tba is forwarded to TBA
  const { path } = req.query;
  if (!path) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  const tbaPath = Array.isArray(path) ? path.join('/') : path;
  const tbaUrl = `https://www.thebluealliance.com/api/v3/${tbaPath}`;

  try {
    const response = await fetch(tbaUrl, {
      headers: {
        'X-TBA-Auth-Key': tbaKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `TBA returned ${response.status}` });
    }

    const data = await response.json();
    
    // Cache headers to reduce API hits
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
