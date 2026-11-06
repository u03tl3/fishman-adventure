import assert from 'node:assert/strict';
import {chromium, webkit} from 'playwright';

// Test the published v35 homepage, with the original v16 1–4 player gamepad UI.
for(const [name, engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true,args:name==='Chromium'?['--no-sandbox','--disable-dev-shm-usage']:[]});
 const page=await browser.newPage({viewport:{width:1220,height:900},hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8765/?test=1',{waitUntil:'domcontentloaded',timeout:35000});
  await page.waitForFunction(()=>!!window.FishmanLocal?.addPlayer&&!!window.FishmanV16Adapter&&!!window.fishmanTest);
  assert.equal(await page.evaluate(()=>FishmanLocal.count),1);
  assert.equal(await page.locator('#removePlayerBtn').isDisabled(),true,'P1 cannot be removed');
  assert.equal(await page.locator('#localControllerBoard .local-pad').count(),0,'v16 controllers hidden until P2 joins');
  assert.equal(await page.locator('#onBoardControlDeck').count(),0,'old v35 compact controls must not appear');

  for(let n=2;n<=4;n++){
   await page.locator('#addPlayerBtn').click();
   await page.waitForFunction(count=>FishmanLocal.count===count&&!!FishmanV16Adapter.getPlayer(count),n);
   assert.equal(await page.locator('#localControllerBoard .local-pad').count(),n);
   assert.equal(await page.locator('#localControllerBoard .stick-base').count(),n*2,'each player has two v16 joysticks');
   assert.equal(await page.locator('#localControllerBoard .pad-button').count(),(n-1)*4,'P2–P4 have v16 A, B, S and W actions');
   assert.equal(await page.locator('#removePlayerBtn').isDisabled(),false);
  }
  assert.equal(await page.locator('#addPlayerBtn').isDisabled(),true,'4P is the maximum');
  assert.equal(await page.evaluate(()=>FishmanMultiplayerBridge.getScene()),'playing','4 players need the live game');
  assert.equal(await page.evaluate(()=>new Set([FishmanMultiplayerBridge.getG()?.hero,
    ...[2,3,4].map(i=>FishmanV16Adapter.getPlayer(i)?.hero)]).size),4,'four distinct heroes');

  for(let n=3;n>=1;n--){
   await page.locator('#removePlayerBtn').click();
   await page.waitForFunction(count=>FishmanLocal.count===count,n);
   assert.equal(await page.locator('#localControllerBoard .local-pad').count(),n===1?0:n);
   assert.equal(await page.locator('#removePlayerBtn').isDisabled(),n===1);
  }
  assert.equal(await page.evaluate(()=>FishmanNet.role),'solo');
  assert.equal(await page.locator('#mpOpen').isHidden(),false);
  assert.equal(await page.locator('#addPlayerBtn').isDisabled(),false);
  assert.deepEqual(errors,[],'browser JavaScript errors: '+errors.join('; '));
  console.log('PASS '+name+' v35: v16 controllers for 1–4 players, V join, W remove, P1 protected');
 }finally{await page.close();await browser.close();}
}
