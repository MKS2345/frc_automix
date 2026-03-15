// src/components/StreamViewer.jsx
import { refreshEvent } from '../utils/api.js';

export default function StreamViewer({
  currentStreamEvent,
  eventData,
  onSelectStream,
  onClearPin,
}) {
  if (!currentStreamEvent) {
    return (
      <div style={S.empty}>
        <div style={S.emptyIcon}>📺</div>
        <div style={S.emptyTitle}>No Stream Selected</div>
        <div style={S.emptySub}>
          Add favorite teams in Settings, or select an event from the sidebar.
        </div>
      </div>
    );
  }

  const edata   = eventData[currentStreamEvent] || {};
  const streams = edata.streams || [];
  const activeIdx = edata.activeStreamIdx ?? (streams.length > 0 ? streams.length - 1 : 0);
  const activeUrl = edata.activeStream || streams[activeIdx]?.url;
  const isPinned  = edata.pinned || false;

  // Fix Twitch parent to current hostname
  const resolvedUrl = activeUrl
    ? activeUrl.replace('HOSTNAME', window.location.hostname)
    : null;

  if (!resolvedUrl) {
    return (
      <div style={S.empty}>
        <div style={S.emptyIcon}>📡</div>
        <div style={S.emptyTitle}>{edata.shortName || edata.name || currentStreamEvent}</div>
        <div style={S.emptySub}>No stream available for this event.</div>
        <button
          style={S.refreshBtn}
          onClick={() => refreshEvent(currentStreamEvent, true).catch(() => {})}
        >
          ↺ Check for streams
        </button>
      </div>
    );
  }

  return (
    <div style={S.wrapper}>
      {/* Multi-stream picker */}
      {streams.length > 1 && (
        <div style={S.picker}>
          <span style={S.pickerLabel}>Streams</span>
          {streams.map((stream, i) => {
            const isActive = i === activeIdx;
            const isLive   = stream.liveStatus === 'live';
            return (
              <button
                key={i}
                style={{
                  ...S.pickerBtn,
                  background:   isActive ? '#1d4ed8' : 'transparent',
                  borderColor:  isActive ? '#2563eb' : (isLive ? '#22c55e' : '#1a2e4a'),
                  color:        isActive ? '#fff'    : (isLive ? '#4ade80' : '#94a3b8'),
                }}
                onClick={() => onSelectStream?.(i)}
                title={stream.liveStatus === 'live' ? 'Currently live' : stream.liveStatus === 'upcoming' ? 'Upcoming' : stream.label}
              >
                {stream.label}
                {isLive  && !isActive && <span style={S.liveDot} />}
                {isActive && isPinned  && <span style={{ marginLeft: 5, fontSize: 10 }}>📌</span>}
              </button>
            );
          })}
          {isPinned && (
            <button
              style={{ ...S.pickerBtn, borderColor: '#78350f', color: '#fbbf24', fontSize: 11 }}
              onClick={onClearPin}
              title="Clear pin and auto-detect live stream"
            >
              ↺ Auto
            </button>
          )}
          <button
            style={{ ...S.pickerBtn, borderColor: '#1a2e4a', color: '#374151', fontSize: 11, marginLeft: 'auto' }}
            onClick={() => refreshEvent(currentStreamEvent, true).catch(() => {})}
            title="Re-check which stream is live"
          >
            ↺ Recheck
          </button>
        </div>
      )}

      {/* Single stream — show override button */}
      {streams.length === 1 && (
        <div style={S.pickerSingle}>
          <span style={S.pickerLabel}>
            {streams[0].type} stream
            {streams[0].liveStatus === 'live'     && <span style={S.liveTag}>LIVE</span>}
            {streams[0].liveStatus === 'upcoming' && <span style={S.upcomingTag}>UPCOMING</span>}
          </span>
          <button
            style={{ ...S.pickerBtn, borderColor: '#1a2e4a', color: '#374151', fontSize: 11 }}
            onClick={() => refreshEvent(currentStreamEvent, true).catch(() => {})}
            title="Re-check stream status"
          >
            ↺ Recheck
          </button>
        </div>
      )}

      <iframe
        key={resolvedUrl}
        src={resolvedUrl}
        style={{
          ...S.iframe,
          height: streams.length > 0 ? 'calc(100% - 42px)' : '100%',
        }}
        allowFullScreen
        allow="autoplay; fullscreen"
        title={`${edata.shortName || currentStreamEvent} stream`}
        frameBorder="0"
      />
    </div>
  );
}

const S = {
  wrapper: {
    flex: 1,
    position: 'relative',
    background: '#000',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  iframe: {
    width: '100%',
    flex: 1,
    border: 'none',
    display: 'block',
  },
  picker: {
    height: 42,
    background: 'rgba(7, 11, 20, 0.95)',
    borderBottom: '1px solid #1a2e4a',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 14px',
    flexShrink: 0,
    backdropFilter: 'blur(8px)',
  },
  pickerSingle: {
    height: 42,
    background: 'rgba(7, 11, 20, 0.95)',
    borderBottom: '1px solid #1a2e4a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '0 14px',
    flexShrink: 0,
  },
  pickerLabel: {
    color: '#374151',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginRight: 4,
    fontFamily: "'Barlow Condensed', sans-serif",
    flexShrink: 0,
  },
  pickerBtn: {
    padding: '5px 11px',
    border: '1px solid',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    whiteSpace: 'nowrap',
  },
  liveDot: {
    width: 6, height: 6,
    borderRadius: '50%',
    background: '#22c55e',
    display: 'inline-block',
    animation: 'pulse 1.5s infinite',
  },
  liveTag: {
    background: '#14532d', color: '#4ade80',
    fontSize: 9, fontWeight: 800, padding: '1px 5px',
    borderRadius: 3, marginLeft: 7, letterSpacing: '0.08em',
  },
  upcomingTag: {
    background: '#1e3a5f', color: '#93c5fd',
    fontSize: 9, fontWeight: 800, padding: '1px 5px',
    borderRadius: 3, marginLeft: 7, letterSpacing: '0.08em',
  },
  refreshBtn: {
    marginTop: 20, padding: '10px 20px',
    background: 'transparent', border: '1px solid #1a2e4a',
    borderRadius: 8, color: '#475569',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  empty: {
    flex: 1,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: '#070b14', padding: 40, textAlign: 'center',
  },
  emptyIcon:  { fontSize: 56, marginBottom: 16, opacity: 0.25 },
  emptyTitle: {
    color: '#374151', fontSize: 18, fontWeight: 700, marginBottom: 8,
    fontFamily: "'Barlow Condensed', sans-serif",
    textTransform: 'uppercase', letterSpacing: '0.08em',
  },
  emptySub: { color: '#1e3a5f', fontSize: 13, maxWidth: 320, lineHeight: 1.6 },
};
