// src/components/MatchNotification.jsx
import { useEffect, useState } from 'react';

export default function MatchNotification({ notification, onAccept, onDismiss }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!notification) return;
    setProgress(100);
    const start = Date.now();
    const duration = 15000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(pct);
      if (pct === 0) clearInterval(interval);
    }, 50);

    return () => clearInterval(interval);
  }, [notification]);

  if (!notification) return null;

  const { eventName, teamNum, match } = notification;
  const matchLabel = match?.description || match?.matchNumber
    ? `Match ${match.matchNumber || '?'}`
    : 'Upcoming match';

  return (
    <div style={styles.container}>
      {/* Progress bar */}
      <div style={styles.progressTrack}>
        <div style={{ ...styles.progressBar, width: `${progress}%` }} />
      </div>

      <div style={styles.inner}>
        <div style={styles.icon}>🚨</div>
        <div style={styles.content}>
          <div style={styles.headline}>
            Team <span style={styles.teamHighlight}>{teamNum}</span> is on field!
          </div>
          <div style={styles.sub}>
            <span style={styles.eventBadge}>{eventName}</span>
            <span style={styles.matchLabel}>{matchLabel}</span>
          </div>
          <div style={styles.note}>
            Can't switch mid-match — current match still in progress.
          </div>
        </div>

        <div style={styles.actions}>
          <button style={styles.switchBtn} onClick={onAccept}>
            Switch Now
          </button>
          <button style={styles.dismissBtn} onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    width: 340,
    background: '#0d1526',
    border: '1px solid #1d4ed8',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 0 40px rgba(29, 78, 216, 0.3), 0 8px 32px rgba(0,0,0,0.5)',
    zIndex: 2000,
    animation: 'slideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  },
  progressTrack: {
    height: 3,
    background: '#1e3a5f',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #1d4ed8, #60a5fa)',
    transition: 'width 0.05s linear',
  },
  inner: {
    padding: '16px',
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
  },
  icon: { fontSize: 22, flexShrink: 0, paddingTop: 2 },
  content: { flex: 1, minWidth: 0 },
  headline: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 6,
    fontFamily: "'Barlow Condensed', sans-serif",
    letterSpacing: '0.02em',
  },
  teamHighlight: {
    color: '#60a5fa',
    fontSize: 17,
    fontWeight: 800,
  },
  sub: {
    display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap',
  },
  eventBadge: {
    background: '#1e3a5f',
    color: '#93c5fd',
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  matchLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  note: {
    color: '#475569',
    fontSize: 11,
    lineHeight: 1.4,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    flexShrink: 0,
  },
  switchBtn: {
    padding: '8px 14px',
    background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
    border: 'none',
    borderRadius: 7,
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    letterSpacing: '0.05em',
  },
  dismissBtn: {
    padding: '7px 14px',
    background: 'transparent',
    border: '1px solid #1e3a5f',
    borderRadius: 7,
    color: '#64748b',
    fontSize: 12,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};
