'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyzeTravel,createTravelService,flightContext,playerTravelSplits}=require('../travel');
const now=Date.parse('2026-10-26T16:00:00Z');
const games=[{id:1,gameDate:'2026-10-25',startTimeUTC:'2026-10-25T23:00:00Z',gameState:'OFF'},{id:2,gameDate:'2026-10-26',startTimeUTC:'2026-10-26T23:00:00Z',gameState:'FUT'}];
const flight={id:1,team:'TOR',firstSeen:'2026-10-26T02:00:00Z',arrived:'2026-10-26T04:00:00Z',status:'landed',distanceNm:1000};
test('recovery, distance and back-to-back use observed flights and completed games',()=>{
 const result=analyzeTravel('TOR',[flight,{...flight,id:2,team:null,positioning:true}],games,now);
 assert.equal(result.recoveryHours,19);assert.equal(result.distanceKm,1852);assert.equal(result.backToBack,true);assert.equal(result.score,55);assert.equal(result.flights.length,1);
});
test('missing flights and airborne latest flight never imply a known arrival or zero distance',()=>{
 const missing=analyzeTravel('TOR',[],games,now);assert.equal(missing.recoveryHours,null);assert.equal(missing.distanceKm,null);
 const airborne=analyzeTravel('TOR',[flight,{...flight,id:3,firstSeen:'2026-10-26T15:00:00Z',arrived:null,status:'airborne',distanceNm:null}],games,now);
 assert.equal(airborne.recoveryHours,null);assert.equal(airborne.distanceKm,null);
 assert.equal(analyzeTravel('TOR',[flight],[],now).score,null);
});
test('flight source caches concurrent requests and follows pagination',async()=>{
 let calls=0;
 const service=createTravelService({teams:['TOR'],getNhl:async()=>({games}),fetchJson:async url=>{calls++;if(url.endsWith('/teams'))return {teams:[{tri:'TOR'}]};if(url.includes('before='))return {flights:[{...flight,id:2}],next:null};return {flights:[flight],next:'/api/v1/flights?before=1'};}});
 await Promise.all([service('TOR'),service('TOR')]);assert.equal(calls,3);
 await service();assert.equal(calls,3);await assert.rejects(service('BAD'),/Unknown/);
});
test('source failure can be retried and unexpected records are rejected',async()=>{
 let fail=true;const service=createTravelService({teams:['TOR'],getNhl:async()=>({games}),fetchJson:async url=>{if(fail)throw Error('offline');return url.endsWith('/teams')?{teams:[]}:{flights:[]};}});
 await assert.rejects(service(),/offline/);fail=false;assert.deepEqual((await service()).teams,[]);
});
test('airport time zones respect daylight saving and unknown airports stay unknown',()=>{
 assert.deepEqual(flightContext({origin:'KLAX',destination:'CYYZ',arrived:'2026-10-26T07:00:00Z'}),{zoneHours:3,lateArrival:true});
 assert.deepEqual(flightContext({origin:'XXXX',destination:'YYYY',arrived:'2026-10-26T07:00:00Z'}),{zoneHours:null,lateArrival:null});
});
test('player splits join team games, preserve zero statistics and exclude unknown travel',()=>{
 const schedule=games.map(g=>({...g,gameType:2,gameState:'OFF'}));
 const logs=[{gameId:1,teamAbbrev:'TOR',shots:0,goals:0,assists:1},{gameId:2,teamAbbrev:'TOR',shots:4,goals:1,assists:0},{gameId:3,teamAbbrev:'VAN',shots:20,goals:2,assists:0}];
 const result=playerTravelSplits('TOR',logs,schedule,[{...flight,origin:'KLAX',destination:'CYYZ',arrived:'2026-10-26T07:00:00Z'}]);
 const rows=Object.fromEntries(result.splits.map(r=>[r.key,r]));
 assert.equal(rows.season.games,2);assert.equal(rows.season.shots,2);assert.equal(rows.backToBack.games,1);assert.equal(rows.afterFlight.games,1);assert.equal(rows.overnight.games,1);assert.equal(rows.zones.games,1);assert.equal(rows.rested.shots,null);
});
