const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseGoaliePost,mergeGoalies}=require('../goaliepost');
test('GoaliePost parses public Flight data and respects NHL date and explicit status',()=>{
 const game={gameDate:'$D2026-10-06T01:00:00.000Z',teams:{HOME:{team:{abbreviation:'BOS'}}},predictedGoalies:{HOME:[{goalie:{fullName:'Test Goalie'},likeliness:'UNCONFIRMED',timestamp:1791226634}]}};
 const html='<script>self.__next_f.push('+JSON.stringify([1,'32:'+JSON.stringify({games:[game]})+'\n'])+')</script>';
 assert.equal(parseGoaliePost(html,'2026-10-05').BOS.status,'Unconfirmed');
 assert.deepEqual(parseGoaliePost(html,'2026-10-06'),{});
 game.predictedGoalies.HOME.push({goalie:{fullName:'Other Goalie'}});
 const ambiguous='<script>self.__next_f.push('+JSON.stringify([1,'32:'+JSON.stringify({games:[game]})])+')</script>';
 assert.deepEqual(parseGoaliePost(ambiguous,'2026-10-05'),{});
});
test('secondary reports fill gaps, confirm matching names and flag disagreement',()=>{
 const a={team:'BOS',name:'Test Goalie',status:'Likely',source:'Daily Faceoff'},b={...a,status:'Confirmed',source:'GoaliePost'};
 assert.equal(mergeGoalies({BOS:a},{BOS:b}).BOS.source,'GoaliePost');
 assert.equal(mergeGoalies({},{BOS:b}).BOS.status,'Confirmed');
 assert.equal(mergeGoalies({BOS:a},{BOS:{...b,name:'Other Goalie'}}).BOS.status,'Conflicting reports');
});
