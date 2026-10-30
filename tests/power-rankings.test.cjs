'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
const context=vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function buildPowerRankings'),source.indexOf('function renderPowerRankings')),context);
const build=rows=>context.buildPowerRankings(rows.map(t=>({wins:1,losses:0,otLosses:0,points:t.gamesPlayed,goalsAgainst:t.gamesPlayed,...t})));
test('power rankings give equal weight to category ranks and preserve ties',()=>{
 const rows=[{id:1,name:'A',gamesPlayed:10,pp:.3,pk:.7,goals:20},{id:2,name:'B',gamesPlayed:10,pp:.2,pk:.9,goals:30},{id:3,name:'C',gamesPlayed:10,pp:.3,pk:.8,goals:10}];
 const r=build(rows);
 assert.equal(r.pp[0].rank,1);assert.equal(r.pp[1].rank,1);assert.equal(r.pp[2].rank,3);
 assert.equal(r.pk[0].name,'B');assert.equal(r.goals[0].name,'B');
 assert.equal(r.combined[0].name,'B');assert.equal(r.combined[0].average,7/5);
 assert.equal(r.combined[1].rank,2);assert.equal(r.combined[2].rank,2);
});
test('missing metrics and unplayed teams do not produce fabricated combined ranks',()=>{
 const r=build([{id:1,name:'Complete',gamesPlayed:1,pp:0,pk:0,goals:0},{id:2,name:'Missing',gamesPlayed:1,pp:null,pk:.9,goals:4},{id:3,name:'Unplayed',gamesPlayed:0,pp:0,pk:0,goals:0}]);
 assert.equal(r.pp.length,1);assert.equal(r.combined.length,1);assert.equal(r.combined[0].name,'Complete');assert.equal(r.pk.length,2);
});
test('goals per game corrects for unequal schedules and feeds the combined rank',()=>{
 const r=build([
  {id:1,name:'More games',gamesPlayed:20,pp:.2,pk:.8,goals:60},
  {id:2,name:'Fewer games',gamesPlayed:10,pp:.2,pk:.8,goals:40},
  {id:3,name:'Equal rate',gamesPlayed:5,pp:.2,pk:.8,goals:20}
 ]);
 assert.equal(r.goals[0].goalsPerGame,4);
 assert.equal(r.goals.find(t=>t.id===1).rank,3);
 assert.equal(r.goals.find(t=>t.id===2).rank,1);
 assert.equal(r.goals.find(t=>t.id===3).rank,1);
 assert.equal(r.combined.find(t=>t.id===1).average,7/5);
 assert.equal(r.combined.find(t=>t.id===2).average,1);
 assert.equal(r.combined.find(t=>t.id===3).average,1);
});

test('record and defense affect combined ranking with fair schedule rates',()=>{
 const r=build([{id:1,name:'A',gamesPlayed:10,pp:.2,pk:.8,goals:30,points:16,goalsAgainst:20},{id:2,name:'B',gamesPlayed:20,pp:.2,pk:.8,goals:60,points:20,goalsAgainst:60}]);
 assert.equal(r.record[0].id,1);assert.equal(r.defense[0].id,1);assert.equal(r.combined[0].id,1);assert.equal(r.combined[1].average,1.4);
});
test('missing record or goals against excludes a team from combined rankings',()=>{
 const r=build([{id:1,name:'A',gamesPlayed:10,pp:.2,pk:.8,goals:30,points:null},{id:2,name:'B',gamesPlayed:10,pp:.2,pk:.8,goals:30,goalsAgainst:null}]);
 assert.equal(r.combined.length,0);assert.equal(r.record.length,1);assert.equal(r.defense.length,1);
});

test('power rankings render all categories, records and goal totals',()=>{
 const elements={powerColumns:{innerHTML:''}};context.$=id=>elements[id];context.esc=String;context.powerData={rows:[{id:1,name:'A',gamesPlayed:10,wins:6,losses:3,otLosses:1,points:13,goals:35,goalsAgainst:25,pp:.25,pk:.8}]};
 vm.runInContext(source.slice(source.indexOf('function renderPowerRankings'),source.indexOf('async function loadPowerRankings')),context);
 context.renderPowerRankings();const html=elements.powerColumns.innerHTML;
 assert.equal((html.match(/<table>/g)||[]).length,6);assert.match(html,/6–3–1/);assert.match(html,/GF 35 · GA 25/);assert.match(html,/65.0%/);assert.match(html,/2.50/);assert.match(html,/3.50/);
 context.powerData={rows:[]};context.renderPowerRankings();assert.equal((elements.powerColumns.innerHTML.match(/No statistics available yet/g)||[]).length,6);
});
