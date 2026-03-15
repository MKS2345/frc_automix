// api/refresh-event.js
// On-demand: fetch TBA webcasts for an event, run YouTube live detection,
// write stream data to Firebase. Called when:
//   - Event data is missing from Firebase
//   - Event data is >1hr old
//   - Nexus webhook fires for an event with stale stream data
//   - User manually triggers override check

import { getDb, requireAuth } from './_firebase-admin.js';

const TBA_BASE = 'https://www.thebluealliance.com/api/v3';

async function tbaFetch(path) {
  const res = await fetch(`${TBA_BASE}/${path}`, {
    headers: { 'X-TBA-Auth-Key': process.env.TBA_API_KEY },
  });
  if (!res.ok) throw new Error(`TBA ${res.status}`);
  return res.json();
}

// Batch YouTube Data API v3 check — one call for up to 50 video IDs
// Returns a map of { videoId: 'live' | 'upcoming' | 'none' }
async function checkYoutubeLive(videoIds) {
  if (!videoIds.length) return {};
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return {};

  try {
    const ids = videoIds.join(',');
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos` +
      `?part=snippet,liveStreamingDetails&id=${ids}&key=${key}`
    );
    if (!res.ok) return {};
    const data = await res.json();

    const result = {};
    for (const item of data.items || []) {
      const lbc = item.snippet?.liveBroadcastContent || 'none';
      // 'live' = currently streaming, 'upcoming' = scheduled, 'none' = VOD/ended
      result[item.id] = lbc;
    }
    return result;
  } catch {
    return {};
  }
}

function buildEmbedUrl(wc, eventKey) {
  switch (wc.type) {
    case 'twitch':
      // parent will be set client-side; use placeholder
      return `https://player.twitch.tv/?channel=${wc.channel}&parent=HOSTNAME&autoplay=true`;
    case 'youtube':
      return `https://www.youtube.com/embed/${wc.channel}?autoplay=1&rel=0`;
    case 'livestream':
      return `https://livestream.com/accounts/${wc.channel}/events/${wc.file}/player`;
    default:
      return wc.channel?.startsWith('http') ? wc.channel : '';
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-app-password, x-firebase-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const authed = await requireAuth(req, res);
  if (!authed) return;

  const { eventKey, force } = req.body || req.query || {};
  if (!eventKey) return res.status(400).json({ error: 'Missing eventKey' });

  const db  = getDb();
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;

  // Check if already fresh (skip unless forced)
  if (!force) {
    const snap = await db.ref(`events/${eventKey}/streamsCheckedAt`).get();
    const checkedAt = snap.val();
    if (checkedAt && (now - checkedAt) < ONE_HOUR) {
      return res.status(200).json({ ok: true, cached: true });
    }
  }

  try {
    // Fetch event info + webcasts from TBA
    const [eventInfo, webcasts] = await Promise.all([
      tbaFetch(`event/${eventKey}/simple`),
      tbaFetch(`event/${eventKey}`).then(e => e.webcasts || []),
    ]);

    if (!webcasts.length) {
      await db.ref(`events/${eventKey}`).update({
        name: eventInfo.name || eventKey,
        shortName: eventInfo.short_name || eventInfo.name || eventKey,
        streams: [],
        activeStream: null,
        streamsCheckedAt: now,
        updatedAt: now,
      });
      return res.status(200).json({ ok: true, streams: 0 });
    }

    // Build stream objects
    const streams = webcasts.map((wc, i) => ({
      url: buildEmbedUrl(wc, eventKey),
      type: wc.type,
      videoId: wc.type === 'youtube' ? wc.channel : null,
      channel: wc.channel,
      label: webcasts.length > 1
        ? `Stream ${i + 1} (${wc.type})`
        : wc.type.charAt(0).toUpperCase() + wc.type.slice(1),
      index: i,
    })).filter(s => s.url);

    // Run YouTube live detection on all YouTube streams in one API call
    const youtubeIds = streams
      .filter(s => s.type === 'youtube' && s.videoId)
      .map(s => s.videoId);

    const liveStatus = await checkYoutubeLive(youtubeIds);

    // Annotate streams with live status
    let activeIdx = streams.length - 1; // default: last stream
    let foundLive = false;

    for (let i = 0; i < streams.length; i++) {
      const s = streams[i];
      if (s.type === 'youtube' && s.videoId) {
        s.liveStatus = liveStatus[s.videoId] || 'unknown';
        if (s.liveStatus === 'live' && !foundLive) {
          activeIdx = i;
          foundLive = true;
        }
      } else {
        // Non-YouTube streams (Twitch) — treat as potentially live
        s.liveStatus = 'unknown';
        if (!foundLive) activeIdx = i;
      }
    }

    const activeStream = streams[activeIdx]?.url || null;

    await db.ref(`events/${eventKey}`).update({
      name: eventInfo.name || eventKey,
      shortName: eventInfo.short_name || eventInfo.name || eventKey,
      streams,
      activeStream,
      activeStreamIdx: activeIdx,
      streamsCheckedAt: now,
      updatedAt: now,
    });

    return res.status(200).json({
      ok: true,
      streams: streams.length,
      activeIdx,
      foundLive,
    });
  } catch (err) {
    console.error(`[refresh-event] ${eventKey}:`, err.message);
    return res.status(500).json({ error: err.message });
  }
}
