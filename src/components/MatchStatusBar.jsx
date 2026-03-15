// src/components/MatchStatusBar.jsx
import { normalizeStatus } from '../hooks/useFirebase.js';

function TeamChip({ number, favTeams, alliance }) {
  if (!number || number === 'null') return null;
  const num = number.toString().replace(/frc/i, '');
  const isFav = favTeams.includes(parseInt(num, 10));
  const isRed = alliance === 'red';

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 6,
      background: isRed ? '#7f1d1d' : '#1e3a5f',
      border: `1px solid ${isRed ? '#dc2626' : '#2563eb'}`,
      color: isFav ? '#fbbf24' : '#e2e8f0',
      fontSize: 13, fontWeight: isFav ? 800 : 600,
      fontFamily: "'Barlow Condensed', sans-serif",
      flexShrink: 0,
    }}>
      {isFav && <span style={{ fontSize: 9 }}>★</span>}
      {num}
    </span>
  );
}

export default function MatchStatusBar({ currentStreamEvent, eventData, favTeams }) {
  if (!currentStreamEvent) {
    return (
      <div style={S.bar}>
        <span style={S.idle}>Select an event from the sidebar</span>
      </div>
    );
  }

  const edata = eventData[currentStreamEvent] || {};
  const cm    = edata.currentMatch;  // { label, r1-r3, b1-b3, status, onFieldAt }
  const od    = edata.onDeck;        // { label, r1-r3, b1-b3 }

  const red  = cm ? [cm.r1, cm.r2, cm.r3].filter(t => t && t !== 'null') : [];
  const blue = cm ? [cm.b1, cm.b2, cm.b3].filter(t => t && t !== 'null') : [];

  const status = normalizeStatus(cm?.status);
  const isActive = status === 'onField' || status === 'inProgress';

  return (
    <div style={S.bar}>
      {/* Event name */}
      <div style={S.eventInfo}>
        <span style={S.eventName}>{edata.shortName || edata.name || currentStreamEvent}</span>
        <span style={S.sep}>·</span>
        {cm ? (
          <span style={S.matchRow}>
            {isActive && <span style={S.onFieldBadge}>ON FIELD</span>}
            <span style={S.matchLabel}>{cm.label}</span>
          </span>
        ) : (
          <span style={S.waiting}>Waiting for match…</span>
        )}
      </div>

      {/* Alliance chips */}
      {cm && (
        <div style={S.alliances}>
          <div style={S.alliance}>
            <span style={S.redLabel}>RED</span>
            <div style={S.chips}>
              {red.map(t => <TeamChip key={t} number={t} favTeams={favTeams} alliance="red" />)}
            </div>
          </div>
          <span style={S.vs}>VS</span>
          <div style={S.alliance}>
            <span style={S.blueLabel}>BLUE</span>
            <div style={S.chips}>
              {blue.map(t => <TeamChip key={t} number={t} favTeams={favTeams} alliance="blue" />)}
            </div>
          </div>
        </div>
      )}

      {/* On deck */}
      {od && (
        <div style={S.deckRow}>
          <span style={S.deckLabel}>On Deck:</span>
          <span style={S.deckMatch}>{od.label}</span>
          {(() => {
            const deckTeams = [od.r1, od.r2, od.r3, od.b1, od.b2, od.b3]
              .filter(t => t && t !== 'null')
              .map(t => parseInt(t, 10))
              .filter(n => !isNaN(n));
            const favInDeck = deckTeams.filter(n => favTeams.includes(n));
            if (!favInDeck.length) return null;
            return (
              <span style={S.deckFavs}>
                ⭐ {favInDeck.map(n => `#${n}`).join(' ')}
              </span>
            );
          })()}
        </div>
      )}
    </div>
  );
}

const S = {
  bar: {
    height: 54,
    background: '#070b14',
    borderBottom: '1px solid #1a2e4a',
    display: 'flex',
    alignItems: 'center',
    padding: '0 18px',
    gap: 20,
    overflow: 'hidden',
    flexShrink: 0,
  },
  idle:      { color: '#374151', fontSize: 13, fontStyle: 'italic' },
  eventInfo: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  eventName: {
    color: '#94a3b8', fontSize: 13, fontWeight: 700,
    letterSpacing: '0.05em', textTransform: 'uppercase',
    fontFamily: "'Barlow Condensed', sans-serif",
  },
  sep: { color: '#1a2e4a' },
  matchRow: { display: 'flex', alignItems: 'center', gap: 8 },
  onFieldBadge: {
    background: '#14532d', border: '1px solid #22c55e', color: '#4ade80',
    borderRadius: 4, padding: '1px 7px', fontSize: 10,
    fontWeight: 800, letterSpacing: '0.08em', animation: 'pulse 2s infinite',
  },
  matchLabel: { color: '#e2e8f0', fontSize: 13 },
  waiting:    { color: '#374151', fontSize: 12, fontStyle: 'italic' },
  alliances:  { display: 'flex', alignItems: 'center', gap: 14, flex: 1, overflow: 'hidden' },
  alliance:   { display: 'flex', alignItems: 'center', gap: 7 },
  redLabel:   { color: '#ef4444', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', fontFamily: "'Barlow Condensed', sans-serif", flexShrink: 0 },
  blueLabel:  { color: '#3b82f6', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', fontFamily: "'Barlow Condensed', sans-serif", flexShrink: 0 },
  chips: { display: 'flex', gap: 4 },
  vs: { color: '#1a2e4a', fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', fontFamily: "'Barlow Condensed', sans-serif", flexShrink: 0 },
  deckRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    marginLeft: 'auto', flexShrink: 0,
    background: '#0d1526', border: '1px solid #1a2e4a',
    borderRadius: 8, padding: '4px 12px',
  },
  deckLabel: { color: '#374151', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' },
  deckMatch: { color: '#64748b', fontSize: 12 },
  deckFavs:  { color: '#fbbf24', fontSize: 12, fontWeight: 700 },
};
