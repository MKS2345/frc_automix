// src/components/MatchStatusBar.jsx

function TeamChip({ number, favTeams, color }) {
  const priority = favTeams.indexOf(number);
  const isFav = priority !== -1;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 10px',
      borderRadius: 6,
      background: color === 'red' ? '#7f1d1d' : '#1e3a5f',
      border: `1px solid ${color === 'red' ? '#dc2626' : '#2563eb'}`,
      color: isFav ? '#fbbf24' : '#e2e8f0',
      fontSize: 13,
      fontWeight: isFav ? 800 : 600,
      fontFamily: "'Barlow Condensed', sans-serif",
    }}>
      {isFav && <span style={{ fontSize: 10 }}>★</span>}
      {number}
    </span>
  );
}

export default function MatchStatusBar({ eventMatchData, currentStreamEvent, favTeams, activeEvents }) {
  if (!currentStreamEvent) {
    return (
      <div style={styles.bar}>
        <span style={styles.noStream}>No stream selected</span>
      </div>
    );
  }

  const matches = eventMatchData[currentStreamEvent] || [];
  const event = activeEvents?.find(e => e.key === currentStreamEvent);

  // Find on-field / in-progress match
  const activeMatch = matches.find(m => {
    const s = (m.status || '').toLowerCase();
    return s === 'onfield' || s === 'on_field' || s === 'inprogress' || s === 'in_progress' || s === 'field';
  });

  // Find on-deck
  const deckMatch = matches.find(m => {
    const s = (m.status || '').toLowerCase();
    return s === 'ondeck' || s === 'on_deck' || s === 'deck';
  });

  const parseTeams = (m) => {
    if (!m) return { red: [], blue: [] };
    return {
      red: (m.redTeams || []).map(t => parseInt(t.toString().replace('frc', ''), 10)),
      blue: (m.blueTeams || []).map(t => parseInt(t.toString().replace('frc', ''), 10)),
    };
  };

  const { red: redTeams, blue: blueTeams } = parseTeams(activeMatch);

  return (
    <div style={styles.bar}>
      <div style={styles.eventInfo}>
        <span style={styles.eventName}>{event?.short_name || currentStreamEvent}</span>
        <span style={styles.dot}>·</span>
        {activeMatch ? (
          <span style={styles.matchStatus}>
            <span style={styles.onFieldBadge}>ON FIELD</span>
            {activeMatch.description || `Match ${activeMatch.matchNumber || ''}`}
          </span>
        ) : (
          <span style={styles.waitingText}>Waiting for match…</span>
        )}
      </div>

      {activeMatch && (
        <div style={styles.alliances}>
          <div style={styles.alliance}>
            <span style={styles.allianceLabel}>RED</span>
            <div style={styles.chips}>
              {redTeams.map(t => <TeamChip key={t} number={t} favTeams={favTeams} color="red" />)}
            </div>
          </div>
          <span style={styles.vs}>VS</span>
          <div style={styles.alliance}>
            <span style={{ ...styles.allianceLabel, color: '#2563eb' }}>BLUE</span>
            <div style={styles.chips}>
              {blueTeams.map(t => <TeamChip key={t} number={t} favTeams={favTeams} color="blue" />)}
            </div>
          </div>
        </div>
      )}

      {deckMatch && (
        <div style={styles.onDeck}>
          <span style={styles.deckLabel}>On Deck:</span>
          <span style={styles.deckMatch}>{deckMatch.description || `Match ${deckMatch.matchNumber || ''}`}</span>
          {(() => {
            const { red, blue } = parseTeams(deckMatch);
            const favInDeck = [...red, ...blue].filter(t => favTeams.includes(t));
            if (favInDeck.length === 0) return null;
            return (
              <span style={styles.deckFavs}>
                ⭐ {favInDeck.map(t => `#${t}`).join(' ')}
              </span>
            );
          })()}
        </div>
      )}
    </div>
  );
}

const styles = {
  bar: {
    height: 56,
    background: '#080d1a',
    borderBottom: '1px solid #1e3a5f',
    display: 'flex',
    alignItems: 'center',
    padding: '0 20px',
    gap: 24,
    overflow: 'hidden',
    flexShrink: 0,
  },
  noStream: {
    color: '#475569',
    fontSize: 13,
    fontStyle: 'italic',
  },
  eventInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  eventName: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.05em',
    fontFamily: "'Barlow Condensed', sans-serif",
    textTransform: 'uppercase',
  },
  dot: { color: '#1e3a5f' },
  matchStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#e2e8f0',
    fontSize: 13,
  },
  onFieldBadge: {
    background: '#166534',
    border: '1px solid #22c55e',
    color: '#4ade80',
    borderRadius: 4,
    padding: '1px 7px',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.08em',
    animation: 'pulse 2s infinite',
  },
  waitingText: {
    color: '#475569',
    fontSize: 12,
    fontStyle: 'italic',
  },
  alliances: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  alliance: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  allianceLabel: {
    color: '#dc2626',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.1em',
    fontFamily: "'Barlow Condensed', sans-serif",
  },
  chips: {
    display: 'flex',
    gap: 5,
  },
  vs: {
    color: '#1e3a5f',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.1em',
    fontFamily: "'Barlow Condensed', sans-serif",
  },
  onDeck: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
    flexShrink: 0,
    background: '#111827',
    border: '1px solid #1e3a5f',
    borderRadius: 8,
    padding: '4px 12px',
  },
  deckLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  deckMatch: {
    color: '#94a3b8',
    fontSize: 12,
  },
  deckFavs: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: 700,
  },
};
