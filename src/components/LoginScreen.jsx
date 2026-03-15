// src/components/LoginScreen.jsx
import { useState, useEffect } from 'react';
import { checkPassword } from '../utils/api.js';
import { onActiveSessionsChange } from '../firebase.js';

export default function LoginScreen({ onLogin }) {
  const [password,  setPassword]  = useState('');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [watching,  setWatching]  = useState(0);

  useEffect(() => {
    // Show live viewer count even on login screen
    const unsub = onActiveSessionsChange(setWatching);
    return () => unsub();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const ok = await checkPassword(password);
      if (ok) { sessionStorage.setItem('appPassword', password); onLogin(); }
      else    setError('Incorrect password');
    } catch { setError('Connection error'); }
    finally  { setLoading(false); }
  };

  return (
    <div style={S.page}>
      <style>{css}</style>

      <div style={S.card}>
        {/* Logo */}
        <div style={S.logoRow}>
          <div style={S.logoMark}>⚡</div>
          <div>
            <div style={S.logoText}>FRC Automix</div>
            <div style={S.logoSub}>Live stream switcher</div>
          </div>
        </div>

        {/* Live viewer count */}
        {watching > 0 && (
          <div style={S.watchingBadge}>
            <span style={S.watchingDot} />
            {watching} watching now
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ marginTop: 28 }}>
          <label style={S.label}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            style={{ ...S.input, borderColor: error ? '#ef4444' : '#1a2e4a' }}
            onFocus={e => e.target.style.borderColor = '#2563eb'}
            onBlur={e => e.target.style.borderColor  = error ? '#ef4444' : '#1a2e4a'}
          />
          {error && <p style={S.error}>{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            style={{ ...S.btn, opacity: (!password || loading) ? 0.5 : 1 }}
          >
            {loading ? 'Checking…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh', background: '#070b14',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Barlow', sans-serif",
  },
  card: {
    background: 'linear-gradient(160deg, #0d1526 0%, #0a101e 100%)',
    border: '1px solid #1a2e4a', borderRadius: 16,
    padding: '44px 52px', width: 360,
    boxShadow: '0 0 80px rgba(37,99,235,0.08)',
  },
  logoRow: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4 },
  logoMark: {
    fontSize: 36, width: 52, height: 52, borderRadius: 12,
    background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  logoText: {
    color: '#e2e8f0', fontSize: 20, fontWeight: 800,
    letterSpacing: '0.04em', textTransform: 'uppercase',
    fontFamily: "'Barlow Condensed', sans-serif",
  },
  logoSub:  { color: '#475569', fontSize: 12, marginTop: 2 },
  watchingBadge: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#0a1628', border: '1px solid #1a2e4a',
    borderRadius: 20, padding: '6px 14px', marginTop: 16,
    color: '#60a5fa', fontSize: 12, fontWeight: 600, width: 'fit-content',
  },
  watchingDot: {
    width: 7, height: 7, borderRadius: '50%',
    background: '#22c55e', display: 'inline-block',
    animation: 'pulse 1.5s infinite',
  },
  label: {
    display: 'block', color: '#64748b', fontSize: 11,
    fontWeight: 700, letterSpacing: '0.1em',
    textTransform: 'uppercase', marginBottom: 8,
  },
  input: {
    width: '100%', padding: '12px 16px',
    background: '#070b14', border: '1px solid',
    borderRadius: 8, color: '#e2e8f0', fontSize: 15,
    outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.2s', fontFamily: 'inherit',
  },
  error: { color: '#ef4444', fontSize: 12, marginTop: 6, marginBottom: 0 },
  btn: {
    width: '100%', marginTop: 16, padding: '13px',
    background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
    border: 'none', borderRadius: 8, color: '#fff',
    fontSize: 14, fontWeight: 700, letterSpacing: '0.08em',
    textTransform: 'uppercase', cursor: 'pointer',
    transition: 'opacity 0.2s', fontFamily: 'inherit',
  },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@400;500;600;700&display=swap');
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #070b14; overflow: hidden; }
`;
