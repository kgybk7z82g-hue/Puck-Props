'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
test('Matchup History shows both panels and ENG/OT navigation hides them',()=>{
 const elements={},make=()=>({classList:{values:new Set(['hidden']),contains(x){return this.values.has(x)},toggle(x,on){if(on)this.values.add(x);else this.values.delete(x)}},setAttribute(){},removeAttribute(){},dataset:{},addEventListener(e,fn){this.click=fn}});
 for(const id of ['scores','picks','bets','travel','sameDay','topTen','firstGoals','goalLeaders','history','teams','powerRankings','player'])elements[id]=make();
 const tabs=['history','goalLeaders'].map(id=>{const b=make();b.dataset.tab=id;return b});const context=vm.createContext({$:id=>elements[id],document:{querySelectorAll:()=>tabs}});
 vm.runInContext(source.split('\n').find(line=>line.startsWith("document.querySelectorAll('[data-tab]').forEach(b=>")),context);
 tabs[0].click();assert.equal(elements.history.classList.contains('hidden'),false);assert.equal(elements.player.classList.contains('hidden'),false);
 tabs[1].click();assert.equal(elements.goalLeaders.classList.contains('hidden'),false);assert.equal(elements.player.classList.contains('hidden'),true);assert.equal(elements.history.classList.contains('hidden'),true);
 assert.doesNotMatch(fs.readFileSync('index.html','utf8'),/data-tab="player"/);
});
test('shared player selection updates stats and matchup selections and loads stats once',()=>{
 const elements={},selections={stats:null,history:null};let loads=0;const context=vm.createContext({playerSelections:selections,$:id=>elements[id]||(elements[id]={}),loadPlayerStats:()=>loads++});
 vm.runInContext(source.slice(source.indexOf('function selectPlayer'),source.indexOf("setupSearch('statsPlayerSearch'")),context);
 const p={id:1,name:'Test Player',team:'TOR'};context.selectPlayer('history',p);assert.equal(selections.stats,p);assert.equal(selections.history,p);assert.equal(loads,1);assert.equal(elements.statsPlayerSearch.value,p.name);
});
