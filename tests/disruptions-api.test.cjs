'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
test('disruption endpoint validates teams and serves source evidence with upcoming game context',async()=>{
 const port=4196;
 const mock=`global.fetch=async input=>{const url=new URL(input);if(url.hostname==='news.google.com'||url.hostname==='www.bing.com')return new Response('<rss><channel><item><title>Avalanche flight delayed by mechanical issue</title><link>https://example.com/report</link><pubDate>'+new Date().toUTCString()+'</pubDate><source>Local writer</source></item></channel></rss>');if(url.pathname==='/v1/schedule/now')return Response.json({gameWeek:[{games:[{id:123,homeTeam:{abbrev:'COL'},awayTeam:{abbrev:'CGY'},startTimeUTC:new Date(Date.now()+3600000).toISOString(),gameState:'FUT'}]}]});throw Error('Unexpected upstream request');};require('./server.js');`;
 const child=spawn(process.execPath,['-e',mock],{cwd:path.resolve(__dirname,'..'),env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 const base='http://127.0.0.1:'+port;let error='';child.stderr.on('data',data=>error+=data);
 try{
  let ready=false;for(let i=0;i<40;i++){try{await fetch(base+'/');ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,50));}}
  assert.ok(ready,error||'Server did not start');
  assert.equal((await fetch(base+'/api/disruptions?team=BAD')).status,400);
  const response=await fetch(base+'/api/disruptions?team=COL');assert.equal(response.status,200);
  const data=await response.json();assert.equal(data.reports.length,1);assert.equal(data.partial,false);assert.equal(data.coverage.length,4);assert.equal(data.reports[0].candidateGames[0].id,123);assert.equal(data.reports[0].sources[0].url,'https://example.com/report');
  const html=await(await fetch(base+'/')).text();assert.match(html,/Pregame Disruption Watch/);assert.match(html,/id="disruptionTeam"/);
 }finally{child.kill();if(child.exitCode===null)await new Promise(resolve=>child.once('exit',resolve));}
});
