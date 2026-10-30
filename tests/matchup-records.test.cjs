'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
test('matchup shows both venue splits and highlights the venue each team plays in',()=>{
 const output={};
 const context=vm.createContext({teamRows:[
  {teamAbbrev:{default:'BOS'},homeWins:4,homeLosses:1,homeOtLosses:0,roadWins:2,roadLosses:3,roadOtLosses:1},
  {teamAbbrev:'TOR',homeWins:6,homeLosses:0,homeOtLosses:1,roadWins:1,roadLosses:4,roadOtLosses:2}
 ],$:()=>output,esc:String});
 vm.runInContext(source.slice(source.indexOf('function matchupSplitRecord'),source.indexOf('function matchupProbabilities')),context);
 context.renderMatchupRecords({awayTeam:{abbrev:'BOS'},homeTeam:{abbrev:'TOR'}});
 assert.match(output.innerHTML,/Home record<\/dt><dd>4–1–0/);
 assert.match(output.innerHTML,/record-current-venue"><dt>Away record<\/dt><dd>2–3–1/);
 assert.match(output.innerHTML,/record-current-venue"><dt>Home record<\/dt><dd>6–0–1/);
 assert.match(output.innerHTML,/Away record<\/dt><dd>1–4–2/);
 assert.equal(context.matchupSplitRecord(null,'home'),'Unavailable');
 assert.equal(context.matchupSplitRecord({homeWins:0,homeLosses:0,homeOtLosses:0},'home'),'0–0–0');
 assert.equal(context.matchupSplitRecord({homeWins:3,homeLosses:1},'home'),'Unavailable');
});
