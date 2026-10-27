'use strict';

const HOUR = 3600000;
const instant = value => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
const airportZones={};
for(const [zone,codes] of Object.entries({
  'America/Los_Angeles':'KLAX KLGB KSNA KBUR KSJC KSFO KOAK KSEA KBFI KLAS',
  'America/Vancouver':'CYVR', 'America/Denver':'KDEN KBJC KSLC', 'America/Edmonton':'CYYC CYEG',
  'America/Chicago':'KORD KMDW KDAL KDFW KMSP KBNA KSTL', 'America/Winnipeg':'CYWG',
  'America/New_York':'KBOS KBUF KRDU KCMH KDTW KFLL KMIA KEWR KTEB KJFK KLGA KHPN KFRG KISP KPHL KPIT KTPA KIAD KDCA',
  'America/Toronto':'CYYZ CYTZ CYUL CYMX CYOW'
}))for(const code of codes.split(' '))airportZones[code]=zone;
function flightContext(flight){
  if(!flight)return {zoneHours:null,lateArrival:null};
  const from=airportZones[flight.origin],to=airportZones[flight.destination],at=instant(flight.arrived)||instant(flight.firstSeen);
  const offset=zone=>{const label=new Intl.DateTimeFormat('en',{timeZone:zone,timeZoneName:'longOffset'}).formatToParts(at).find(x=>x.type==='timeZoneName').value;const m=label.match(/GMT([+-])(\d{2}):(\d{2})/);return m?(m[1]==='-'?-1:1)*(Number(m[2])+Number(m[3])/60):0;};
  const arrival=instant(flight.arrived),hour=to&&arrival!=null?Number(new Intl.DateTimeFormat('en',{timeZone:to,hour:'numeric',hourCycle:'h23'}).format(arrival)):null;
  return {zoneHours:from&&to&&at!=null?Math.abs(offset(from)-offset(to)):null,lateArrival:hour==null?null:hour<6};
}
function analyzeTravel(team, flights, games, now = Date.now()) {
  const tracked = flights.filter(f => f.team === team && !f.positioning && instant(f.firstSeen)!=null && instant(f.firstSeen) <= now).sort((a,b) => instant(b.firstSeen)-instant(a.firstSeen));
  const next = games.filter(g => instant(g.startTimeUTC) > now && !['OFF','FINAL'].includes(g.gameState)).sort((a,b)=>instant(a.startTimeUTC)-instant(b.startTimeUTC))[0] || null;
  const reference = next ? instant(next.startTimeUTC) : now;
  const past = games.filter(g => ['OFF','FINAL'].includes(g.gameState) && instant(g.startTimeUTC) < reference).sort((a,b)=>instant(b.startTimeUTC)-instant(a.startTimeUTC));
  const latest = tracked[0] || null;
  const arrival = latest?.status === 'landed' ? instant(latest.arrived) : null;
  const recoveryHours = next && arrival && arrival <= now ? (reference-arrival)/HOUR : null;
  const restHours = past.length && next ? (reference-instant(past[0].startTimeUTC))/HOUR : null;
  const recent = tracked.filter(f=>instant(f.firstSeen)>=reference-72*HOUR);
  const distanceKm = recent.length && recent.every(f=>f.distanceNm!=null && Number.isFinite(Number(f.distanceNm))) ? Math.round(recent.reduce((s,f)=>s+Number(f.distanceNm)*1.852,0)) : null;
  const gamesSevenDays = past.filter(g=>instant(g.startTimeUTC)>=reference-7*24*HOUR).length;
  const context=flightContext(latest);
  let roadGames=next&&next.awayTeam?.abbrev===team?1:0;
  if(roadGames)for(const game of past){if(game.awayTeam?.abbrev!==team)break;roadGames++;}
  const backToBack = next && past[0] ? Math.round((Date.parse(next.gameDate)-Date.parse(past[0].gameDate))/(24*HOUR))===1 : false;
  const reasons=[];
  let score=0;
  if(backToBack){score+=30;reasons.push('Back-to-back games +30');}
  if(recoveryHours!=null && recoveryHours<24){const points=recoveryHours<12?30:15;score+=points;reasons.push('Under '+(recoveryHours<12?12:24)+' hours after landing +'+points);}
  if(distanceKm!=null && distanceKm>1500){const points=distanceKm>4000?20:10;score+=points;reasons.push('Observed 72-hour travel distance +'+points);}
  if(gamesSevenDays>=3){score+=15;reasons.push('At least 3 prior games in seven days +15');}
  if(context.zoneHours>=2 && recent.includes(latest)){score+=10;reasons.push('Recent flight crosses 2+ time zones +10');}
  if(context.lateArrival && recoveryHours!=null && recoveryHours<24){score+=10;reasons.push('Arrival before 6 a.m. destination time +10');}
  if(roadGames>=3){score+=5;reasons.push('At least 3 consecutive road games +5');}
  return {latest,next,recoveryHours,restHours,distanceKm,gamesSevenDays,backToBack,roadGames,...context,score:next&&past.length?Math.min(100,score):null,reasons,flights:tracked.slice(0,20)};
}

function createTravelService({getNhl,fetchJson,teams}) {
  let snapshot, expires=0, pending;
  async function source() {
    if(snapshot && expires>Date.now())return snapshot;
    if(pending)return pending;
    pending=(async()=>{
      const [directory,first]=await Promise.all([fetchJson('https://nhlflights.ca/api/v1/teams'),fetchJson('https://nhlflights.ca/api/v1/flights?since=14&limit=500')]);
      if(!Array.isArray(directory.teams)||!Array.isArray(first.flights))throw Error('Flight source returned an unexpected format.');
      // Follow bounded pagination so busy travel days do not silently lose team records.
      const flights=[...first.flights]; let next=first.next, pages=1;
      while(next && pages<5){const url=new URL(next,'https://nhlflights.ca');if(url.origin!=='https://nhlflights.ca'||url.pathname!=='/api/v1/flights')throw Error('Invalid flight page.');const page=await fetchJson(url.href);if(!Array.isArray(page.flights))throw Error('Invalid flight records.');flights.push(...page.flights);next=page.next;pages++;}
      snapshot={teams:directory.teams,flights:[...new Map(flights.map(f=>[f.id,f])).values()],truncated:!!next,updatedAt:new Date().toISOString()};expires=Date.now()+60000;return snapshot;
    })();
    try{return await pending;}finally{pending=null;}
  }
  return async function getTravel(team,playerId) {
    if(team && !teams.includes(team))throw Error('Unknown NHL team.');
    const data=await source();
    if(!team)return {teams:data.teams,updatedAt:data.updatedAt,truncated:data.truncated};
    const now=new Date(),year=now.getUTCFullYear()-(now.getUTCMonth()<8?1:0),season=String(year)+String(year+1);
    const schedule=await getNhl(`/club-schedule-season/${team}/${season}`);
    if(!Array.isArray(schedule.games))throw Error('NHL schedule unavailable.');
    if(playerId){
      const [roster,log]=await Promise.all([getNhl(`/roster/${team}/current`),getNhl(`/player/${playerId}/game-log/${season}/2`)]);
      const skaters=[...(roster.forwards||[]),...(roster.defensemen||[])];
      if(!skaters.some(p=>String(p.id)===String(playerId)))throw Error('Choose a current skater on this team.');
      if(!Array.isArray(log.gameLog))throw Error('Player game history unavailable.');
      return {...playerTravelSplits(team,log.gameLog,schedule.games,data.flights),team,playerId,season,updatedAt:data.updatedAt};
    }
    return {...analyzeTravel(team,data.flights,schedule.games),team,updatedAt:data.updatedAt,truncated:data.truncated};
  };
}
function playerTravelSplits(team,logs,games,flights){
  const completed=games.filter(g=>g.gameType===2&&['OFF','FINAL'].includes(g.gameState)).sort((a,b)=>instant(a.startTimeUTC)-instant(b.startTimeUTC));
  const buckets={season:[],backToBack:[],rested:[],afterFlight:[],overnight:[],zones:[]};
  for(const log of new Map(logs.filter(g=>g.teamAbbrev===team).map(g=>[String(g.gameId),g])).values()){
    if(!['shots','goals','assists'].every(k=>log[k]!=null&&Number.isFinite(Number(log[k]))))continue;
    buckets.season.push(log);
    const index=completed.findIndex(g=>String(g.id)===String(log.gameId));if(index<0)continue;
    const game=completed[index],previous=completed[index-1],start=instant(game.startTimeUTC);
    const days=previous?(Date.parse(game.gameDate)-Date.parse(previous.gameDate))/(24*HOUR):null;
    if(days===1)buckets.backToBack.push(log);
    if(days>=3)buckets.rested.push(log);
    const relevant=flights.filter(f=>f.team===team&&!f.positioning&&f.status==='landed'&&instant(f.arrived)!=null&&instant(f.arrived)<start&&instant(f.arrived)>=start-24*HOUR&&(!previous||instant(f.arrived)>instant(previous.startTimeUTC))).sort((a,b)=>instant(b.arrived)-instant(a.arrived))[0];
    if(relevant){buckets.afterFlight.push(log);const context=flightContext(relevant);if(context.lateArrival)buckets.overnight.push(log);if(context.zoneHours>=2)buckets.zones.push(log);}
  }
  return {splits:Object.entries(buckets).map(([key,rows])=>({key,games:rows.length,shots:rows.length?rows.reduce((s,r)=>s+Number(r.shots),0)/rows.length:null,goals:rows.length?rows.reduce((s,r)=>s+Number(r.goals),0)/rows.length:null,points:rows.length?rows.reduce((s,r)=>s+Number(r.goals)+Number(r.assists),0)/rows.length:null})),flightWindowDays:14};
}
module.exports={analyzeTravel,createTravelService,flightContext,playerTravelSplits};
