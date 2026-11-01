'use strict';

const HOUR=3600000;
const aliases={COL:['avs'],MTL:['habs'],PIT:['pens'],TBL:['bolts'],WSH:['caps'],OTT:['sens'],CAR:['canes']};
const categories={
 weather:/\b(weather|snow(?:storm)?|blizzard|storm|ice storm|fog|hurricane|tornado|freezing|de-icing|deicing)\b/i,
 mechanical:/\b(mechanical|maintenance|engine|aircraft issue|plane issue|equipment problem)\b/i,
 customs:/\b(customs|immigration|border|passport|visa)\b/i,
 disruption:/\b(delay(?:ed|s)?|strand(?:ed)?|cancel(?:led|ed|lation)?|divert(?:ed)?|ground(?:ed|ing)|postpon(?:ed|ement)|stuck)\b/i,
 arrival:/\b(late arrival|arrived late|overnight|early morning|hotel at|landed at|arrived at|missed.*(?:skate|practice)|cancel(?:led|ed).*morning skate)\b/i
};
function decode(value=''){
 return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,' ').replace(/&#(x[\da-f]+|\d+);/gi,(_,n)=>{const code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return code>0&&code<=0x10ffff?String.fromCodePoint(code):'';}).replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,m=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '})[m]).replace(/\s+/g,' ').trim();
}
function safeUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
function parseFeed(xml){
 if(!/<(?:rss|feed)\b/i.test(xml))throw Error('Search feed format unavailable');
 return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].slice(0,100).map(([,item])=>{
  const tag=name=>{const match=item.match(new RegExp('<'+name+'\\b[^>]*>([\\s\\S]*?)</'+name+'>','i'));return decode(match?.[1]||'');};
  const source=item.match(/<source\b[^>]*url=["']([^"']+)["']/i);
  return {title:tag('title'),snippet:tag('description').slice(0,700),url:safeUrl(tag('link')),publishedAt:tag('pubDate'),publisher:tag('source'),publisherUrl:safeUrl(decode(source?.[1]||''))};
 }).filter(r=>r.title&&r.url);
}
function classify(title){
 const tags=Object.entries(categories).filter(([,pattern])=>pattern.test(title)).map(([name])=>name);
 // A weather forecast alone is not a report about team travel.
 const travel=/\b(flight|fly|flying|plane|aircraft|airport|travel|trip|bus|customs|immigration|border|passport|visa|hotel|arriv|landed|morning skate)\w*/i.test(title);
 return travel&&tags.some(t=>['disruption','arrival','customs','mechanical'].includes(t))?tags:[];
}
function normalizeReports(rows,{now,teams}){
 const reports=new Map();
 for(const row of rows){
  const text=row.title+' '+(row.snippet||'');
  const time=Date.parse(row.publishedAt),tags=classify(text);
  if(!Number.isFinite(time)||time<now-72*HOUR||time>now+5*60000||!tags.length)continue;
  const normalized=row.title.toLowerCase().replace(/\s+-\s+[^-]+$/,'').replace(/[^a-z0-9]+/g,' ').trim();
  const matched=[...teams].filter(([name,code])=>{
   const lower=text.toLowerCase();return lower.includes(name)||[name.split(' ').slice(-1)[0],...(aliases[code]||[])].some(alias=>new RegExp('\\b'+alias+'\\b','i').test(lower));
  }).map(([,code])=>code);
  if(!matched.length&&!/\b(NHL|hockey)\b/i.test(text))continue;
  const key=normalized;
  if(!reports.has(key))reports.set(key,{title:row.title,snippet:row.snippet||'',tags,teams:matched,publishedAt:new Date(time).toISOString(),verification:'Unverified search lead',eventTime:null,gameMatch:'Not confirmed — publication time is not incident time',sources:[]});
  const report=reports.get(key);
  if(!report.sources.some(s=>s.url===row.url))report.sources.push({url:row.url,publisher:row.publisher||'Publisher not supplied',publisherUrl:row.publisherUrl,searchProvider:row.searchProvider});
 }
 return [...reports.values()].sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
}
function searchLinks(subject){
 const terms=`${subject} (flight OR travel OR customs) (delay OR mechanical OR weather OR stranded OR "arrived late")`;
 return [
  {label:'Google News',url:'https://news.google.com/search?q='+encodeURIComponent(terms+' when:3d')},
  {label:'X · latest posts',url:'https://x.com/search?q='+encodeURIComponent(terms+' -filter:retweets')+'&f=live'},
  {label:'Bluesky posts',url:'https://bsky.app/search?q='+encodeURIComponent(subject+' travel delay')},
  {label:'Reddit · newest',url:'https://www.reddit.com/search/?q='+encodeURIComponent(subject+' travel delay')+'&sort=new&t=week'},
  {label:'Indexed reporter / social posts',url:'https://www.google.com/search?q='+encodeURIComponent(subject+' (flight OR customs OR travel) (delay OR mechanical OR weather OR stranded) (site:x.com OR site:bsky.app OR site:threads.net)')}
 ];
}
function createDisruptionService({teams,getNhl,fetchText=async url=>{
 const response=await fetch(url,{headers:{Accept:'application/rss+xml, application/xml, text/xml','User-Agent':'PuckProps/1.0'},signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('Search provider returned HTTP '+response.status);
 const body=await response.text();if(body.length>2000000)throw Error('Search feed too large');return body;
},now=()=>Date.now()}){
 const cache=new Map(),pending=new Map();
 return async function getDisruptions(team=''){
  const name=[...teams].find(([,code])=>code===team)?.[0];
  if(team&&!name)throw Error('Unknown NHL team.');
  const stamp=now(),cached=cache.get(team);
  if(cached&&cached.expires>stamp)return cached.value;
  if(pending.has(team))return pending.get(team);
  const work=(async()=>{
   const subject=name?'"'+name+'"':'NHL hockey';
   const queries=[
    {provider:'Google News · travel disruptions',q:`${subject} (flight OR travel OR plane OR customs) (delay OR mechanical OR weather OR stranded OR diverted OR cancelled) when:3d`},
    {provider:'Google News · arrivals and practice',q:`${subject} ("arrived late" OR "late arrival" OR "hotel at" OR "morning skate" OR "travel issues" OR "travel problems") when:3d`},
    {provider:'Bing · news and indexed posts',q:`${subject} (flight OR customs OR travel) (delay OR stranded OR mechanical OR weather)`}
   ];
   // Team names catch local coverage whose headline never mentions "NHL".
   if(!team){
    const names=[...teams.keys()];
    for(let i=0;i<names.length;i+=4)queries.push({provider:'Google News · '+names.slice(i,i+4).join(', '),q:`(${names.slice(i,i+4).map(n=>'"'+n+'"').join(' OR ')}) ("flight delay" OR "travel delay" OR mechanical OR customs OR stranded OR "arrived late" OR "late arrival" OR "travel issues" OR "cancelled flight" OR "weather delay" OR "morning skate") when:3d`});
   }
   queries.push({provider:'Bing · indexed social posts',q:`${subject} (flight OR customs OR travel) (delay OR mechanical OR stranded OR weather) (site:x.com OR site:bsky.app OR site:threads.net)`});
   const results=new Array(queries.length);let cursor=0;
   const scan=async()=>{while(cursor<queries.length){const index=cursor++,query=queries[index];try{
     const url=query.provider.startsWith('Bing')?'https://www.bing.com/search?format=rss&q='+encodeURIComponent(query.q):'https://news.google.com/rss/search?hl=en-CA&gl=CA&ceid=CA:en&q='+encodeURIComponent(query.q);
     results[index]={status:'fulfilled',value:parseFeed(await fetchText(url)).map(row=>({...row,searchProvider:query.provider}))};
    }catch{results[index]={status:'rejected'};}}};
   const [feeds,schedule]=await Promise.all([
    Promise.all(Array.from({length:Math.min(6,queries.length)},scan)).then(()=>results),
    Promise.resolve().then(()=>getNhl('/schedule/now')).then(data=>{if(!Array.isArray(data.gameWeek))throw Error('Schedule unavailable');return data.gameWeek.flatMap(day=>day.games||[]).filter(g=>Date.parse(g.startTimeUTC)>stamp&&Date.parse(g.startTimeUTC)<=stamp+48*HOUR&&!['OFF','FINAL'].includes(g.gameState)&&(!team||g.homeTeam?.abbrev===team||g.awayTeam?.abbrev===team));}).then(games=>({games}),()=>({games:[],error:'Upcoming schedule unavailable'}))
   ]);
   const coverage=feeds.map((feed,i)=>({name:queries[i].provider,status:feed.status==='fulfilled'?'Available':'Unavailable',results:feed.status==='fulfilled'?feed.value.length:0}));
   const reports=normalizeReports(feeds.flatMap(f=>f.status==='fulfilled'?f.value:[]),{now:stamp,teams}).filter(r=>!team||r.teams.includes(team)).map(report=>({...report,candidateGames:schedule.games.filter(g=>report.teams.includes(g.homeTeam?.abbrev)||report.teams.includes(g.awayTeam?.abbrev)).map(g=>({id:g.id,home:g.homeTeam.abbrev,away:g.awayTeam.abbrev,startTimeUTC:g.startTimeUTC}))}));
   const value={team:team||null,subject,checkedAt:new Date(stamp).toISOString(),lookbackHours:72,reports,upcomingGames:schedule.games,coverage,partial:feeds.some(f=>f.status==='rejected'),unavailable:feeds.every(f=>f.status==='rejected'),warnings:[...(schedule.error?[schedule.error]:[]),'Social feeds are not directly ingested. Public posts may appear in search; use the social links to check writers directly.','Headlines are screened automatically. Incident dates, affected team and relevance to the upcoming game require source review. No result does not mean travel was normal.'],searchLinks:searchLinks(subject)};
   // Failed searches retry promptly; successful results are shared for five minutes.
   cache.set(team,{value,expires:stamp+(value.partial?60000:300000)});
   return value;
  })();
  pending.set(team,work);try{return await work;}finally{pending.delete(team);}
 };
}
module.exports={parseFeed,classify,normalizeReports,searchLinks,createDisruptionService};
