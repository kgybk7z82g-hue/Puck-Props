'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {parseMoneyPuck,parsePuckCast,parsePodium,averageForGames,getWinProjections}=require('../projections');
const fixture=name=>fs.readFileSync(path.join(__dirname,'fixtures',name),'utf8');
const game={id:2026020040,homeTeam:{abbrev:'TBL'},awayTeam:{abbrev:'PHI'},startTimeUTC:'2026-10-05T23:00:00Z'};
test('verified provider formats preserve home/away orientation and aliases',()=>{
 const mp=parseMoneyPuck(fixture('moneypuck-preview.html'));assert.equal(mp.length,1);assert.equal(mp[0].homeTeam,'TBL');assert.ok(Math.abs(mp[0].home-.638)<1e-10);
 const pc=parsePuckCast(fixture('puckcast-card.html'));assert.equal(pc.length,1);assert.equal(pc[0].homeTeam,'NYR');assert.ok(Math.abs(pc[0].home-.421)<1e-10);
 const po=parsePodium(JSON.parse(fixture('podium-slate.json')));assert.equal(po[0].homeTeam,'TBL');assert.equal(po[0].home,.6427);
 assert.equal(parseMoneyPuck(fixture('moneypuck-preview.html').replaceAll('preview.htm','g.htm')).length,0);
 assert.equal(parseMoneyPuck(fixture('moneypuck-preview.html').replace('63.8%','98%')).length,0);
 assert.equal(parsePodium({slate:[{home:'TB',away:'PHI',p:[.6,.1,.3]}]}).length,0);
});
test('average counts each source once and requires exact fixture identity',()=>{
 const row={id:String(game.id),homeTeam:'TBL',awayTeam:'PHI',home:.6,away:.4};
 const feeds=[{name:'A',rows:[row]},{name:'B',rows:[{...row,home:.7,away:.3}]},{name:'wrong day',rows:[{...row,id:undefined,startTimeUTC:'2026-10-06T23:00Z'}]},{name:'duplicate',rows:[row,row]}];
 const result=averageForGames([game],feeds)[game.id];assert.equal(result.sourceCount,2);assert.ok(Math.abs(result.home-.65)<1e-10);assert.equal(result.away,1-result.home);
 assert.equal(averageForGames([game],[])[game.id].home,null);
});
test('one failed provider does not prevent remaining providers contributing',async()=>{
 const response=await getWinProjections('2026-10-05',[game],async url=>{
  if(url.includes('moneypuck'))return new Response(fixture('moneypuck-preview.html'));
  if(url.includes('puckcast'))throw Error('Unavailable');
  return new Response(fixture('podium-slate.json'));
 });
 assert.equal(response.games[game.id].sourceCount,2);assert.equal(response.providers.find(p=>p.name==='PuckCast').status,'unavailable');
 assert.ok(Math.abs(response.games[game.id].home-(.638+.6427)/2)<1e-10);
});
