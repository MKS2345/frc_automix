// src/components/SettingsPanel.jsx
import { useState } from 'react';
import { getTeamName } from '../utils/api';

export default function SettingsPanel({ favTeams, setFavTeams, offsetSeconds, setOffsetSeconds, onClose }) {
  const [newTeam, setNewTeam] = useState('');
  const [teamNames, setTeamNames] = useState({});
  const [loading, setLoading] = useState(false);
  const [offsetInput, setOffsetInput] = useState(offsetSeconds.toString());

  const addTeam = async () => {
    const num = parseInt(newTeam.trim(), 10);
    if (!num || isNaN(num) || favTeams.includes(num)) return;
    setLoading(true);
    const name = await getTeamName(num);
    setTeamNames(prev => ({ ...prev, [num]: name }));
    setFavTeams(prev => [...prev, num]);
    setNewTeam('');
    setLoading(false);
  };

  const removeTeam = (num) => {
    setFavTeams(prev => prev.filter(t => t !== num));
  };

  const moveUp = (idx) => {
    if (idx === 0) return;
    setFavTeams(prev => {
      const arr = [...prev];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return arr;
    });
  };

  const moveDown = (idx) => {
    setFavTeams(prev => {
      if (idx >= prev.length - 1) return prev;
      const arr = [...prev];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr;
    });
  };

  const handleOffsetChange = (val) => {
    setOffsetInput(val);
    const n = parseFloat(val);
    if (!isNaN(n) && n >= 0) setOffsetSeconds(n);
  };

  const s = styles;

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.panel} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <h2 style={s.title}>Settings</h2>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Favorite Teams */}
        <section style={s.section}>
          <h3 style={s.sectionTitle}>
            <span style={s.sectionIcon}>⭐</span>
            Favorite Teams
            <span style={s.hint}>Priority: top = highest</span>
          </h3>

          <div style={s.addRow}>
            <input
              type="number"
              value={newTeam}
              onChange={e => setNewTeam(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTeam()}
              placeholder="Team number…"
              style={s.input}
            />
            <button
              onClick={addTeam}
              disabled={loading || !newTeam}
              style={s.addBtn}
            >
              {loading ? '…' : '+ Add'}
            </button>
          </div>

          <div style={s.teamList}>
            {favTeams.length === 0 && (
              <p style={s.empty}>No teams added yet. Add team numbers above.</p>
            )}
            {favTeams.map((num, idx) => (
              <div key={num} style={s.teamRow}>
                <span style={s.rank}>#{idx + 1}</span>
                <span style={s.teamNum}>{num}</span>
                {teamNames[num] && <span style={s.teamName}>{teamNames[num]}</span>}
                <div style={s.teamActions}>
                  <button style={s.iconBtn} onClick={() => moveUp(idx)} disabled={idx === 0} title="Move up">↑</button>
                  <button style={s.iconBtn} onClick={() => moveDown(idx)} disabled={idx === favTeams.length - 1} title="Move down">↓</button>
                  <button style={{ ...s.iconBtn, color: '#ef4444' }} onClick={() => removeTeam(num)} title="Remove">✕</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Stream Offset */}
        <section style={s.section}>
          <h3 style={s.sectionTitle}>
            <span style={s.sectionIcon}>⏱</span>
            Nexus Start Offset
          </h3>
          <p style={s.desc}>
            How many seconds to wait after Nexus marks a match "on field" before switching streams.
            3 minutes (180s) accounts for robot enable time.
          </p>
          <div style={s.offsetRow}>
            <input
              type="number"
              value={offsetInput}
              onChange={e => handleOffsetChange(e.target.value)}
              min="0"
              max="600"
              style={{ ...s.input, width: 100 }}
            />
            <span style={s.offsetUnit}>seconds</span>
            <span style={s.offsetMins}>
              ({(parseFloat(offsetInput) / 60).toFixed(1)} min)
            </span>
          </div>
          <div style={s.presets}>
            {[120, 180, 240, 300].map(v => (
              <button
                key={v}
                style={{
                  ...s.presetBtn,
                  background: offsetSeconds === v ? '#1d4ed8' : 'transparent',
                  borderColor: offsetSeconds === v ? '#2563eb' : '#1e3a5f',
                }}
                onClick={() => { setOffsetSeconds(v); setOffsetInput(v.toString()); }}
              >
                {v / 60}m
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
    padding: 16,
  },
  panel: {
    background: '#0d1526',
    border: '1px solid #1e3a5f',
    borderRadius: 12,
    width: 420,
    maxHeight: 'calc(100vh - 32px)',
    overflowY: 'auto',
    boxShadow: '0 0 60px rgba(0,0,0,0.5)',
    marginTop: 56,
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 24px 16px',
    borderBottom: '1px solid #1e3a5f',
    position: 'sticky', top: 0, background: '#0d1526', zIndex: 1,
  },
  title: {
    color: '#e2e8f0', fontSize: 18, fontWeight: 700, margin: 0,
    letterSpacing: '0.05em', textTransform: 'uppercase',
    fontFamily: "'Barlow Condensed', sans-serif",
  },
  closeBtn: {
    background: 'none', border: 'none', color: '#64748b',
    cursor: 'pointer', fontSize: 18, padding: '4px 8px',
    borderRadius: 6, transition: 'color 0.2s',
  },
  section: {
    padding: '20px 24px',
    borderBottom: '1px solid #1e3a5f',
  },
  sectionTitle: {
    color: '#94a3b8', fontSize: 11, fontWeight: 700,
    letterSpacing: '0.12em', textTransform: 'uppercase',
    margin: '0 0 14px',
    display: 'flex', alignItems: 'center', gap: 8,
    fontFamily: "'Barlow Condensed', sans-serif",
  },
  sectionIcon: { fontSize: 14 },
  hint: {
    marginLeft: 'auto', color: '#475569', fontWeight: 400,
    fontSize: 10, letterSpacing: '0.06em',
  },
  addRow: {
    display: 'flex', gap: 8, marginBottom: 14,
  },
  input: {
    flex: 1, padding: '10px 14px',
    background: '#0a0e1a', border: '1px solid #1e3a5f',
    borderRadius: 8, color: '#e2e8f0', fontSize: 14,
    outline: 'none', fontFamily: 'inherit',
  },
  addBtn: {
    padding: '10px 18px',
    background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
    border: 'none', borderRadius: 8, color: '#fff',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  teamList: { display: 'flex', flexDirection: 'column', gap: 6 },
  empty: { color: '#475569', fontSize: 13, margin: 0 },
  teamRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#111827', borderRadius: 8, padding: '10px 14px',
    border: '1px solid #1e3a5f',
  },
  rank: { color: '#475569', fontSize: 11, fontWeight: 700, width: 24, flexShrink: 0 },
  teamNum: { color: '#2563eb', fontSize: 16, fontWeight: 800, minWidth: 44, fontFamily: "'Barlow Condensed', sans-serif" },
  teamName: { color: '#94a3b8', fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  teamActions: { display: 'flex', gap: 4, marginLeft: 'auto' },
  iconBtn: {
    background: 'none', border: '1px solid #1e3a5f',
    borderRadius: 6, color: '#64748b',
    cursor: 'pointer', padding: '3px 8px', fontSize: 13,
    transition: 'all 0.15s',
  },
  desc: { color: '#64748b', fontSize: 12, marginTop: 0, marginBottom: 14, lineHeight: 1.5 },
  offsetRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
  offsetUnit: { color: '#64748b', fontSize: 13 },
  offsetMins: { color: '#475569', fontSize: 12 },
  presets: { display: 'flex', gap: 8 },
  presetBtn: {
    padding: '6px 14px', borderRadius: 6, border: '1px solid',
    color: '#94a3b8', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', transition: 'all 0.15s',
  },
};
