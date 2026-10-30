const {test}=require('node:test');
const assert=require('node:assert/strict');
const {normalizeInjuries,createInjuryService}=require('../injuries');
const feed={injuries:[{displayName:'New Jersey Devils',injuries:[{athlete:{displayName:'Test Player',team:{abbreviation:'NJ'}},status:'Out',shortComment:'Will miss tonight.',date:'2026-10-30T12:00Z',details:{type:'Upper Body'}}]},{displayName:'Boston Bruins',injuries:[]}]};
test('maps team aliases and empty reports, preserving news and dates',()=>{
 const data=normalizeInjuries(feed,new Map([['boston bruins','BOS']]),'2026-10-30T13:00Z');
 assert.equal(data.teams.NJD.players[0].summary,'Will miss tonight.');
 assert.equal(data.teams.NJD.players[0].status,'Out');
 assert.equal(data.teams.NJD.players[0].returnDate,null);
 assert.deepEqual(data.teams.BOS.players,[]);
 assert.throws(()=>normalizeInjuries({},new Map(),''));
});
test('shares requests, expires after five minutes and retries failed fetches',async()=>{
 let calls=0,time=Date.parse('2026-10-30T13:00Z'),fail=false;
 const get=createInjuryService({now:()=>time,fetchImpl:async()=>{calls++;return {ok:!fail,json:async()=>feed}}});
 await Promise.all([get(),get()]);assert.equal(calls,1);
 await get();assert.equal(calls,1);
 time+=300001;fail=true;await assert.rejects(get());
 fail=false;await get();assert.equal(calls,3);
});
