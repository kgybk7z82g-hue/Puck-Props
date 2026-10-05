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
 const history=Array.from({length:20},(_,i)=>({gameDate:`2026-09-${String(i+1).padStart(2,'0')}`,shots:i<3?3:0}));
 const leg=id=>({id,playerId:id,team:'TOR',probability:.7,sample:20,history,key:'shots',threshold:2});
 const pick=sameGameParlay([leg('1'),leg('2')]);assert.ok(pick);assert.ok(pick.odds>=3.5&&pick.odds<=4.5);assert.equal(pick.jointSample,20);assert.equal(pick.jointHits,3);
 assert.equal(sameGameParlay([leg('1'),leg('1')]),null);
 assert.equal(sameGameParlay([leg('1'),{...leg('2'),team:'BOS'}]).method,'marginal');
 assert.equal(sameGameParlay([leg('1'),{...leg('2'),sample:2}]),null);
});


test('same-game selection favors estimated return closest to four',()=>{
 const leg=(id,hits)=>({id,playerId:id,team:'TOR',probability:.7,sample:20,key:'shots',threshold:2,history:Array.from({length:20},(_,i)=>({gameDate:`2026-09-${String(i+1).padStart(2,'0')}`,shots:i<hits?3:0}))});
 const lower=sameGameParlay([leg('1',20),leg('2',7)]),nearer=sameGameParlay([leg('1',20),leg('3',3)]);
 assert.ok(lower&&nearer);assert.ok(lower.probability>nearer.probability);
 const selected=sameGameParlay([leg('1',20),leg('2',7),leg('3',3)]);
 assert.equal(selected.odds,nearer.odds);
 assert.equal(sameGameParlay([leg('1',20),leg('2',20)]).outsideTarget,true);
});

test('SGP fills outside-range and limited shared history games without fabricating records',()=>{
 const leg=(id,offset=0)=>({id,playerId:id,team:'TOR',probability:.8,sample:3,key:'shots',threshold:1,history:Array.from({length:3},(_,i)=>({gameDate:`day-${i+offset}`,shots:1}))});
 const limited=sameGameParlay([leg('a'),leg('b')]);assert.ok(limited);assert.equal(limited.jointSample,3);assert.equal(limited.outsideTarget,true);
 const fallback=sameGameParlay([leg('a'),leg('b',10)]);assert.ok(fallback);assert.equal(fallback.method,'marginal');assert.equal(fallback.jointSample,0);
 assert.equal(sameGameParlay([]),null);assert.equal(sameGameParlay([leg('a')]),null);
});
test('SGP can use more than two distinct players to approach four',()=>{
 const legs=Array.from({length:4},(_,i)=>({id:String(i),playerId:String(i),team:'TOR',probability:.7,sample:10,key:'shots',threshold:1,history:Array.from({length:10},(_,j)=>({gameDate:`day-${j+i*10}`,shots:1}))}));
 const pick=sameGameParlay(legs);assert.equal(pick.legs.length,4);assert.ok(Math.abs(pick.odds-4)<.2);
});

test('core-player shortlist keeps six forwards and three defensemen per team by recent ice time',()=>{
 const players=[],histories=new Map();
 for(const team of ['TOR','BOS'])for(const position of ['C','D'])for(let i=0;i<(position==='D'?5:8);i++){
  const id=`${team}-${position}-${i}`;players.push({id,team,position});histories.set(id,Array.from({length:5},(_,j)=>({gameDate:`2026-09-${20+j}`,toi:`${25-i}:00`,shots:i===7?10:1})));
 }
 const core=context.selectCorePlayers(players,histories);assert.equal(core.size,18);
 for(const team of ['TOR','BOS']){assert.equal([...core.values()].filter(p=>p.team===team&&p.position==='C').length,6);assert.equal([...core.values()].filter(p=>p.team===team&&p.position==='D').length,3);assert.ok(!core.has(`${team}-C-7`));assert.ok(!core.has(`${team}-D-4`));}
 assert.equal(core.get('TOR-C-0').roleMinutes,25);
});
test('role selection uses latest games and excludes missing or malformed ice time',()=>{
 const players=[{id:'recent',team:'TOR',position:'C'},{id:'old',team:'TOR',position:'C'},{id:'missing',team:'TOR',position:'D'},{id:'bad',team:'TOR',position:'D'},{id:'goalie',team:'TOR',position:'G'}];
 const history=minutes=>Array.from({length:5},(_,i)=>({gameDate:`2026-09-${20+i}`,toi:minutes}));
 const histories=new Map([['recent',[...history('21:30'),{gameDate:'2025-09-01',toi:'05:00'}]],['old',[...history('11:00'),{gameDate:'2025-09-01',toi:'30:00'}]],['missing',[{gameDate:'2026-09-01'}]],['bad',history('20:99')],['goalie',history('60:00')]]);
 const core=context.selectCorePlayers(players,histories);assert.equal(core.size,2);assert.equal(core.get('recent').roleRank,1);assert.equal(core.get('recent').roleMinutes,21.5);assert.equal(core.get('old').roleMinutes,11);
});
