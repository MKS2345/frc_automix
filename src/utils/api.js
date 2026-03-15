// src/utils/api.js
import { getIdToken } from '../firebase.js';

async function headers() {
  const token = await getIdToken().catch(() => '');
  return {
    'Content-Type': 'application/json',
    'x-app-password': sessionStorage.getItem('appPassword') || '',
    'x-firebase-token': token,
  };
}

export async function apiPost(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function apiGet(path) {
  const h = await headers();
  delete h['Content-Type'];
  const res = await fetch(path, { headers: h });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// Check app password (before Firebase auth is set up)
export async function checkPassword(password) {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  return data.ok === true;
}

// Trigger on-demand team metadata refresh
export async function refreshTeam(teamNum) {
  return apiPost('/api/refresh-team', { teamNum });
}

// Trigger on-demand event stream refresh
export async function refreshEvent(eventKey, force = false) {
  return apiPost('/api/refresh-event', { eventKey, force });
}

export function getCurrentYear() {
  return new Date().getFullYear();
}
