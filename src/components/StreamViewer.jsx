// src/components/StreamViewer.jsx

export default function StreamViewer({ streamInfo, eventName, offsetSeconds, pendingDelay }) {
  if (!streamInfo) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>📺</div>
        <div style={styles.emptyTitle}>No Stream Selected</div>
        <div style={styles.emptySub}>
          Select an event from the sidebar, or add favorite teams to auto-switch.
        </div>
      </div>
    );
  }

  const { url, type } = streamInfo;

  // If the URL doesn't look like an embeddable iframe URL
  if (!url || (!url.includes('youtube') && !url.includes('twitch') && !url.includes('livestream'))) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>📡</div>
        <div style={styles.emptyTitle}>{eventName}</div>
        <div style={styles.emptySub}>
          Stream type: <code style={styles.code}>{type || 'unknown'}</code>
        </div>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" style={styles.openLink}>
            Open Stream ↗
          </a>
        )}
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      {pendingDelay > 0 && (
        <div style={styles.delayOverlay}>
          <div style={styles.delayBox}>
            <div style={styles.delayIcon}>⏱</div>
            <div style={styles.delayTitle}>Switching in…</div>
            <div style={styles.delayCount}>{pendingDelay}s</div>
            <div style={styles.delaySub}>Waiting for match to begin</div>
          </div>
        </div>
      )}
      <iframe
        key={url}
        src={url}
        style={styles.iframe}
        allowFullScreen
        allow="autoplay; fullscreen"
        title={`${eventName} stream`}
        frameBorder="0"
      />
    </div>
  );
}

const styles = {
  wrapper: {
    flex: 1,
    position: 'relative',
    background: '#000',
    overflow: 'hidden',
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    display: 'block',
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#080d1a',
    padding: 40,
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
    filter: 'grayscale(1)',
    opacity: 0.3,
  },
  emptyTitle: {
    color: '#475569',
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 8,
    fontFamily: "'Barlow Condensed', sans-serif",
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  emptySub: {
    color: '#374151',
    fontSize: 13,
    maxWidth: 360,
    lineHeight: 1.6,
  },
  openLink: {
    marginTop: 20,
    color: '#2563eb',
    fontSize: 14,
    fontWeight: 700,
    textDecoration: 'none',
    padding: '10px 20px',
    border: '1px solid #1e3a5f',
    borderRadius: 8,
  },
  code: {
    fontFamily: 'monospace',
    background: '#111827',
    padding: '2px 6px',
    borderRadius: 4,
    color: '#94a3b8',
    fontSize: 12,
  },
  delayOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    backdropFilter: 'blur(4px)',
  },
  delayBox: {
    background: '#0d1526',
    border: '1px solid #1e3a5f',
    borderRadius: 16,
    padding: '32px 48px',
    textAlign: 'center',
    boxShadow: '0 0 60px rgba(0,0,0,0.5)',
  },
  delayIcon: { fontSize: 40, marginBottom: 8 },
  delayTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    marginBottom: 8,
    fontFamily: "'Barlow Condensed', sans-serif",
  },
  delayCount: {
    color: '#60a5fa',
    fontSize: 72,
    fontWeight: 800,
    lineHeight: 1,
    fontFamily: "'Barlow Condensed', sans-serif",
    marginBottom: 8,
  },
  delaySub: {
    color: '#475569',
    fontSize: 12,
  },
};
