import { normalizeStatus } from '../hooks/useMatchWatcher';
// src/components/StreamSidebar.jsx

export default function StreamSidebar({
                                        categorizedEvents,
                                        currentStreamEvent,
                                        switchToEvent,
                                        streamUrls,
                                        eventMatchData,
                                        favTeams,
                                      }) {
  const { withFavPlaying, withFavAtEvent, others } = categorizedEvents;
  const allGroups = [
    { label: 'Fav Teams Playing Now', events: withFavPlaying, accent: '#22c55e' },
    { label: 'Fav Teams at Event', events: withFavAtEvent, accent: '#2563eb' },
    { label: 'Other Events', events: others, accent: '#475569' },
  ];

  const getOnFieldTeams = (eventKey) => {
    const matches = eventMatchData[eventKey] || [];
    const active = matches.filter(m => {
      const s = normalizeStatus(m.status);
      return s === 'onField' || s === 'inProgress';
    });
    // Nexus teams are plain number strings like "1800", no frc prefix
    const teams = active.flatMap(m => [
      ...(m.redTeams || []),
      ...(m.blueTeams || []),
    ]).map(t => parseInt(t.toString().replace(/frc/i, ''), 10));
    return [...new Set(teams)];
  };

  return (
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <span style={styles.sidebarTitle}>Live Events</span>
          <span style={styles.eventCount}>
          {withFavPlaying.length + withFavAtEvent.length + others.length} active
        </span>
        </div>

        <div style={styles.groupList}>
          {allGroups.map(({ label, events, accent }) => {
            if (events.length === 0) return null;
            return (
                <div key={label} style={styles.group}>
                  <div style={styles.groupLabel}>
                    <span style={{ ...styles.groupDot, background: accent }} />
                    {label}
                  </div>
                  {events.map(event => {
                    const isActive = currentStreamEvent === event.key;
                    const onFieldTeams = getOnFieldTeams(event.key);
                    const favOnField = onFieldTeams.filter(t => favTeams.includes(t));

                    return (
                        <button
                            key={event.key}
                            style={{
                              ...styles.eventBtn,
                              borderColor: isActive ? accent : '#1e3a5f',
                              background: isActive
                                  ? `linear-gradient(135deg, ${accent}22, ${accent}11)`
                                  : '#111827',
                              boxShadow: isActive ? `0 0 16px ${accent}33` : 'none',
                            }}
                            onClick={() => switchToEvent(event.key)}
                        >
                          <div style={styles.eventBtnTop}>
                            <span style={{ ...styles.activeDot, background: isActive ? accent : '#1e3a5f' }} />
                            <span style={styles.eventName}>
                        {event.short_name || event.name}
                      </span>
                            {streamUrls[event.key] && (
                                <span style={styles.liveBadge}>LIVE</span>
                            )}
                          </div>
                          <div style={styles.eventBtnSub}>
                            <span style={styles.eventKey}>{event.key}</span>
                            {favOnField.length > 0 && (
                                <span style={styles.favTeams}>
                          {favOnField.map(t => `#${t}`).join(' ')}
                        </span>
                            )}
                          </div>
                        </button>
                    );
                  })}
                </div>
            );
          })}

          {withFavPlaying.length + withFavAtEvent.length + others.length === 0 && (
              <div style={styles.noEvents}>
                <div style={styles.noEventsIcon}>📡</div>
                <div style={styles.noEventsText}>No active events found</div>
                <div style={styles.noEventsSub}>Events refresh every 5 minutes</div>
              </div>
          )}
        </div>
      </div>
  );
}

const styles = {
  sidebar: {
    width: 240,
    flexShrink: 0,
    background: '#080d1a',
    borderRight: '1px solid #1e3a5f',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sidebarHeader: {
    padding: '16px 16px 12px',
    borderBottom: '1px solid #1e3a5f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sidebarTitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontFamily: "'Barlow Condensed', sans-serif",
  },
  eventCount: {
    color: '#475569',
    fontSize: 11,
    background: '#111827',
    padding: '2px 8px',
    borderRadius: 10,
    border: '1px solid #1e3a5f',
  },
  groupList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 0',
  },
  group: {
    marginBottom: 8,
  },
  groupLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px 6px',
    color: '#475569',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    fontFamily: "'Barlow Condensed', sans-serif",
  },
  groupDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },
  eventBtn: {
    display: 'block',
    width: '100%',
    padding: '10px 16px',
    border: '1px solid',
    borderLeft: 'none',
    borderRight: 'none',
    borderRadius: 0,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s',
    marginBottom: 2,
  },
  eventBtnTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
    transition: 'background 0.2s',
  },
  eventName: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: 600,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  liveBadge: {
    background: '#dc2626',
    color: '#fff',
    fontSize: 9,
    fontWeight: 800,
    padding: '1px 5px',
    borderRadius: 3,
    letterSpacing: '0.08em',
    animation: 'pulse 2s infinite',
  },
  eventBtnSub: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
  },
  eventKey: {
    color: '#475569',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  favTeams: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: 700,
    fontFamily: "'Barlow Condensed', sans-serif",
  },
  noEvents: {
    padding: '40px 20px',
    textAlign: 'center',
  },
  noEventsIcon: { fontSize: 32, marginBottom: 12, opacity: 0.4 },
  noEventsText: { color: '#475569', fontSize: 13, fontWeight: 600 },
  noEventsSub: { color: '#374151', fontSize: 11, marginTop: 4 },
};