// api/refresh-team.js
// On-demand: look up a team in TBA, find their current event, write lean data to Firebase.
// Called by the app when /teams/{num} is missing or stale (>30min old for metadata).
// Team STATUS comes from Nexus webhooks, not here — this only handles metadata.

import { getDb, requireAuth } from './_firebase-admin.js';

const TBA_BASE = 'https://www.thebluealliance.com/api/v3';

async function tbaFetch(path) {
  const res = await fetch(`${TBA_BASE}/${path}`, {
    headers: { 'X-TBA-Auth-Key': process.env.TBA_API_KEY },
  });
  if (!res.ok) throw new Error(`TBA ${res.status} for ${path}`);
  return res.json();
}

function getCurrentYear() {
  return new Date().getFullYear();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-app-password, x-firebase-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const internalSecret = process.env.NEXUS_WEBHOOK_TOKEN;
  const isInternalCall = internalSecret && req.headers['x-internal-secret'] === internalSecret;
  if (!isInternalCall) {
    const authed = await requireAuth(req, res);
    if (!authed) return;
  }

  const { teamNum } = req.body || req.query || {};
  if (!teamNum) return res.status(400).json({ error: 'Missing teamNum' });

  const num = teamNum.toString().replace(/frc/i, '');
  const db = getDb();
  const now = Date.now();

  // Check if Firebase already has fresh metadata (updated within 6hr)
  const existing = await db.ref(`teams/${num}`).get();
  const data = existing.val();
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  if (data?.nameFetchedAt && (now - data.nameFetchedAt) < SIX_HOURS && data.name) {
    // Metadata is fresh — just return what we have
    return res.status(200).json({ ok: true, cached: true, data });
  }

  try {
    // Fetch team info + current year events from TBA
    const [teamInfo, teamEvents] = await Promise.all([
      tbaFetch(`team/frc${num}/simple`),
      tbaFetch(`team/frc${num}/events/${getCurrentYear()}/simple`),
    ]);

    // Find current or next upcoming event
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    const sortedEvents = (teamEvents || []).sort((a, b) =>
        new Date(a.start_date) - new Date(b.start_date)
    );

    // Current = started and not ended yet
    const currentEvent = sortedEvents.find(e => {
      const start = new Date(e.start_date).getTime();
      const end   = new Date(e.end_date).getTime() + 86400000;
      return start <= todayMs && end >= todayMs;
    });

    // Next upcoming if not currently at one
    const nextEvent = !currentEvent
        ? sortedEvents.find(e => new Date(e.start_date).getTime() > todayMs)
        : null;

    const relevantEvent = currentEvent || nextEvent;

    const update = {
      name: teamInfo.nickname || teamInfo.team_number?.toString() || num,
      nameFetchedAt: now,
    };

    if (relevantEvent) {
      update.currentEvent = relevantEvent.key;
      update.eventName    = relevantEvent.short_name || relevantEvent.name;
    }

    await db.ref(`teams/${num}`).update(update);

    // Also ensure event metadata exists in Firebase
    if (relevantEvent) {
      const eventSnap = await db.ref(`events/${relevantEvent.key}`).get();
      const eventData = eventSnap.val();
      const ONE_HOUR  = 60 * 60 * 1000;
      if (!eventData?.updatedAt || (now - eventData.updatedAt) > ONE_HOUR) {
        // Trigger event refresh asynchronously (fire and forget)
        fetch(`${req.headers.origin || ''}/api/refresh-event`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-app-password': req.headers['x-app-password'] || '',
            'x-firebase-token': req.headers['x-firebase-token'] || '',
          },
          body: JSON.stringify({ eventKey: relevantEvent.key }),
        }).catch(() => {});
      }
    }

    return res.status(200).json({ ok: true, cached: false });
  } catch (err) {
    console.error(`[refresh-team] frc${num}:`, err.message);
    return res.status(500).json({ error: err.message });
  }
}
