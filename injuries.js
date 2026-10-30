'use strict';

const ALIASES = { LA: 'LAK', NJ: 'NJD', SJ: 'SJS', TB: 'TBL', WSH: 'WSH', UTAH: 'UTA' };
function normalizeInjuries(data, teamCodes, fetchedAt) {
  if (!Array.isArray(data.injuries)) throw new Error('Invalid injury feed');
  const teams = {};
  for (const group of data.injuries) {
    const abbreviation = group.injuries?.[0]?.athlete?.team?.abbreviation;
    const team = teamCodes.get(String(group.displayName).toLowerCase()) || ALIASES[abbreviation] || abbreviation;
    if (!team || !Array.isArray(group.injuries)) continue;
    teams[team] = { players: group.injuries.filter(row => row.athlete?.displayName).map(row => ({
      name: row.athlete.displayName,
      status: row.status || 'Not specified',
      type: row.details?.type || '',
      summary: row.shortComment || '',
      updatedAt: Number.isFinite(Date.parse(row.date)) ? row.date : null,
      returnDate: row.details?.returnDate || null,
    })).sort((a,b) => (Date.parse(b.updatedAt)||0)-(Date.parse(a.updatedAt)||0)) };
  }
  return { teams, fetchedAt, source: 'ESPN' };
}

function createInjuryService({ fetchImpl = fetch, teamCodes = new Map(), now = Date.now } = {}) {
  let cached, pending;
  return async function getInjuries() {
    if (cached && now()-Date.parse(cached.fetchedAt)<300000) return cached;
    if (pending) return pending;
    pending = (async () => {
      const response = await fetchImpl('https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/injuries', {
        headers: { Accept: 'application/json', 'User-Agent': 'PuckProps/1.0' }, signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error('Injury feed unavailable');
      const result = normalizeInjuries(await response.json(), teamCodes, new Date(now()).toISOString());
      cached = result;
      return result;
    })();
    try { return await pending; } finally { pending = null; }
  };
}
module.exports = { normalizeInjuries, createInjuryService };
