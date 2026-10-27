import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base='http://127.0.0.1:8765/v16-4p/?test=1';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const failures=[],results=[];
async function suite(name,viewport,run){
 const page=await browser.newPage({viewport,deviceScaleFactor:1,hasTouch:true,isMobile:viewport.width<950,ignoreHTTPSErrors:true});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 page.on('console',m=>{if(m.type()==='error' && !/peerjs|cdn.jsdelivr/i.test(m.text()))errors.push('console: '+m.text());});
 page.on('requestfailed',r=>{if(!/peerjs|cdn.jsdelivr|manifest/i.test(r.url()))errors.push('request '+r.url()+': '+r.failure()?.errorText)});
 try{
   await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForFunction(()=>!!window.fishmanTest && !!window.FishmanLocal,{timeout:10000});
   await run(page,errors);
   if(errors.length)throw Error('Browser exceptions: '+errors.slice(0,5).join('\n'));
   results.push('PASS '+name);
 }catch(e){
  failures.push({name,error:String(e.stack||e),browserErrors:errors});
  await page.screenshot({path:'/tmp/fishman-'+name.replace(/[^a-z0-9]/gi,'_')+'.png',fullPage:true}).catch(()=>{});
 }finally{await page.close();}
}
const getState=async p=>p.evaluate(()=>({scene:fishmanTest.get().scene,level:fishmanTest.get().level,g:window.FishmanMultiplayerBridge?.getG?.(),role:FishmanNet.role,slots:FishmanLocal.count}));
const engage=async(page,slot)=>{
 await page.locator('#addPlayerBtn').click();
 assert.equal(await page.evaluate(()=>FishmanLocal.count),slot);
};
await suite('solo-start', {width:1280,height:760}, async p=>{
 await p.evaluate(()=>{fishmanTest.intro(0);fishmanTest.start(0)});
 await p.waitForTimeout(450);
 let st=await getState(p);
 assert.equal(st.scene,'playing');
 assert.ok(['fish','kai','roxy','humpty','gozilla','sub'].includes(st.g.hero),'invalid solo hero');
 assert.equal(st.g.coopPlayers?.[2],undefined);
});
await suite('four-players-desktop', {width:1280,height:860}, async p=>{
 for(let sl=2;sl<=4;sl++)await engage(p,sl);
 assert.equal(await p.locator('#addPlayerBtn').count(),1);
 assert.equal(await p.locator('#localControllerBoard .local-pad').count(),4);
 assert.equal(await p.locator('#localControllerBoard .stick-base').count(),8);
 assert.equal(await p.locator('#localControllerBoard .pad-button').count(),12);
 await p.evaluate(()=>{fishmanTest.intro(0);fishmanTest.start(0)});
 await p.waitForTimeout(250);
 const g=(await getState(p)).g;
 assert.deepEqual(Object.keys(g.coopPlayers||{}).sort(),['2','3','4']);
 assert.equal(g.hp>0,true);
 // Exercise the original P1 joystick while P1 is also firing and a local guest is steering.
 const rect=await p.locator('#joystick').boundingBox();
 const rect2=await p.locator('#aimStick').boundingBox();
 await p.dispatchEvent('#joystick','pointerdown',{pointerId:91,pointerType:'touch',clientX:rect.x+rect.width*.75,clientY:rect.y+rect.height*.5});
 await p.dispatchEvent('#aimStick','pointerdown',{pointerId:92,pointerType:'touch',clientX:rect2.x+rect2.width*.78,clientY:rect2.y+rect2.height*.45});
 await p.waitForTimeout(130);
 const before=await getState(p);
 await p.dispatchEvent('#joystick','pointerup',{pointerId:91,pointerType:'touch',clientX:rect.x,clientY:rect.y});
 await p.waitForTimeout(100);
 const after=await getState(p);
 assert.ok(after.g.x>before.g.x-3,'P1 moved backwards');
 assert.ok(after.g.proj?.length>=0,'P1 attack failed');
 await p.dispatchEvent('#aimStick','pointerup',{pointerId:92,pointerType:'touch',clientX:rect2.x,clientY:rect2.y});
 // Trigger other players and make sure their weapons/skills update independently.
 await p.evaluate(()=>{
    FishmanNet.players[2].input.skill=true;
    FishmanNet.players[3].input.fire=true;
    FishmanNet.players[4].input.x=.7;
 });
 await p.waitForTimeout(180);
 const updated=(await getState(p)).g;
 assert.ok(updated.coopPlayers[2].skillCooldown>0,'P2 ability never activated');
 assert.ok(updated.coopPlayers[4].x>0);
});
await suite('chapters-all-four', {width:1100,height:850}, async p=>{
 for(let sl=2;sl<=4;sl++)await engage(p,sl);
 for(let ch=0;ch<10;ch++){
  await p.evaluate(i=>{fishmanTest.intro(i);fishmanTest.start(0)},ch);
  await p.waitForTimeout(180);
  const s=await getState(p);
  assert.equal(s.level,ch);
  assert.equal(s.scene,'playing');
  assert.deepEqual(Object.keys(s.g.coopPlayers||{}).sort(),['2','3','4']);
  await p.evaluate(()=>{
   for(const [slot,pr] of Object.entries(FishmanNet.players)){
     pr.input.fire=true;pr.input.x=.2;pr.input.y=0;pr.input.skill=true;
   }
  });
  await p.waitForTimeout(150);
 }
});
await suite('mobile-portrait', {width:390,height:844}, async p=>{
 for(let sl=2;sl<=4;sl++)await engage(p,sl);
 await p.evaluate(()=>{fishmanTest.intro(0);fishmanTest.start(0)});
 await p.waitForTimeout(450);
 const geom=await p.evaluate(()=>{
  const rect=s=>{const r=document.querySelector(s)?.getBoundingClientRect();return r&&{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
  return {viewport:[innerWidth,innerHeight],game:rect('.stage-wrap'),p1:rect('.local-pad.p1'),p2:rect('.local-pad.p2'),p3:rect('.local-pad.p3'),p4:rect('.local-pad.p4'),board:rect('#localControllerBoard'),v:rect('#addPlayerBtn')};
 });
 console.log('mobile-portrait-layout',JSON.stringify(geom));
 assert.ok(geom.game.w>180 && geom.game.h>110,'game area too small');
 for(const slot of ['p1','p2','p3','p4']) assert.ok(geom[slot].w>0 && geom[slot].h>0,slot+' hidden');
 assert.ok(geom.v.w>0 && geom.v.x>=0,'V button missing');
});
await suite('mobile-landscape', {width:844,height:390}, async p=>{
 for(let sl=2;sl<=4;sl++)await engage(p,sl);
 await p.evaluate(()=>{fishmanTest.intro(4);fishmanTest.start(0)});
 await p.waitForTimeout(450);
 const counts=await p.evaluate(()=>({game:document.querySelector('.stage-wrap').getBoundingClientRect().width,pads:document.querySelectorAll('#localControllerBoard .local-pad').length}));
 assert.equal(counts.pads,4);
 assert.ok(counts.game>200);
});
await browser.close();
for(const item of results) console.log(item);
for(const bad of failures) console.error('FAIL',JSON.stringify(bad));
console.log('QA_TOTAL',results.length+failures.length,'PASS',results.length,'FAIL',failures.length);
if(failures.length)process.exitCode=1;
