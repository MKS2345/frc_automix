# FRC Automix

Live FRC match stream switcher — automatically switches to streams when your favorite teams are on field.

## Architecture

```
Nexus Webhook → /api/webhook → Firebase RTDB
                                     ↓
                          App subscribes to /teams/{num}
                          for each favorite team only
                          (push updates, zero polling)
```

- **Zero polling** — Nexus webhooks push updates server-side; app uses Firebase listeners
- **On-demand caching** — TBA data fetched only when needed, cached in Firebase
- **Anonymous auth** — Firebase anon auth gates all RTDB reads; bots can't hit APIs
- **YouTube Data API v3** — definitive live stream detection, no scraping
---

## Vercel Environment Variables

Set all of these in **Vercel Dashboard → Settings → Environment Variables**:

| Variable | Description |
|---|---|
| `TBA_API_KEY` | The Blue Alliance read API key |
| `NEXUS_API_KEY` | Nexus API key |
| `NEXUS_WEBHOOK_TOKEN` | Token from frc.nexus/api after registering webhook |
| `APP_PASSWORD` | Password for the app login screen |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key (for live detection) |
| `FIREBASE_SERVICE_ACCOUNT` | Full service account JSON as a single-line string |
| `FIREBASE_DATABASE_URL` | e.g. `https://frc-automix-default-rtdb.firebaseio.com` |
| `VITE_FIREBASE_API_KEY` | Firebase web config (safe to expose) |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase web config |
| `VITE_FIREBASE_DATABASE_URL` | Firebase web config |
| `VITE_FIREBASE_PROJECT_ID` | Firebase web config |

---

## Firebase Setup

### Security Rules
Paste the contents of `database.rules.json` into:
**Firebase Console → Realtime Database → Rules**

### Presence & Analytics
The active session count uses Firebase's `.info/connected` presence system.
Active viewers are counted as children of `/presence`.

---

## Nexus Webhook Registration

1. Go to https://frc.nexus/api
2. Register your webhook URL: `https://your-app.vercel.app/api/webhook`
3. Copy the `Nexus-Token` → add as `NEXUS_WEBHOOK_TOKEN` in Vercel

The webhook fires on every match status change. The server writes:
- `/teams/{num}` for each of the 6 teams in the match
- `/events/{eventKey}/currentMatch` and `/onDeck`

---

## Settings

| Setting | Description |
|---|---|
| Favorite Teams | Ordered list — top = highest priority |
| Stream Start Offset | Seconds after "on field" before switching (default 3min) |
| Stream End Offset | Seconds after match ends before switching away (default 15s) |
| Auto-Switch Higher Priority | Immediately switch for higher-ranked teams, or always ask |
| After Match Ends | Stay / return to home event / random event with your teams |

---

## Stream Detection

Stream liveness is checked via **YouTube Data API v3** (`snippet.liveBroadcastContent`):
- `"live"` → currently streaming, select this one
- `"upcoming"` → scheduled but not started
- `"none"` → VOD or ended

Checks run when:
1. Event data is first loaded
2. Event data is >1hr old  
3. User clicks "↺ Recheck" in the stream picker
4. Nexus webhook fires for an event with stale stream data

Users can manually pin a stream — the pin persists in localStorage and is respected until cleared with "↺ Auto".

---

## Local Development

```bash
cp .env.example .env.local
# Fill in your keys

npm install
vercel dev   # runs frontend + API functions together
```
