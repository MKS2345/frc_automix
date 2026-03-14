# FRC Watcher

Live FRC match stream switcher with automatic priority-based switching.

## Features

- Monitors multiple FRC events simultaneously via Nexus API
- Auto-switches to streams when favorite teams are on field
- Priority queue: highest-priority team wins mid-match conflicts
- Mid-match popup notifications
- 3-minute configurable stream start delay (accounts for robot enable time)
- Password-protected with API keys never exposed to the browser
- Favorite teams persisted in localStorage with drag-reorder priority

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Local development

Create a `.env.local` file (never commit this):

```env
TBA_API_KEY=your_tba_read_api_key_here
NEXUS_API_KEY=your_nexus_api_key_here
APP_PASSWORD=your_chosen_password_here
```

Run both the Vite dev server and a local API server:

```bash
npm run dev
```

> Note: For local dev, the Vite proxy in `vite.config.js` forwards `/api/*` to `localhost:3001`.
> You'll need to run a small local Express server or use `vercel dev` (see below).

**Recommended for local dev: use Vercel CLI**

```bash
npm install -g vercel
vercel dev
```

This spins up both the frontend and the serverless functions locally with your `.env.local` variables loaded.

---

## Deploying to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/frc-watcher.git
git push -u origin main
```

### 2. Import to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo
3. Framework: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`

### 3. Set Environment Variables in Vercel ⚠️

**This is how you keep your API keys safe.** Go to:
**Project → Settings → Environment Variables**

Add these three:

| Name | Value | Environment |
|------|-------|-------------|
| `TBA_API_KEY` | your TBA read API key | Production, Preview, Development |
| `NEXUS_API_KEY` | your Nexus API key | Production, Preview, Development |
| `APP_PASSWORD` | your chosen password | Production, Preview, Development |

> Keys set here are **encrypted at rest** and **never included in the deployed bundle**.
> The browser only ever talks to `/api/tba` and `/api/nexus` — your actual keys never leave Vercel's servers.

### 4. Deploy

Vercel auto-deploys on every push to `main`. Or click "Redeploy" in the dashboard.

---

## API Keys

### The Blue Alliance (TBA)
1. Sign in at https://www.thebluealliance.com/account
2. Go to Account → Read API Keys
3. Create a new key, copy it

### FRC Nexus
1. Contact the Nexus team at https://frc.nexus or check their documentation
2. Keys are event-based or global depending on access tier

---

## Security Model

```
Browser → /api/tba?path=... → Vercel Function → TBA API (with key)
Browser → /api/nexus?eventCode=... → Vercel Function → Nexus API (with key)
Browser → /api/auth (POST password) → Vercel Function → checks APP_PASSWORD env var
```

- The password check on every API call means even if someone guesses your URL, they can't hit the APIs
- `APP_PASSWORD` env var is also used as the `x-app-password` header on all requests
- If `APP_PASSWORD` is not set, the app runs without password protection (good for private deploys)

---

## Match Switching Logic

1. **Match marked on-field in Nexus**
2. Timer starts (default: 180s / 3 minutes offset)
3. At timer expiry:
   - **Not watching**: Switch to best-priority fav team's event
   - **Watching current match**: Show popup (15s auto-dismiss), user can switch now
   - **Higher priority team also on-field**: Wait for higher-priority match first
4. Match completes → lock releases → next on-field match can trigger

---

## Customization

- `POLL_INTERVAL` in `useMatchWatcher.js` (default 15s) — how often Nexus is polled
- Offset default is 180s but adjustable in Settings panel
- Presets available: 2m, 3m, 4m, 5m
