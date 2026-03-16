// src/components/MatchStatusBar.jsx
import { useMemo } from 'react';
import { normalizeStatus } from '../hooks/useFirebase.js';
import { useStatbotics } from '../hooks/useStatbotics.js';

const YEAR = new Date().getFullYear();

// EPA colour scale matching Statbotics' own palette
function epaColor(norm) {
  if (norm == null) return '#374151';
  if (norm >= 1500)  return '#3b82f6'; // top ~1%  — blue
  if (norm >= 1350)  return '#22c55e'; // top ~10% — dark green
  if (norm >= 1200)  return '#86efac'; // top ~25% — light green
  if (norm >= 800)   return '#94a3b8'; // middle   — grey
  return '#f87171';                    // bottom   — red
}

function EpaChip({ teamNum, epa, alliance, isFav }) {
  const color   = epaColor(epa?.norm);
  const isRed   = alliance === 'red';
  const meanStr = epa?.mean != null ? epa.mean.toFixed(1) : '—';

  return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '4px 8px', borderRadius: 7, minWidth: 58,
        background: isRed ? '#1a0a0a' : '#0a0f1a',
        border: `1px solid ${isRed ? '#7f1d1d' : '#1e3a5f'}`,
        position: 'relative',
      }}>
        {isFav && (
            <span style={{
              position: 'absolute', top: -5, right: -5,
              fontSize: 9, lineHeight: 1,
            }}>⭐</span>
        )}
        <span style={{
          color: isFav ? '#fbbf24' : '#e2e8f0',
          fontSize: 13, fontWeight: 800,
          fontFamily: "'Barlow Condensed', sans-serif",
          lineHeight: 1.2,
        }}>{teamNum}</span>
        <span style={{
          color, fontSize: 12, fontWeight: 700,
          fontFamily: "'Barlow Condensed', sans-serif",
          lineHeight: 1.2,
        }}>{meanStr}</span>
      </div>
  );
}

function AllianceTotal({ teams, epaData, label, isRed }) {
  const total = teams.reduce((sum, t) => {
    const mean = epaData[t]?.mean;
    return mean != null ? sum + mean : sum;
  }, 0);

  const allLoaded = teams.every(t => epaData[t] !== undefined);
  const totalStr  = allLoaded && total > 0 ? total.toFixed(1) : '—';

  return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '3px 10px', borderRadius: 7,
        background: isRed ? '#2d0a0a' : '#0a0f2d',
        border: `1px solid ${isRed ? '#dc2626' : '#2563eb'}`,
        minWidth: 52,
      }}>
      <span style={{
        color: isRed ? '#f87171' : '#93c5fd',
        fontSize: 10, fontWeight: 700,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        fontFamily: "'Barlow Condensed', sans-serif",
      }}>{label}</span>
        <span style={{
          color: isRed ? '#fca5a5' : '#bfdbfe',
          fontSize: 15, fontWeight: 900,
          fontFamily: "'Barlow Condensed', sans-serif",
          lineHeight: 1.2,
        }}>{totalStr}</span>
      </div>
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
  const cm    = edata.currentMatch;
  const od    = edata.onDeck;

  const red  = cm ? [cm.r1, cm.r2, cm.r3].filter(t => t && t !== 'null') : [];
  const blue = cm ? [cm.b1, cm.b2, cm.b3].filter(t => t && t !== 'null') : [];
  const allTeams = [...red, ...blue].map(t => parseInt(t, 10)).filter(n => !isNaN(n));

  const { epaData } = useStatbotics(allTeams.length ? allTeams : null, YEAR);

  const status   = normalizeStatus(cm?.status);
  const isActive = status === 'onField' || status === 'inProgress';

  const redNums  = red.map(t  => parseInt(t, 10));
  const blueNums = blue.map(t => parseInt(t, 10));

  return (
      <div style={S.bar}>
        {/* Event + match label */}
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

        {/* EPA alliance display */}
        {cm && (
            <div style={S.epaSection}>
              {/* Red alliance total */}
              <AllianceTotal teams={redNums} epaData={epaData} label="RED" isRed={true} />

              {/* Red team chips */}
              <div style={S.chips}>
                {redNums.map(n => (
                    <EpaChip
                        key={n}
                        teamNum={n}
                        epa={epaData[n]}
                        alliance="red"
                        isFav={favTeams.includes(n)}
                    />
                ))}
              </div>

              <span style={S.vs}>VS</span>

              {/* Blue team chips */}
              <div style={S.chips}>
                {blueNums.map(n => (
                    <EpaChip
                        key={n}
                        teamNum={n}
                        epa={epaData[n]}
                        alliance="blue"
                        isFav={favTeams.includes(n)}
                    />
                ))}
              </div>

              {/* Blue alliance total */}
              <AllianceTotal teams={blueNums} epaData={epaData} label="BLUE" isRed={false} />
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
                return <span style={S.deckFavs}>⭐ {favInDeck.map(n => `#${n}`).join(' ')}</span>;
              })()}
            </div>
        )}
      </div>
  );
}

const S = {
  bar: {
    height: 68,
    background: '#070b14',
    borderBottom: '1px solid #1a2e4a',
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    gap: 14,
    overflow: 'hidden',
    flexShrink: 0,
  },
  idle:      { color: '#374151', fontSize: 13, fontStyle: 'italic' },
  eventInfo: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, minWidth: 0 },
  eventName: {
    color: '#64748b', fontSize: 12, fontWeight: 700,
    letterSpacing: '0.05em', textTransform: 'uppercase',
    fontFamily: "'Barlow Condensed', sans-serif",
    whiteSpace: 'nowrap',
  },
  sep: { color: '#1a2e4a', flexShrink: 0 },
  matchRow: { display: 'flex', alignItems: 'center', gap: 7 },
  onFieldBadge: {
    background: '#14532d', border: '1px solid #22c55e', color: '#4ade80',
    borderRadius: 4, padding: '1px 6px', fontSize: 9,
    fontWeight: 800, letterSpacing: '0.08em', animation: 'pulse 2s infinite',
    flexShrink: 0,
  },
  matchLabel: { color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' },
  waiting:    { color: '#374151', fontSize: 12, fontStyle: 'italic' },

  // EPA section
  epaSection: {
    display: 'flex', alignItems: 'center', gap: 8, flex: 1,
    justifyContent: 'center', overflow: 'hidden',
  },
  chips: { display: 'flex', gap: 5 },
  vs: {
    color: '#1a2e4a', fontSize: 11, fontWeight: 800,
    letterSpacing: '0.1em', fontFamily: "'Barlow Condensed', sans-serif",
    flexShrink: 0,
  },

  // On deck
  deckRow: {
    display: 'flex', alignItems: 'center', gap: 7,
    marginLeft: 'auto', flexShrink: 0,
    background: '#0d1526', border: '1px solid #1a2e4a',
    borderRadius: 8, padding: '4px 11px',
  },
  deckLabel: { color: '#374151', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' },
  deckMatch: { color: '#475569', fontSize: 11 },
  deckFavs:  { color: '#fbbf24', fontSize: 11, fontWeight: 700 },
};