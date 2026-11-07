import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

// Published v35 4-player woodland defence: P4 can start and complete it while P1 is away.
// Real attackers can be defeated, and ambient enemies cannot permanently lock the timer.
for(const [name,driver] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await driver.launch({headless:true,args:name==='Chromium'?['--no-sandbox','--disable-dev-shm-usage']:[]});
 const page=await browser.newPage({viewport:{width:1200,height:800}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8765/v35-full-v16-4p/?test=1',{waitUntil:'domcontentloaded',timeout:35000});
  await page.waitForFunction(()=>!!window.FishmanLocal?.addPlayer&&!!window.fishmanTest&&
   !!window.FishmanV16Adapter&&!!window.FishmanAdventureV35,{timeout:20000});
  await page.evaluate(()=>{
   fishmanTest.intro(1);fishmanTest.start(0); // Naughty's Forest
   for(let i=0;i<3;i++)FishmanLocal.addPlayer();
   const g=FishmanMultiplayerBridge.getG(),m=g.adventureMission;
   FishmanAdventureV35.finish(m,m.nodes[0]); // Root heart defeated
   const defend=m.nodes[1],p4=FishmanV16Adapter.getPlayer(4);
   if(!p4)throw Error('P4 actor was not created');
   g.x=120;g.y=240;g.inv=100; // P1 nowhere near clearing
   for(const slot of [2,3]){const p=FishmanV16Adapter.getPlayer(slot);p.x=120;p.y=250;p.inv=100;}
   p4.x=defend.x;p4.y=defend.y;p4.inv=100;p4.down=false;p4.hp=p4.maxHp;
   g.hazards=[]; // Isolate the mission's genuine attacker spawn from background patrols
   FishmanNet.players[4].input.interact=true; // Real fourth player's USE action
  });
  await page.waitForFunction(()=>{
   const g=FishmanMultiplayerBridge.getG();
   return g?.adventureMission?.nodes?.[1]?.active&&g.hazards.filter(h=>h.defenceGuard).length===2;
  },{timeout:10000});
  const first=await page.evaluate(()=>{
   const g=FishmanMultiplayerBridge.getG();
   const m=g.adventureMission,n=m.nodes[1];
   const p4=FishmanV16Adapter.getPlayer(4);
   return {active:n.active,guards:g.hazards.filter(h=>h.defenceGuard).length,
    hostDistance:Math.hypot(g.x-n.x,g.y-n.y),p4Distance:Math.hypot(p4.x-n.x,p4.y-n.y)};
  });
  assert.equal(first.guards,2,'Exactly two root attackers should appear');
  assert.ok(first.hostDistance>800,'P1 must be far away for this test');
  assert.ok(first.p4Distance<50,'P4 should be guarding the clearing');
  const result=await page.evaluate(()=>{
   const g=FishmanMultiplayerBridge.getG(),m=g.adventureMission,n=m.nodes[1];
   // Give each attacker a real hit from the normal projectile collision path.
   for(const h of g.hazards.filter(x=>x.defenceGuard)){
    // Some guards are elite (3x health); keep firing until they are actually defeated.
    for(let attempt=0;attempt<10&&!h.defeated;attempt++){
     g.proj.push({x:h.x,y:h.y,vx:0,vy:0,r:20,age:0,life:1,
       damage:160,weapon:'basic',hitIndices:[]});
     fishmanTest.step(.025);
    }
   }
   const guardsAfter=g.hazards.filter(h=>h.defenceGuard).length;
   // A wandering enemy does not count as one of the wave attackers.
   g.hazards.push({x:n.x+10,y:n.y+8,bx:n.x+10,by:n.y+8,ax:0,ay:0,
     rate:0,phase:0,stun:0,defenceGuard:false,hunter:false,type:'root'});
   fishmanTest.step(4.2);
   return {guardsAfter,done:n.done,hold:n.hold,progress:m.progress,
    scene:FishmanMultiplayerBridge.getScene(),wave:g.wave};
  });
  assert.equal(result.guardsAfter,0,'Defeated clearing attackers must stay defeated');
  assert.equal(result.done,true,'P4 alone must be able to protect the woodland clearing');
  assert.equal(result.progress,2,'Woodland clearing progress should advance to 2/3');
  assert.equal(result.wave,0,'The remaining root source objective must still be available');
  assert.deepEqual(errors,[],'uncaught page errors');
  console.log('PASS '+name+' v35 4P woodland clearing with P4-only defence and real attacker defeat');
 }finally{await page.close();await browser.close();}
}
