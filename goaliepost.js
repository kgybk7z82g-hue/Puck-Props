'use strict';
function parseGoaliePost(html,date) {
 const chunks=[];
 for(const match of html.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g)) {
  try {const data=JSON.parse(match[1]);if(data[0]===1&&typeof data[1]==='string')chunks.push(data[1]);}catch{}
 }
 const reports={};
 const visit=value=>{
  if(!value||typeof value!=='object')return;
  if(value.predictedGoalies&&value.teams){
   const raw=String(value.gameDate||'').replace(/^\$D/,'');
   const parsed=new Date(raw);
   if(!Number.isFinite(parsed.getTime()))return;
   const gameDate=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(parsed);
   if(gameDate!==date)return;
   for(const side of ['HOME','AWAY']){
    const team=value.teams[side]?.team?.abbreviation;
    const candidates=value.predictedGoalies[side]||[];
    if(!/^[A-Z]{3}$/.test(team||'')||candidates.length!==1)continue;
    const report=candidates[0],name=report.goalie?.fullName;
    if(!name)continue;
    const status=report.likeliness==='CONFIRMED'?'Confirmed':['LIKELY','PROBABLE'].includes(report.likeliness)?'Likely':'Unconfirmed';
    reports[team]={team,name,status,source:'GoaliePost',sourceUrl:'https://goaliepost.com/',updatedAt:Number.isFinite(report.timestamp)?new Date(report.timestamp*1000).toISOString():null};
   }
   return;
  }
  for(const child of Object.values(value))visit(child);
 };
 // Flight records can be split across script tags. Parse JSON records only; never execute page code.
 for(const line of [...chunks.flatMap(chunk=>chunk.split('\n')),...chunks.join('').split('\n')]){
  const colon=line.indexOf(':');if(colon<0)continue;
  const json=line.slice(colon+1);if(!/^[\[{]/.test(json))continue;
  try{visit(JSON.parse(json));}catch{}
 }
 return reports;
}
function mergeGoalies(primary,secondary){
 const result={};
 for(const team of new Set([...Object.keys(primary),...Object.keys(secondary)])){
  const a=primary[team],b=secondary[team];
  if(!a){result[team]=b;continue}if(!b){result[team]=a;continue}
  const same=a.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()===b.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(!same)result[team]={...a,status:'Conflicting reports',alternate:b};
  else result[team]={...(b.status==='Confirmed'&&a.status!=='Confirmed'?b:a),corroboration:b.status==='Confirmed'&&a.status==='Confirmed'?'Confirmed by both sources':`${a.source}: ${a.status}; ${b.source}: ${b.status}`};
 }
 return result;
}
module.exports={parseGoaliePost,mergeGoalies};
