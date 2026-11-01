import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {chromium,webkit} from 'playwright';

function load(path,key){const box={};box.globalThis=box;vm.runInNewContext(fs.readFileSync(path,'utf8'),box);return box[key];}
const A=load('adventure-v35.js','FishmanAdventureV35');
const H=load('hero-motion-v35.js','FishmanHeroMotionV35');
assert.equal(Object.keys(H.STYLES).length,6);
assert.equal(Object.keys(A.PLANS).length,8);
const speeds={};
for(const hero of ['fish','kai','roxy','humpty','gozilla','sub']){
 const p={hero,x:400,y:350};let rate=0;
 for(let i=0;i<45;i++)rate=H.step(p,1,0,.025,hero==='sub'?'cruise':hero==='fish'?'swim':'run',{minX:0,maxX:8000,minY:0,maxY:620},250).speed;
 assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.motionVX),hero+' motion invalid');
 assert.ok(Array.isArray(p.motionTrail)&&p.motionTrail.length>0,hero+' has no visible trail');
 speeds[hero]=Math.round(rate);
}
assert.ok(speeds.roxy>speeds.kai*1.3,'Roxy must visibly sprint faster than Kai');
assert.ok(speeds.humpty>speeds.fish*1.25,'Humpty must roll much faster than Fishman');
assert.ok(speeds.gozilla<speeds.kai,'Gozilla must feel heavier/slower than Kai');
assert.ok(new Set(Object.values(speeds)).size===6,'Distinct heroes should not share identical speed curves');
const probe={hero:'gozilla',x:300,y:300};
for(let i=0;i<70;i++)H.step(probe,1,0,.025,'stomp',{minX:0,maxX:9999,minY:0,maxY:620},220);
const enemy={x:probe.x+20,y:probe.y,stun:0,hp:3};
assert.ok(H.passive(probe,.08,'stomp',[enemy]).length>0,'Gozilla stomp must affect actual enemies');
assert.ok(enemy.stun>0&&enemy.hp<3);
console.log('PASS six unique character movement curves, visual trails and stomping strength');

const targets={0:['switch','shoot','align'],1:['hunt','defend','shoot'],
 2:['rescue','escort','defend'],3:['rescue','shoot','escort','bomb'],
 5:['shoot','switch','defend','sequence'],6:['align','shoot','sequence'],
 7:['ring','ring','escape'],8:['stealth','disable','stealth']};
const failures=[];
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true,args:name==='chromium'?['--no-sandbox','--disable-dev-shm-usage']:[]});
 const page=await browser.newPage({viewport:{width:1200,height:780}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8765/?test=1',{waitUntil:'domcontentloaded',timeout:35000});
  await page.waitForFunction(()=>!!window.fishmanTest&&!!window.FishmanAdventureV35&&!!window.FishmanHeroMotionV35,{timeout:18000});
  for(const [chapter,expected] of Object.entries(targets)){
   const result=await page.evaluate(index=>{
    const A=window.FishmanAdventureV35;
    fishmanTest.intro(+index);fishmanTest.start(0);
    let g=FishmanMultiplayerBridge.getG();
    g.hazards=[];g.inv=999;fishmanTest.steer(0,0,false);
    if(+index===5){
     const naughty=g.items.find(it=>it.type==='naughty');
     g.x=naughty.x;g.y=naughty.y;fishmanTest.interact();
     if(!g.captured)return {error:'Naughty cannot be captured'};
     g.x=g.runLength-234;fishmanTest.step(.06);
     g=FishmanMultiplayerBridge.getG();
     if(g.wave!==1||!g.adventureMission)return {error:'Naughty escort did not automatically reach prison'};
    }
    const m=g.adventureMission;
    if(!m)return {error:'missing interactive mission'};
    const kinds=m.nodes.map(n=>n.kind);
    for(const node of m.nodes){
     g.hazards=[];g.inv=999;
     g.motionVX=0;g.motionVY=0;
     g.x=node.x;g.y=node.y;
     if(node.kind==='shoot'||node.kind==='hunt'){
      for(let attempt=0;attempt<8&&!node.done;attempt++){
       g.proj.push({x:node.x,y:node.y,vx:0,vy:0,r:21,age:0,life:1,damage:47,weapon:'charge',hitIndices:[],homing:0});
       fishmanTest.step(.025);
      }
     }else if(node.kind==='align'){
      for(let i=0;i<2;i++){node.angle=node.goalAngle;fishmanTest.interact();}
     }else if(node.kind==='sequence'){
      for(let i=0;i<3;i++){
       const mark=A.targetPosition(node);g.x=mark.x;g.y=mark.y;fishmanTest.interact();
      }
     }else if(node.kind==='escort'){
      fishmanTest.interact();
      for(let i=0;i<115&&!node.done;i++){
       g.x=node.escortX+15;g.y=node.escortY;
       fishmanTest.step(.05);
       g.hazards=[];
      }
     }else if(node.kind==='defend'||node.kind==='bomb'||node.kind==='disable'){
      fishmanTest.interact();
      // The defend action spawns attackers. Simulate stunning them before channeling.
      const spawned=g.hazards.length;
      if(node.kind==='defend'&&spawned<2)return {error:'defence did not spawn real enemies'};
      for(const h of g.hazards)h.stun=20;
      fishmanTest.step(4.0);
     }else if(node.kind==='ring'||node.kind==='escape'){
      fishmanTest.step(.05);
     }else{
      fishmanTest.interact();
     }
     if(!node.done)return {error:'stage objective not solvable: '+node.kind,progress:m.progress,chapter:index};
    }
    const completed=A.complete(m);
    fishmanTest.step(1.8);
    return {kinds,completed,nextWave:FishmanMultiplayerBridge.getG().wave,after:FishmanMultiplayerBridge.getG().adventureMission?.version};
   },chapter);
   assert.equal(result.error,undefined,'placeholder must be replaced');
   assert.deepEqual(result.kinds,expected,'chapter '+chapter+' mission types');
   assert.equal(result.completed,true,'chapter '+chapter+' objectives did not finish');
   assert.equal(result.nextWave,1,'chapter '+chapter+' must progress without interacting with an exit gate');
   console.log('PASS '+name+' chapter '+(+chapter+1)+' unique missions and no-gate story transition');
  }
  assert.deepEqual(errors,[],'Browser errors: '+errors.join(' | '));
 }catch(e){failures.push(name+': '+(e.stack||e));}
 finally{await browser.close();}
}
if(failures.length){console.error(failures.join('\n\n'));process.exit(1);}
console.log('PASS v35 motion, active missions and story progression in Chromium and WebKit');
