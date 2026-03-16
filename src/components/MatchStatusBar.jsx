// src/components/MatchStatusBar.jsx
import { useCallback } from 'react';
import { normalizeStatus } from '../hooks/useFirebase.js';
import { useStatbotics } from '../hooks/useStatbotics.js';
import { refreshEvent } from '../utils/api.js';

const YEAR = new Date().getFullYear();

function epaColor(norm) {
  if (norm == null) return '#475569';
  if (norm >= 1500)  return '#60a5fa';
  if (norm >= 1350)  return '#4ade80';
  if (norm >= 1200)  return '#86efac';
  if (norm >= 800)   return '#94a3b8';
  return '#f87171';
}

function EpaChip({ teamNum, epa, alliance, isFav }) {
  const color   = epaColor(epa?.norm);
  const isRed   = alliance === 'red';
  const meanStr = epa?.mean != null ? epa.mean.toFixed(1) : '—';

  return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '5px 9px', borderRadius: 7, minWidth: 56,
        background: isRed ? '#1a0808' : '#08101a',
        border: `1px solid ${isRed ? '#7f1d1d' : '#1e3a5f'}`,
        position: 'relative', flexShrink: 0,
      }}>
        {isFav && (
            <span style={{ position: 'absolute', top: -5, right: -4, fontSize: 9 }}>⭐</span>
        )}
        <span style={{
          color: isFav ? '#fbbf24' : '#e2e8f0',
          fontSize: 14, fontWeight: 800,
          fontFamily: "'Barlow Condensed', sans-serif",
          lineHeight: 1.2,
        }}>{teamNum}</span>
        <span style={{
          color, fontSize: 13, fontWeight: 900,
          fontFamily: "'Barlow Condensed', sans-serif",
          lineHeight: 1.2,
        }}>{meanStr}</span>
      </div>
  );
}

function AllianceTotal({ teams, epaData, isRed }) {
  const total     = teams.reduce((s, t) => s + (epaData[t]?.mean ?? 0), 0);
  const allLoaded = teams.every(t => epaData[t] !== undefined);
  const str       = allLoaded && total > 0 ? total.toFixed(1) : '—';

  return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '5px 10px', borderRadius: 7, flexShrink: 0,
        background: isRed ? '#2d0808' : '#08102d',
        border: `1px solid ${isRed ? '#dc2626' : '#2563eb'}`,
      }}>
      <span style={{
        color: isRed ? '#f87171' : '#93c5fd',
        fontSize: 9, fontWeight: 800,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        fontFamily: "'Barlow Condensed', sans-serif",
      }}>{isRed ? 'RED' : 'BLUE'}</span>
        <span style={{
          color: isRed ? '#fca5a5' : '#bfdbfe',
          fontSize: 16, fontWeight: 900,
          fontFamily: "'Barlow Condensed', sans-serif",
          lineHeight: 1.2,
        }}>{str}</span>
      </div>
  );
}

export default function MatchStatusBar({
                                         currentStreamEvent, eventData, favTeams,
                                         onSelectStream, onClearPin,
                                       }) {
  if (!currentStreamEvent) {
    return (
        <div style={{ ...S.bar, height: 52 }}>
          <span style={S.idle}>Select an event from the sidebar</span>
        </div>
    );
  }

  const fav       = favTeams || [];
  const edata     = eventData[currentStreamEvent] || {};
  const cm        = edata.currentMatch;
  const od        = edata.onDeck;
  const streams   = edata.streams || [];
  const activeIdx = edata.activeStreamIdx ?? (streams.length > 0 ? streams.length - 1 : 0);
  const isPinned  = edata.pinned || false;

  const red  = cm ? [cm.r1, cm.r2, cm.r3].filter(t => t && t !== 'null') : [];
  const blue = cm ? [cm.b1, cm.b2, cm.b3].filter(t => t && t !== 'null') : [];
  const allTeams = [...red, ...blue].map(t => parseInt(t, 10)).filter(n => !isNaN(n));

  const { epaData } = useStatbotics(allTeams.length ? allTeams : null, YEAR);

  const redNums  = red.map(t  => parseInt(t, 10));
  const blueNums = blue.map(t => parseInt(t, 10));

  const status   = normalizeStatus(cm?.status);
  const isActive = status === 'onField' || status === 'inProgress';

  const handleStreamChange = useCallback((e) => {
    const idx = parseInt(e.target.value, 10);
    onSelectStream?.(idx);
  }, [onSelectStream]);

  return (
      <div style={S.bar}>

        {/* ── Left column: event info + stream dropdown ── */}
        <div style={S.leftCol}>
          {/* Row 1: event name + match label */}
          <div style={S.row1}>
            <span style={S.eventName}>{edata.shortName || edata.name || currentStreamEvent}</span>
            {cm ? (
                <>
                  <span style={S.sep}>·</span>
                  {isActive && <span style={S.onFieldBadge}>ON FIELD</span>}
                  <span style={S.matchLabel}>{cm.label}</span>
                </>
            ) : (
                <>
                  <span style={S.sep}>·</span>
                  <span style={S.waiting}>Waiting…</span>
                </>
            )}
            {/* On deck inline */}
            {od && (
                <>
                  <span style={{ ...S.sep, marginLeft: 4 }}>|</span>
                  <span style={S.deckLabel}>Next:</span>
                  <span style={S.deckMatch}>{od.label}</span>
                  {(() => {
                    const favInDeck = [od.r1,od.r2,od.r3,od.b1,od.b2,od.b3]
                        .filter(t => t && t !== 'null')
                        .map(t => parseInt(t,10))
                        .filter(n => fav.includes(n));
                    return favInDeck.length
                        ? <span style={S.deckFavs}>⭐{favInDeck.map(n=>`#${n}`).join(' ')}</span>
                        : null;
                  })()}
                </>
            )}
          </div>

          {/* Row 2: stream dropdown */}
          <div style={S.row2}>
            {streams.length > 0 ? (
                <div style={S.dropdownWrap}>
                  <select
                      value={activeIdx}
                      onChange={handleStreamChange}
                      style={S.dropdown}
                  >
                    {streams.map((s, i) => (
                        <option key={i} value={i}>
                          {s.liveStatus === 'live' ? '🔴 ' : ''}
                          {s.label}
                          {i === activeIdx && isPinned ? ' 📌' : ''}
                        </option>
                    ))}
                  </select>
                  {isPinned && (
                      <button style={S.autoBtn} onClick={onClearPin} title="Clear pin, auto-detect live">
                        ↺
                      </button>
                  )}
                  <button
                      style={S.recheckBtn}
                      onClick={() => refreshEvent(currentStreamEvent, true).catch(() => {})}
                      title="Re-check which stream is live"
                  >
                    ↺ Recheck
                  </button>
                </div>
            ) : (
                <span style={S.noStream}>No streams available</span>
            )}
          </div>
        </div>

        {/* ── Right: EPA chips spanning both rows ── */}
        {cm && (
            <div style={S.epaSection}>
              <AllianceTotal teams={redNums}  epaData={epaData} isRed={true}  />
              <div style={S.chips}>
                {redNums.map(n => (
                    <EpaChip key={n} teamNum={n} epa={epaData[n]} alliance="red"  isFav={fav.includes(n)} />
                ))}
              </div>
              <span style={S.vs}>VS</span>
              <div style={S.chips}>
                {blueNums.map(n => (
                    <EpaChip key={n} teamNum={n} epa={epaData[n]} alliance="blue" isFav={fav.includes(n)} />
                ))}
              </div>
              <AllianceTotal teams={blueNums} epaData={epaData} isRed={false} />
            </div>
        )}

      </div>
  );
}

const S = {
  bar: {
    height: 72,
    background: '#070b14',
    borderBottom: '1px solid #1a2e4a',
    display: 'flex',
    alignItems: 'stretch',
    padding: '0 16px',
    gap: 16,
    overflow: 'hidden',
    flexShrink: 0,
  },

  // Left column
  leftCol: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 5,
    flexShrink: 0,
    minWidth: 0,
  },
  row1: {
    display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'nowrap',
  },
  row2: {
    display: 'flex', alignItems: 'center', gap: 6,
  },

  // Event info
  eventName: {
    color: '#64748b', fontSize: 12, fontWeight: 700,
    letterSpacing: '0.06em', textTransform: 'uppercase',
    fontFamily: "'Barlow Condensed', sans-serif",
    whiteSpace: 'nowrap',
  },
  sep: { color: '#1a2e4a', fontSize: 12, flexShrink: 0 },
  onFieldBadge: {
    background: '#14532d', border: '1px solid #22c55e', color: '#4ade80',
    borderRadius: 4, padding: '1px 6px', fontSize: 9,
    fontWeight: 800, letterSpacing: '0.08em',
    animation: 'pulse 2s infinite', flexShrink: 0,
  },
  matchLabel: { color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' },
  waiting:    { color: '#374151', fontSize: 12, fontStyle: 'italic' },
  deckLabel:  { color: '#374151', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' },
  deckMatch:  { color: '#374151', fontSize: 11, whiteSpace: 'nowrap' },
  deckFavs:   { color: '#fbbf24', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' },

  // Stream dropdown
  dropdownWrap: {
    display: 'flex', alignItems: 'center', gap: 5,
  },
  dropdown: {
    background: '#0d1526',
    border: '1px solid #1a2e4a',
    borderRadius: 6,
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 22px 3px 8px',
    outline: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23475569'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 7px center',
    minWidth: 130,
  },
  autoBtn: {
    background: 'transparent', border: '1px solid #78350f',
    borderRadius: 5, color: '#fbbf24', fontSize: 12,
    padding: '2px 7px', cursor: 'pointer', fontFamily: 'inherit',
  },
  recheckBtn: {
    background: 'transparent', border: '1px solid #1a2e4a',
    borderRadius: 5, color: '#374151', fontSize: 11,
    padding: '2px 7px', cursor: 'pointer', fontFamily: 'inherit',
  },
  noStream: { color: '#374151', fontSize: 11, fontStyle: 'italic' },

  // EPA
  epaSection: {
    display: 'flex', alignItems: 'center', gap: 8,
    flex: 1, justifyContent: 'center', overflow: 'hidden',
  },
  chips: { display: 'flex', gap: 5 },
  vs: {
    color: '#1a2e4a', fontSize: 11, fontWeight: 800,
    letterSpacing: '0.1em', fontFamily: "'Barlow Condensed', sans-serif",
    flexShrink: 0,
  },
  idle: { color: '#374151', fontSize: 13, fontStyle: 'italic' },
};