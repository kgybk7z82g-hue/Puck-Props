'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {rankGoalLeaders,createGoalLeadersService}=require('../goal-leaders');
test('goal leaders rank each metric separately, preserve ties, omit zeros and cap at twenty',()=>{
 const rows=Array.from({length:25},(_,i)=>({playerId:i,skaterFullName:'Player '+String(i).padStart(2,'0'),teamAbbrevs:'TOR',otGoals:i<2?30:25-i,emptyNetGoals:i}));
 const ot=rankGoalLeaders(rows,'otGoals'),eng=rankGoalLeaders(rows,'emptyNetGoals');assert.equal(ot.length,20);assert.equal(ot[0].rank,1);assert.equal(ot[1].rank,1);assert.equal(ot[2].rank,3);assert.equal(eng[0].id,24);assert.ok(eng.every(p=>p.goals>0));assert.equal(ot[0].team,'TOR');
});
test('goal leaders cache concurrent requests and retry incomplete or failed reports',async()=>{
 let calls=0;let fail=true;const load=createGoalLeadersService({get:async url=>{calls++;assert.match(url,/gameTypeId=2/);if(fail)throw Error('offline');return {data:[{playerId:1,skaterFullName:'A',teamAbbrevs:'TOR',otGoals:2,emptyNetGoals:3}],total:1}}});
 await assert.rejects(load('20252026'),/offline/);fail=false;const [a,b]=await Promise.all([load('20252026'),load('20252026')]);assert.equal(a,b);assert.equal(a.overtime[0].goals,2);assert.equal(a.emptyNet[0].goals,3);await load('20252026');assert.equal(calls,2);
 const incomplete=createGoalLeadersService({get:async()=>({data:[],total:1})});await assert.rejects(incomplete('20252026'),/Complete NHL/);
 const empty=createGoalLeadersService({get:async()=>({data:[],total:0})});assert.deepEqual((await empty('20262027')).emptyNet,[]);
});
test('leader tables escape names and display both categories and empty states',()=>{
 const fs=require('fs'),vm=require('vm'),source=fs.readFileSync('app.js','utf8'),context=vm.createContext({esc:s=>String(s).replaceAll('<','&lt;')});vm.runInContext(source.slice(source.indexOf('function renderGoalLeaders'),source.indexOf('async function loadGoalLeaders')),context);
 const html=context.renderGoalLeaders({overtime:[{rank:1,name:'<A',team:'TOR',goals:3}],emptyNet:[]});assert.match(html,/Overtime goals/);assert.match(html,/Empty-net goals/);assert.match(html,/&lt;A/);assert.match(html,/No empty-net goals scorers/);
});
