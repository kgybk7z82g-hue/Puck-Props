const {test}=require('node:test');
const assert=require('node:assert/strict');
const {openingScorer,createFirstGoalsService}=require('../firstgoals');
const game={homeTeam:{id:1,abbrev:'TOR'},awayTeam:{id:2,abbrev:'BOS'},rosterSpots:[{playerId:10,firstName:{default:'Test'},lastName:{default:'Player'}}],plays:[{typeDescKey:'goal',periodDescriptor:{number:1,periodType:'REG'},timeInPeriod:'03:00',details:{scoringPlayerId:10,eventOwnerTeamId:2}}]};
test('counts the game opener, excludes shootouts, and sorts scoring events',()=>{
 assert.equal(openingScorer({...game,plays:[{...game.plays[0],timeInPeriod:'12:00',details:{scoringPlayerId:999}},...game.plays]}).id,10);
 assert.equal(openingScorer({...game,plays:[{...game.plays[0],periodDescriptor:{number:5,periodType:'SO'}}]}),null);
 assert.throws(()=>openingScorer({...game,rosterSpots:[]}));
});
test('deduplicates league games and reports unavailable schedules',async()=>{
 let calls=0;
 const load=createFirstGoalsService({teams:['TOR','BOS','BAD'],get:async path=>{if(path.includes('/BAD/'))throw Error('missing');if(path.includes('schedule'))return {games:[{id:1,gameType:2,gameState:'OFF'},{id:2,gameType:1,gameState:'OFF'}]};calls++;return game;}});
 const data=await load('20262027');
 assert.equal(data.leaders[0].firstGoals,1);assert.equal(data.gamesProcessed,1);assert.equal(data.failedTeams,1);assert.equal(calls,1);
 await load('20262027');assert.equal(calls,1);
});
