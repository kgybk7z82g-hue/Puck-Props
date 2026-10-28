'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const research=require('../matchup');
const game={id:10,startTimeUTC:'2026-10-28T23:00:00Z',homeTeam:{abbrev:'TOR'},awayTeam:{abbrev:'BOS'}};
const player={team:'TOR',position:'C'};
function context(){return {date:'2026-10-28',updatedAt:'2026-10-28T16:00:00Z',defense:{},travel:{},schedules:{},goalies:{},projections:{}};}
test('missing data stays unknown and does not change probability or research order',()=>{
 const c=context(),result=research.evaluate(c,game,player,'shots');
 assert.equal(result.support,0);assert.ok(result.missing.length>=6);
 const item={probability:.6,context:result};assert.equal(research.order(item),.6);assert.equal(item.probability,.6);
});
test('position weakness and relative back-to-back affect ordering with bounded support',()=>{
 const c=context();
 for(const [team,shots]of [['BOS',200],['TOR',100],['MTL',100],['OTT',100]])c.defense[team]={gamesProcessed:10,allowed:{Centers:{shots}}};
 const previous=date=>({gameType:2,gameState:'OFF',gameDate:date});
 c.schedules={TOR:{games:[previous('2026-10-26')]},BOS:{games:[previous('2026-10-27')]}};
 const result=research.evaluate(c,game,player,'shots');assert.equal(result.support,1.5);
 assert.ok(result.notes.some(n=>n.includes('all centers combined')));
 assert.equal(research.order({probability:.6,context:result}),.63);
 c.defense.BOS.gamesProcessed=4;assert.equal(research.evaluate(c,game,player,'shots').support,.5);
});
test('arrival estimates require exact fixture, observed landing and recent timing',()=>{
 const c=context();c.travel.BOS={next:{id:10},latest:{status:'landed',arrived:'2026-10-28T05:00:00Z'},lateArrival:true};
 let result=research.evaluate(c,game,player,'shots');assert.ok(result.notes.some(n=>n.includes('15.0h')));
 c.travel.BOS.next.id=11;result=research.evaluate(c,game,player,'shots');assert.ok(!result.notes.some(n=>n.includes('recovery opportunity')));
 c.travel.BOS.next.id=10;c.travel.BOS.latest.arrived='2026-10-28T20:00:00Z';assert.ok(!research.evaluate(c,game,player,'shots').notes.some(n=>n.includes('recovery opportunity')));
 c.travel.BOS.latest={status:'airborne'};assert.ok(!research.evaluate(c,game,player,'shots').notes.some(n=>n.includes('recovery opportunity')));
});
