'use strict';

function openingScorer(data) {
  if (!Array.isArray(data.plays)) throw Error('Scoring details unavailable');
  const goals = data.plays.filter(p => p.typeDescKey === 'goal' && p.periodDescriptor?.periodType !== 'SO')
    .sort((a,b) => Number(a.periodDescriptor?.number)-Number(b.periodDescriptor?.number) || String(a.timeInPeriod).localeCompare(String(b.timeInPeriod)) || Number(a.sortOrder)-Number(b.sortOrder));
  if (!goals.length) return null;
  const goal = goals[0], id = goal.details?.scoringPlayerId;
  const player = (data.rosterSpots || []).find(p => Number(p.playerId) === Number(id));
  const team = [data.homeTeam, data.awayTeam].find(t => Number(t?.id) === Number(goal.details?.eventOwnerTeamId));
  if (!id || !player || !team?.abbrev) throw Error('Opening scorer unavailable');
  const name = [player.firstName?.default, player.lastName?.default].filter(Boolean).join(' ');
  if (!name) throw Error('Scorer name unavailable');
  return {id, name, team:team.abbrev};
}

function createFirstGoalsService({get, teams}) {
  const cache = new Map(), gamesCache = new Map();
  return async function load(season) {
    const cached = cache.get(season);
    if (cached?.promise) return cached.promise;
    if (cached?.expires > Date.now()) return cached.value;
    const promise = (async () => {
      const schedules = await Promise.allSettled(teams.map(t => get(`/club-schedule-season/${t}/${season}`)));
      const games = new Map();
      let failedTeams = 0;
      for (const result of schedules) {
        if (result.status !== 'fulfilled' || !Array.isArray(result.value.games)) { failedTeams++; continue; }
        for (const g of result.value.games) if (g.gameType === 2 && ['OFF','FINAL'].includes(g.gameState)) games.set(String(g.id),g);
      }
      if (failedTeams === teams.length) throw Error('League schedules are unavailable.');
      const list = [...games.values()], players = new Map();
      let next = 0, processed = 0, failed = 0;
      const worker = async () => {
        while (next < list.length) {
          const game = list[next++];
          try {
            const key = String(game.id);
            let scorer;
            if (gamesCache.has(key)) scorer = gamesCache.get(key);
            else { scorer = openingScorer(await get(`/gamecenter/${key}/play-by-play`)); gamesCache.set(key,scorer); }
            if (scorer) {
              const row = players.get(scorer.id) || {...scorer, firstGoals:0, teams:new Set()};
              row.firstGoals++; row.teams.add(scorer.team); players.set(scorer.id,row);
            }
            processed++;
          } catch { failed++; }
        }
      };
      await Promise.all(Array.from({length:Math.min(6,list.length)},worker));
      const rows = [...players.values()].sort((a,b)=>b.firstGoals-a.firstGoals || a.name.localeCompare(b.name));
      let rank = 0;
      const leaders = rows.map((p,i)=>{if(!i || p.firstGoals !== rows[i-1].firstGoals) rank=i+1;return {id:p.id,name:p.name,team:[...p.teams].sort().join(' / '),firstGoals:p.firstGoals,rank};}).slice(0,20);
      const value = {season,leaders,gamesProcessed:processed,gamesScheduled:list.length,failed,failedTeams,updatedAt:new Date().toISOString()};
      cache.set(season,{value,expires:Date.now()+(failed || failedTeams ? 60000 : 5*60000)});
      return value;
    })();
    cache.set(season,{promise});
    try { return await promise; } catch(error) {cache.delete(season);throw error;}
  };
}
module.exports = {openingScorer, createFirstGoalsService};
