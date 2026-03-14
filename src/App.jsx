// src/App.jsx
import { useState } from 'react';
import LoginScreen from './components/LoginScreen';
import SettingsPanel from './components/SettingsPanel';
import StreamSidebar from './components/StreamSidebar';
import StreamViewer from './components/StreamViewer';
import MatchStatusBar from './components/MatchStatusBar';
import MatchNotification from './components/MatchNotification';
import { useMatchWatcher } from './hooks/useMatchWatcher';
import { useLocalStorage } from './hooks/useLocalStorage';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
      () => !!sessionStorage.getItem('appPassword')
  );
  const [showSettings, setShowSettings] = useState(false);
  const [favTeams,      setFavTeams]      = useLocalStorage('frc-fav-teams', []);
  const [offsetSeconds, setOffsetSeconds] = useLocalStorage('frc-offset', 180);

  const {
    activeEvents,
    eventMatchData,
    currentStreamEvent,
    streamUrls,
    notification,
    deferredSwitch,
    categorizedEvents,
    isWatchingMatch,
    switchToEvent,
    acceptPendingSwitch,
    dismissNotification,
    pollMatches,
    setActiveWebcast,
    clearStreamPin,
  } = useMatchWatcher({ favTeams, offsetSeconds, isAuthenticated });

  if (!isAuthenticated) {
    return <LoginScreen onLogin={() => setIsAuthenticated(true)} />;
  }

  // streamUrls[key] = { webcasts: [{url,type,label}], activeIdx }
  const currentStreamEntry = currentStreamEvent ? streamUrls[currentStreamEvent] : null;
  const currentStream = currentStreamEntry
      ? currentStreamEntry.webcasts[currentStreamEntry.activeIdx] ?? null
      : null;
  const currentEvent  = activeEvents.find(e => e.key === currentStreamEvent);

  return (
      <div style={S.root}>
        <style>{globalCss}</style>

        {/* ── Header ── */}
        <header style={S.header}>
          <div style={S.logo}>
            <span style={S.logoGear}>⚙</span>
            <span style={S.logoText}>FRC Watcher</span>
            <span style={S.livePill}>LIVE</span>
          </div>

          <div style={S.headerMid}>
            {isWatchingMatch && (
                <div style={S.chip('#166534', '#22c55e', '#4ade80')}>
                  <span style={S.pulseDot('#22c55e')} />
                  Watching — auto-switch locked
                </div>
            )}
            {deferredSwitch && !isWatchingMatch && (
                <div style={S.chip('#1e3a5f', '#2563eb', '#93c5fd')}>
                  <span style={S.pulseDot('#2563eb')} />
                  Pending switch queued
                </div>
            )}
            {!isWatchingMatch && !deferredSwitch && favTeams.length > 0 && (
                <div style={S.chip('#111827', '#1e3a5f', '#475569')}>
                  Monitoring {favTeams.length} team{favTeams.length !== 1 ? 's' : ''}
                </div>
            )}
            {favTeams.length === 0 && (
                <div style={S.chip('#111827', '#1e3a5f', '#475569')}>
                  Add teams in Settings to enable auto-switch
                </div>
            )}
          </div>

          <div style={S.headerRight}>
            <div style={S.offsetPill}>
              <span style={S.offsetLabel}>OFFSET</span>
              <span style={S.offsetVal}>{offsetSeconds}s</span>
              <span style={S.offsetMins}>/ {(offsetSeconds/60).toFixed(1)}m</span>
            </div>
            <button style={S.btn} onClick={() => setShowSettings(true)}>⚙ Settings</button>
            <button style={{ ...S.btn, padding: '6px 11px', fontSize: 17 }} onClick={pollMatches} title="Refresh now">↻</button>
          </div>
        </header>

        {/* ── Body ── */}
        <div style={S.body}>
          <StreamSidebar
              categorizedEvents={categorizedEvents}
              currentStreamEvent={currentStreamEvent}
              switchToEvent={switchToEvent}
              streamUrls={streamUrls}
              setActiveWebcast={setActiveWebcast}
              eventMatchData={eventMatchData}
              favTeams={favTeams}
          />

          <div style={S.main}>
            <MatchStatusBar
                eventMatchData={eventMatchData}
                currentStreamEvent={currentStreamEvent}
                favTeams={favTeams}
                activeEvents={activeEvents}
            />
            <StreamViewer
                streamInfo={currentStream}
                streamEntry={currentStreamEntry}
                eventName={currentEvent?.short_name || currentEvent?.name || currentStreamEvent}
                onSelectWebcast={(idx) => currentStreamEvent && setActiveWebcast(currentStreamEvent, idx)}
                onClearPin={() => currentStreamEvent && clearStreamPin(currentStreamEvent)}
            />
          </div>
        </div>

        {showSettings && (
            <SettingsPanel
                favTeams={favTeams}
                setFavTeams={setFavTeams}
                offsetSeconds={offsetSeconds}
                setOffsetSeconds={setOffsetSeconds}
                onClose={() => setShowSettings(false)}
            />
        )}

        <MatchNotification
            notification={notification}
            onAccept={acceptPendingSwitch}
            onDismiss={dismissNotification}
        />
      </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const S = {
  root: {
    display: 'flex', flexDirection: 'column', height: '100vh',
    background: '#0a0e1a', color: '#e2e8f0',
    fontFamily: "'Barlow', 'Segoe UI', sans-serif", overflow: 'hidden',
  },
  header: {
    height: 52, background: '#080d1a', borderBottom: '1px solid #1a2e4a',
    display: 'flex', alignItems: 'center', padding: '0 18px', gap: 16,
    flexShrink: 0, zIndex: 100,
  },
  logo: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  logoGear: { fontSize: 17, color: '#2563eb' },
  logoText: {
    color: '#e2e8f0', fontSize: 16, fontWeight: 800,
    letterSpacing: '0.07em', textTransform: 'uppercase',
    fontFamily: "'Barlow Condensed', sans-serif",
  },
  livePill: {
    background: '#dc2626', color: '#fff', fontSize: 9, fontWeight: 900,
    padding: '2px 6px', borderRadius: 3, letterSpacing: '0.1em',
    animation: 'pulse 2s infinite',
  },
  headerMid: { flex: 1, display: 'flex', justifyContent: 'center' },
  chip: (bg, border, color) => ({
    display: 'flex', alignItems: 'center', gap: 7,
    background: bg, border: `1px solid ${border}`, color,
    borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 600,
  }),
  pulseDot: (color) => ({
    width: 7, height: 7, borderRadius: '50%', background: color,
    display: 'inline-block', animation: 'pulse 1.5s infinite', flexShrink: 0,
  }),
  headerRight: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  offsetPill: {
    display: 'flex', alignItems: 'center', gap: 5,
    background: '#0d1526', border: '1px solid #1a2e4a',
    borderRadius: 8, padding: '5px 12px',
  },
  offsetLabel: {
    color: '#374151', fontSize: 9, fontWeight: 800,
    letterSpacing: '0.12em', textTransform: 'uppercase',
  },
  offsetVal: {
    color: '#2563eb', fontSize: 13, fontWeight: 800,
    fontFamily: "'Barlow Condensed', sans-serif",
  },
  offsetMins: { color: '#374151', fontSize: 10 },
  btn: {
    padding: '6px 14px', background: 'transparent',
    border: '1px solid #1a2e4a', borderRadius: 8,
    color: '#94a3b8', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
    transition: 'border-color 0.15s, color 0.15s',
    fontFamily: 'inherit',
  },
  body: { flex: 1, display: 'flex', overflow: 'hidden' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
};

const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { margin: 0; overflow: hidden; background: #0a0e1a; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: #080d1a; }
  ::-webkit-scrollbar-thumb { background: #1a2e4a; border-radius: 3px; }
  @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
  @keyframes slideIn {
    from { transform: translateX(110%) translateY(16px); opacity:0 }
    to   { transform: translateX(0)     translateY(0);   opacity:1 }
  }
  button:hover { filter: brightness(1.15); }
`;