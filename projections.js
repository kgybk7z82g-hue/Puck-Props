'use strict';
const aliases={TB:'TBL',LA:'LAK',SJ:'SJS',NJ:'NJD',WAS:'WSH',MON:'MTL',UTAH:'UTA'};
const team=value=>aliases[String(value).toUpperCase()]||String(value).toUpperCase();
function validPair(home,away){return typeof home==='number'&&typeof away==='number'&&Number.isFinite(home)&&Number.isFinite(away)&&home>0&&home<1&&away>0&&away<1&&Math.abs(home+away-1)<.015}
function parseMoneyPuck(html){
 const rows=[];
 for(const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const block=match[1],id=block.match(/preview\.htm\?id=(\d{10})/i)?.[1];
  // Only preview rows: live/postgame MoneyPuck percentages have a different meaning.
  if(!id||/\b(?:Final|Intermission|Deserve To Win)\b/i.test(block))continue;
  const clubs=[...block.matchAll(/logos\/([A-Z]{2,4})\.png/gi)].map(x=>team(x[1]));
  const percentages=[...block.matchAll(/<h2\b[^>]*>\s*(\d+(?:\.\d+)?)%\s*<\/h2>/gi)].map(x=>Number(x[1])/100);
  if(clubs.length!==2||percentages.length!==2||!validPair(percentages[1],percentages[0]))continue;
  rows.push({id,awayTeam:clubs[0],homeTeam:clubs[1],home:percentages[1],away:percentages[0]});
 }
 return rows;
}
function parsePuckCast(html){
 const rows=[];
 for(const match of html.matchAll(/<a\b[^>]*href="\/matchup\/(\d{10})"[^>]*>([\s\S]*?)<\/a>/gi)){
  const block=match[2];if(!/class="tpc"/.test(match[0]))continue;
  const clubs=[...block.matchAll(/<b>([A-Z]{2,4})<\/b>/g)].map(x=>team(x[1]));
  const bar=block.match(/class="tpc__bar"[^>]*>([\s\S]*?)<\/div>/)?.[1]||'';
  const probabilities=[...bar.matchAll(/width:(\d+(?:\.\d+)?)%/g)].map(x=>Number(x[1])/100);
  if(clubs.length===2&&probabilities.length===2&&validPair(probabilities[1],probabilities[0]))rows.push({id:match[1],awayTeam:clubs[0],homeTeam:clubs[1],home:probabilities[1],away:probabilities[0]});
 }
 return rows;
}
function parsePodium(data){
 if(!Array.isArray(data.slate))throw Error('Projection format unavailable');
 return data.slate.filter(g=>!g.done&&Array.isArray(g.p)&&g.p[1]===0&&validPair(g.p[0],g.p[2])).map(g=>({homeTeam:team(g.home),awayTeam:team(g.away),startTimeUTC:g.time,home:g.p[0],away:g.p[2],publishedAt:data.meta?.generated_at}));
}
function averageForGames(games,feeds){
 return Object.fromEntries(games.map(game=>{
  const sources=[];
  for(const feed of feeds){
   const matches=feed.rows.filter(row=>row.homeTeam===game.homeTeam?.abbrev&&row.awayTeam===game.awayTeam?.abbrev&&(row.id?row.id===String(game.id):Number.isFinite(Date.parse(row.startTimeUTC))&&Math.abs(Date.parse(row.startTimeUTC)-Date.parse(game.startTimeUTC))<=2*60*60*1000));
   if(matches.length!==1)continue;
   const row=matches[0];if(!validPair(row.home,row.away))continue;
   sources.push({name:feed.name,url:feed.url,home:row.home/(row.home+row.away),away:row.away/(row.home+row.away),fetchedAt:feed.fetchedAt,publishedAt:row.publishedAt||null});
  }
  const home=sources.length?sources.reduce((sum,s)=>sum+s.home,0)/sources.length:null;
  return [String(game.id),{home,away:home===null?null:1-home,sourceCount:sources.length,sources,spread:sources.length?Math.max(...sources.map(s=>s.home))-Math.min(...sources.map(s=>s.home)):null}];
 }));
}
const sourceCache=new Map();
async function getWinProjections(date,games,fetcher=fetch){
 const key=date,cached=sourceCache.get(key);let feeds;
 if(cached?.expires>Date.now())feeds=cached.feeds;
 else{
  const specs=[{name:'MoneyPuck',url:`https://moneypuck.com/?date=${date}`,feed:`https://moneypuck.com/moneypuck/dates/${date.replaceAll('-','')}.htm`,parse:parseMoneyPuck},{name:'PuckCast',url:'https://puckcast.ai/',feed:'https://puckcast.ai/',parse:parsePuckCast},{name:'PodiumOracle',url:'https://podiumoracle.com/nhl',feed:'https://podiumoracle.com/data/nhl.json',parse:text=>parsePodium(JSON.parse(text))}];
  feeds=await Promise.all(specs.map(async spec=>{try{
   const response=await fetcher(spec.feed,{headers:{Accept:'text/html,application/json','User-Agent':'PuckProps/1.0'},signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error(`HTTP ${response.status}`);
   const text=await response.text();if(text.length>3000000)throw Error('Projection response too large');
   const rows=spec.parse(text);return {name:spec.name,url:spec.url,rows,status:rows.length?'available':'no projections',fetchedAt:new Date().toISOString()};
  }catch{return {name:spec.name,url:spec.url,rows:[],status:'unavailable',fetchedAt:new Date().toISOString()}}}));
  sourceCache.set(key,{feeds,expires:Date.now()+ (feeds.some(f=>f.status==='unavailable')?60000:300000)});
  if(sourceCache.size>10)sourceCache.delete(sourceCache.keys().next().value);
 }
 return {date,updatedAt:new Date().toISOString(),method:'Equal average of available external pregame models; overtime included',games:averageForGames(games,feeds),providers:feeds.map(({rows,...meta})=>({...meta,projectionCount:rows.length}))};
}
module.exports={parseMoneyPuck,parsePuckCast,parsePodium,averageForGames,getWinProjections};
