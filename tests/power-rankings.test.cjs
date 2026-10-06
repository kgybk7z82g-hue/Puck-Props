'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
const context=vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function buildPowerRankings'),source.indexOf('function renderPowerRankings')),context);
test('power rankings give equal weight to category ranks and preserve ties',()=>{
 const rows=[{id:1,name:'A',gamesPlayed:10,pp:.3,pk:.7,goals:20},{id:2,name:'B',gamesPlayed:10,pp:.2,pk:.9,goals:30},{id:3,name:'C',gamesPlayed:10,pp:.3,pk:.8,goals:10}];
 const r=context.buildPowerRankings(rows);
 assert.equal(r.pp[0].rank,1);assert.equal(r.pp[1].rank,1);assert.equal(r.pp[2].rank,3);
 assert.equal(r.pk[0].name,'B');assert.equal(r.goals[0].name,'B');
 assert.equal(r.combined[0].name,'B');assert.equal(r.combined[0].average,5/3);
 assert.equal(r.combined[1].rank,2);assert.equal(r.combined[2].rank,2);
});
test('missing metrics and unplayed teams do not produce fabricated combined ranks',()=>{
 const r=context.buildPowerRankings([{id:1,name:'Complete',gamesPlayed:1,pp:0,pk:0,goals:0},{id:2,name:'Missing',gamesPlayed:1,pp:null,pk:.9,goals:4},{id:3,name:'Unplayed',gamesPlayed:0,pp:0,pk:0,goals:0}]);
 assert.equal(r.pp.length,1);assert.equal(r.combined.length,1);assert.equal(r.combined[0].name,'Complete');assert.equal(r.pk.length,2);
});
