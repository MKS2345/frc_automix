// src/hooks/useFirebase.js
//
// Replaces useMatchWatcher entirely.
// Instead of polling Nexus every 15s, this hook:
//   1. Subscribes to /teams/{num} for each fav team via Firebase RTDB onValue
//   2. Those paths are updated by Nexus webhooks server-side
//   3. On change, runs the switching logic
//
// Settings that affect switching:
//   offsetSeconds    - delay after onFieldAt before switching (default 180s)
//   endOffsetSeconds - delay after match ends before switching away (default 15s)
//   forceSwitch      - auto-switch for higher priority team without popup
//   afterMatchEnds   - 'home' | 'stay' | 'random' (what to do when no fav teams on)
//   homeEvent        - eventKey to return to if afterMatchEnds === 'home'

import { useState, useEffect, useRef, useCallback } from 'react';
import { db, onValue, ref } from '../firebase.js';
import { refreshTeam, refreshEvent } from '../utils/api.js';

const TEAM_STALE_MS  = 30  * 60 * 1000; // 30 min — metadata only; status from webhooks
const EVENT_STALE_MS = 60  * 60 * 1000; // 1 hr

export function normalizeStatus(raw) {
  if (!raw) return 'unknown';
  const s = raw.toString().toLowerCase().replace(/[_\s-]/g, '');
  if (s === 'onfield' || s === 'field')                   return 'onField';
  if (s === 'inprogress' || s === 'awaitingresults')      return 'inProgress';
  if (s === 'ondeck')                                     return 'onDeck';
  if (s === 'nowqueuing' || s === 'queuing')              return 'queuing';
  if (s === 'complete' || s === 'done' || s === 'posted') return 'complete';
  if (s === 'idle')                                       return 'idle';
  return 'unknown';
}

function isActiveStatus(status) {
  return status === 'onField' || status === 'inProgress';
}

export function useFirebase({
                              favTeams,
                              offsetSeconds,
                              endOffsetSeconds,
                              forceSwitch,
                              afterMatchEnds,
                              homeEvent,
                              isAuthenticated,
                            }) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [teamData,    setTeamData]    = useState({}); // { [teamNum]: Firebase /teams/{num} }
  const [eventData,   setEventData]   = useState({}); // { [eventKey]: Firebase /events/{key} }
  const [currentStreamEvent, setCurrentStreamEvent] = useState(null);
  const [isWatchingMatch,    setIsWatchingMatch]    = useState(false);
  const [watchingMatchLabel, setWatchingMatchLabel] = useState(null);
  const [deferredSwitch,     setDeferredSwitch]     = useState(null); // { eventKey, teamNum, matchLabel }
  const [notification,       setNotification]       = useState(null);
  const [activeSessions,     setActiveSessions]     = useState(0);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const stateRef      = useRef({});
  const switchTimers  = useRef({}); // teamNum → timeoutId (offset timer)
  const endTimerRef   = useRef(null);
  const notifTimerRef = useRef(null);
  const unsubsRef     = useRef([]); // Firebase onValue unsubscribers

  stateRef.current = {
    favTeams, offsetSeconds, endOffsetSeconds, forceSwitch,
    afterMatchEnds, homeEvent,
    teamData, eventData, currentStreamEvent,
    isWatchingMatch, watchingMatchLabel, deferredSwitch,
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const dismissNotification = useCallback(() => {
    setNotification(null);
    if (notifTimerRef.current) { clearTimeout(notifTimerRef.current); notifTimerRef.current = null; }
  }, []);

  const switchToEvent = useCallback((eventKey) => {
    Object.values(switchTimers.current).forEach(clearTimeout);
    switchTimers.current = {};
    if (endTimerRef.current) { clearTimeout(endTimerRef.current); endTimerRef.current = null; }
    setCurrentStreamEvent(eventKey);
    setIsWatchingMatch(false);
    setWatchingMatchLabel(null);
    setDeferredSwitch(null);
    dismissNotification();
  }, [dismissNotification]);

  const acceptPendingSwitch = useCallback(() => {
    const { deferredSwitch: ds } = stateRef.current;
    if (ds) switchToEvent(ds.eventKey);
    else    dismissNotification();
  }, [switchToEvent, dismissNotification]);

  // ── After-match-ends handler ───────────────────────────────────────────────
  const handleMatchEnded = useCallback(() => {
    const {
      deferredSwitch: ds, afterMatchEnds: policy,
      homeEvent: home, teamData: td, favTeams: fav, currentStreamEvent: cur,
    } = stateRef.current;

    // If there's a deferred switch waiting, always take it
    if (ds) {
      setCurrentStreamEvent(ds.eventKey);
      setIsWatchingMatch(true);
      setWatchingMatchLabel(ds.matchLabel || null);
      setDeferredSwitch(null);
      dismissNotification();
      return;
    }

    // Otherwise apply policy
    if (policy === 'home' && home) {
      setCurrentStreamEvent(home);
      setIsWatchingMatch(false);
      setWatchingMatchLabel(null);
      return;
    }

    if (policy === 'random') {
      // Find all events where fav teams are registered
      const eventsWithFavs = [...new Set(
          fav.map(n => td[n.toString()]?.currentEvent).filter(Boolean)
      )];
      if (eventsWithFavs.length > 1) {
        const others = eventsWithFavs.filter(e => e !== cur);
        const pick   = others[Math.floor(Math.random() * others.length)];
        if (pick) { setCurrentStreamEvent(pick); setIsWatchingMatch(false); }
      }
      return;
    }

    // 'stay' — do nothing, stay on current event
    setIsWatchingMatch(false);
    setWatchingMatchLabel(null);
  }, [dismissNotification]);

  // ── Core switching decision — runs when any team data changes ──────────────
  const evaluateTeamUpdate = useCallback((updatedTeamNum, updatedData) => {
    const {
      favTeams: fav, offsetSeconds: offset, endOffsetSeconds: endOffset,
      isWatchingMatch: watching, currentStreamEvent: curEvent,
      watchingMatchLabel: curLabel, forceSwitch: doForce,
      teamData: td,
    } = stateRef.current;

    if (!fav?.length) return;

    const status = normalizeStatus(updatedData?.status);
    const isActive = isActiveStatus(status);
    const eventKey = updatedData?.currentEvent;
    const matchLabel = updatedData?.match?.label;
    const teamIdx  = fav.indexOf(parseInt(updatedTeamNum, 10));
    if (teamIdx === -1) return; // not a fav team

    // ── Team just went on field ──────────────────────────────────────────────
    if (isActive && eventKey) {
      const timerKey = updatedTeamNum.toString();

      // Don't double-schedule for same match
      if (switchTimers.current[timerKey]) return;

      // Check priority vs any other teams already on field
      // If a higher-priority fav team is already on field → don't schedule
      for (let i = 0; i < teamIdx; i++) {
        const higherNum = fav[i].toString();
        const higherData = td[higherNum];
        const higherStatus = normalizeStatus(higherData?.status);
        if (isActiveStatus(higherStatus)
            && higherData?.currentEvent) {
          // Higher priority team already handled — skip this one
          return;
        }
      }

      // Schedule switch after offset
      const onFieldAt = updatedData?.onFieldAt || Date.now();
      const elapsed   = Date.now() - onFieldAt;
      const delayMs   = Math.max(0, (offset * 1000) - elapsed);

      switchTimers.current[timerKey] = setTimeout(() => {
        delete switchTimers.current[timerKey];

        const {
          isWatchingMatch: w, currentStreamEvent: ce,
          watchingMatchLabel: cl, forceSwitch: fs,
          favTeams: f,
        } = stateRef.current;

        // Re-check priority at fire time
        for (let i = 0; i < teamIdx; i++) {
          const higherNum  = f[i].toString();
          const higherData = stateRef.current.teamData[higherNum];
          const hs = normalizeStatus(higherData?.status);
          if (isActiveStatus(hs) && higherData?.currentEvent) {
            return; // Higher priority team active — their timer handles it
          }
        }

        if (!w) {
          // FLOW A: not watching → switch now
          setCurrentStreamEvent(eventKey);
          setIsWatchingMatch(true);
          setWatchingMatchLabel(matchLabel || null);
          setDeferredSwitch(null);
          dismissNotification();
        } else if (ce === eventKey) {
          // Already on this event — just mark as watching
          setIsWatchingMatch(true);
          setWatchingMatchLabel(matchLabel || null);
        } else {
          // FLOW B/C: watching a different event
          const watchingTeamIdx = f.findIndex(n => {
            const nd = stateRef.current.teamData[n.toString()];
            return nd?.currentEvent === ce &&
                isActiveStatus(normalizeStatus(nd?.status));
          });
          const isHigherPriority = watchingTeamIdx === -1 || teamIdx < watchingTeamIdx;

          if (isHigherPriority && fs) {
            // FORCE SWITCH: higher priority + setting enabled → switch now
            setCurrentStreamEvent(eventKey);
            setIsWatchingMatch(true);
            setWatchingMatchLabel(matchLabel || null);
            setDeferredSwitch(null);
            dismissNotification();
          } else {
            // Show popup + defer
            setDeferredSwitch({ eventKey, teamNum: parseInt(updatedTeamNum, 10), matchLabel });
            setNotification({
              eventKey,
              teamNum: parseInt(updatedTeamNum, 10),
              matchLabel,
              isHigherPriority,
            });
            if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
            notifTimerRef.current = setTimeout(() => setNotification(null), 15_000);
          }
        }
      }, delayMs);
    }

    // ── Team match ended ─────────────────────────────────────────────────────
    if (!isActive && watching && curEvent === eventKey) {
      // Clear any pending switch timer for this team
      const timerKey = updatedTeamNum.toString();
      if (switchTimers.current[timerKey]) {
        clearTimeout(switchTimers.current[timerKey]);
        delete switchTimers.current[timerKey];
      }

      // Check if any OTHER fav team is still active on this event
      const otherFavActive = fav.some(n => {
        if (n.toString() === updatedTeamNum.toString()) return false;
        const nd = td[n.toString()];
        const ns = normalizeStatus(nd?.status);
        return (ns === 'onField' || ns === 'inProgress') && nd?.currentEvent === curEvent;
      });

      if (otherFavActive) return; // Someone else still playing, stay

      // Start end offset timer
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
      endTimerRef.current = setTimeout(() => {
        endTimerRef.current = null;
        handleMatchEnded();
      }, (endOffset || 15) * 1000);
    }
  }, [dismissNotification, handleMatchEnded]);

  // ── Load event data — checks cache, triggers refresh if stale ─────────────
  const ensureEventData = useCallback(async (eventKey) => {
    if (!eventKey) return;

    // Subscribe to Firebase path
    const eventRef  = ref(db, `events/${eventKey}`);
    const unsub = onValue(eventRef, (snap) => {
      const data = snap.val();
      setEventData(prev => ({ ...prev, [eventKey]: data || {} }));
    });
    unsubsRef.current.push(unsub);

    // Check if refresh needed
    const snap = await new Promise(resolve => {
      const u = onValue(ref(db, `events/${eventKey}/streamsCheckedAt`), s => {
        resolve(s); u();
      });
    });
    const checkedAt = snap.val();
    if (!checkedAt || (Date.now() - checkedAt) > EVENT_STALE_MS) {
      refreshEvent(eventKey).catch(console.warn);
    }
  }, []);

  // ── Subscribe to fav team paths ────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !favTeams?.length) return;

    // Unsubscribe previous listeners
    unsubsRef.current.forEach(u => u());
    unsubsRef.current = [];
    Object.values(switchTimers.current).forEach(clearTimeout);
    switchTimers.current = {};

    const subscribedEvents = new Set();

    for (const teamNum of favTeams) {
      const num = teamNum.toString();
      const teamRef = ref(db, `teams/${num}`);

      const unsub = onValue(teamRef, async (snap) => {
        const data = snap.val();
        const now  = Date.now();

        // If missing or metadata stale, trigger refresh
        if (!data || !data.nameFetchedAt || (now - data.nameFetchedAt) > TEAM_STALE_MS) {
          refreshTeam(num).catch(console.warn);
        }

        if (data) {
          setTeamData(prev => ({ ...prev, [num]: data }));
          evaluateTeamUpdate(num, data);

          // Ensure event data is loaded
          if (data.currentEvent && !subscribedEvents.has(data.currentEvent)) {
            subscribedEvents.add(data.currentEvent);
            ensureEventData(data.currentEvent);
          }
        }
      });

      unsubsRef.current.push(unsub);
    }

    return () => {
      unsubsRef.current.forEach(u => u());
      unsubsRef.current = [];
      Object.values(switchTimers.current).forEach(clearTimeout);
      switchTimers.current = {};
    };
  }, [isAuthenticated, favTeams, evaluateTeamUpdate, ensureEventData]);

  // ── Ensure event data for current stream event ─────────────────────────────
  useEffect(() => {
    if (currentStreamEvent) ensureEventData(currentStreamEvent);
  }, [currentStreamEvent, ensureEventData]);

  // ── Active sessions listener ───────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = onValue(ref(db, 'presence'), (snap) => {
      setActiveSessions(snap.exists() ? Object.keys(snap.val() || {}).length : 0);
    });
    return () => unsub();
  }, [isAuthenticated]);

  // ── Stream helpers ─────────────────────────────────────────────────────────
  const setActiveStream = useCallback((eventKey, idx) => {
    try { localStorage.setItem(`frc-stream-pin-${eventKey}`, String(idx)); } catch {}
    setEventData(prev => {
      const entry = prev[eventKey];
      if (!entry) return prev;
      const streams = entry.streams || [];
      return {
        ...prev,
        [eventKey]: {
          ...entry,
          activeStreamIdx: idx,
          activeStream: streams[idx]?.url || entry.activeStream,
          pinned: true,
        },
      };
    });
  }, []);

  const clearStreamPin = useCallback((eventKey) => {
    try { localStorage.removeItem(`frc-stream-pin-${eventKey}`); } catch {}
    setEventData(prev => ({
      ...prev,
      [eventKey]: { ...(prev[eventKey] || {}), pinned: false },
    }));
    refreshEvent(eventKey, true).catch(console.warn);
  }, []);

  // ── Categorized events for sidebar ─────────────────────────────────────────
  const categorizedEvents = (() => {
    const fav = favTeams || [];
    const withFavOnField = [];
    const withFavAtEvent = [];
    const seen = new Set();

    for (const num of fav) {
      const data = teamData[num.toString()];
      if (!data?.currentEvent) continue;
      const ek = data.currentEvent;
      if (seen.has(ek)) continue;
      seen.add(ek);

      const status = normalizeStatus(data.status);
      const isActive = isActiveStatus(status);
      if (isActive) withFavOnField.push(ek);
      else withFavAtEvent.push(ek);
    }

    return { withFavOnField, withFavAtEvent };
  })();

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => () => {
    unsubsRef.current.forEach(u => u());
    Object.values(switchTimers.current).forEach(clearTimeout);
    if (endTimerRef.current) clearTimeout(endTimerRef.current);
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
  }, []);

  return {
    teamData,
    eventData,
    currentStreamEvent,
    isWatchingMatch,
    deferredSwitch,
    notification,
    activeSessions,
    categorizedEvents,
    switchToEvent,
    acceptPendingSwitch,
    dismissNotification,
    setActiveStream,
    clearStreamPin,
    ensureEventData,
  };
}