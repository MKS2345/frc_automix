// src/hooks/useMatchWatcher.js
//
// Three switching flows:
//
// FLOW A — Normal start
//   Match marked on-field → offset timer starts → timer fires, not watching → switch
//
// FLOW B — Mid-match conflict
//   Match on-field while watching a different event
//   → show 15s popup; user can force-switch or dismiss
//   → when current match ends → auto-switch to deferred if still pending
//
// FLOW C — Higher-priority wait
//   Match A on-field → timer fires → finds higher-priority match ALSO on-field
//   → defer this match; the higher match's own timer handles the switch

import { useState, useEffect, useRef, useCallback } from 'react';
import { nexusGetMatches, getCurrentEvents, getCurrentYear } from '../utils/api';

const POLL_INTERVAL_MS = 15_000;

// ─── Nexus status normalizer ─────────────────────────────────────────────────
// Nexus returns human-readable strings: "Now queuing", "On deck", "On field",
// "In progress", "Complete" (and "Awaiting results" after match ends)
export function normalizeStatus(raw) {
  if (!raw) return 'unknown';
  const s = raw.toString().toLowerCase().replace(/[_\s-]/g, '');
  if (s === 'onfield')                                      return 'onField';
  if (s === 'inprogress' || s === 'awaitingresults')        return 'inProgress';
  if (s === 'ondeck')                                       return 'onDeck';
  if (s === 'nowqueuing' || s === 'queuing')                return 'queuing';
  if (s === 'complete' || s === 'done' || s === 'posted' || s === 'results') return 'complete';
  return 'unknown';
}

// ─── Team helpers ─────────────────────────────────────────────────────────────
// Nexus redTeams/blueTeams are string arrays like ["1800", "600", "3100"]
// No "frc" prefix — just plain team number strings
export function teamsInMatch(match) {
  if (!match) return [];
  const red  = match.redTeams  || [];
  const blue = match.blueTeams || [];
  return [...red, ...blue]
      .filter(t => t != null)                          // Nexus uses null for empty playoff slots
      .map(t => parseInt(t.toString().replace(/frc/i, ''), 10))
      .filter(n => !isNaN(n) && n > 0);
}

function bestPriority(match, favTeams) {
  const teams = teamsInMatch(match);
  let best = Infinity;
  for (const t of teams) {
    const idx = favTeams.indexOf(t);
    if (idx !== -1 && idx < best) best = idx;
  }
  return best;
}

function hasFav(match, favTeams) {
  return bestPriority(match, favTeams) < Infinity;
}

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useMatchWatcher({ favTeams, offsetSeconds, isAuthenticated }) {

  const [activeEvents,    setActiveEvents]    = useState([]);
  const [eventMatchData,  setEventMatchData]  = useState({});
  const [streamUrls,      setStreamUrls]      = useState({});
  const [currentStreamEvent, setCurrentStreamEvent] = useState(null);
  const [watchingMatchKey,   setWatchingMatchKey]   = useState(null);
  const [isWatchingMatch,    setIsWatchingMatch]    = useState(false);
  const [deferredSwitch,     setDeferredSwitch]     = useState(null);
  const [notification,       setNotification]       = useState(null);

  const stateRef   = useRef({});
  const timerRefs  = useRef({});
  const pollRef    = useRef(null);
  const notifRef   = useRef(null);

  stateRef.current = {
    favTeams, offsetSeconds, isWatchingMatch,
    currentStreamEvent, watchingMatchKey,
    eventMatchData, activeEvents, deferredSwitch,
  };

  // ── helpers ─────────────────────────────────────────────────────────────────

  const clearSwitchTimer = useCallback((key) => {
    if (timerRefs.current[key]) {
      clearTimeout(timerRefs.current[key]);
      delete timerRefs.current[key];
    }
  }, []);

  const dismissNotification = useCallback(() => {
    setNotification(null);
    if (notifRef.current) { clearTimeout(notifRef.current); notifRef.current = null; }
  }, []);

  const switchToEvent = useCallback((eventKey) => {
    Object.keys(timerRefs.current).forEach(k => clearTimeout(timerRefs.current[k]));
    timerRefs.current = {};
    setCurrentStreamEvent(eventKey);
    setIsWatchingMatch(false);
    setWatchingMatchKey(null);
    setDeferredSwitch(null);
    dismissNotification();
  }, [dismissNotification]);

  const acceptPendingSwitch = useCallback(() => {
    const { deferredSwitch: ds } = stateRef.current;
    if (ds) switchToEvent(ds.eventKey);
    else    dismissNotification();
  }, [switchToEvent, dismissNotification]);

  const resolveDeferred = useCallback(() => {
    const { deferredSwitch: ds } = stateRef.current;
    if (!ds) return;
    setCurrentStreamEvent(ds.eventKey);
    setWatchingMatchKey(ds.matchKey);
    setIsWatchingMatch(true);
    setDeferredSwitch(null);
    dismissNotification();
  }, [dismissNotification]);

  // ── timer callback ────────────────────────────────────────────────────────────
  const onMatchTimerFired = useCallback((eventKey, timerKey, matchObj) => {
    const {
      favTeams: fav, isWatchingMatch: watching,
      currentStreamEvent: curEvent, eventMatchData: matchData, activeEvents: events,
    } = stateRef.current;

    // Re-verify the match is still live at fire-time
    const eventMatches = matchData[eventKey] || [];
    const live = eventMatches.find(m => m.label === matchObj.label);
    const ls = normalizeStatus(live?.status);
    if (!live || (ls !== 'onField' && ls !== 'inProgress')) return;

    // Build full ranked candidate list across all events
    const candidates = [];
    for (const evt of events) {
      for (const m of matchData[evt.key] || []) {
        const s = normalizeStatus(m.status);
        if ((s === 'onField' || s === 'inProgress') && hasFav(m, fav)) {
          candidates.push({
            eventKey: evt.key,
            match: m,
            matchKey: `${evt.key}_${m.label}`,
            priority: bestPriority(m, fav),
          });
        }
      }
    }
    candidates.sort((a, b) => a.priority - b.priority);

    const best = candidates[0];
    const thisMatchKey = timerKey;

    // FLOW C: a higher-priority match exists → bail, its timer will fire
    if (best && best.matchKey !== thisMatchKey) return;

    // FLOW B: mid-match on a different event → popup + defer
    if (watching && curEvent !== eventKey) {
      const favTeamNum = fav.find(t => teamsInMatch(matchObj).includes(t));
      const eventInfo  = events.find(e => e.key === eventKey);
      setNotification({
        eventKey,
        matchKey: thisMatchKey,
        teamNum: favTeamNum,
        eventName: eventInfo?.short_name || eventInfo?.name || eventKey,
        match: matchObj,
      });
      setDeferredSwitch({ eventKey, matchKey: thisMatchKey });
      if (notifRef.current) clearTimeout(notifRef.current);
      notifRef.current = setTimeout(() => setNotification(null), 15_000);
      return;
    }

    // FLOW A: not locked → switch immediately
    setCurrentStreamEvent(eventKey);
    setWatchingMatchKey(thisMatchKey);
    setIsWatchingMatch(true);
    setDeferredSwitch(null);
    dismissNotification();
  }, [dismissNotification]);

  // ── detect match end → release lock ─────────────────────────────────────────
  useEffect(() => {
    if (!isWatchingMatch || !currentStreamEvent) return;
    const matches = eventMatchData[currentStreamEvent] || [];
    const hasActive = matches.some(m => {
      const s = normalizeStatus(m.status);
      return s === 'onField' || s === 'inProgress';
    });
    if (!hasActive) {
      setIsWatchingMatch(false);
      setWatchingMatchKey(null);
      resolveDeferred();
    }
  }, [eventMatchData, isWatchingMatch, currentStreamEvent, resolveDeferred]);

  // ── evaluator — schedules timers for newly-active fav matches ────────────────
  const evaluateMatches = useCallback((updatedData, events) => {
    const { favTeams: fav, offsetSeconds: offset } = stateRef.current;
    if (!fav || fav.length === 0) return;

    for (const event of events) {
      for (const match of updatedData[event.key] || []) {
        const s = normalizeStatus(match.status);
        if ((s !== 'onField' && s !== 'inProgress') || !hasFav(match, fav)) continue;

        // Use label as stable match ID (e.g. "Qualification 12")
        const timerKey = `${event.key}_${match.label}`;
        if (timerRefs.current[timerKey]) continue;

        const delayMs = Math.max(0, offset * 1000);
        timerRefs.current[timerKey] = setTimeout(() => {
          delete timerRefs.current[timerKey];
          onMatchTimerFired(event.key, timerKey, match);
        }, delayMs);
      }
    }

    // Cancel timers for completed matches
    for (const event of events) {
      for (const match of updatedData[event.key] || []) {
        const s = normalizeStatus(match.status);
        if (s === 'complete') {
          clearSwitchTimer(`${event.key}_${match.label}`);
        }
      }
    }
  }, [onMatchTimerFired, clearSwitchTimer]);

  // ── poll Nexus ───────────────────────────────────────────────────────────────
  // Track events that have 404d so we stop polling them every 15s
  const nexus404Cache = useRef(new Set());

  const pollMatches = useCallback(async () => {
    const { activeEvents: events } = stateRef.current;
    if (!events?.length) return;

    const updates = {};
    await Promise.allSettled(events.map(async (event) => {
      // Skip events we know are not on Nexus
      if (nexus404Cache.current.has(event.key)) return;
      try {
        const raw = await nexusGetMatches(event.key);
        // Nexus returns { eventKey, matches: [...], ... }
        updates[event.key] = raw?.matches || (Array.isArray(raw) ? raw : []);
      } catch (e) {
        if (e.message === 'UNAUTHORIZED') {
          sessionStorage.removeItem('appPassword');
          window.location.reload();
          return;
        }
        if (e.message?.includes('404')) {
          // Event not on Nexus — stop polling it silently
          nexus404Cache.current.add(event.key);
          return;
        }
        console.warn(`[Nexus] ${event.key}:`, e.message);
      }
    }));

    setEventMatchData(prev => {
      const merged = { ...prev, ...updates };
      evaluateMatches(merged, events);
      return merged;
    });
  }, [evaluateMatches]);

  // ── stream URL builder ───────────────────────────────────────────────────────
  const loadStreamUrl = useCallback((event) => {
    if (!event?.webcasts?.length) return;
    const wc   = event.webcasts[0];
    const host = window.location.hostname;
    let url    = '';

    switch (wc.type) {
      case 'twitch':
        url = `https://player.twitch.tv/?channel=${wc.channel}&parent=${host}&autoplay=true`;
        break;
      case 'youtube':
        url = `https://www.youtube.com/embed/${wc.channel}?autoplay=1&rel=0`;
        break;
      case 'livestream':
        url = `https://livestream.com/accounts/${wc.channel}/events/${wc.file}/player`;
        break;
      default:
        url = wc.channel?.startsWith('http') ? wc.channel : '';
    }

    if (url) {
      setStreamUrls(prev => ({ ...prev, [event.key]: { url, type: wc.type, raw: wc } }));
    }
  }, []);

  // ── load active events ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    const load = async () => {
      try {
        const events = await getCurrentEvents(getCurrentYear());
        setActiveEvents(events);
        events.forEach(loadStreamUrl);
      } catch (e) {
        if (e.message === 'UNAUTHORIZED') {
          sessionStorage.removeItem('appPassword');
          window.location.reload();
        }
        console.error('[TBA] load events:', e);
      }
    };
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [isAuthenticated, loadStreamUrl]);

  // ── start polling once events exist ─────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || activeEvents.length === 0) return;
    pollMatches();
    pollRef.current = setInterval(pollMatches, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [isAuthenticated, activeEvents, pollMatches]);

  // ── global cleanup ───────────────────────────────────────────────────────────
  useEffect(() => () => {
    Object.values(timerRefs.current).forEach(clearTimeout);
    if (pollRef.current) clearInterval(pollRef.current);
    if (notifRef.current) clearTimeout(notifRef.current);
  }, []);

  // ── sidebar categorization ───────────────────────────────────────────────────
  const categorizedEvents = (() => {
    const fav = favTeams || [];
    const withFavPlaying = [], withFavAtEvent = [], others = [];

    for (const event of activeEvents) {
      const matches = eventMatchData[event.key] || [];
      if (matches.some(m => {
        const s = normalizeStatus(m.status);
        return (s === 'onField' || s === 'inProgress') && hasFav(m, fav);
      })) { withFavPlaying.push(event); continue; }

      if (matches.some(m => hasFav(m, fav))) { withFavAtEvent.push(event); continue; }
      others.push(event);
    }
    return { withFavPlaying, withFavAtEvent, others };
  })();

  return {
    activeEvents, eventMatchData, currentStreamEvent,
    streamUrls, notification, deferredSwitch,
    categorizedEvents, isWatchingMatch,
    switchToEvent, acceptPendingSwitch, dismissNotification, pollMatches,
  };
}