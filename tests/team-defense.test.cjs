'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('defense snapshots exclude slate-day and future results with separate cutoff caches',async()=>{
 const source=fs.readFileSync('server.js','utf8');
 const context=vm.createContext({Date,Map,teamDefenseCache:new Map(),nhlJson:async route=>route.includes('club-schedule')?{games:['2026-10-26','2026-10-27','2026-10-28'].map((gameDate,id)=>({id,gameDate,gameType:2,gameState:'OFF'}))}:{homeTeam:{abbrev:'TOR'},awayTeam:{abbrev:'BOS'},playerByGameStats:{awayTeam:{forwards:[],defense:[],goalies:[]}}}});
 vm.runInContext(source.slice(source.indexOf('async function getTeamDefense('),source.indexOf('function clockSeconds(')),context);
 assert.equal((await context.getTeamDefense('TOR','20262027','2026-10-27')).gamesProcessed,1);
 assert.equal((await context.getTeamDefense('TOR','20262027','2026-10-28')).gamesProcessed,2);
 assert.equal((await context.getTeamDefense('TOR','20262027')).gamesProcessed,3);
});

test('opponent position splits use each box score and preserve forward totals',async()=>{
 const source=fs.readFileSync('server.js','utf8');
 const player=(position,sog)=>({position,sog,goals:1,points:2});
 const context=vm.createContext({Date,Map,teamDefenseCache:new Map(),nhlJson:async route=>{
  if(route.includes('club-schedule'))return {games:[{id:1,gameType:2,gameState:'OFF'},{id:2,gameType:2,gameState:'FINAL'},{id:3,gameType:1,gameState:'OFF'}]};
  const home=route.includes('/1/');
  return {homeTeam:{abbrev:home?'TOR':'BOS'},awayTeam:{abbrev:home?'BOS':'TOR'},playerByGameStats:{[home?'awayTeam':'homeTeam']:{forwards:[player('C',3),player('L',2),player('RW',4),player('',1)],defense:[player('D',5)],goalies:[]},[home?'homeTeam':'awayTeam']:{forwards:[player('C',99)]}}};
 }});
 vm.runInContext(source.slice(source.indexOf('async function getTeamDefense('),source.indexOf('function clockSeconds(')),context);
 const result=await context.getTeamDefense('TOR','20262027');
 assert.equal(result.gamesProcessed,2);
 for(const [key,shots] of [['Centers',6],['LeftWings',4],['RightWings',8],['UnknownForwards',2],['Defensemen',10]]){
  assert.equal(result.allowed[key].shots,shots);
  assert.equal(result.allowed[key].goals,2);
  assert.equal(result.allowed[key].points,4);
 }
 assert.equal(result.allowed.Forwards.shots,20);
 assert.equal(result.allowed.Forwards.goals,8);
});
