const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
test('right swipe from left edge triggers visible back action; scrolls, controls and cancelled gestures do not',()=>{
 const handlers={};let clicks=0,prevented=0;
 class Element {closest(){return this.control?{}:null}}
 const target=new Element();target.scrollWidth=100;target.clientWidth=100;
 const button={getClientRects:()=>[{}],click:()=>clicks++};
 const document={body:target,getElementById:id=>id==='backToScoreboard'?button:null,addEventListener:(name,handler)=>handlers[name]=handler};
 const source=fs.readFileSync(require.resolve('../app.js'),'utf8').split('const teams=')[0];
 vm.runInNewContext(source,{document,Element,Date,getComputedStyle:()=>({overflowX:'visible'})});
 const touch=(x,y)=>({identifier:1,clientX:x,clientY:y});
 function start(){handlers.touchstart({target,touches:[touch(20,100)]})}
 function move(x,y){handlers.touchmove({touches:[touch(x,y)],cancelable:true,preventDefault:()=>prevented++})}
 function end(x,y){handlers.touchend({changedTouches:[touch(x,y)]})}
 start();move(100,110);end(100,110);assert.equal(clicks,1);assert.equal(prevented,1);
 start();move(25,160);end(100,180);assert.equal(clicks,1);
 target.control=true;start();end(100,100);assert.equal(clicks,1);target.control=false;
 start();handlers.touchcancel();end(100,100);assert.equal(clicks,1);
 start();move(-60,100);end(-60,100);assert.equal(clicks,1);
 handlers.touchstart({target,touches:[touch(120,100)]});end(220,100);assert.equal(clicks,1);
});
