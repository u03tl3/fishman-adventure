import assert from 'node:assert/strict';
import {chromium, webkit} from 'playwright';

// From repository root: serve with npx http-server -p 8765, then run this script.
// Regression: a boss dies while there are several shots in flight. The old
// projectile loop must stop when challengeWin() replaces the boss and g.proj.
const base=process.env.FISHMAN_TEST_BASE||'http://127.0.0.1:8765';

for(const [label,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true,args:label==='chromium'?['--no-sandbox','--disable-dev-shm-usage']:[]});
 const page=await browser.newPage({viewport:{width:1200,height:780}});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base+'/v35-full-v16-4p/?test=1',{waitUntil:'domcontentloaded',timeout:35000});
  await page.waitForFunction(()=>!!window.fishmanTest&&!!window.FishmanMultiplayerBridge,{timeout:20000});
  const result=await page.evaluate(()=>{
   fishmanTest.intro(9);fishmanTest.start(0);
   const first=FishmanMultiplayerBridge.getG();
   const lives=first.lives,results=[];
   for(let id=0;id<9;id++){
    const g=FishmanMultiplayerBridge.getG(),a=g.challenge;
    if(!a||a.index!==id)throw new Error('Expected boss '+id+', got '+a?.index);
    a.phase=2;a.hp=1;a.barrier=0;a.completed=a.required;
    const shot=(x,y,damage=0)=>({x,y,vx:0,vy:0,r:15,damage,age:0,life:1,homing:0});
    // Iterated backwards: killing shot comes first, leaving two stale entries.
    g.proj=[shot(145,220),shot(170,290),shot(a.x,a.y,9999)];
    fishmanTest.step(.025);
    const state=fishmanTest.get(),round=FishmanMultiplayerBridge.getG();
    if(round.lives!==lives)throw new Error('Lives changed during transition '+id);
    if(id<8){
     if(round.challenge?.index!==id+1)throw new Error('Boss '+id+' failed to advance');
     if(round.proj.length!==0)throw new Error('Old projectiles carried into round '+(id+1));
     if(state.scene!=='playing')throw new Error('Scene stopped after boss '+id);
    }else{
     if(state.scene!=='gameWin'||round.challenge)throw new Error('Final boss failed to finish the gauntlet');
    }
    results.push({boss:id+1,scene:state.scene,next:round.challenge?.index??null,lives:round.lives});
   }
   return results;
  });
  assert.equal(result.length,9);
  await page.waitForTimeout(200);
  assert.deepEqual(errors,[],'Uncaught browser error');
  console.log('PASS '+label+' single-player gauntlet: all 9 bosses / 8 transitions / final victory, stale projectiles safely discarded');
 }finally{await page.close();await browser.close();}
}
