'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseFeed,classify,normalizeReports,createDisruptionService}=require('../disruptions');
const now=Date.parse('2026-11-01T16:00:00Z');
const teams=new Map([['colorado avalanche','COL'],['calgary flames','CGY']]);
const row={title:'Colorado Avalanche flight delayed by mechanical problems',url:'https://example.com/story',publishedAt:new Date(now-3600000).toUTCString(),publisher:'Local writer'};
const feed=(r=row)=>`<rss><channel><item><title><![CDATA[${r.title}]]></title><link>${r.url}</link><pubDate>${r.publishedAt}</pubDate><source url="https://example.com">Local &amp; trusted</source></item></channel></rss>`;
test('RSS parser decodes titles and publisher, rejects unsafe links and malformed responses',()=>{
 const parsed=parseFeed(feed());assert.equal(parsed[0].publisher,'Local & trusted');assert.equal(parsed[0].publisherUrl,'https://example.com/');
 assert.equal(parseFeed(feed({...row,url:'javascript:alert(1)'})).length,0);
 assert.throws(()=>parseFeed('<html>Rate limited</html>'),/format/);
 assert.equal(parseFeed('<rss><channel /></rss>').length,0);
});
test('disruption categories require travel context and exclude weather-only or game penalty headlines',()=>{
 assert.deepEqual(classify('Snowstorm forecast for Calgary Flames game'),[]);
 assert.deepEqual(classify('Avalanche delayed penalty results in goal'),[]);
 assert.ok(classify(row.title).includes('mechanical'));
 assert.ok(classify('Flames stuck at customs overnight').includes('customs'));
 assert.ok(classify('Avalanche arrived late after flight diverted by storm').includes('weather'));
 assert.ok(classify('Flames missed morning skate after travel problems').includes('arrival'));
});
test('reports enforce publication window, deduplicate headlines and never claim verified incidents',()=>{
 const reports=normalizeReports([row,{...row,url:'https://another.example/story'}, {...row,publishedAt:'invalid'}, {...row,publishedAt:new Date(now-73*3600000).toISOString()}, {...row,publishedAt:new Date(now+3600000).toISOString()}],{now,teams});
 assert.equal(reports.length,1);assert.equal(reports[0].sources.length,2);assert.deepEqual(reports[0].teams,['COL']);assert.equal(reports[0].eventTime,null);assert.equal(reports[0].verification,'Unverified search lead');
});
test('service shares concurrent requests, filters next 48 hours and retains partial coverage',async()=>{
 let calls=0;
 const service=createDisruptionService({teams,now:()=>now,fetchText:async url=>{calls++;if(url.includes('bing.com'))throw Error('offline');return feed();},getNhl:async()=>({gameWeek:[{games:[{id:1,awayTeam:{abbrev:'COL'},homeTeam:{abbrev:'CGY'},startTimeUTC:new Date(now+3600000).toISOString(),gameState:'FUT'},{id:2,startTimeUTC:new Date(now+50*3600000).toISOString(),gameState:'FUT'}]}]})});
 const [a,b]=await Promise.all([service('COL'),service('COL')]);assert.equal(a,b);assert.equal(calls,4);assert.equal(a.reports.length,1);assert.equal(a.partial,true);assert.equal(a.unavailable,false);assert.equal(a.upcomingGames.length,1);assert.equal(a.searchLinks.length,5);
 await service('COL');assert.equal(calls,4);await assert.rejects(service('INVALID'),/Unknown/);
});
test('all failed sources are reported as unavailable, not a successful clear result; failures retry',async()=>{
 let clock=now,fail=true;
 const service=createDisruptionService({teams,now:()=>clock,fetchText:async()=>{if(fail)throw Error('offline');return feed();},getNhl:async()=>{throw Error('offline');}});
 const a=await service();assert.equal(a.unavailable,true);assert.equal(a.partial,true);assert.ok(a.warnings.includes('Upcoming schedule unavailable'));
 fail=false;clock+=61000;const b=await service();assert.equal(b.unavailable,false);assert.equal(b.reports.length,1);assert.equal(b.coverage.length,5);
});
test('team searches exclude other-team headlines',async()=>{
 const service=createDisruptionService({teams,now:()=>now,fetchText:async()=>feed(),getNhl:async()=>({gameWeek:[]})});
 assert.equal((await service('CGY')).reports.length,0);
});
test('feed excerpts catch travel details outside the headline and aliases identify teams',()=>{
 const reports=normalizeReports([{...row,title:'Avs pregame notebook',snippet:'The team was stuck at customs after its flight.'}],{now,teams});
 assert.equal(reports.length,1);assert.deepEqual(reports[0].teams,['COL']);assert.ok(reports[0].tags.includes('customs'));
 assert.equal(normalizeReports([{...row,title:'Holiday flight delayed by storm',snippet:'Airport update'}],{now,teams}).length,0);
});
test('watch UI escapes search content and distinguishes unavailable sources',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../app.js'),'utf8');
 const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',addEventListener(){}});return nodes.get(id);};
 let data={coverage:[],upcomingGames:[],warnings:[],reports:[{...row,title:'<img src=x onerror=alert(1)>',verification:'Unverified',tags:['mechanical'],teams:['COL'],gameMatch:'Not confirmed',snippet:'<script>bad</script>',sources:[{url:'https://example.com/',publisher:'Writer',searchProvider:'Test'}]}],searchLinks:[],checkedAt:new Date(now).toISOString(),lookbackHours:72};
 const context=vm.createContext({$,teams:[['COL','Colorado Avalanche']],esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),busy(){},status:(id,text)=>{$(id).textContent=text;},document:{querySelectorAll:()=>[]},fetchJson:async()=>data,travelTime:s=>s,setInterval(){},clearInterval(){}});
 vm.runInContext(source.slice(source.indexOf('let disruptionRequest='),source.indexOf('let travelRequest=')),context);
 await context.loadDisruptions();assert.ok($('disruptionReports').innerHTML.includes('&lt;img'));assert.ok(!$('disruptionReports').innerHTML.includes('<script>'));
 data={...data,reports:[],unavailable:true,partial:true};await context.loadDisruptions();assert.match($('disruptionReports').innerHTML,/unavailable/);assert.match($('disruptionStatus').textContent,/Coverage incomplete/);
});
