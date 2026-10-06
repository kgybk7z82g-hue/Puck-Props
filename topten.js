'use strict';
const CATEGORIES=['points','goals','assists','shots','blockedShots'];
function lastTen(rows,today){return [...new Map(rows.filter(g=>g.gameId&&g.gameDate&&g.gameDate<=today).sort((a,b)=>b.gameDate.localeCompare(a.gameDate)||Number(b.gameId)-Number(a.gameId)).map(g=>[String(g.gameId),g])).values()].slice(0,10)}
function rankPlayers(players){return Object.fromEntries(CATEGORIES.map(key=>[key,players.filter(p=>p.games===10&&Number.isFinite(p.totals[key])).sort((a,b)=>b.totals[key]-a.totals[key]||a.name.localeCompare(b.name)||a.id.localeCompare(b.id)).slice(0,10).map((p,index)=>({...p,rank:index+1,total:p.totals[key],average:p.totals[key]/10}))]))}
async function workers(items,action,count=8){let next=0;await Promise.all(Array.from({length:Math.min(count,items.length)},async()=>{while(next<items.length)await action(items[next++])}))}
function createTopTenService({get,teams,now=()=>new Date()}){
 let job=null;
 const start=()=>{
  const date=now(),today=date.toISOString().slice(0,10),year=date.getUTCFullYear(),startYear=date.getUTCMonth()>=6?year:year-1,seasons=[Number(''+startYear+(startYear+1)),Number(''+(startYear-1)+startYear)];
  const state={state:'loading',phase:'Loading all team rosters',done:0,total:teams.length,failedRosters:0,failedPlayers:0,failedGames:0,playersChecked:0};job={state,expires:Infinity};
  (async()=>{
   const players=new Map();
   await workers(teams,async team=>{try{const d=await get('/roster/'+team+'/current');if(!Array.isArray(d.forwards)||!Array.isArray(d.defensemen||d.defense))throw Error('Missing roster');for(const p of [...d.forwards,...(d.defensemen||d.defense),...(d.injuredReserve||[])]){const id=String(p.id??p.playerId);if(!/^\d+$/.test(id)||p.positionCode==='G')continue;players.set(id,{id,team,name:[p.firstName?.default||p.firstName,p.lastName?.default||p.lastName].filter(Boolean).join(' ')||p.name||id,headshot:p.headshot||''})}}catch{state.failedRosters++}state.done++});
   if(!players.size)throw Error('NHL rosters are unavailable. Please retry.');
   state.phase='Checking player game logs';state.done=0;state.total=players.size;const windows=[];
   await workers([...players.values()],async p=>{try{const current=await get('/player/'+p.id+'/game-log/'+seasons[0]+'/2');if(!Array.isArray(current.gameLog))throw Error('Missing history');let rows=current.gameLog;if(lastTen(rows,today).length<10){const previous=await get('/player/'+p.id+'/game-log/'+seasons[1]+'/2');if(!Array.isArray(previous.gameLog))throw Error('Missing history');rows=[...rows,...previous.gameLog]}const games=lastTen(rows,today);if(games.length===10)windows.push({...p,history:games})}catch{state.failedPlayers++}state.done++;state.playersChecked++});
   const gameIds=[...new Set(windows.flatMap(p=>p.history.map(g=>String(g.gameId))))],boxes=new Map();state.phase='Reading completed game box scores';state.done=0;state.total=gameIds.length;
   await workers(gameIds,async id=>{try{const box=await get('/gamecenter/'+id+'/boxscore');if(!['OFF','FINAL'].includes(box.gameState)||!box.playerByGameStats)throw Error('Missing completed box score');const entries=['homeTeam','awayTeam'].flatMap(side=>{const d=box.playerByGameStats[side]||{};return [...(d.forwards||[]),...(d.defense||d.defensemen||[])]});boxes.set(id,new Map(entries.map(p=>[String(p.playerId),p])))}catch{state.failedGames++}state.done++});
   const records=windows.map(p=>{
    const totals=Object.fromEntries(CATEGORIES.map(k=>[k,0]));let blocksComplete=true,complete=true;
    for(const g of p.history){const box=boxes.get(String(g.gameId)),row=box?.get(p.id);if(!box||!row){complete=false;break}for(const key of ['points','goals','assists','shots']){const value=Number(g[key]);if(!Number.isFinite(value)){complete=false;break}totals[key]+=value}if(row.blockedShots==null||!Number.isFinite(Number(row.blockedShots)))blocksComplete=false;else totals.blockedShots+=Number(row.blockedShots)}
    if(!blocksComplete)totals.blockedShots=null;
    return {id:p.id,name:p.name,team:p.team,headshot:p.headshot,games:complete?10:0,from:p.history[9].gameDate,to:p.history[0].gameDate,totals};
   });
   Object.assign(state,{state:'ready',rankings:rankPlayers(records),qualifiedPlayers:records.filter(p=>p.games===10).length,blockedPlayers:records.filter(p=>p.games===10&&Number.isFinite(p.totals.blockedShots)).length,updatedAt:now().toISOString()});job.expires=Date.now()+((state.failedRosters||state.failedPlayers||state.failedGames)?60000:30*60000);
  })().catch(error=>{Object.assign(state,{state:'error',error:error.message});job.expires=Date.now()+60000});
 };
 return {snapshot(refresh=false){if(!job||(job.state.state!=='loading'&&(refresh||job.expires<Date.now())))start();return {...job.state}}};
}
module.exports={lastTen,rankPlayers,createTopTenService};
