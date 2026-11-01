'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {parseCsv,buildSeason,buildTrend,createUnderlyingStrengthService}=require('../underlying-strength');
const base={team:'TOR',season:'2026',situation:'5on5',games_played:'12',iceTime:'3600',xGoalsFor:'3',xGoalsAgainst:'1',goalsFor:'4',goalsAgainst:'2',highDangerShotsFor:'5',highDangerShotsAgainst:'3'};
function csv(rows){const keys=[...new Set(rows.flatMap(Object.keys))];return keys.join(',')+'\r\n'+rows.map(r=>keys.map(k=>r[k]??'').join(',')).join('\r\n')}
test('season strength uses raw xG totals, five-on-five time and nullable metrics',()=>{
 const result=buildSeason([base,{...base,team:'BOS',xGoalsFor:'1',xGoalsAgainst:'3',goalsFor:'',highDangerShotsFor:''},{...base,team:'CAR',situation:'all'},{...base,team:'EDM',iceTime:'0'},{...base,team:'FLA',season:'2025'}],'20262027');
 assert.equal(result.rows.length,2);assert.equal(result.rows[0].rank,1);assert.equal(result.rows[0].xGoalsShare,.75);assert.equal(result.rows[0].xGoalsForPer60,3);assert.equal(result.rows[0].finishing,1);assert.equal(result.rows[0].goalsPrevented,-1);assert.equal(result.rows[1].finishing,null);assert.equal(result.rows[1].highDangerShotsFor,null);assert.equal(result.omitted,1);
 assert.equal(buildSeason([{...base,xGoalsFor:'0',xGoalsAgainst:'0'}],'20262027').rows[0].xGoalsShare,null);
});
test('recent ten use unique regular-season games, summed xG and stay within season',()=>{
 const rows=Array.from({length:12},(_,i)=>({...base,gameId:'202602'+String(i+1).padStart(4,'0'),gameDate:'202610'+String(i+1).padStart(2,'0'),opposingTeam:'BOS',xGoalsFor:String(i+1)}));
 const result=buildTrend([...rows,{...rows[0],gameId:'2026030001'},{...rows[0],gameId:'2025020001'},{...rows[0],gameId:'2026020013',gameDate:'20261201'}],'TOR','20262027','2026-11-01');
 assert.equal(result.season.games,12);assert.equal(result.lastTen.games,10);assert.equal(result.lastTen.xGoalsFor,75);assert.equal(result.lastTen.xGoalsShare,75/85);assert.equal(result.firstDate,'2026-10-03');assert.equal(result.lastDate,'2026-10-12');
 assert.throws(()=>buildTrend([rows[0],rows[0]],'TOR','20262027','2026-11-01'),/Duplicate/);
 assert.equal(buildTrend(rows.slice(0,2),'TOR','20262027','2026-11-01').lastTen.games,2);
});
test('CSV handles quotes and rejects HTML and missing required columns',()=>{
 assert.equal(parseCsv(csv([{...base,name:'"Toronto, Maple Leafs"'}]))[0].name,'Toronto, Maple Leafs');
 assert.throws(()=>parseCsv('<html>blocked</html>'),/format/);
 assert.throws(()=>parseCsv('team,situation\nTOR,5on5'),/format/);
});
test('service shares requests, caches downloads and retries failures',async()=>{
 let calls=0,time=Date.parse('2026-11-01T12:00:00Z'),fail=false;
 const get=createUnderlyingStrengthService({now:()=>time,fetchImpl:async()=>{calls++;await new Promise(r=>setTimeout(r,5));if(fail)return new Response('blocked',{status:503});return new Response(csv([base]));}});
 const [a,b]=await Promise.all([get('20262027'),get('20262027')]);assert.equal(calls,1);assert.equal(a,b);await get('20262027');assert.equal(calls,1);
 time+=900001;fail=true;await assert.rejects(get('20262027'),/unavailable/);fail=false;await get('20262027');assert.equal(calls,3);
 await assert.rejects(get('20262029'),/Invalid season/);await assert.rejects(get('20262027','BAD'),/Unknown/);
});
