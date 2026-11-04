import assert from 'node:assert/strict';
import {chromium, webkit} from 'playwright';

// Exercise the complete in-browser v35 build, not an isolated control mock.
const url='http://127.0.0.1:8765/v35-v16-4player/?test=1';
for(const [label,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true,args:label==='Chromium'?['--no-sandbox','--disable-dev-shm-usage']:[]});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:800},hasTouch:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:35000});
   await page.waitForFunction(()=>!!window.FishmanLocal?.addPlayer&&!!window.FishmanLocal?.removePlayer&&!!window.FishmanLocalEngine&&!!window.fishmanTest,{timeout:20000});
   await page.evaluate(()=>{fishmanTest.intro(0);fishmanTest.start(0);});
   assert.equal(await page.evaluate(()=>FishmanLocal.count),1,'must begin as one player');
   assert.equal(await page.locator('#localControllerBoard .local-pad').count(),0,'v16 board should be hidden until P2 joins');
   for(let count=2;count<=4;count++){
    await page.keyboard.press('v');
    await page.waitForFunction(n=>window.FishmanLocal?.count===n&&
      document.querySelectorAll('#localControllerBoard .local-pad').length===n&&
      !!window.FishmanLocalEngine?.getPlayer(n),count,{timeout:6000});
    const state=await page.evaluate(()=>({
     role:FishmanNet.role,online:FishmanNet.connected,
     pads:document.querySelectorAll('#localControllerBoard .local-pad').length,
     player1Controls:document.getElementById('touchControl')?.closest('.local-pad')?.dataset.player
    }));
    assert.equal(state.role,'local');assert.equal(state.online,false);
    assert.equal(state.pads,count);
    assert.equal(state.player1Controls,'1','P1 v16 panel must use the original game controls');
   }
   assert.equal(await page.locator('#addPlayerBtn').isDisabled(),true,'join caps at four players');
   const controls=await page.evaluate(()=>[2,3,4].map(slot=>({
    slot,sticks:document.querySelectorAll('.local-pad.p'+slot+' .local-stick').length,
    buttons:document.querySelectorAll('.local-pad.p'+slot+' .pad-button').length,
    alive:!!FishmanLocalEngine.getPlayer(slot)
   })));
   for(const c of controls){assert.equal(c.sticks,2,'P'+c.slot+' needs TWO v16 joysticks');assert.equal(c.buttons,4);assert(c.alive);}
   const before=await page.evaluate(()=>[2,3].map(i=>FishmanLocalEngine.getPlayer(i).x));
   await page.evaluate(()=>{FishmanNet.players[2].input.x=1;FishmanNet.players[3].input.x=0;});
   // Deterministically advance the same game loop on slow WebKit/CI runners.
   await page.evaluate(()=>{for(let i=0;i<8;i++)FishmanLocalEngine.step(.033);});
   const after=await page.evaluate(()=>[2,3].map(i=>FishmanLocalEngine.getPlayer(i).x));
   assert(after[0]>before[0]+12,'P2 did not move independently');
   assert(Math.abs(after[1]-before[1])<5,'P3 moved without input');
   await page.evaluate(()=>{FishmanNet.players[2].input.x=0;FishmanNet.players[2].input.aim={x:1,y:0};FishmanNet.players[2].input.fire=true;});
   await page.evaluate(()=>FishmanLocalEngine.step(.033));
   assert(await page.evaluate(()=>FishmanLocalEngine.getPlayer(2)?.cool>.02),'P2 fire must use their own weapon');
   await page.evaluate(()=>{FishmanNet.players[2].input.fire=false;FishmanNet.players[2].input.skill=true;});
   await page.evaluate(()=>FishmanLocalEngine.step(.033));
   assert(await page.evaluate(()=>FishmanLocalEngine.getPlayer(2)?.skillCooldown>0),'P2 special skill must activate independently');
   await page.evaluate(()=>{FishmanNet.players[2].input.hero='roxy';FishmanNet.players[2].hero='roxy';});
   await page.evaluate(()=>FishmanLocalEngine.step(.033));
   assert.equal(await page.evaluate(()=>FishmanLocalEngine.getPlayer(2)?.hero),'roxy','P2 hero picker changes P2 only');
   for(let count=3;count>=1;count--){
    await page.keyboard.press('w');
    await page.waitForFunction(n=>FishmanLocal.count===n&&document.querySelectorAll('#localControllerBoard .local-pad').length===(n===1?0:n),count,{timeout:6000});
    assert.equal(await page.evaluate(()=>FishmanLocalEngine.count),count);
   }
   const solo=await page.evaluate(()=>({
    role:FishmanNet.role,onlineButtonHidden:document.getElementById('mpOpen').hidden,
    stillInBoard:!!document.getElementById('touchControl')?.closest('.local-pad'),
    localCSS:document.documentElement.classList.contains('local-coop')
   }));
   assert.equal(solo.role,'solo');assert.equal(solo.onlineButtonHidden,false);
   assert.equal(solo.stillInBoard,false);assert.equal(solo.localCSS,false);
   await page.keyboard.press('w');assert.equal(await page.evaluate(()=>FishmanLocal.count),1,'W cannot remove P1');
   await page.keyboard.press('v');assert.equal(await page.evaluate(()=>FishmanLocal.count),2,'V must work after returning to solo');
   assert.deepEqual(errors,[],'Uncaught browser errors: '+errors.join('; '));
   console.log('PASS '+label+' complete v16 1–4 gamepads in v35; independent characters, attacks, skills, V add and W remove');
  }finally{await page.close();}
 }finally{await browser.close();}
}
