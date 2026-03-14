// src/App.jsx
import { useState, useEffect } from 'react';
import LoginScreen from './components/LoginScreen';
import SettingsPanel from './components/SettingsPanel';
import StreamSidebar from './components/StreamSidebar';
import StreamViewer from './components/StreamViewer';
import MatchStatusBar from './components/MatchStatusBar';
import MatchNotification from './components/MatchNotification';
import { useMatchWatcher } from './hooks/useMatchWatcher';
import { useLocalStorage } from './hooks/useLocalStorage';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Check if already logged in this session
    return !!sessionStorage.getItem('appPassword');
  });
  const [showSettings, setShowSettings] = useState(false);
  const [favTeams, setFavTeams] = useLocalStorage('frc-fav-teams', []);
  const [offsetSeconds, setOffsetSeconds] = useLocalStorage('frc-offset', 180); // 3 minutes default

  const {
    activeEvents,
    eventMatchData,
    currentStreamEvent,
    streamUrls,
    notification,
    categorizedEvents,
    isWatchingMatch,
    switchToEvent,
    acceptPendingSwitch,
    dismissNotification,
    pollMatches,
  } = useMatchWatcher({ favTeams, offsetSeconds, isAuthenticated });

  const [switchCountdown, setSwitchCountdown] = useState(null);
  useEffect(() => {
    if (isWatchingMatch || notification) {
      setSwitchCountdown(null);
    }
  }, [isWatchingMatch, notification]);

  const handleLogin = (password) => {
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const currentStream = currentStreamEvent ? streamUrls[currentStreamEvent] : null;
  const currentEvent = activeEvents.find(e => e.key === currentStreamEvent);

  return (
    <div style={appStyles.root}>
      {/* Global styles */}
      <style>{globalCss}</style>

      {/* Header */}
      <header style={appStyles.header}>
        <div style={appStyles.logo}>
          <span style={appStyles.logoIcon}>⚙</span>
          <span style={appStyles.logoText}>FRC Watcher</span>
          <span style={appStyles.logoBeta}>LIVE</span>
        </div>

        <div style={appStyles.headerCenter}>
          {isWatchingMatch && currentStreamEvent && (
            <div style={appStyles.watchingBadge}>
              <span style={appStyles.watchingDot} />
              Watching match · auto-switch locked
            </div>
          )}
          {!isWatchingMatch && favTeams.length > 0 && (
            <div style={appStyles.monitoringBadge}>
              Monitoring {favTeams.length} team{favTeams.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        <div style={appStyles.headerRight}>
          <div style={appStyles.offsetDisplay}>
            <span style={appStyles.offsetLabel}>Offset</span>
            <span style={appStyles.offsetValue}>{offsetSeconds}s</span>
          </div>
          <button
            style={appStyles.settingsBtn}
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            ⚙ Settings
          </button>
          <button
            style={appStyles.refreshBtn}
            onClick={pollMatches}
            title="Refresh match data"
          >
            ↻
          </button>
        </div>
      </header>

      {/* Main content */}
      <div style={appStyles.body}>
        {/* Sidebar */}
        <StreamSidebar
          categorizedEvents={categorizedEvents}
          currentStreamEvent={currentStreamEvent}
          switchToEvent={switchToEvent}
          streamUrls={streamUrls}
          eventMatchData={eventMatchData}
          favTeams={favTeams}
        />

        {/* Main area */}
        <div style={appStyles.main}>
          <MatchStatusBar
            eventMatchData={eventMatchData}
            currentStreamEvent={currentStreamEvent}
            favTeams={favTeams}
            activeEvents={activeEvents}
          />
          <StreamViewer
            streamInfo={currentStream}
            eventName={currentEvent?.short_name || currentEvent?.name || currentStreamEvent}
          />
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <SettingsPanel
          favTeams={favTeams}
          setFavTeams={setFavTeams}
          offsetSeconds={offsetSeconds}
          setOffsetSeconds={setOffsetSeconds}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Match notification popup */}
      <MatchNotification
        notification={notification}
        onAccept={acceptPendingSwitch}
        onDismiss={dismissNotification}
      />
    </div>
  );
}

const appStyles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#0a0e1a',
    color: '#e2e8f0',
    fontFamily: "'Barlow', 'Segoe UI', sans-serif",
    overflow: 'hidden',
  },
  header: {
    height: 52,
    background: '#080d1a',
    borderBottom: '1px solid #1e3a5f',
    display: 'flex',
    alignItems: 'center',
    padding: '0 20px',
    gap: 20,
    flexShrink: 0,
    zIndex: 100,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  logoIcon: {
    fontSize: 18,
    color: '#2563eb',
  },
  logoText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    fontFamily: "'Barlow Condensed', sans-serif",
  },
  logoBeta: {
    background: '#dc2626',
    color: '#fff',
    fontSize: 9,
    fontWeight: 900,
    padding: '2px 6px',
    borderRadius: 3,
    letterSpacing: '0.1em',
    animation: 'pulse 2s infinite',
  },
  headerCenter: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
  },
  watchingBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#166534',
    border: '1px solid #22c55e',
    color: '#4ade80',
    borderRadius: 20,
    padding: '4px 14px',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.03em',
  },
  watchingDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#22c55e',
    animation: 'pulse 1.5s infinite',
    display: 'inline-block',
  },
  monitoringBadge: {
    color: '#475569',
    fontSize: 12,
    background: '#111827',
    border: '1px solid #1e3a5f',
    borderRadius: 20,
    padding: '4px 14px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  offsetDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#111827',
    border: '1px solid #1e3a5f',
    borderRadius: 8,
    padding: '5px 12px',
  },
  offsetLabel: {
    color: '#475569',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  offsetValue: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: 800,
    fontFamily: "'Barlow Condensed', sans-serif",
  },
  settingsBtn: {
    padding: '6px 14px',
    background: 'transparent',
    border: '1px solid #1e3a5f',
    borderRadius: 8,
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all 0.15s',
  },
  refreshBtn: {
    padding: '6px 10px',
    background: 'transparent',
    border: '1px solid #1e3a5f',
    borderRadius: 8,
    color: '#475569',
    fontSize: 16,
    cursor: 'pointer',
    lineHeight: 1,
  },
  body: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
};

const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600;700&display=swap');
  
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { margin: 0; overflow: hidden; background: #0a0e1a; }
  
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #080d1a; }
  ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 3px; }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  @keyframes slideIn {
    from { transform: translateX(100%) translateY(20px); opacity: 0; }
    to { transform: translateX(0) translateY(0); opacity: 1; }
  }
`;
