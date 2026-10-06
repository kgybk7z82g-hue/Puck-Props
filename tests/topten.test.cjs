'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {lastTen,rankPlayers,createTopTenService}=require('../topten');
test('last ten are appearances, sorted across seasons and deduplicated',()=>{
 const rows=Array.from({length:14},(_,i)=>({gameId:100+i,gameDate:i<7?'2025-04-'+String(10+i).padStart(2,'0'):'2026-10-'+String(i-6).padStart(2,'0')}));
 const pick=lastTen([...rows,rows[9],{gameId:999,gameDate:'2027-01-01'}],'2026-10-07');assert.equal(pick.length,10);assert.equal(pick[0].gameId,113);assert.equal(pick[9].gameId,104);
});
test('rankings use ten-game totals, independent categories and deterministic ties',()=>{
 const players=Array.from({length:12},(_,i)=>({id:String(i),name:'Player '+String(i).padStart(2,'0'),games:10,totals:{points:i,goals:11-i,assists:2,shots:i*2,blockedShots:i===11?null:i}}));
 players.push({id:'short',name:'Short',games:9,totals:{points:100,goals:100}});
 const ranks=rankPlayers(players);assert.equal(ranks.points.length,10);assert.equal(ranks.points[0].id,'11');assert.equal(ranks.goals[0].id,'0');assert.equal(ranks.assists[0].id,'0');assert.equal(ranks.blockedShots[0].id,'10');assert.equal(ranks.shots[0].average,2.2);assert.ok(!ranks.points.some(p=>p.id==='short'));
});
async function ready(service){for(let i=0;i<100;i++){const data=service.snapshot();if(data.state!=='loading')return data;await new Promise(resolve=>setImmediate(resolve))}throw Error('Job did not finish')}
test('service spans seasons, retains zero blocks and caches league results',async()=>{
 let calls=0;const service=createTopTenService({teams:['TOR','BOS'],now:()=>new Date('2026-10-06T12:00:00Z'),get:async endpoint=>{
  calls++;
  if(endpoint.includes('/roster/'))return {forwards:[{id:endpoint.includes('TOR')?1:2,firstName:{default:'Test'},lastName:{default:endpoint.includes('TOR')?'Toronto':'Boston'},positionCode:'C'}],defensemen:[]};
  if(endpoint.includes('20262027'))return {gameLog:[]};
  if(endpoint.includes('game-log'))return {gameLog:Array.from({length:10},(_,i)=>({gameId:100+i,gameDate:'2026-04-'+String(i+1).padStart(2,'0'),points:1,goals:0,assists:1,shots:2}))};
  return {gameState:'OFF',playerByGameStats:{homeTeam:{forwards:[{playerId:1,blockedShots:0}]},awayTeam:{defense:[{playerId:2,blockedShots:2}]}}};
 }});
 const result=await ready(service);assert.equal(result.state,'ready');assert.equal(result.qualifiedPlayers,2);assert.equal(result.rankings.blockedShots[0].total,20);assert.equal(result.rankings.blockedShots[1].total,0);assert.equal(result.rankings.points[0].total,10);const before=calls;service.snapshot();assert.equal(calls,before);
});
test('failed box scores are disclosed and never treated as zero',async()=>{
 const service=createTopTenService({teams:['TOR'],now:()=>new Date('2026-10-06T12:00:00Z'),get:async endpoint=>{
  if(endpoint.includes('roster'))return {forwards:[{id:1,positionCode:'C'}],defensemen:[]};
  if(endpoint.includes('game-log'))return {gameLog:Array.from({length:10},(_,i)=>({gameId:100+i,gameDate:'2026-04-'+String(i+1).padStart(2,'0'),points:1,goals:0,assists:1,shots:2}))};
  throw Error('Missing');
 }});const result=await ready(service);assert.equal(result.failedGames,10);assert.equal(result.qualifiedPlayers,0);assert.equal(result.rankings.blockedShots.length,0);
});
