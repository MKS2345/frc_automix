// src/utils/api.js

const getPassword = () => sessionStorage.getItem('appPassword') || '';

const headers = () => ({
  'Content-Type': 'application/json',
  'x-app-password': getPassword(),
});

// TBA proxy: path is anything after /api/v3/
export async function tbaGet(path) {
  const encoded = encodeURIComponent(path);
  const res = await fetch(`/api/tba?path=${encoded}`, { headers: headers() });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error(`TBA error ${res.status}`);
  return res.json();
}

// Nexus proxy: get match queue for an event
export async function nexusGetMatches(eventCode) {
  const res = await fetch(`/api/nexus?eventCode=${encodeURIComponent(eventCode)}`, {
    headers: headers(),
  });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error(`Nexus error ${res.status}`);
  return res.json();
}

// Auth check
export async function checkPassword(password) {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  return data.ok === true;
}

// Get current FRC year
export function getCurrentYear() {
  const now = new Date();
  // FRC season: season runs Jan-Apr, kickoff in Jan
  return now.getFullYear();
}

// Get all current/ongoing events for a given year
export async function getCurrentEvents(year) {
  const events = await tbaGet(`events/${year}`);
  const now = Date.now();
  return events.filter(e => {
    const start = new Date(e.start_date).getTime();
    const end = new Date(e.end_date).getTime() + 86400000; // include end day
    return start <= now && end >= now;
  });
}

// Get team info
export async function getTeamInfo(teamNumber) {
  return tbaGet(`team/frc${teamNumber}`);
}

// Get events for a team this year
export async function getTeamEvents(teamNumber, year) {
  return tbaGet(`team/frc${teamNumber}/events/${year}`);
}

// Get matches for an event
export async function getEventMatches(eventKey) {
  return tbaGet(`event/${eventKey}/matches`);
}

// Get team name from TBA
export async function getTeamName(teamNumber) {
  try {
    const info = await tbaGet(`team/frc${teamNumber}/simple`);
    return info.nickname || info.team_number?.toString() || teamNumber.toString();
  } catch {
    return teamNumber.toString();
  }
}
