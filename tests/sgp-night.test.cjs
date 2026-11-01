'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8'),ctx=vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function injuryName'),source.indexOf('function renderSgpNight')),ctx);
const games=[{id:1,homeTeam:{id:10,abbrev:'A'},awayTeam:{id:20,abbrev:'B'}},{id:2,homeTeam:{id:30,abbrev:'C'},awayTeam:{id:40,abbrev:'D'}}];
const legs=[{fixtureId:'1',market:'Team win',team:'A',probability:.65},{fixtureId:'1',market:'Team win',team:'B',probability:.35},{fixtureId:'2',market:'Team win',team:'C',probability:.64},{fixtureId:'2',market:'Team win',team:'D',probability:.36}];
const stats={rows:[{id:10,gamesPlayed:10,pp:.2,penaltyMinutes:50},{id:20,gamesPlayed:10,pp:.15,penaltyMinutes:60},{id:30,gamesPlayed:10,pp:.35,penaltyMinutes:40},{id:40,gamesPlayed:10,pp:.1,penaltyMinutes:200}]};
test('win probability leads and special teams can favor a close alternative',()=>{
 assert.equal(ctx.rankNightGames(games,legs,null,null,new Map())[0].favorite.team,'A');
 const result=ctx.rankNightGames(games,legs,stats,null,new Map());
 assert.equal(result[0].favorite.team,'C');assert.equal(result[0].favorite.probability,.64);assert.equal(result[0].special,.04);
});
test('key injuries change selection score and name matching handles accents',()=>{
 const core=new Map([['1',{name:'René Test',team:'C'}]]),injuries={teams:{C:{players:[{name:'Rene Test',status:'Out'}]}}};
 const result=ctx.rankNightGames(games,legs,stats,injuries,core).find(c=>c.favorite.team==='C');
 assert.equal(result.injuryWeight,-.01);assert.equal(result.affected.length,1);
 assert.ok(ctx.sgpInjury({playerName:'René Test',team:'C'},injuries));
 assert.equal(ctx.sgpInjury({name:'Rene Test',team:'C'},{teams:{C:{players:[{name:'Rene Test',status:'Active'}]}}}),undefined);
});
test('missing statistics never fabricate a matchup advantage',()=>{
 const result=ctx.rankNightGames(games,legs,{rows:[{id:10,gamesPlayed:0,pp:0,penaltyMinutes:null}]},null,new Map());
 assert.equal(result[0].special,0);assert.equal(result[0].statsAvailable,false);assert.equal(result[0].injuryAvailable,false);
 assert.equal(ctx.rankNightGames([],legs,stats,null,new Map()).length,0);
});
