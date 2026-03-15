// api/webhook.js
// Receives Nexus push webhooks → writes lean data to Firebase RTDB.
// Auth: Nexus-Token header only (Nexus doesn't send Firebase tokens).
// Schema written:
//   /teams/{num}  { status, onFieldAt, match, currentEvent, updatedAt }
//   /events/{key} { currentMatch, onDeck, nexusActive, updatedAt }

import { getDb } from './_firebase-admin.js';

export default async function handler(req, res) {
  // Nexus sends POST
  if (req.method !== 'POST') return res.status(405).end();

  // Verify Nexus-Token — this is the only auth needed for the webhook
  // (Nexus calls this, not the browser, so no Firebase token)
  const nexusToken = process.env.NEXUS_WEBHOOK_TOKEN;
  if (nexusToken) {
    const incoming = req.headers['nexus-token'] || req.headers['Nexus-Token'];
    if (incoming !== nexusToken) {
      console.warn('[webhook] Invalid Nexus-Token');
      return res.status(401).json({ error: 'Invalid Nexus token' });
    }
  }

  const body = req.body;
  if (!body) return res.status(400).json({ error: 'No body' });

  // Nexus sends either a full event payload or a single-match update
  // Full event: { eventKey, matches: [...], dataAsOfTime }
  // Single match: { eventKey, match: {...}, dataAsOfTime }
  const eventKey = body.eventKey;
  if (!eventKey) return res.status(400).json({ error: 'No eventKey' });

  const allMatches = body.matches
      ? (Array.isArray(body.matches) ? body.matches : [])
      : (body.match ? [body.match] : []);

  const now = body.dataAsOfTime || Date.now();

  const db = getDb();

  // ── Find current on-field and on-deck matches ─────────────────────────────
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

  // ── Write event-level data ─────────────────────────────────────────────────
  const eventUpdate = {
    nexusActive: true,
    updatedAt: now,
    currentMatch: currentMatch ? {
      label:       currentMatch.label || '',
      status:      currentMatch.status || '',
      r1: currentMatch.redTeams?.[0]  ?? null,
      r2: currentMatch.redTeams?.[1]  ?? null,
      r3: currentMatch.redTeams?.[2]  ?? null,
      b1: currentMatch.blueTeams?.[0] ?? null,
      b2: currentMatch.blueTeams?.[1] ?? null,
      b3: currentMatch.blueTeams?.[2] ?? null,
      onFieldAt: currentMatch.times?.actualStartTime
          ?? currentMatch.times?.estimatedStartTime
          ?? now,
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

  // ── Write per-team data ───────────────────────────────────────────────────
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
            status:       matchStatus,
            onFieldAt:    currentMatch.times?.actualStartTime
                ?? currentMatch.times?.estimatedStartTime
                ?? now,
            match: {
              label:    currentMatch.label || '',
              alliance,
              position,
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

  // Also update stream freshness check — if Nexus is firing, event is running,
  // trigger a stream recheck if streams haven't been checked in the last hour
  try {
    const streamSnap = await db.ref(`events/${eventKey}/streamsCheckedAt`).get();
    const checkedAt  = streamSnap.val();
    const ONE_HOUR   = 60 * 60 * 1000;
    if (!checkedAt || (Date.now() - checkedAt) > ONE_HOUR) {
      // Fire-and-forget stream refresh
      const origin = `https://${req.headers.host}`;
      fetch(`${origin}/api/refresh-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Use internal service account auth for this server→server call
          'x-internal-secret': process.env.NEXUS_WEBHOOK_TOKEN || '',
        },
        body: JSON.stringify({ eventKey }),
      }).catch(() => {});
    }
  } catch {}

  await Promise.allSettled(writes);
  return res.status(200).json({ ok: true, event: eventKey });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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