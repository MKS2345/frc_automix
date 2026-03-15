// api/webhook.js
// Receives Nexus push webhooks → writes lean data to Firebase RTDB.
// Nexus fires this on every match status change.
// Schema written:
//   /teams/{num}  { status, onFieldAt, match, currentEvent, updatedAt }
//   /events/{key} { currentMatch, onDeck, nexusActive, updatedAt }

import { getDb } from './_firebase-admin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Verify this is actually from Nexus
  const nexusToken = process.env.NEXUS_WEBHOOK_TOKEN;
  if (nexusToken && req.headers['nexus-token'] !== nexusToken) {
    return res.status(401).json({ error: 'Invalid Nexus token' });
  }

  const body = req.body;
  if (!body) return res.status(400).json({ error: 'No body' });

  const { eventKey, matches, dataAsOfTime } = body;
  if (!eventKey) return res.status(400).json({ error: 'No eventKey' });

  const db = getDb();
  const now = dataAsOfTime || Date.now();

  // ── Parse the latest on-field and on-deck matches ──────────────────────────
  // Nexus never clears old statuses — find latest by timestamp
  const allMatches = Array.isArray(matches) ? matches : [];

  const onFieldMatches = allMatches.filter(m =>
    normalizeStatus(m.status) === 'onField' || normalizeStatus(m.status) === 'inProgress'
  );
  const currentMatch = latestMatch(onFieldMatches);

  const onDeckMatches = allMatches.filter(m =>
    normalizeStatus(m.status) === 'onDeck' || normalizeStatus(m.status) === 'queuing'
  );
  const onDeckMatch = latestMatch(onDeckMatches);

  const writes = [];

  // ── Write event-level data ─────────────────────────────────────────────────
  const eventUpdate = {
    nexusActive: true,
    updatedAt: now,
  };

  if (currentMatch) {
    eventUpdate.currentMatch = {
      label: currentMatch.label || '',
      status: currentMatch.status || '',
      r1: currentMatch.redTeams?.[0] ?? null,
      r2: currentMatch.redTeams?.[1] ?? null,
      r3: currentMatch.redTeams?.[2] ?? null,
      b1: currentMatch.blueTeams?.[0] ?? null,
      b2: currentMatch.blueTeams?.[1] ?? null,
      b3: currentMatch.blueTeams?.[2] ?? null,
      onFieldAt: currentMatch.times?.actualStartTime
        ?? currentMatch.times?.estimatedStartTime
        ?? now,
      estimatedStartAt: currentMatch.times?.estimatedStartTime ?? null,
    };
  } else {
    eventUpdate.currentMatch = null;
  }

  if (onDeckMatch) {
    eventUpdate.onDeck = {
      label: onDeckMatch.label || '',
      r1: onDeckMatch.redTeams?.[0] ?? null,
      r2: onDeckMatch.redTeams?.[1] ?? null,
      r3: onDeckMatch.redTeams?.[2] ?? null,
      b1: onDeckMatch.blueTeams?.[0] ?? null,
      b2: onDeckMatch.blueTeams?.[1] ?? null,
      b3: onDeckMatch.blueTeams?.[2] ?? null,
    };
  } else {
    eventUpdate.onDeck = null;
  }

  writes.push(
    db.ref(`events/${eventKey}`).update(eventUpdate)
  );

  // ── Write per-team data for everyone in the current match ─────────────────
  if (currentMatch) {
    const allTeams = [
      ...(currentMatch.redTeams || []).map((t, i) => ({
        num: t, alliance: 'red', position: i + 1,
      })),
      ...(currentMatch.blueTeams || []).map((t, i) => ({
        num: t, alliance: 'blue', position: i + 1,
      })),
    ].filter(t => t.num != null);

    const matchStatus = normalizeStatus(currentMatch.status);

    for (const { num, alliance, position } of allTeams) {
      const teamNum = num.toString().replace(/frc/i, '');
      if (!teamNum || teamNum === 'null') continue;

      writes.push(
        db.ref(`teams/${teamNum}`).update({
          currentEvent: eventKey,
          status: matchStatus,
          onFieldAt: currentMatch.times?.actualStartTime
            ?? currentMatch.times?.estimatedStartTime
            ?? now,
          match: {
            label: currentMatch.label || '',
            alliance,
            position,
            r1: currentMatch.redTeams?.[0] ?? null,
            r2: currentMatch.redTeams?.[1] ?? null,
            r3: currentMatch.redTeams?.[2] ?? null,
            b1: currentMatch.blueTeams?.[0] ?? null,
            b2: currentMatch.blueTeams?.[1] ?? null,
            b3: currentMatch.blueTeams?.[2] ?? null,
          },
          updatedAt: now,
        })
      );
    }
  }

  // Teams from the PREVIOUS match that are no longer on field → mark idle
  // We don't know who was on before without reading, so we rely on
  // refresh-team.js to clean up stale statuses on next demand-load.
  // This keeps webhook writes O(6) per call.

  await Promise.allSettled(writes);

  return res.status(200).json({ ok: true, event: eventKey });
}

// ── Helpers (duplicated from client to avoid shared module issues) ──────────
function normalizeStatus(raw) {
  if (!raw) return 'unknown';
  const s = raw.toString().toLowerCase().replace(/[_\s-]/g, '');
  if (s === 'onfield' || s === 'field')                         return 'onField';
  if (s === 'inprogress' || s === 'awaitingresults')            return 'inProgress';
  if (s === 'ondeck')                                           return 'onDeck';
  if (s === 'nowqueuing' || s === 'queuing')                    return 'queuing';
  if (s === 'complete' || s === 'done' || s === 'posted')       return 'complete';
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
