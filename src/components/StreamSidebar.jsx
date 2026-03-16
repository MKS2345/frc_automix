// src/components/StreamSidebar.jsx
import { normalizeStatus } from '../hooks/useFirebase.js';

export default function StreamSidebar({
                                        categorizedEvents,
                                        currentStreamEvent,
                                        switchToEvent,
                                        eventData,
                                        teamData,
                                        favTeams,
                                      }) {
  const fav = favTeams || [];
  const { withFavOnField, withFavAtEvent } = categorizedEvents || { withFavOnField: [], withFavAtEvent: [] };

  // All known event keys in priority order
  const allKnown = [
    ...withFavOnField,
    ...withFavAtEvent.filter(e => !withFavOnField.includes(e)),
  ];

  // Get fav teams currently on field at an event
  const getFavTeamsOnField = (eventKey) => {
    return fav.filter(n => {
      const d = teamData[n.toString()];
      const s = normalizeStatus(d?.status);
      return d?.currentEvent === eventKey && (s === 'onField' || s === 'inProgress');
    });
  };

  // Get all fav teams at an event (regardless of status)
  const getFavTeamsAtEvent = (eventKey) => {
    return fav.filter(n => teamData[n.toString()]?.currentEvent === eventKey);
  };

  const groups = [
    {
      label: 'Playing Now',
      eventKeys: withFavOnField,
      accent: '#22c55e',
    },
    {
      label: 'At Event',
      eventKeys: withFavAtEvent.filter(e => !withFavOnField.includes(e)),
      accent: '#2563eb',
    },
  ];

  return (
      <div style={S.sidebar}>
        <div style={S.header}>
          <span style={S.headerTitle}>Events</span>
          <span style={S.headerCount}>{allKnown.length} tracked</span>
        </div>

        <div style={S.list}>
          {groups.map(({ label, eventKeys, accent }) => {
            if (!eventKeys.length) return null;
            return (
                <div key={label} style={S.group}>
                  <div style={S.groupLabel}>
                    <span style={{ ...S.groupDot, background: accent }} />
                    {label}
                  </div>
                  {eventKeys.map(ek => {
                    const edata      = eventData[ek] || {};
                    const isActive   = currentStreamEvent === ek;
                    const onField    = getFavTeamsOnField(ek);
                    const atEvent    = getFavTeamsAtEvent(ek);
                    const hasStream  = !!(edata.activeStream || edata.streams?.length);
                    const displayName = edata.shortName || edata.name || ek;

                    return (
                        <button
                            key={ek}
                            onClick={() => switchToEvent(ek)}
                            style={{
                              ...S.eventBtn,
                              borderColor: isActive ? accent : '#1a2e4a',
                              background: isActive
                                  ? `linear-gradient(135deg, ${accent}18, ${accent}08)`
                                  : '#0d1526',
                              boxShadow: isActive ? `0 0 20px ${accent}22` : 'none',
                            }}
                        >
                          <div style={S.eventBtnTop}>
                            <span style={{ ...S.activeDot, background: isActive ? accent : '#1a2e4a' }} />
                            <span style={S.eventName}>{displayName}</span>
                            {hasStream && <span style={S.livePill}>LIVE</span>}
                          </div>

                          <div style={S.eventBtnMid}>
                            <span style={S.eventKey}>{ek}</span>
                          </div>

                          {/* Fav teams on field */}
                          {onField.length > 0 && (
                              <div style={S.teamChips}>
                                {onField.map(n => (
                                    <span key={n} style={{ ...S.teamChip, background: '#166534', borderColor: '#22c55e', color: '#4ade80' }}>
                            ★ {n}
                          </span>
                                ))}
                              </div>
                          )}

                          {/* Fav teams at event but not on field */}
                          {onField.length === 0 && atEvent.length > 0 && (
                              <div style={S.teamChips}>
                                {atEvent.slice(0, 4).map(n => (
                                    <span key={n} style={S.teamChip}>
                            {n}
                          </span>
                                ))}
                                {atEvent.length > 4 && (
                                    <span style={{ ...S.teamChip, color: '#374151' }}>
                            +{atEvent.length - 4}
                          </span>
                                )}
                              </div>
                          )}
                        </button>
                    );
                  })}
                </div>
            );
          })}

          {allKnown.length === 0 && (
              <div style={S.empty}>
                <div style={S.emptyIcon}>📡</div>
                <div style={S.emptyTitle}>No events tracked</div>
                <div style={S.emptySub}>Add favorite teams in Settings</div>
              </div>
          )}
        </div>
      </div>
  );
}

const S = {
  sidebar: {
    width: 236,
    flexShrink: 0,
    background: '#070b14',
    borderRight: '1px solid #1a2e4a',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '14px 16px 12px',
    borderBottom: '1px solid #1a2e4a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  headerTitle: {
    color: '#64748b', fontSize: 11, fontWeight: 700,
    letterSpacing: '0.12em', textTransform: 'uppercase',
    fontFamily: "'Barlow Condensed', sans-serif",
  },
  headerCount: {
    color: '#374151', fontSize: 11,
    background: '#0d1526', padding: '2px 8px',
    borderRadius: 10, border: '1px solid #1a2e4a',
  },
  list: { flex: 1, overflowY: 'auto', padding: '6px 0' },
  group: { marginBottom: 4 },
  groupLabel: {
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '8px 16px 5px',
    color: '#374151', fontSize: 10, fontWeight: 700,
    letterSpacing: '0.1em', textTransform: 'uppercase',
    fontFamily: "'Barlow Condensed', sans-serif",
  },
  groupDot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
  eventBtn: {
    display: 'block', width: '100%',
    padding: '10px 14px 10px 16px',
    border: '1px solid', borderLeft: 'none', borderRight: 'none',
    cursor: 'pointer', textAlign: 'left',
    transition: 'all 0.15s', marginBottom: 1,
    borderRadius: 0,
  },
  eventBtnTop: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3,
  },
  activeDot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0, transition: 'background 0.2s' },
  eventName: {
    color: '#e2e8f0', fontSize: 13, fontWeight: 600,
    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  livePill: {
    background: '#dc2626', color: '#fff', fontSize: 9, fontWeight: 800,
    padding: '1px 5px', borderRadius: 3, letterSpacing: '0.08em',
    animation: 'pulse 2s infinite', flexShrink: 0,
  },
  eventBtnMid: { paddingLeft: 14, marginBottom: 4 },
  eventKey:    { color: '#374151', fontSize: 11, fontFamily: 'monospace' },
  teamChips:   { display: 'flex', gap: 4, paddingLeft: 14, flexWrap: 'wrap' },
  teamChip: {
    background: '#0d1526', border: '1px solid #1a2e4a',
    color: '#475569', borderRadius: 4,
    padding: '2px 7px', fontSize: 11, fontWeight: 700,
    fontFamily: "'Barlow Condensed', sans-serif",
  },
  empty: { padding: '40px 20px', textAlign: 'center' },
  emptyIcon:  { fontSize: 28, marginBottom: 10, opacity: 0.3 },
  emptyTitle: { color: '#374151', fontSize: 13, fontWeight: 600 },
  emptySub:   { color: '#1e3a5f', fontSize: 11, marginTop: 4 },
};