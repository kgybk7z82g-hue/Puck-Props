'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
const context=vm.createContext({num:x=>Number(x)||0,Date,Map,Set});
for(const [start,end] of [['function weightedRate','function gameNotStarted'],['function gameNotStarted','function pickPropLabel']])vm.runInContext(source.slice(source.indexOf(start),source.indexOf(end)),context);
const {gameNotStarted,researchRate,sameGameParlay}=context;
test('eligibility excludes live, finished, past start, missing time and unknown states',()=>{
 const now=Date.parse('2026-10-05T20:00:00Z');
 for(const state of ['FUT','PRE'])assert.equal(gameNotStarted({gameState:state,startTimeUTC:'2026-10-05T21:00:00Z'},now),true);
 for(const state of ['LIVE','CRIT','OFF','FINAL','SUSP','PPD'])assert.equal(gameNotStarted({gameState:state,startTimeUTC:'2026-10-05T21:00:00Z'},now),false);
 assert.equal(gameNotStarted({gameState:'FUT',startTimeUTC:'2026-10-05T20:00:00Z'},now),false);
 assert.equal(gameNotStarted({gameState:'FUT'},now),false);
});
test('opponent results affect ranking and missing seasons remain usable',()=>{
 const history=Array.from({length:40},(_,i)=>({shots:i%2?3:0,currentSeason:i<20,opponentAbbrev:i%2?'TOR':'BOS'}));
 assert.ok(researchRate(history,'shots',2,.58,'TOR')>researchRate(history,'shots',2,.58,'BOS'));
 const rate=researchRate(history.filter(g=>!g.currentSeason),'shots',2,.58,'TOR');assert.ok(rate>0&&rate<1);
});
test('same-game returns respect range, shared outcomes and distinct players',()=>{
 const history=Array.from({length:20},(_,i)=>({gameDate:`2026-09-${String(i+1).padStart(2,'0')}`,shots:i<6?3:0}));
 const leg=id=>({id,playerId:id,team:'TOR',probability:.7,sample:20,history,key:'shots',threshold:2});
 const pick=sameGameParlay([leg('1'),leg('2')]);assert.ok(pick);assert.ok(pick.odds>=2.5&&pick.odds<=3.5);assert.equal(pick.jointSample,20);assert.equal(pick.jointHits,6);
 assert.equal(sameGameParlay([leg('1'),leg('1')]),null);
 assert.equal(sameGameParlay([leg('1'),{...leg('2'),team:'BOS'}]),null);
 assert.equal(sameGameParlay([leg('1'),{...leg('2'),sample:2}]),null);
});


test('same-game selection favors estimated return closest to three',()=>{
 const leg=(id,hits)=>({id,playerId:id,team:'TOR',probability:.7,sample:20,key:'shots',threshold:2,history:Array.from({length:20},(_,i)=>({gameDate:`2026-09-${String(i+1).padStart(2,'0')}`,shots:i<hits?3:0}))});
 const lower=sameGameParlay([leg('1',20),leg('2',7)]),nearer=sameGameParlay([leg('1',20),leg('3',5)]);
 assert.ok(lower&&nearer);assert.ok(lower.probability>nearer.probability);
 const selected=sameGameParlay([leg('1',20),leg('2',7),leg('3',5)]);
 assert.equal(selected.odds,nearer.odds);
 assert.equal(sameGameParlay([leg('1',20),leg('2',20)]),null);
});
