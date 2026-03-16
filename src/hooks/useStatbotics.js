// src/hooks/useStatbotics.js
// Fetches EPA data from Statbotics for a set of team numbers.
// Called client-side directly — no API key needed, public endpoint.
// Caches results in memory for the session to avoid re-fetching same teams.
//
// Statbotics REST API v3:
//   GET https://api.statbotics.io/v3/team_year/{team}/{year}
//   Returns: { team, year, epa: { total_points: { mean, sd }, unitless, norm }, ... }

import { useState, useEffect, useRef, useCallback } from 'react';

const BASE = 'https://api.statbotics.io/v3';
const cache = {}; // module-level cache — persists across re-renders

async function fetchTeamYear(teamNum, year) {
    const key = `${teamNum}_${year}`;
    if (cache[key] !== undefined) return cache[key];

    try {
        const res = await fetch(`${BASE}/team_year/${teamNum}/${year}`);
        if (!res.ok) { cache[key] = null; return null; }
        const data = await res.json();
        cache[key] = data;
        return data;
    } catch {
        cache[key] = null;
        return null;
    }
}

export function useStatbotics(teamNums, year) {
    const [epaData, setEpaData] = useState({}); // { [teamNum]: { mean, sd, norm, unitless } | null }
    const [loading, setLoading] = useState(false);
    const prevTeamsRef = useRef('');

    const fetchAll = useCallback(async (teams, yr) => {
        if (!teams?.length) return;
        const key = teams.slice().sort().join(',') + '_' + yr;
        if (key === prevTeamsRef.current) return;
        prevTeamsRef.current = key;

        setLoading(true);
        const results = await Promise.all(teams.map(n => fetchTeamYear(n, yr)));

        const mapped = {};
        teams.forEach((n, i) => {
            const d = results[i];
            if (!d) { mapped[n] = null; return; }
            mapped[n] = {
                mean:     d.epa?.total_points?.mean     ?? null,
                sd:       d.epa?.total_points?.sd       ?? null,
                norm:     d.epa?.norm                   ?? null,
                unitless: d.epa?.unitless               ?? null,
                wins:     d.record?.wins                ?? null,
                losses:   d.record?.losses              ?? null,
                count:    d.record?.count               ?? null,
            };
        });

        setEpaData(prev => ({ ...prev, ...mapped }));
        setLoading(false);
    }, []);

    useEffect(() => {
        if (teamNums?.length && year) {
            fetchAll(teamNums.filter(n => n != null && !isNaN(n)), year);
        }
    }, [teamNums, year, fetchAll]);

    return { epaData, loading };
}