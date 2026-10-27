import { webkit } from 'playwright';
import assert from 'node:assert/strict';
const browser=await webkit.launch({headless:true});
const failures=[];
for(const viewport of [{width:390,height:844},{width:844,height:390},{width:1024,height:768}]){
 const page=await browser.newPage({viewport,hasTouch:true,isMobile:true,deviceScaleFactor:2});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8765/v16-4p/?test=1',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>!!window.FishmanLocal&&!!window.fishmanTest,{timeout:10000});
  for(const slot of [2,3,4]){
   await page.locator('#addPlayerBtn').tap();
   assert.equal(await page.evaluate(()=>FishmanLocal.count),slot);
  }
  assert.equal(await page.locator('#localControllerBoard .stick-base').count(),8);
  for(let chapter=0;chapter<10;chapter++){
   await page.evaluate(ch=>{fishmanTest.intro(ch);fishmanTest.start(0)},chapter);
   await page.waitForTimeout(80);
   const game=await page.evaluate(()=>({scene:FishmanMultiplayerBridge.getScene(),
    n:Object.keys(FishmanMultiplayerBridge.getG()?.coopPlayers||{}).length,
    mode:FishmanNet.role,slots:FishmanLocal.count,
    rooms:Object.entries(FishmanNet.players||{}).map(([k,v])=>({slot:k,open:v.connection?.open,hero:v.hero})),
    level:FishmanMultiplayerBridge.getLevel(),wave:FishmanMultiplayerBridge.getG()?.wave}));
   if(game.n!==3)console.error('WEBKIT_DEBUG_CHAPTER',viewport,chapter,JSON.stringify(game));
   assert.equal(game.scene,'playing');
   assert.equal(game.n,3,'Three local teammates absent from Safari chapter '+chapter);
  }
  // The user must be able to activate a transformative S ability on a real touch surface.
  await page.evaluate(()=>{fishmanTest.intro(2);fishmanTest.start(0);});
  await page.locator('#skillBtn').tap();
  await page.waitForTimeout(90);
  const superState=await page.evaluate(()=>({active:FishmanMultiplayerBridge.getG()?.skillEffect,button:document.getElementById('skillName')?.textContent}));
  assert.ok(superState.active>6,'Safari S ability does not activate');
  assert.equal(superState.button,'SUPER!');
  await page.locator('#localControllerBoard .pad-weapon').first().tap();
  await page.waitForTimeout(90);
  assert.ok(errors.length===0,'Safari console errors: '+errors.join('; '));
  console.log('PASS Safari/WebKit '+viewport.width+'×'+viewport.height+' all 10 chapters, four players, 8 joysticks, S super and W weapon');
 }catch(e){failures.push({viewport,error:String(e.stack||e),js:errors});
  console.error('FAIL Safari',viewport,e.stack||e);
 }finally{await page.close();}
}
await browser.close();
console.log('SAFARI_QA_TOTAL',3,'FAILED',failures.length);
if(failures.length)process.exitCode=1;
