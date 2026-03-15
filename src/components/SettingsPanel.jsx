// src/components/SettingsPanel.jsx
import { useState } from 'react';
import { refreshTeam } from '../utils/api.js';

export default function SettingsPanel({
  favTeams, setFavTeams,
  offsetSeconds, setOffsetSeconds,
  endOffsetSeconds, setEndOffsetSeconds,
  forceSwitch, setForceSwitch,
  afterMatchEnds, setAfterMatchEnds,
  homeEvent, setHomeEvent,
  teamData, eventData,
  onClose,
}) {
  const [newTeam,     setNewTeam]     = useState('');
  const [teamNames,   setTeamNames]   = useState({});
  const [loading,     setLoading]     = useState(false);
  const [offsetInput, setOffsetInput] = useState(offsetSeconds.toString());
  const [endInput,    setEndInput]    = useState(endOffsetSeconds.toString());

  const addTeam = async () => {
    const num = parseInt(newTeam.trim(), 10);
    if (!num || isNaN(num) || favTeams.includes(num)) return;
    setLoading(true);
    // Get name from Firebase teamData or refresh
    const existing = teamData[num.toString()];
    if (existing?.name) {
      setTeamNames(p => ({ ...p, [num]: existing.name }));
    } else {
      refreshTeam(num).catch(() => {});
    }
    setFavTeams(prev => [...prev, num]);
    setNewTeam('');
    setLoading(false);
  };

  const removeTeam = (n) => setFavTeams(p => p.filter(t => t !== n));
  const moveUp     = (i) => setFavTeams(p => { const a = [...p]; [a[i-1],a[i]]=[a[i],a[i-1]]; return a; });
  const moveDown   = (i) => setFavTeams(p => { const a = [...p]; [a[i],a[i+1]]=[a[i+1],a[i]]; return a; });

  const getTeamName = (num) => {
    return teamNames[num] || teamData[num.toString()]?.name || null;
  };

  // Events where fav teams are registered (for homeEvent picker)
  const knownEvents = [...new Set(
    favTeams.map(n => teamData[n.toString()]?.currentEvent).filter(Boolean)
  )];

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.panel} onClick={e => e.stopPropagation()}>

        <div style={S.header}>
          <h2 style={S.title}>Settings</h2>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* ── Favorite Teams ── */}
        <section style={S.section}>
          <h3 style={S.sectionTitle}><span>⭐</span> Favorite Teams <span style={S.hint}>top = highest priority</span></h3>
          <div style={S.addRow}>
            <input
              type="number" value={newTeam}
              onChange={e => setNewTeam(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTeam()}
              placeholder="Team number…" style={S.input}
            />
            <button onClick={addTeam} disabled={loading || !newTeam} style={S.addBtn}>
              {loading ? '…' : '+ Add'}
            </button>
          </div>
          <div style={S.teamList}>
            {favTeams.length === 0 && <p style={S.empty}>No teams added yet.</p>}
            {favTeams.map((num, idx) => (
              <div key={num} style={S.teamRow}>
                <span style={S.rank}>#{idx+1}</span>
                <span style={S.teamNum}>{num}</span>
                {getTeamName(num) && <span style={S.teamName}>{getTeamName(num)}</span>}
                <div style={S.teamActions}>
                  <button style={S.iconBtn} onClick={() => moveUp(idx)}   disabled={idx===0}>↑</button>
                  <button style={S.iconBtn} onClick={() => moveDown(idx)} disabled={idx===favTeams.length-1}>↓</button>
                  <button style={{...S.iconBtn, color:'#ef4444'}} onClick={() => removeTeam(num)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Stream Start Offset ── */}
        <section style={S.section}>
          <h3 style={S.sectionTitle}><span>⏱</span> Stream Start Offset</h3>
          <p style={S.desc}>Seconds to wait after Nexus marks a match "on field" before switching. Accounts for robot enable time.</p>
          <div style={S.offsetRow}>
            <input type="number" value={offsetInput} min="0" max="600"
              onChange={e => { setOffsetInput(e.target.value); const n=parseFloat(e.target.value); if(!isNaN(n)&&n>=0) setOffsetSeconds(n); }}
              style={{...S.input, width:90}}
            />
            <span style={S.unit}>seconds ({(parseFloat(offsetInput||0)/60).toFixed(1)}m)</span>
          </div>
          <div style={S.presets}>
            {[120,180,240,300].map(v => (
              <button key={v} onClick={() => { setOffsetSeconds(v); setOffsetInput(v.toString()); }}
                style={{...S.presetBtn, background: offsetSeconds===v?'#1d4ed8':'transparent', borderColor: offsetSeconds===v?'#2563eb':'#1a2e4a'}}>
                {v/60}m
              </button>
            ))}
          </div>
        </section>

        {/* ── Stream End Offset ── */}
        <section style={S.section}>
          <h3 style={S.sectionTitle}><span>⏳</span> Stream End Offset</h3>
          <p style={S.desc}>Seconds to stay on current stream after a match ends before switching away.</p>
          <div style={S.offsetRow}>
            <input type="number" value={endInput} min="0" max="120"
              onChange={e => { setEndInput(e.target.value); const n=parseFloat(e.target.value); if(!isNaN(n)&&n>=0) setEndOffsetSeconds(n); }}
              style={{...S.input, width:90}}
            />
            <span style={S.unit}>seconds</span>
          </div>
          <div style={S.presets}>
            {[0,10,15,30].map(v => (
              <button key={v} onClick={() => { setEndOffsetSeconds(v); setEndInput(v.toString()); }}
                style={{...S.presetBtn, background: endOffsetSeconds===v?'#1d4ed8':'transparent', borderColor: endOffsetSeconds===v?'#2563eb':'#1a2e4a'}}>
                {v}s
              </button>
            ))}
          </div>
        </section>

        {/* ── Force Switch ── */}
        <section style={S.section}>
          <h3 style={S.sectionTitle}><span>⚡</span> Auto-Switch for Higher Priority</h3>
          <p style={S.desc}>When a team higher on your list comes on field mid-match, should Automix switch immediately or ask first?</p>
          <div style={S.toggleGroup}>
            <button
              style={{...S.toggleBtn, ...(forceSwitch ? S.toggleActive : {})}}
              onClick={() => setForceSwitch(true)}
            >
              Switch immediately
            </button>
            <button
              style={{...S.toggleBtn, ...(!forceSwitch ? S.toggleActive : {})}}
              onClick={() => setForceSwitch(false)}
            >
              Always ask first
            </button>
          </div>
          <p style={{...S.desc, marginTop:8, color:'#374151'}}>
            Lower priority teams always show a popup regardless of this setting.
          </p>
        </section>

        {/* ── After Match Ends ── */}
        <section style={S.section}>
          <h3 style={S.sectionTitle}><span>🔀</span> After Match Ends</h3>
          <p style={S.desc}>When no fav teams are on field after your match ends:</p>
          <div style={S.radioGroup}>
            {[
              { val: 'stay',   label: 'Stay on current event' },
              { val: 'home',   label: 'Return to home event' },
              { val: 'random', label: 'Random event with my teams' },
            ].map(({ val, label }) => (
              <label key={val} style={S.radioRow}>
                <input
                  type="radio" name="afterMatchEnds"
                  checked={afterMatchEnds === val}
                  onChange={() => setAfterMatchEnds(val)}
                  style={{ accentColor: '#2563eb' }}
                />
                <span style={{ color: afterMatchEnds === val ? '#e2e8f0' : '#64748b' }}>{label}</span>
              </label>
            ))}
          </div>

          {afterMatchEnds === 'home' && (
            <div style={{ marginTop: 12 }}>
              <label style={S.label}>Home Event</label>
              {knownEvents.length > 0 ? (
                <select
                  value={homeEvent || ''}
                  onChange={e => setHomeEvent(e.target.value)}
                  style={{ ...S.input, paddingTop: 10, paddingBottom: 10 }}
                >
                  <option value="">Select event…</option>
                  {knownEvents.map(ek => (
                    <option key={ek} value={ek}>
                      {eventData[ek]?.shortName || eventData[ek]?.name || ek}
                    </option>
                  ))}
                </select>
              ) : (
                <p style={S.empty}>Add teams to see their events here.</p>
              )}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}

const S = {
  overlay: {
    position:'fixed', inset:0, zIndex:1000,
    background:'rgba(0,0,0,0.75)', backdropFilter:'blur(4px)',
    display:'flex', alignItems:'flex-start', justifyContent:'flex-end', padding:16,
  },
  panel: {
    background:'#0a101e', border:'1px solid #1a2e4a',
    borderRadius:12, width:440, maxHeight:'calc(100vh - 32px)',
    overflowY:'auto', boxShadow:'0 0 60px rgba(0,0,0,0.6)', marginTop:60,
  },
  header: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'20px 24px 16px', borderBottom:'1px solid #1a2e4a',
    position:'sticky', top:0, background:'#0a101e', zIndex:1,
  },
  title: {
    color:'#e2e8f0', fontSize:17, fontWeight:800, margin:0,
    letterSpacing:'0.06em', textTransform:'uppercase',
    fontFamily:"'Barlow Condensed', sans-serif",
  },
  closeBtn: { background:'none', border:'none', color:'#475569', cursor:'pointer', fontSize:18, padding:'4px 8px', borderRadius:6 },
  section:  { padding:'18px 24px', borderBottom:'1px solid #1a2e4a' },
  sectionTitle: {
    color:'#64748b', fontSize:11, fontWeight:700, letterSpacing:'0.12em',
    textTransform:'uppercase', margin:'0 0 12px', display:'flex', alignItems:'center', gap:7,
    fontFamily:"'Barlow Condensed', sans-serif",
  },
  hint: { marginLeft:'auto', color:'#374151', fontWeight:400, fontSize:10 },
  addRow: { display:'flex', gap:8, marginBottom:12 },
  input: {
    flex:1, padding:'10px 14px',
    background:'#070b14', border:'1px solid #1a2e4a',
    borderRadius:8, color:'#e2e8f0', fontSize:14,
    outline:'none', fontFamily:'inherit', width:'100%',
  },
  addBtn: {
    padding:'10px 18px', background:'linear-gradient(135deg,#1d4ed8,#2563eb)',
    border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer',
  },
  teamList:    { display:'flex', flexDirection:'column', gap:5 },
  empty:       { color:'#374151', fontSize:13, margin:0 },
  teamRow:     { display:'flex', alignItems:'center', gap:10, background:'#0d1526', borderRadius:8, padding:'9px 13px', border:'1px solid #1a2e4a' },
  rank:        { color:'#374151', fontSize:11, fontWeight:700, width:22, flexShrink:0 },
  teamNum:     { color:'#3b82f6', fontSize:16, fontWeight:800, minWidth:44, fontFamily:"'Barlow Condensed', sans-serif" },
  teamName:    { color:'#94a3b8', fontSize:13, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  teamActions: { display:'flex', gap:4, marginLeft:'auto' },
  iconBtn: {
    background:'none', border:'1px solid #1a2e4a', borderRadius:6,
    color:'#475569', cursor:'pointer', padding:'3px 8px', fontSize:13,
  },
  desc:     { color:'#475569', fontSize:12, lineHeight:1.55, margin:'0 0 12px' },
  offsetRow:{ display:'flex', alignItems:'center', gap:10, marginBottom:10 },
  unit:     { color:'#475569', fontSize:12 },
  presets:  { display:'flex', gap:7 },
  presetBtn:{ padding:'5px 13px', borderRadius:6, border:'1px solid', color:'#94a3b8', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.15s' },
  toggleGroup:{ display:'flex', gap:8 },
  toggleBtn:  { flex:1, padding:'9px 14px', borderRadius:8, border:'1px solid #1a2e4a', background:'transparent', color:'#64748b', fontSize:13, fontWeight:600, cursor:'pointer', transition:'all 0.15s', fontFamily:'inherit' },
  toggleActive:{ background:'#1d4ed8', borderColor:'#2563eb', color:'#fff' },
  radioGroup: { display:'flex', flexDirection:'column', gap:10 },
  radioRow:   { display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:13 },
  label:      { display:'block', color:'#64748b', fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 },
};
