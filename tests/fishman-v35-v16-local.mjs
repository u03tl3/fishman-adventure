import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

for(const [label,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true,args:label==='Chromium'?['--no-sandbox','--disable-dev-shm-usage']:[]});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:800},hasTouch:true});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  try{
   await page.goto('http://127.0.0.1:8765/v35-v16-4player/?test=1',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!window.fishmanTest&&!!window.FishmanLocal&&!!window.FishmanNet);
   assert.equal(await page.evaluate(()=>FishmanLocal.count),1,'v16 starts as one player');
   await page.evaluate(()=>{fishmanTest.intro(0);fishmanTest.start(0);});
   assert.equal(await page.evaluate(()=>fishmanTest.get().scene),'playing');
   for(let count=2;count<=4;count++){
    await page.locator('#addPlayerBtn').click();
    assert.equal(await page.evaluate(()=>FishmanLocal.count),count);
    assert.equal(await page.locator('#localControllerBoard .local-pad').count(),count);
    assert.equal(await page.locator('#localControllerBoard .local-pad .pad-stick-wrap').count(),2*(count-1));
    assert.equal(await page.locator('#localControllerBoard .local-pad .pad-button').count(),4*(count-1));
    assert.equal(await page.evaluate(()=>FishmanNet.role),'solo','local players must not disable v35 gameplay');
   }
   assert.equal(await page.locator('#addPlayerBtn').isDisabled(),true,'join caps at four players');
   assert.equal(await page.evaluate(()=>FishmanLocal.players[2].hero),'kai');
   await page.locator('.local-pad.p2 select').selectOption('roxy');
   assert.equal(await page.evaluate(()=>FishmanLocal.players[2].hero),'roxy');
   const m=await page.evaluate(()=>{
    const stick=document.querySelector('.local-pad.p2 .local-stick');
    const aim=document.querySelector('.local-pad.p2 .aim-stick');
    const r=stick.getBoundingClientRect();
    const a=aim.getBoundingClientRect();
    stick.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:42,clientX:r.right-8,clientY:r.top+r.height/2}));
    aim.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:43,clientX:a.right-8,clientY:a.top+a.height/2}));
    return {p2:{...FishmanLocal.players[2].input},p3:{...FishmanLocal.players[3].input}};
   });
   assert(m.p2.x>.3,'P2 move joystick not connected');
   assert(m.p2.fire&&m.p2.aim.x>.3,'P2 independent aim/fire not connected');
   assert.equal(m.p3.x,0,'P2 should not move P3');
   assert.equal(m.p3.fire,false,'P2 aim should not fire P3');
   await page.evaluate(()=>{
    for(const p of document.querySelectorAll('.local-pad.p2 .local-stick')){
     p.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:p.classList.contains('aim-stick')?43:42}));
    }
    const b=document.querySelector('.local-pad.p3 .pad-weapon');
    const r=b.getBoundingClientRect();
    b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:44,clientX:r.left+4,clientY:r.top+4}));
   });
   assert.equal(await page.evaluate(()=>FishmanLocal.players[3].input.weapon),true,'P3 W button not connected');
   await page.waitForTimeout(120);
   assert.equal(await page.evaluate(()=>FishmanLocal.players[3].input.weapon),false,'W should be consumed once');
   assert.equal(await page.evaluate(()=>fishmanTest.get().scene),'playing','v35 gameplay survives four players');
   assert.deepEqual(errors,[],label+' JavaScript errors');
   console.log('PASS '+label+' v35 with authentic v16 1–4 player controls');
  }finally{await page.close();}
 }finally{await browser.close();}
}
