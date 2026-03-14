// src/components/LoginScreen.jsx
import { useState } from 'react';
import { checkPassword } from '../utils/api';

export default function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const ok = await checkPassword(password);
      if (ok) {
        sessionStorage.setItem('appPassword', password);
        onLogin(password);
      } else {
        setError('Incorrect password');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0e1a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #0d1526 0%, #111827 100%)',
        border: '1px solid #1e3a5f',
        borderRadius: 12,
        padding: '48px 56px',
        width: 360,
        boxShadow: '0 0 60px rgba(0,120,255,0.1)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            fontSize: 48,
            marginBottom: 8,
            filter: 'drop-shadow(0 0 12px #2563eb)',
          }}>⚙️</div>
          <h1 style={{
            color: '#e2e8f0',
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '0.05em',
            margin: 0,
            textTransform: 'uppercase',
          }}>FRC Watcher</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>
            Live match stream switcher
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block',
              color: '#94a3b8',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                background: '#0a0e1a',
                border: `1px solid ${error ? '#ef4444' : '#1e3a5f'}`,
                borderRadius: 8,
                color: '#e2e8f0',
                fontSize: 16,
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = '#2563eb'}
              onBlur={e => e.target.style.borderColor = error ? '#ef4444' : '#1e3a5f'}
            />
            {error && (
              <p style={{ color: '#ef4444', fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: '100%',
              padding: '13px',
              background: loading ? '#1e3a5f' : 'linear-gradient(135deg, #1d4ed8, #2563eb)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: loading ? 'wait' : 'pointer',
              transition: 'all 0.2s',
              opacity: (!password && !loading) ? 0.5 : 1,
            }}
          >
            {loading ? 'Checking…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}
