'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');

test('server assets, API allowlist, proxy errors and analytics routes',async()=>{
 const port=4184;
 const mock=`global.fetch=async input=>{
  const url=new URL(input),p=url.pathname;
  if(url.hostname==='nhlflights.ca')return Response.json(p.endsWith('/teams')?{teams:[{tri:'TOR',name:'Toronto Maple Leafs'}]}:{flights:[]});
  if(p.includes('/starting-goalies/'))return new Response('<script id="__NEXT_DATA__">'+JSON.stringify({props:{pageProps:{data:[]}}})+'</script>');
  if(p.includes('/player/999/'))throw Error('Simulated upstream failure');
  if(p.includes('/player/998/'))return new Response(JSON.stringify({error:'Unavailable'}),{status:503,headers:{'Content-Type':'application/json'}});
  if(p.includes('/roster/TOR/current'))return Response.json({forwards:[{id:8478402},{id:3}],defensemen:[],goalies:[]});
  if(p.includes('/club-schedule-season/'))return Response.json({games:[]});
  if(p.includes('/search/player')){if(url.searchParams.get('active')!=='true')throw Error('Active player filter missing');return Response.json([{playerId:8478402,name:'Test Player',teamAbbrev:'TOR',active:true},{playerId:2,name:'Prospect',teamAbbrev:'TOR',active:true},{playerId:3,name:'Retired',teamAbbrev:'TOR',active:false}]);}
  return Response.json({games:[],standings:[],gameLog:[],forwards:[],playerByGameStats:{}});
 };require('./server.js');`;
 const child=spawn(process.execPath,['-e',mock],{cwd:path.resolve(__dirname,'..'),env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server did not start')),5000);child.stdout.once('data',()=>{clearTimeout(timer);resolve()});child.once('exit',code=>{clearTimeout(timer);reject(Error('Server exited '+code))})});
  const base='http://127.0.0.1:'+port;
  for(const route of ['/','/index.html','/app.js?v=24','/matchup.js?v=55','/sw.js','/manifest.json','/icon.svg','/api/health','/api/top-ten','/api/win-projections/2026-10-02','/api/player-search?q=Test','/api/nhl/v1/score/2026-10-02','/api/nhl/v1/standings/now','/api/nhl/v1/player/8478402/landing','/api/nhl/v1/player/8478402/game-log/20262027/2','/api/nhl/v1/roster/TOR/current','/api/nhl/v1/club-schedule-season/TOR/20262027','/api/nhl/v1/gamecenter/2026020001/boxscore','/api/starting-goalies/2026-10-02','/api/team-defense/TOR/20262027','/api/team-special-stats/TOR/20262027']){
   const r=await fetch(base+route);assert.equal(r.status,200,route);assert.equal(r.headers.get('x-content-type-options'),'nosniff');
   if(route.startsWith('/api/'))assert.equal(typeof await r.json(),'object',route);
  }
  const search=await(await fetch(base+'/api/player-search?q=Test')).json();assert.deepEqual(search.map(p=>p.playerId),[8478402]);
  const defense=await(await fetch(base+'/api/team-defense/TOR/20262027')).json();assert.equal(defense.gamesProcessed,0);assert.equal(defense.allowed.Forwards.shots,0);
  const travel=await(await fetch(base+'/api/travel?team=TOR')).json();assert.equal(travel.team,'TOR');assert.deepEqual(travel.flights,[]);assert.equal(travel.recoveryHours,null);
  assert.equal((await fetch(base+'/api/travel?team=BAD')).status,400);
  assert.equal((await fetch(base+'/api/travel?team=TOR&player=oops')).status,400);
  const special=await(await fetch(base+'/api/team-special-stats/TOR/20262027')).json();assert.equal(special.gamesProcessed,0);assert.deepEqual(special.emptyNetLeaders,[]);
  for(const route of ['/api/nhl/v1/arbitrary','/api/nhl/v1/player/bad/landing','/api/player-search?q=a'])assert.equal((await fetch(base+route)).status,400,route);
  assert.equal((await fetch(base+'/missing')).status,404);
  assert.equal((await fetch(base+'/',{method:'POST'})).status,405);
  assert.equal((await fetch(base+'/api/nhl/v1/player/999/landing')).status,502);
  assert.equal((await fetch(base+'/api/nhl/v1/player/998/landing')).status,503);
  assert.equal((await fetch(base+'/api/odds/daily-picks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:'2026-10-02'})})).status,405);
 }finally{child.kill();await new Promise(resolve=>child.once('exit',resolve))}
});
