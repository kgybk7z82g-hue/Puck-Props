'use strict';

// MoneyPuck's published downloads; no HTML scraping or substitute xG model.
const SOURCE = {name:'MoneyPuck.com',url:'https://moneypuck.com/data.htm'};
const TEAMS = new Set('ANA ARI BOS BUF CAR CBJ CGY CHI COL DAL DET EDM FLA LAK MIN MTL NJD NSH NYI NYR OTT PHI PIT SEA SJS STL TBL TOR UTA VAN VGK WPG WSH'.split(' '));
const METRICS = ['iceTime','xGoalsFor','xGoalsAgainst','goalsFor','goalsAgainst','highDangerShotsFor','highDangerShotsAgainst'];
function parseCsv(text) {
  const records=[]; let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') {if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))records.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw Error('Invalid team statistics download.');
  if(cell||row.length){row.push(cell);records.push(row);}
  const header=records.shift()?.map(s=>s.replace(/^\uFEFF/,'').trim());
  if(!header||!['team','situation',...METRICS].every(k=>header.includes(k)))throw Error('Team statistics format unavailable.');
  return records.map(values=>Object.fromEntries(header.map((key,i)=>[key,values[i]?.trim()??''])));
}
const number=value=>value!==''&&value!=null&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;
function metrics(row) {
  const values=Object.fromEntries(METRICS.map(k=>[k,number(row[k])]));
  if(values.iceTime===null||values.iceTime<=0||values.xGoalsFor===null||values.xGoalsAgainst===null)return null;
  return values;
}
function summarize(values,games) {
  const sum=key=>values.every(v=>v[key]!==null)?values.reduce((n,v)=>n+v[key],0):null;
  const totals=Object.fromEntries(METRICS.map(k=>[k,sum(k)])),denominator=totals.xGoalsFor+totals.xGoalsAgainst;
  return {...totals,games,xGoalsShare:denominator>0?totals.xGoalsFor/denominator:null,
    xGoalsForPer60:totals.iceTime>0?totals.xGoalsFor*3600/totals.iceTime:null,
    xGoalsAgainstPer60:totals.iceTime>0?totals.xGoalsAgainst*3600/totals.iceTime:null,
    finishing:totals.goalsFor===null?null:totals.goalsFor-totals.xGoalsFor,
    goalsPrevented:totals.goalsAgainst===null?null:totals.xGoalsAgainst-totals.goalsAgainst};
}
function buildSeason(rows,season) {
  let omitted=0;const teams=new Map();
  for(const row of rows.filter(r=>r.situation==='5on5'&&String(r.season)===season.slice(0,4))) {
    const team=row.team,values=metrics(row),games=number(row.games_played);
    if(!TEAMS.has(team)||!values||!games){omitted++;continue;}
    if(teams.has(team))throw Error('Duplicate team statistics in source.');
    teams.set(team,{team,...summarize([values],games)});
  }
  const result=[...teams.values()].sort((a,b)=>(b.xGoalsShare??-1)-(a.xGoalsShare??-1)||a.team.localeCompare(b.team));
  let rank=0;result.forEach((t,i)=>{if(t.xGoalsShare===null)t.rank=null;else{if(i===0||t.xGoalsShare!==result[i-1].xGoalsShare)rank=i+1;t.rank=rank;}});
  return {rows:result,omitted};
}
function buildTrend(rows,team,season,today) {
  const games=new Map();let omitted=0;
  for(const row of rows.filter(r=>r.situation==='5on5'&&r.team===team)) {
    if(!new RegExp('^'+season.slice(0,4)+'02\\d{4}$').test(row.gameId))continue;
    const date=/^\d{8}$/.test(row.gameDate)?row.gameDate.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'):'';
    if(!date||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>today)continue;
    const values=metrics(row);if(!values){omitted++;continue;}
    if(games.has(row.gameId))throw Error('Duplicate game statistics in source.');
    games.set(row.gameId,{...values,gameId:row.gameId,date,opponent:row.opposingTeam});
  }
  const ordered=[...games.values()].sort((a,b)=>b.date.localeCompare(a.date)||b.gameId.localeCompare(a.gameId)),recent=ordered.slice(0,10);
  const seasonStats=ordered.length?summarize(ordered,ordered.length):null,lastTen=recent.length?summarize(recent,recent.length):null;
  return {team,season:seasonStats,lastTen,change:seasonStats?.xGoalsShare!=null&&lastTen?.xGoalsShare!=null?lastTen.xGoalsShare-seasonStats.xGoalsShare:null,
    games:recent.map(g=>({gameId:g.gameId,date:g.date,opponent:g.opponent,...summarize([g],1)})),omitted,
    firstDate:recent.at(-1)?.date||null,lastDate:recent[0]?.date||null};
}
function createUnderlyingStrengthService({fetchImpl=fetch,now=Date.now}={}) {
  const cache=new Map(),pending=new Map();
  return async function getUnderlyingStrength(season,team='') {
    if(!/^\d{8}$/.test(season)||Number(season.slice(4))!==Number(season.slice(0,4))+1||Number(season.slice(0,4))<2008||Number(season.slice(0,4))>new Date(now()).getUTCFullYear())throw Error('Invalid season.');
    if(team&&!TEAMS.has(team))throw Error('Unknown NHL team.');
    const key=season+':'+team,stored=cache.get(key);if(stored?.expires>now())return stored.value;
    if(pending.has(key))return pending.get(key);
    const promise=(async()=>{
      const start=season.slice(0,4),url=team?`https://moneypuck.com/moneypuck/playerData/teamGameByGame/${start}/regular/${team}.csv`:`https://moneypuck.com/moneypuck/playerData/seasonSummary/${start}/regular/teams.csv`;
      const response=await fetchImpl(url,{headers:{Accept:'text/csv','User-Agent':'PuckProps/1.0'},signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw Error('MoneyPuck team data is unavailable for this season.');
      const text=await response.text();if(text.length>3000000)throw Error('Team statistics download is too large.');
      const rows=parseCsv(text),value={seasonId:season,situation:'5on5',source:SOURCE,sourceUrl:url,fetchedAt:new Date(now()).toISOString(),...(team?buildTrend(rows,team,season,new Date(now()).toISOString().slice(0,10)):buildSeason(rows,season))};
      // Retry empty downloads quickly, while sharing successful downloads for 15 minutes.
      const empty=team?!value.season:!value.rows.length;
      cache.set(key,{value,expires:now()+(empty?60000:900000)});
      // Keep cache bounded across seasons and team selections.
      if(cache.size>100)cache.delete(cache.keys().next().value);
      return value;
    })();
    pending.set(key,promise);try{return await promise}finally{pending.delete(key)}
  };
}
module.exports={parseCsv,buildSeason,buildTrend,createUnderlyingStrengthService};
