import assert from 'node:assert/strict';
import {chromium, webkit} from 'playwright';

// Regression: the published four-player link must draw characters, not only controllers.
// Run against a local static server at port 8765, from the repository root.
for (const [label, engine] of [['Chromium', chromium], ['WebKit', webkit]]) {
 const browser=await engine.launch({headless:true,args:label==='Chromium'?['--no-sandbox','--disable-dev-shm-usage']:[]});
 try {
  const page=await browser.newPage({viewport:{width:1180,height:840},hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try {
   await page.goto('http://127.0.0.1:8765/v35-full-v16-4p/?test=1',
    {waitUntil:'domcontentloaded',timeout:35000});
   await page.waitForFunction(()=>!!window.FishmanLocal?.addPlayer&&
     !!window.FishmanV16Adapter&&!!window.FishmanMultiplayerBridge,{timeout:20000});
   assert.equal(await page.evaluate(()=>FishmanMultiplayerBridge.getScene()),'menu');
   // Watch the actual canvas character drawing, not just the hero state.
   await page.evaluate(()=>{
    window.__visibleFourPlayerDraws=[];
    const original=FishmanHeroMotionV35.draw;
    FishmanHeroMotionV35.draw=(ctx,actor,...rest)=>{
     if(actor?.hero&&Number.isFinite(actor.x)&&Number.isFinite(actor.y)){
      window.__visibleFourPlayerDraws.push({hero:actor.hero,x:actor.x,y:actor.y});
      if(window.__visibleFourPlayerDraws.length>100)window.__visibleFourPlayerDraws.shift();
     }
     return original(ctx,actor,...rest);
    };
   });
   await page.locator('#addPlayerBtn').click();
   await page.waitForFunction(()=>FishmanMultiplayerBridge.getScene()==='playing'&&
     !!FishmanMultiplayerBridge.getG()&&!!FishmanV16Adapter.getPlayer(2),{timeout:7000});
   for(let count=3;count<=4;count++){
    await page.locator('#addPlayerBtn').click();
    await page.waitForFunction(n=>FishmanLocal.count===n&&
      !!FishmanV16Adapter.getPlayer(n),count,{timeout:6000});
   }
   await page.waitForFunction(()=>{
    const drawn=new Set(window.__visibleFourPlayerDraws.map(p=>p.hero));
    return ['fish','kai','roxy','humpty'].every(h=>drawn.has(h));
   },{timeout:15000});
   const state=await page.evaluate(()=>({
    scene:FishmanMultiplayerBridge.getScene(),players:FishmanLocal.count,
    panels:document.querySelectorAll('#localControllerBoard .local-pad').length,
    heroes:[FishmanMultiplayerBridge.getG(),...Array.from({length:3},(_,i)=>FishmanV16Adapter.getPlayer(i+2))]
     .map(p=>({hero:p?.hero,x:p?.x,y:p?.y})),
    overlayHidden:document.getElementById('overlay').classList.contains('hidden'),
    canvasWidth:document.getElementById('game').getBoundingClientRect().width,
    drawn:[...new Set(window.__visibleFourPlayerDraws.map(p=>p.hero))]
   }));
   assert.equal(state.scene,'playing');
   assert.equal(state.players,4);
   assert.equal(state.panels,4);
   assert.equal(state.overlayHidden,true,'menu overlay still hides the game');
   assert.ok(state.canvasWidth>200,'game canvas disappeared');
   assert.equal(new Set(state.heroes.map(p=>p.hero)).size,4,'four distinct heroes missing');
   assert.ok(state.heroes.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
   assert.deepEqual(errors,[],'uncaught browser errors');
   console.log('PASS '+label+' four controller panels and four on-screen characters');
  } finally {await page.close();}
 } finally {await browser.close();}
}
