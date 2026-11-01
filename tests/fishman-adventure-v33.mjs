import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

const types={0:['switch','shoot','switch','shoot'],1:['shoot','shoot','shoot','shoot'],2:['defend','defend','defend','defend'],3:['rescue','shoot','rescue','bomb'],6:['shoot','switch','shoot','switch'],7:['ring','ring','ring','ring'],8:['stealth','stealth','stealth','stealth']};
const failures=[];
for(const [name,launcher] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await launcher.launch({headless:true,args:name==='chromium'?['--no-sandbox','--disable-dev-shm-usage']:[]});
 const page=await browser.newPage({viewport:{width:1200,height:780}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8765/?test=1',{waitUntil:'domcontentloaded',timeout:35000});
  await page.waitForFunction(()=>!!window.fishmanTest&&!!window.FishmanAdventureV33,{timeout:20000});
  for(const [chap,kinds] of Object.entries(types)){
   const result=await page.evaluate(chapter=>{
    fishmanTest.intro(+chapter);fishmanTest.start(0);
    const g=FishmanMultiplayerBridge.getG();
    const m=g.adventureMission;
    if(!m)return {error:'missing-mission'};
    const observed=m.nodes.map(n=>n.kind);
    // Remove damage sources in this controlled progression test, not in the game.
    g.hazards=[];g.inv=999;
    const stageBefore={count:g.items.length,mission:m.progress,gateX:g.runLength-135};
    for(const n of m.nodes){
     g.x=n.x;g.y=n.y;
     if(n.kind==='shoot'){
      // Simulate actual projectiles through the gameplay tick collision path.
      for(let k=0;k<3;k++){
       g.proj.push({x:n.x,y:n.y,vx:0,vy:0,damage:35,r:20,age:0,life:1,hitIndices:[],weapon:'basic',homing:0});
       fishmanTest.step(.025);
      }
     }else if(n.kind==='ring'){fishmanTest.step(.05);}
     else{
      fishmanTest.interact();
      if(n.kind==='defend'||n.kind==='bomb')fishmanTest.step(3.35);
     }
     if(!n.done)return {error:'uncompleted-'+n.kind,id:n.id,observed,stageBefore};
    }
    const completed=FishmanAdventureV33.complete(m);
    g.x=g.runLength-135;g.y=390;
    fishmanTest.interact();
    return {observed,completed,stageBefore,wave:FishmanMultiplayerBridge.getG().wave,scene:fishmanTest.get().scene};
   },chap);
   assert.equal(result.error,undefined,'chapter '+chap+' '+JSON.stringify(result));
   assert.deepEqual(result.observed,kinds,'chapter '+chap+' objective types');
   assert.equal(result.stageBefore.count,0,'chapter '+chap+' should not demand collectible items');
   assert.equal(result.completed,true,'chapter '+chap+' missions incomplete');
   assert.equal(result.wave,1,'chapter '+chap+' should reach next story area');
   assert.equal(result.scene,'playing','chapter '+chap+' scene');
   console.log('PASS '+name+' chapter '+(+chap+1)+' playable mission variation and gate');
  }
  assert.deepEqual(errors,[],'Browser runtime errors: '+errors.join(' | '));
 }catch(e){failures.push(name+': '+(e.stack||e));}
 finally{await browser.close();}
}
if(failures.length){console.error(failures.join('\n\n'));process.exit(1);}
console.log('PASS v33 chapter missions and all browser engines');
