import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { chromium, webkit } from 'playwright';

const box={};box.globalThis=box;
vm.runInNewContext(fs.readFileSync('adventure-v35.js','utf8'),box);
const A=box.FishmanAdventureV35;
// Unit test: after two real enemy defeats the forest objective advances.
{
 const m=A.create(1,0),first=m.nodes[0],clearing=m.nodes[1];
 A.finish(m,first);
 const start=A.interact(m,clearing.x,clearing.y);
 assert.equal(start.started,true,'clearing should start when B is pressed');
 assert.equal(clearing.enemiesDefeated,0);
 clearing.enemiesDefeated=2;
 const events=A.update(m,.025,[],0,[],0);
 assert.equal(clearing.done,true,'clearing must finish when both attackers die');
 assert.equal(events.filter(e=>e.type==='complete').length,1);
 assert.equal(A.next(m).kind,'shoot');
 // Other defend objectives keep their original stay-and-protect mechanic.
 const sharks=A.create(2,0);A.finish(sharks,sharks.nodes[0]);A.finish(sharks,sharks.nodes[1]);
 A.interact(sharks,sharks.nodes[2].x,sharks.nodes[2].y);
 assert.equal(sharks.nodes[2].done,false,'other defence objective changed unexpectedly');
}
console.log('PASS woodland mission state: two kills complete, other defences unchanged');

for(const [label,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true,args:label==='Chromium'?['--no-sandbox','--disable-dev-shm-usage']:[]});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:820},hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:8765/v35-full-v16-4p/?test=1',
      {waitUntil:'domcontentloaded',timeout:35000});
   await page.waitForFunction(()=>!!window.FishmanLocal?.addPlayer&&!!window.fishmanTest&&
     !!window.FishmanAdventureV35&&!!window.FishmanV16Adapter,{timeout:20000});
   for(let i=0;i<3;i++) await page.keyboard.press('v');
   await page.waitForFunction(()=>FishmanLocal.count===4&&
     !!FishmanV16Adapter.getPlayer(4),{timeout:7000});
   const start=await page.evaluate(()=>{
     fishmanTest.intro(1);fishmanTest.start(0);
     const g=FishmanMultiplayerBridge.getG(),m=g.adventureMission;
     const n=m.nodes[1];
     FishmanAdventureV35.finish(m,m.nodes[0]); // root heart already destroyed
     g.hazards=[];g.inv=999;g.x=n.x;g.y=n.y;
     fishmanTest.interact(); // player 1 starts the clearing defence
     return {level:FishmanMultiplayerBridge.getLevel(),players:FishmanLocal.count,
       guards:g.hazards.filter(h=>h.woodlandDefender).length,
       active:n.active,done:n.done};
   });
   assert.equal(start.level,1);
   assert.equal(start.players,4);
   assert.equal(start.guards,2,'B must spawn exactly two woodland attackers');
   assert.equal(start.active,true);
   assert.equal(start.done,false);
   const end=await page.evaluate(()=>{
     const g=FishmanMultiplayerBridge.getG(),m=g.adventureMission,n=m.nodes[1];
     for(let i=0;i<2;i++){
      const target=g.hazards.find(h=>h.woodlandDefender&&!h.defeated);
      if(!target)break;
      // Use real projectiles and the existing collision/damage system.
      g.proj.push({x:target.x,y:target.y,vx:0,vy:0,r:21,age:0,life:1,
        damage:100,weapon:'basic',hitIndices:[],homing:0});
      fishmanTest.step(.025);
     }
     fishmanTest.step(.1);
     return {cleared:n.done,kills:n.enemiesDefeated,next:FishmanAdventureV35.next(m)?.kind,
       survivingGuards:g.hazards.filter(h=>h.woodlandDefender).length};
   });
   assert.equal(end.kills,2,label+' did not count both attacker defeats');
   assert.equal(end.cleared,true,label+' clearing still cannot complete');
   assert.equal(end.next,'shoot',label+' did not advance to destroy root power source');
   assert.equal(end.survivingGuards,0,'defeated attackers were not cleaned up');
   assert.deepEqual(errors,[],'browser exceptions');
   console.log('PASS '+label+' four-player woodland clearing: two attackers defeated and objective advances');
  }finally{await page.close();}
 }finally{await browser.close();}
}
