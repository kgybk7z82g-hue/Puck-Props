'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
function setup(){const elements={},get=id=>elements[id]||(elements[id]={innerHTML:'',value:''}),ctx=vm.createContext({$:get,esc:s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;'),status:(id,text)=>{get(id).message=text},busy:()=>{}});vm.runInContext(source.slice(source.indexOf('let strengthData=null'),source.indexOf("$('strengthSeason').innerHTML=")),ctx);return {ctx,get};}
test('strength table renders missing values honestly and escapes source text',()=>{
 const {ctx,get}=setup();ctx.renderStrengthLeague({rows:[{team:'<team>',rank:1,games:3,xGoalsShare:.6,xGoalsForPer60:2,xGoalsAgainstPer60:1,highDangerShotsFor:null,highDangerShotsAgainst:0,finishing:null,goalsPrevented:-1}]});
 const html=get('strengthTable').innerHTML;assert.match(html,/60.0%/);assert.match(html,/&lt;team&gt;/);assert.doesNotMatch(html,/<team>/);assert.match(html,/<td>—<\/td>/);
 ctx.renderStrengthLeague({rows:[]});assert.match(get('strengthTable').innerHTML,/No five-on-five/);assert.equal(get('strengthHighlights').innerHTML,'');
});
test('team trends ignore stale responses and show honest unavailable state',async()=>{
 const {ctx,get}=setup();get('strengthSeason').value='20262027';get('strengthTeam').value='TOR';const pending=[];ctx.fetchJson=()=>new Promise(resolve=>pending.push(resolve));
 const first=ctx.loadStrengthTrend();get('strengthTeam').value='BOS';const second=ctx.loadStrengthTrend();pending[1]({season:null});await second;pending[0]({season:{games:1}});await first;
 assert.match(get('strengthTrendStatus').message,/No valid game history/);assert.equal(get('strengthTrend').innerHTML,'');
});
