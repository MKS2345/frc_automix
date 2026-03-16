// src/components/MatchNotification.jsx
import { useEffect, useState } from 'react';

export default function MatchNotification({ notification, teamData, eventData, onAccept, onDismiss }) {
  // Debug: log key props
  console.log('[MatchNotification] render');
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!notification) return;
    setProgress(100);
    const start = Date.now();
    const id = setInterval(() => {
      const pct = Math.max(0, 100 - ((Date.now() - start) / 15000) * 100);
      setProgress(pct);
      if (pct === 0) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, [notification]);

  if (!notification) return null;

  const { eventKey, teamNum, matchLabel, isHigherPriority } = notification;
  const teamName  = teamData[teamNum?.toString()]?.name;
  const eventName = eventData[eventKey]?.shortName || eventData[eventKey]?.name || eventKey;

  return (
      <div style={S.container}>
        <div style={S.progressTrack}>
          <div style={{ ...S.progressBar, width: `${progress}%` }} />
        </div>

        <div style={S.inner}>
          <div style={S.icon}>{isHigherPriority ? '🔼' : '📺'}</div>
          <div style={S.content}>
            <div style={S.headline}>
              <span style={S.teamNum}>#{teamNum}</span>
              {teamName && <span style={S.teamName}> {teamName}</span>}
              {isHigherPriority && <span style={S.priorityTag}>higher priority</span>}
            </div>
            <div style={S.sub}>
              <span style={S.eventBadge}>{eventName}</span>
              {matchLabel && <span style={S.matchLabel}>{matchLabel}</span>}
            </div>
            <div style={S.note}>
              {isHigherPriority
                  ? 'Higher priority team on field — switch now?'
                  : 'Match in progress on current stream.'}
            </div>
          </div>
          <div style={S.actions}>
            <button style={S.switchBtn} onClick={onAccept}>Switch</button>
            <button style={S.dismissBtn} onClick={onDismiss}>Dismiss</button>
          </div>
        </div>
      </div>
  );
}

const S = {
  container: {
    position:'fixed', bottom:24, right:24, width:340,
    background:'#0a101e', border:'1px solid #1d4ed8',
    borderRadius:12, overflow:'hidden',
    boxShadow:'0 0 40px rgba(29,78,216,0.25), 0 8px 32px rgba(0,0,0,0.5)',
    zIndex:2000, animation:'slideIn 0.3s cubic-bezier(0.175,0.885,0.32,1.275)',
  },
  progressTrack: { height:3, background:'#1a2e4a' },
  progressBar:   { height:'100%', background:'linear-gradient(90deg,#1d4ed8,#60a5fa)', transition:'width 0.05s linear' },
  inner:    { padding:16, display:'flex', gap:12, alignItems:'flex-start' },
  icon:     { fontSize:20, flexShrink:0, paddingTop:2 },
  content:  { flex:1, minWidth:0 },
  headline: { display:'flex', alignItems:'center', gap:6, marginBottom:5, flexWrap:'wrap' },
  teamNum:  { color:'#60a5fa', fontSize:17, fontWeight:800, fontFamily:"'Barlow Condensed', sans-serif" },
  teamName: { color:'#94a3b8', fontSize:13 },
  priorityTag: {
    background:'#1e3a5f', color:'#93c5fd', fontSize:10, fontWeight:700,
    padding:'1px 7px', borderRadius:10, letterSpacing:'0.06em',
  },
  sub:        { display:'flex', gap:7, alignItems:'center', marginBottom:5, flexWrap:'wrap' },
  eventBadge: { background:'#1a2e4a', color:'#93c5fd', borderRadius:4, padding:'2px 8px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em' },
  matchLabel: { color:'#475569', fontSize:12 },
  note:       { color:'#374151', fontSize:11, lineHeight:1.4 },
  actions:    { display:'flex', flexDirection:'column', gap:6, flexShrink:0 },
  switchBtn:  { padding:'8px 14px', background:'linear-gradient(135deg,#1d4ed8,#2563eb)', border:'none', borderRadius:7, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' },
  dismissBtn: { padding:'7px 14px', background:'transparent', border:'1px solid #1a2e4a', borderRadius:7, color:'#475569', fontSize:12, cursor:'pointer' },
};