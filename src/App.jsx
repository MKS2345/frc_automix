// src/App.jsx
import { useState, useEffect } from 'react';
import LoginScreen       from './components/LoginScreen.jsx';
import SettingsPanel     from './components/SettingsPanel.jsx';
import StreamSidebar     from './components/StreamSidebar.jsx';
import MatchStatusBar    from './components/MatchStatusBar.jsx';
import StreamViewer      from './components/StreamViewer.jsx';
import MatchNotification from './components/MatchNotification.jsx';
import { useFirebase }   from './hooks/useFirebase.js';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { ensureAuth, setupPresence } from './firebase.js';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
      () => !!sessionStorage.getItem('appPassword')
  );
  const [showSettings,    setShowSettings]    = useState(false);
  const [firebaseReady,   setFirebaseReady]   = useState(false);
  const [firebaseError,   setFirebaseError]   = useState(null);

  // ── Persisted settings ──────────────────────────────────────────────────────
  const [favTeams,        setFavTeams]        = useLocalStorage('am-fav-teams',      []);
  const [offsetSeconds,   setOffsetSeconds]   = useLocalStorage('am-offset',         180);
  const [endOffsetSeconds,setEndOffsetSeconds]= useLocalStorage('am-end-offset',     15);
  const [forceSwitch,     setForceSwitch]     = useLocalStorage('am-force-switch',   false);
  const [afterMatchEnds,  setAfterMatchEnds]  = useLocalStorage('am-after-match',    'stay');
  const [homeEvent,       setHomeEvent]       = useLocalStorage('am-home-event',     '');

  // ── Firebase anon auth ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    ensureAuth()
        .then(() => setupPresence())
        .then(() => setFirebaseReady(true))
        .catch((err) => {
          console.error('[Firebase auth]', err);
          setFirebaseError(err.message || 'Firebase auth failed');
        });
  }, [isAuthenticated]);

  // ── Core hook ───────────────────────────────────────────────────────────────
  const {
    teamData,
    eventData,
    currentStreamEvent,
    isWatchingMatch,
    deferredSwitch,
    notification,
    activeSessions,
    categorizedEvents,
    switchToEvent,
    acceptPendingSwitch,
    dismissNotification,
    setActiveStream,
    clearStreamPin,
  } = useFirebase({
    favTeams,
    offsetSeconds,
    endOffsetSeconds,
    forceSwitch,
    afterMatchEnds,
    homeEvent,
    isAuthenticated: isAuthenticated && firebaseReady,
  });

  if (!isAuthenticated) {
    return <LoginScreen onLogin={() => setIsAuthenticated(true)} />;
  }

  if (firebaseError) {
    return (
        <div style={loadingStyle}>
          <style>{globalCss}</style>
          <div style={loadingInner}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <div style={loadingText}>Firebase Auth Error</div>
            <div style={{ color: '#ef4444', fontSize: 13, maxWidth: 400, lineHeight: 1.6, marginBottom: 20 }}>
              {firebaseError}
            </div>
            <div style={{ color: '#374151', fontSize: 12, maxWidth: 400, lineHeight: 1.7 }}>
              <strong style={{ color: '#64748b' }}>Fix checklist:</strong><br />
              1. Firebase Console → Authentication → Sign-in method → <strong style={{ color: '#94a3b8' }}>Anonymous → Enable</strong><br />
              2. Vercel → Settings → Env Vars → confirm all <code style={{ color: '#3b82f6' }}>VITE_FIREBASE_*</code> vars are set<br />
              3. Redeploy after adding env vars
            </div>
          </div>
        </div>
    );
  }

  if (!firebaseReady) {
    return (
        <div style={loadingStyle}>
          <style>{globalCss}</style>
          <div style={loadingInner}>
            <div style={loadingIcon}>⚡</div>
            <div style={loadingText}>FRC Automix</div>
            <div style={loadingBar}><div style={loadingFill} /></div>
            <div style={loadingSub}>Connecting…</div>
          </div>
        </div>
    );
  }

  const currentEvent = eventData[currentStreamEvent] || {};

  return (
      <div style={S.root}>
        <style>{globalCss}</style>

        {/* ── Header ── */}
        <header style={S.header}>
          {/* Logo */}
          <div style={S.logo}>
            <span style={S.logoMark}>⚡</span>
            <span style={S.logoText}>FRC Automix</span>
          </div>

          {/* Status center */}
          <div style={S.headerMid}>
            {isWatchingMatch && (
                <div style={S.chip('#14532d', '#22c55e', '#4ade80')}>
                  <span style={S.dot('#22c55e')} />
                  Watching — auto-switch locked
                </div>
            )}
            {deferredSwitch && !isWatchingMatch && (
                <div style={S.chip('#1e3a5f', '#2563eb', '#93c5fd')}>
                  <span style={S.dot('#3b82f6')} />
                  Switch queued after match
                </div>
            )}
            {!isWatchingMatch && !deferredSwitch && favTeams.length > 0 && (
                <div style={S.chip('#0d1526', '#1a2e4a', '#374151')}>
                  Monitoring {favTeams.length} team{favTeams.length !== 1 ? 's' : ''}
                </div>
            )}
            {favTeams.length === 0 && (
                <button style={S.noTeamsBtn} onClick={() => setShowSettings(true)}>
                  + Add favorite teams to get started
                </button>
            )}
          </div>

          {/* Right side */}
          <div style={S.headerRight}>
            {/* Live viewers */}
            {activeSessions > 0 && (
                <div style={S.viewerCount}>
                  <span style={S.dot('#22c55e')} />
                  <span style={S.viewerNum}>{activeSessions}</span>
                  <span style={S.viewerLabel}>watching</span>
                </div>
            )}

            {/* Offset display */}
            <div style={S.offsetPill}>
              <span style={S.offsetLabel}>+{offsetSeconds}s</span>
            </div>

            <button style={S.settingsBtn} onClick={() => setShowSettings(true)}>
              ⚙ Settings
            </button>
          </div>
        </header>

        {/* ── Body ── */}
        <div style={S.body}>
          <StreamSidebar
              categorizedEvents={categorizedEvents}
              currentStreamEvent={currentStreamEvent}
              switchToEvent={switchToEvent}
              eventData={eventData}
              teamData={teamData}
              favTeams={favTeams}
          />

          <div style={S.main}>
            <MatchStatusBar
                currentStreamEvent={currentStreamEvent}
                eventData={eventData}
                favTeams={favTeams}
                onSelectStream={(idx) => currentStreamEvent && setActiveStream(currentStreamEvent, idx)}
                onClearPin={() => currentStreamEvent && clearStreamPin(currentStreamEvent)}
            />
            <StreamViewer
                currentStreamEvent={currentStreamEvent}
                eventData={eventData}
            />
          </div>
        </div>

        {/* ── Settings panel ── */}
        {showSettings && (
            <SettingsPanel
                favTeams={favTeams}             setFavTeams={setFavTeams}
                offsetSeconds={offsetSeconds}   setOffsetSeconds={setOffsetSeconds}
                endOffsetSeconds={endOffsetSeconds} setEndOffsetSeconds={setEndOffsetSeconds}
                forceSwitch={forceSwitch}       setForceSwitch={setForceSwitch}
                afterMatchEnds={afterMatchEnds} setAfterMatchEnds={setAfterMatchEnds}
                homeEvent={homeEvent}           setHomeEvent={setHomeEvent}
                teamData={teamData}
                eventData={eventData}
                onClose={() => setShowSettings(false)}
            />
        )}

        {/* ── Match notification ── */}
        <MatchNotification
            notification={notification}
            teamData={teamData}
            eventData={eventData}
            onAccept={acceptPendingSwitch}
            onDismiss={dismissNotification}
        />
      </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  root: {
    display: 'flex', flexDirection: 'column', height: '100vh',
    background: '#070b14', color: '#e2e8f0', overflow: 'hidden',
    fontFamily: "'Barlow', 'Segoe UI', sans-serif",
  },
  header: {
    height: 52, background: '#070b14',
    borderBottom: '1px solid #1a2e4a',
    display: 'flex', alignItems: 'center',
    padding: '0 16px', gap: 16, flexShrink: 0, zIndex: 100,
  },
  logo: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  logoMark: {
    fontSize: 18, width: 30, height: 30, borderRadius: 8,
    background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoText: {
    color: '#e2e8f0', fontSize: 15, fontWeight: 800,
    letterSpacing: '0.06em', textTransform: 'uppercase',
    fontFamily: "'Barlow Condensed', sans-serif",
  },
  headerMid: { flex: 1, display: 'flex', justifyContent: 'center' },
  chip: (bg, border, color) => ({
    display: 'flex', alignItems: 'center', gap: 7,
    background: bg, border: `1px solid ${border}`, color,
    borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 600,
  }),
  dot: (color) => ({
    width: 7, height: 7, borderRadius: '50%', background: color,
    display: 'inline-block', animation: 'pulse 1.5s infinite', flexShrink: 0,
  }),
  noTeamsBtn: {
    background: 'transparent', border: '1px dashed #1a2e4a',
    color: '#374151', borderRadius: 20, padding: '5px 16px',
    fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'border-color 0.2s, color 0.2s',
  },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  viewerCount: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: '#0d1526', border: '1px solid #1a2e4a',
    borderRadius: 20, padding: '4px 12px',
  },
  viewerNum: {
    color: '#e2e8f0', fontSize: 14, fontWeight: 800,
    fontFamily: "'Barlow Condensed', sans-serif",
  },
  viewerLabel: { color: '#374151', fontSize: 11 },
  offsetPill: {
    background: '#0d1526', border: '1px solid #1a2e4a',
    borderRadius: 8, padding: '5px 10px',
  },
  offsetLabel: {
    color: '#2563eb', fontSize: 12, fontWeight: 800,
    fontFamily: "'Barlow Condensed', sans-serif",
  },
  settingsBtn: {
    padding: '6px 14px', background: 'transparent',
    border: '1px solid #1a2e4a', borderRadius: 8,
    color: '#64748b', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', gap: 6,
  },
  body: { flex: 1, display: 'flex', overflow: 'hidden' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
};

const loadingStyle = {
  height: '100vh', background: '#070b14',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: "'Barlow Condensed', sans-serif",
};
const loadingInner = { textAlign: 'center' };
const loadingIcon  = { fontSize: 48, marginBottom: 12, filter: 'drop-shadow(0 0 20px #2563eb)' };
const loadingText  = { color: '#e2e8f0', fontSize: 22, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20 };
const loadingBar   = { width: 200, height: 2, background: '#1a2e4a', borderRadius: 1, overflow: 'hidden', margin: '0 auto 12px' };
const loadingFill  = { height: '100%', background: 'linear-gradient(90deg, #1d4ed8, #3b82f6)', animation: 'loadSlide 1.5s ease-in-out infinite', borderRadius: 1 };
const loadingSub   = { color: '#374151', fontSize: 13 };

const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { margin: 0; overflow: hidden; background: #070b14; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: #070b14; }
  ::-webkit-scrollbar-thumb { background: #1a2e4a; border-radius: 3px; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes slideIn {
    from { transform: translateX(110%) translateY(16px); opacity: 0; }
    to   { transform: translateX(0) translateY(0); opacity: 1; }
  }
  @keyframes loadSlide {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(400%); }
  }
  button:hover { filter: brightness(1.2); }
  select { appearance: none; }
`;