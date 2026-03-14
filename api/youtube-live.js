// api/youtube-live.js
// Checks whether a YouTube video ID is currently a live broadcast.
// Uses YouTube's oembed endpoint + page scrape — no API key needed.

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // Password check
    const appPassword = process.env.APP_PASSWORD;
    if (appPassword && req.headers['x-app-password'] !== appPassword) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { videoId } = req.query;
    if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

    try {
        // Fetch the YouTube watch page — it contains JSON-LD with isLiveBroadcast
        const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; FRCWatcher/1.0)',
                'Accept-Language': 'en-US',
            },
        });

        if (!pageRes.ok) {
            return res.status(200).json({ live: false, reason: `page ${pageRes.status}` });
        }

        const html = await pageRes.text();

        // JSON-LD schema — live streams have "isLiveBroadcast" or "liveBroadcastDetails"
        const isLiveBroadcast = html.includes('"isLiveBroadcast"') ||
            html.includes('"liveBroadcastDetails"') ||
            html.includes('"isLive":true') ||
            html.includes('"isLiveContent":true');

        // Also check for "LIVE" badge in page content
        const hasLiveBadge = html.includes('"style":"LIVE"') ||
            html.includes('"LIVE"') && html.includes('"badgeStyle"');

        // Check for "upcoming" — scheduled but not started
        const isUpcoming = html.includes('"isUpcoming":true') ||
            html.includes('"liveBroadcastDetails":{"isLiveNow":false');

        return res.status(200).json({
            live: (isLiveBroadcast || hasLiveBadge) && !isUpcoming,
            upcoming: isUpcoming,
            reason: isLiveBroadcast ? 'json-ld' : hasLiveBadge ? 'badge' : 'not-live',
        });
    } catch (err) {
        return res.status(200).json({ live: false, reason: err.message });
    }
}