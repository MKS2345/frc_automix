import { getDb } from './_firebase-admin.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Read raw body as string regardless of content-type
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk.toString(); });
    req.on('end',  () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  const db = getDb();

  const entry = { parsedBody: null, rawBody: null };

  try {
    const raw = await getRawBody(req);
    entry.rawBody = raw;
    entry.parsedBody = raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('[webhook] body parse failed:', e.message);
  }

  // ── GET: verification ping from Nexus ─────────────────────────────────────
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, service: 'frc-automix-webhook' });
  }
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const body = entry.parsedBody || {};

  // ── Nexus ownership verification ping ─────────────────────────────────────
  // Nexus sends { token: "..." } in the body (no eventKey) to verify the endpoint.
  // Just check the token and return 200.
  if (body.token && !body.eventKey) {
    const nexusToken = process.env.NEXUS_WEBHOOK_TOKEN;
    if (nexusToken && body.token !== nexusToken) {
      return res.status(401).json({ error: 'Token mismatch' });
    }
    return res.status(200).json({ ok: true, verified: true });
  }

  // ── Token check for real event payloads (token in header) ─────────────────
  const nexusToken = process.env.NEXUS_WEBHOOK_TOKEN;
  if (nexusToken) {
    const headerToken = req.headers['nexus-token'];
    if (headerToken && headerToken !== nexusToken) {
      return res.status(401).json({ error: 'Invalid Nexus token' });
    }
  }

  if (!body) return res.status(400).json({ error: 'No body', raw: entry.rawBody?.slice(0, 200) });

  const eventKey = body.eventKey;
  if (!eventKey) return res.status(400).json({ error: 'No eventKey', keys: Object.keys(body) });

  // ── Parse matches ─────────────────────────────────────────────────────────
  const allMatches = body.matches
      ? (Array.isArray(body.matches) ? body.matches : [])
      : (body.match ? [body.match] : []);

  const now = body.dataAsOfTime || ts;

  const onFieldMatches = allMatches.filter(m => {
    const s = normalizeStatus(m.status);
    return s === 'onField' || s === 'inProgress';
  });
  const currentMatch = latestMatch(onFieldMatches);

  const onDeckMatches = allMatches.filter(m => {
    const s = normalizeStatus(m.status);
    return s === 'onDeck' || s === 'queuing';
  });
  const onDeckMatch = latestMatch(onDeckMatches);

  const writes = [];

  // ── Clear previous match teams that are no longer on field ───────────────
  // Read the current event data to find who was in the last match,
  // then mark any team NOT in the new match as idle.
  if (currentMatch) {
    try {
      const prevSnap = await db.ref(`events/${eventKey}/currentMatch`).get();
      const prev = prevSnap.val();
      if (prev) {
        const prevTeams = [prev.r1, prev.r2, prev.r3, prev.b1, prev.b2, prev.b3]
            .filter(t => t && t !== 'null');
        const newTeams = [
          ...(currentMatch.redTeams  || []),
          ...(currentMatch.blueTeams || []),
        ].map(t => t?.toString().replace(/frc/i, '').trim()).filter(Boolean);

        for (const t of prevTeams) {
          const teamNum = t.toString().replace(/frc/i, '').trim();
          if (!teamNum || newTeams.includes(teamNum)) continue;
          writes.push(
              db.ref(`teams/${teamNum}`).update({ status: 'idle', updatedAt: now })
          );
        }
      }
    } catch {}
  }

  const eventUpdate = {
    nexusActive: true,
    updatedAt: now,
    currentMatch: currentMatch ? {
      label:  currentMatch.label || '',
      status: currentMatch.status || '',
      r1: currentMatch.redTeams?.[0]  ?? null,
      r2: currentMatch.redTeams?.[1]  ?? null,
      r3: currentMatch.redTeams?.[2]  ?? null,
      b1: currentMatch.blueTeams?.[0] ?? null,
      b2: currentMatch.blueTeams?.[1] ?? null,
      b3: currentMatch.blueTeams?.[2] ?? null,
      onFieldAt: currentMatch.times?.actualStartTime
          ?? currentMatch.times?.estimatedStartTime ?? now,
      estimatedStartAt: currentMatch.times?.estimatedStartTime ?? null,
    } : null,
    onDeck: onDeckMatch ? {
      label: onDeckMatch.label || '',
      r1: onDeckMatch.redTeams?.[0]  ?? null,
      r2: onDeckMatch.redTeams?.[1]  ?? null,
      r3: onDeckMatch.redTeams?.[2]  ?? null,
      b1: onDeckMatch.blueTeams?.[0] ?? null,
      b2: onDeckMatch.blueTeams?.[1] ?? null,
      b3: onDeckMatch.blueTeams?.[2] ?? null,
    } : null,
  };

  writes.push(db.ref(`events/${eventKey}`).update(eventUpdate));

  if (currentMatch) {
    const teams = [
      ...(currentMatch.redTeams  || []).map((t, i) => ({ num: t, alliance: 'red',  position: i + 1 })),
      ...(currentMatch.blueTeams || []).map((t, i) => ({ num: t, alliance: 'blue', position: i + 1 })),
    ].filter(t => t.num != null && t.num !== 'null');

    const matchStatus = normalizeStatus(currentMatch.status);

    for (const { num, alliance, position } of teams) {
      const teamNum = num.toString().replace(/frc/i, '').trim();
      if (!teamNum || teamNum === 'null') continue;
      writes.push(
          db.ref(`teams/${teamNum}`).update({
            currentEvent: eventKey,
            status: matchStatus,
            onFieldAt: currentMatch.times?.actualStartTime
                ?? currentMatch.times?.estimatedStartTime ?? now,
            match: {
              label: currentMatch.label || '',
              alliance, position,
              r1: currentMatch.redTeams?.[0]  ?? null,
              r2: currentMatch.redTeams?.[1]  ?? null,
              r3: currentMatch.redTeams?.[2]  ?? null,
              b1: currentMatch.blueTeams?.[0] ?? null,
              b2: currentMatch.blueTeams?.[1] ?? null,
              b3: currentMatch.blueTeams?.[2] ?? null,
            },
            updatedAt: now,
          })
      );
    }
  }

  // Trigger stream refresh if stale
  try {
    const streamSnap = await db.ref(`events/${eventKey}/streamsCheckedAt`).get();
    const checkedAt  = streamSnap.val();
    if (!checkedAt || (Date.now() - checkedAt) > 60 * 60 * 1000) {
      fetch(`https://${req.headers.host}/api/refresh-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.NEXUS_WEBHOOK_TOKEN || '',
        },
        body: JSON.stringify({ eventKey }),
      }).catch(() => {});
    }
  } catch {}

  await Promise.allSettled(writes);
  return res.status(200).json({ ok: true, event: eventKey });
}

function normalizeStatus(raw) {
  if (!raw) return 'unknown';
  const s = raw.toString().toLowerCase().replace(/[_\s-]/g, '');
  if (s === 'onfield' || s === 'field')               return 'onField';
  if (s === 'inprogress' || s === 'awaitingresults')  return 'inProgress';
  if (s === 'ondeck')                                 return 'onDeck';
  if (s === 'nowqueuing' || s === 'queuing')          return 'queuing';
  if (s === 'complete' || s === 'done' || s === 'posted') return 'complete';
  return 'unknown';
}

function latestMatch(matches) {
  return matches.reduce((best, m) => {
    if (!best) return m;
    const bt = best.times?.actualStartTime ?? best.times?.estimatedStartTime ?? 0;
    const mt = m.times?.actualStartTime    ?? m.times?.estimatedStartTime    ?? 0;
    return mt >= bt ? m : best;
  }, null);
}