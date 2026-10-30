'use strict';
function rankGoalLeaders(rows,metric){
 const sorted=rows.filter(p=>Number.isFinite(p[metric])&&p[metric]>0).sort((a,b)=>b[metric]-a[metric]||a.skaterFullName.localeCompare(b.skaterFullName)||a.playerId-b.playerId);
 let rank=0;
 return sorted.slice(0,20).map((p,i)=>{if(!i||p[metric]!==sorted[i-1][metric])rank=i+1;return {id:p.playerId,name:p.skaterFullName,team:p.teamAbbrevs,goals:p[metric],rank};});
}
function createGoalLeadersService({get}){
 const cache=new Map();
 return async season=>{
  const cached=cache.get(season);if(cached?.promise)return cached.promise;if(cached?.expires>Date.now())return cached.value;
  const promise=(async()=>{
   const data=await get('https://api.nhle.com/stats/rest/en/skater/realtime?isAggregate=false&isGame=false&start=0&limit=-1&cayenneExp=seasonId='+season+'%20and%20gameTypeId=2');
   if(!Array.isArray(data.data)||(Number.isFinite(data.total)&&data.data.length<data.total))throw Error('Complete NHL goal statistics are unavailable. Please refresh to retry.');
   const value={season,overtime:rankGoalLeaders(data.data,'otGoals'),emptyNet:rankGoalLeaders(data.data,'emptyNetGoals'),updatedAt:new Date().toISOString()};
   cache.set(season,{value,expires:Date.now()+300000});return value;
  })();cache.set(season,{promise});try{return await promise}catch(e){cache.delete(season);throw e}
 };
}
module.exports={rankGoalLeaders,createGoalLeadersService};
