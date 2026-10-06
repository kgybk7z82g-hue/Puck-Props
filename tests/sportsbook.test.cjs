'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {normalize,getSportsbookOdds}=require('../sportsbook');
test('prefers FanDuel only for identical selections, preserves thresholds and excludes started events',()=>{
 const book=(key,price,line)=>({key,last_update:'2026-10-05T12:00:00Z',markets:[{key:'player_shots_on_goal',outcomes:[{name:'Over',description:'Test Player',point:line,price}]}]});
 const event={id:'one',commence_time:'2026-10-06T23:00:00Z',home_team:'Home',away_team:'Away',bookmakers:[book('draftkings',2.2,1.5),book('fanduel',1.9,1.5),book('draftkings',2.4,2.5)]};
 // One snapshot per bookmaker; include both DraftKings thresholds.
 event.bookmakers[0].markets[0].outcomes.push(event.bookmakers.pop().markets[0].outcomes[0]);
 const result=normalize([event],Date.parse('2026-10-05T12:00:00Z'));
 assert.equal(result.length,2);assert.equal(result[0].book,'FanDuel');assert.equal(result[0].odds,1.9);
 assert.equal(result[1].book,'DraftKings');assert.match(result[1].selection,/2.5/);
 assert.equal(result[0].updatedAt,'2026-10-05T12:00:00Z');
 assert.deepEqual(normalize([event],Date.parse('2026-10-07T12:00:00Z')),[]);
});
test('requests both books and reports partial feed failures',async()=>{
 const previous=global.fetch,calls=[];
 global.fetch=async input=>{
  const url=new URL(input);calls.push(url);
  if(url.pathname.endsWith('/events'))return Response.json([{id:'one',commence_time:'2099-10-06T23:00:00Z',away_team:'Away',home_team:'Home'}]);
  return new Response('',{status:429});
 };
 try {
  const result=await getSportsbookOdds({apiKey:'test',from:'2099-10-06T00:00:00Z',to:'2099-10-06T23:59:59Z'});
  assert.equal(calls[1].searchParams.get('bookmakers'),'fanduel,draftkings');
  assert.match(calls[1].searchParams.get('markets'),/player_points/);
  assert.equal(result.legs.length,0);assert.match(result.warnings[0],/quota/);
 }finally{global.fetch=previous}
});
