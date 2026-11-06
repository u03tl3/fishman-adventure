import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';

// Regression: canonical v35 uses the original v16 local-gamepad layout.
// V adds up to four; the visible W button and W key remove P4 -> P3 -> P2.
for (const [name, engine] of [['Chromium', chromium], ['WebKit', webkit]]) {
 const browser = await engine.launch({
  headless: true, args: name === 'Chromium' ? ['--no-sandbox', '--disable-dev-shm-usage'] : []
 });
 try {
  const page = await browser.newPage({viewport:{width:1200,height:820},hasTouch:true});
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  try {
   await page.goto('http://127.0.0.1:8765/?test=1',{waitUntil:'domcontentloaded',timeout:35000});
   await page.waitForFunction(()=>!!window.FishmanLocal?.addPlayer && !!window.FishmanV16Adapter && !!window.FishmanMultiplayerBridge,{timeout:20000});
   assert.equal(await page.evaluate(()=>FishmanLocal.count),1);
   assert.equal(await page.locator('#localControllerBoard .local-pad').count(),0);
   assert.equal(await page.locator('#removePlayerBtn').isDisabled(),true);
   assert.equal(await page.locator('#onBoardControlDeck').count(),0,'v35 compact controls should not coexist with v16 controls');

   for (let count=2;count<=4;count++) {
    await page.locator('#addPlayerBtn').click();
    await page.waitForFunction(n=>FishmanLocal.count===n &&
      document.querySelectorAll('#localControllerBoard .local-pad').length===n &&
      !!FishmanV16Adapter.getPlayer(n),count,{timeout:9000});
    assert.equal(await page.locator('#removePlayerBtn').isDisabled(),false);
   }
   assert.equal(await page.evaluate(()=>FishmanMultiplayerBridge.getScene()),'playing');
   assert.equal(await page.locator('#addPlayerBtn').isDisabled(),true);
   assert.equal(await page.locator('#localControllerBoard .local-stick').count(),6,'P2–P4 should each have two v16 sticks');
   assert.equal(await page.locator('#localControllerBoard .pad-button').count(),12,'P2–P4 should each have four v16 buttons');

   await page.keyboard.press('w');
   await page.waitForFunction(()=>FishmanLocal.count===3);
   assert.equal(await page.locator('#localControllerBoard .local-pad').count(),3);
   assert.equal(await page.evaluate(()=>FishmanV16Adapter.getPlayer(4)),null);

   await page.locator('#removePlayerBtn').click();
   await page.waitForFunction(()=>FishmanLocal.count===2);
   assert.equal(await page.locator('#localControllerBoard .local-pad').count(),2);
   assert.equal(await page.evaluate(()=>FishmanV16Adapter.getPlayer(3)),null);

   await page.locator('#removePlayerBtn').click();
   await page.waitForFunction(()=>FishmanLocal.count===1);
   assert.equal(await page.evaluate(()=>FishmanNet.role),'solo');
   assert.equal(await page.locator('#localControllerBoard .local-pad').count(),0);
   assert.equal(await page.locator('#removePlayerBtn').isDisabled(),true,'W must not delete P1');
   assert.equal(await page.evaluate(()=>document.getElementById('touchControl').closest('.local-pad')),null,'P1 controls must return to solo layout');
   await page.keyboard.press('w');
   assert.equal(await page.evaluate(()=>FishmanLocal.count),1,'W in solo mode should not remove P1');

   await page.locator('#addPlayerBtn').click();
   await page.waitForFunction(()=>FishmanLocal.count===2);
   assert.equal(await page.evaluate(()=>FishmanNet.role),'local');
   assert.deepEqual(errors,[],'Browser errors: '+errors.join('; '));
   console.log('PASS '+name+' v35 uses v16 gamepads and W removes only the latest player');
  } finally { await page.close(); }
 } finally { await browser.close(); }
}
