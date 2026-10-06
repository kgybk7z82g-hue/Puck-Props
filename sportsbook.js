'use strict';
const markets = {h2h:'Team win',player_shots_on_goal:'Shots on goal',player_points:'Points',player_goals:'Goals',player_assists:'Assists',player_blocked_shots:'Blocked shots'};
function normalize(events, now = Date.now()) {
 const selections = new Map();
 for (const event of events) {
  if (!Number.isFinite(Date.parse(event.commence_time)) || Date.parse(event.commence_time) <= now) continue;
  for (const key of ['fanduel','draftkings']) {
   const book = (event.bookmakers || []).find(b => b.key === key);
   for (const market of book?.markets || []) {
    if (!markets[market.key]) continue;
    for (const outcome of market.outcomes || []) {
     const price = Number(outcome.price), line = outcome.point;
     if (!Number.isFinite(price) || price <= 1 || !outcome.name) continue;
     if (market.key !== 'h2h' && (!outcome.description || !Number.isFinite(line))) continue;
     const id = JSON.stringify([event.id,market.key,outcome.description || '',outcome.name,line ?? null]);
     if (selections.has(id)) { selections.get(id).quotes.push({book:key === 'fanduel' ? 'FanDuel' : 'DraftKings',odds:price,updatedAt:market.last_update || book.last_update || null}); continue; }
     selections.set(id,{id,homeTeam:event.home_team,awayTeam:event.away_team,marketKey:market.key,player:outcome.description || '',side:outcome.name,line:line ?? null,quotes:[{book:key === 'fanduel' ? 'FanDuel' : 'DraftKings',odds:price,updatedAt:market.last_update || book.last_update || null}],event:`${event.away_team} at ${event.home_team}`,startTime:event.commence_time,market:markets[market.key],selection:market.key === 'h2h' ? outcome.name : `${outcome.description} · ${outcome.name} ${line}`,odds:price,book:key === 'fanduel' ? 'FanDuel' : 'DraftKings',updatedAt:market.last_update || book.last_update || null});
    }
   }
  }
 }
 return [...selections.values()];
}
const cache = new Map();
async function getSportsbookOdds({apiKey,from,to}) {
 const cacheKey = JSON.stringify([apiKey,from,to]);
 if (cache.get(cacheKey)?.expires > Date.now()) return cache.get(cacheKey).value;
 async function request(route,params={}) {
  const url = new URL(`https://api.the-odds-api.com/v4/sports/icehockey_nhl/${route}`);
  url.search = new URLSearchParams({...params,apiKey}).toString();
  const response = await fetch(url,{signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(response.status === 401 ? 'The Odds API key was not accepted.' : response.status === 429 ? 'The odds feed quota has been reached.' : `The odds feed returned HTTP ${response.status}. Check your plan and NHL market access.`);
  return response.json();
 }
 const events = await request('events',{commenceTimeFrom:from,commenceTimeTo:to});
 if (!Array.isArray(events)) throw new Error('The odds feed returned invalid events.');
 const upcoming = events.filter(e=>Date.parse(e.commence_time)>Date.now() && Date.parse(e.commence_time)>=Date.parse(from) && Date.parse(e.commence_time)<=Date.parse(to));
 const snapshots=[],warnings=[];
 for (const event of upcoming) {
  try { snapshots.push(await request(`events/${encodeURIComponent(event.id)}/odds`,{bookmakers:'fanduel,draftkings',markets:Object.keys(markets).join(','),oddsFormat:'decimal'})); }
  catch(error) { warnings.push(`${event.away_team} at ${event.home_team}: ${error.message}`); }
 }
 const value={legs:normalize(snapshots),fixtures:upcoming.length,updatedAt:new Date().toISOString(),warnings};
 if (!warnings.length) cache.set(cacheKey,{value,expires:Date.now()+300000});
 return value;
}
module.exports={normalize,getSportsbookOdds};
