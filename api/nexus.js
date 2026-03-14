// api/nexus.js
// Serverless proxy for FRC Nexus API
// API key stored in Vercel env vars

export default async function handler(req, res) {
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

  const nexusKey = process.env.NEXUS_API_KEY;
  if (!nexusKey) {
    return res.status(500).json({ error: 'NEXUS_API_KEY not configured' });
  }

  const { eventCode } = req.query;
  if (!eventCode) {
    return res.status(400).json({ error: 'Missing eventCode parameter' });
  }

  // Correct Nexus endpoint: GET /api/v1/event/{eventKey}
  // Returns { eventKey, dataAsOfTime, matches: [], announcements: [], partsRequests: [] }
  // NOTE: no /matches suffix — the matches array is inside the response body
  const nexusUrl = `https://frc.nexus/api/v1/event/${eventCode}`;

  try {
    const response = await fetch(nexusUrl, {
      headers: {
        'Nexus-Api-Key': nexusKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Nexus returned ${response.status}` });
    }

    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20');
    // Return full object — client reads data.matches
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
