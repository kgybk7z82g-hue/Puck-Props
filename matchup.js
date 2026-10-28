'use strict';
// Context ranks research candidates; unvalidated weights never alter hit probabilities.
const MatchupResearch = {
  evaluate(context, game, player, key) {
    const team = player.team, opp = team === game.homeTeam.abbrev ? game.awayTeam.abbrev : game.homeTeam.abbrev;
    const group = ({C:'Centers', L:'LeftWings', LW:'LeftWings', R:'RightWings', RW:'RightWings', D:'Defensemen'})[player.position] || 'Forwards';
    const notes = [], missing = [];
    let support = 0;
    const rate = d => d?.gamesProcessed >= 5 && Number.isFinite(d.allowed?.[group]?.[key]) ? d.allowed[group][key] / d.gamesProcessed : null;
    const split = context.defense[opp], allowed = rate(split);
    const comparison = Object.values(context.defense).map(rate).filter(x => x != null);
    if (allowed != null) {
      notes.push(`${opp} allows ${allowed.toFixed(2)} ${key} to all ${group.toLowerCase()} combined per team game (${split.gamesProcessed} games${split.failed ? `; ${split.failed} missing` : ''})`);
      if (comparison.length >= 4) {
        const mean = comparison.reduce((a,b) => a+b,0) / comparison.length;
        if (mean > 0) {
          const relative = allowed / mean - 1;
          support += Math.max(-1, Math.min(1, relative * 4));
          notes.push(`${Math.round(Math.abs(relative)*100)}% ${relative >= 0 ? 'above' : 'below'} the ${comparison.length}-team slate average for this position`);
        }
      }
    } else missing.push('Position defense unavailable or fewer than five games');
    const rest = ab => {
      const rows = context.schedules[ab]?.games;
      if (!Array.isArray(rows)) return null;
      const past = rows.filter(g => g.gameType === 2 && ['OFF','FINAL'].includes(g.gameState) && g.gameDate < context.date).sort((a,b) => b.gameDate.localeCompare(a.gameDate));
      return past.length ? (Date.parse(context.date)-Date.parse(past[0].gameDate))/86400000 : null;
    };
    const ownRest = rest(team), oppRest = rest(opp);
    for (const [ab,days] of [[team,ownRest],[opp,oppRest]]) {
      if (days == null) missing.push(`${ab} rest history unavailable`);
      else notes.push(`${ab}: ${days === 1 ? 'second night of back-to-back' : days+' calendar days since previous game'}`);
    }
    if (ownRest != null && oppRest != null) support += oppRest === 1 && ownRest > 1 ? .5 : ownRest === 1 && oppRest > 1 ? -.5 : 0;
    for (const ab of [team,opp]) {
      const travel = context.travel[ab];
      const arrival = String(travel?.next?.id) === String(game.id) && travel.latest?.status === 'landed' ? Date.parse(travel.latest.arrived) : NaN;
      const hours = (Date.parse(game.startTimeUTC)-arrival)/3600000;
      if (Number.isFinite(hours) && hours > 0 && hours <= 24 && arrival <= Date.parse(context.updatedAt)) {
        notes.push(`${ab}: observed landing ${hours.toFixed(1)}h before puck drop${travel.lateArrival ? ' (before 6 a.m. local)' : ''}; estimated recovery opportunity ${Math.max(0,hours-3).toFixed(1)}h after assumed 1h transfer + 2h wind-down. Actual sleep unknown.`);
        if (travel.lateArrival && ownRest != null && oppRest != null) support += ab === opp ? .25 : -.25;
        if (travel.truncated) missing.push(`${ab} flight coverage partial`);
      } else missing.push(`${ab} recent landing not verified for this fixture`);
    }
    const goalie = context.goalies[opp];
    if (goalie) notes.push(`${opp} goalie: ${goalie.name} · ${goalie.status} · ${goalie.source || 'starter report'}${goalie.alternate ? ' · conflicting report; verify starter' : ''}`);
    else missing.push(`${opp} starting goalie unavailable`);
    const projection = context.projections[String(game.id)];
    if (projection?.sourceCount) notes.push(`${team} external win estimate: ${Math.round(100*(team === game.homeTeam.abbrev ? projection.home : projection.away))}% (${projection.sourceCount} models; may already include rest)`);
    else missing.push('External win projection unavailable');
    missing.push('Confirmed lines / power-play roles and live sportsbook prices unavailable');
    return {support,notes,missing,updatedAt:context.updatedAt};
  },
  order(item) { return (item.rate ?? item.probability) + .02*(item.context?.support || 0); }
};
if (typeof module !== 'undefined') module.exports = MatchupResearch;
