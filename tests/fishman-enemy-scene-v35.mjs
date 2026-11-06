import assert from 'node:assert/strict';
import {chromium, webkit} from 'playwright';

// Every ordinary enemy can be defeated. A defeated spawn stays absent until
// ALL active characters have left its scrolling zone and one returns.
for (const [name, engine] of [['Chromium',chromium],['WebKit',webkit]]) {
 const browser=await engine.launch({headless:true,args:name==='Chromium'?['--no-sandbox','--disable-dev-shm-usage']:[]});
 const page=await browser.newPage({viewport:{width:1100,height:780},hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try {
  await page.goto('http://127.0.0.1:8765/?test=1',{waitUntil:'domcontentloaded',timeout:35000});
  await page.waitForFunction(()=>!!window.fishmanTest&&!!window.FishmanLocal&&!!window.FishmanMultiplayerBridge,{timeout:20000});
  for (const [chapter,type] of [[1,'root'],[2,'jelly'],[5,'mine']]) {
   const state=await page.evaluate(({chapter,type})=>{
    fishmanTest.select('classic');fishmanTest.intro(chapter);fishmanTest.start(0);
    const g=FishmanMultiplayerBridge.getG();
    const victim=g.hazards.find(h=>h.type===type&&h.enemyZone===0);
    if(!victim)throw Error('Missing '+type+' enemy in Chapter '+chapter);
    const id=victim.enemyId,startingCount=g.hazards.length;
    // An actual gameplay projectile, not a test-only damage hook.
    g.inv=10;g.proj.push({x:victim.x,y:victim.y,vx:0,vy:0,age:0,life:1,
     kind:g.hero,weapon:'basic',damage:1000,r:20});
    fishmanTest.step(.10);
    const afterShot=g.hazards.find(h=>h.enemyId===id);const killed=!afterShot;const afterHp=afterShot?.hp;const afterX=afterShot?.x;const afterY=afterShot?.y;const shotCount=g.proj.length;
    fishmanTest.step(.7);
    const staysDead=!g.hazards.some(h=>h.enemyId===id);
    fishmanTest.teleport(1220,425);fishmanTest.step(.075);
    const absentAfterLeaving=!g.hazards.some(h=>h.enemyId===id);
    fishmanTest.teleport(300,425);fishmanTest.step(.075);
    const revived=g.hazards.find(h=>h.enemyId===id);
    return {chapter,type,id,startingCount,killed,afterHp,afterX,afterY,shotCount,staysDead,absentAfterLeaving,
     restored:!!revived,fullHp:revived?.hp===revived?.maxHp,
     uniqueIds:new Set(g.hazards.map(h=>h.enemyId)).size===g.hazards.length};
   },{chapter,type});
   console.log('ENEMY STATE',name,JSON.stringify(state));
   assert.equal(state.killed,true,name+' '+type+' was not defeated by its projectile');
   assert.equal(state.staysDead,true,name+' '+type+' respawned without leaving its scene');
   assert.equal(state.absentAfterLeaving,true,name+' '+type+' respawned before re-entering');
   assert.equal(state.restored,true,name+' '+type+' did not respawn on zone re-entry');
   assert.equal(state.fullHp,true,name+' '+type+' did not respawn at full health');
   assert.equal(state.uniqueIds,true,name+' '+type+' duplicate enemy spawn identity');
  }
  const coop=await page.evaluate(()=>{
   fishmanTest.select('classic');fishmanTest.intro(1);fishmanTest.start(0);
   FishmanLocal.addPlayer();
   const g=FishmanMultiplayerBridge.getG(),p2=FishmanV16Adapter.getPlayer(2);
   const h=g.hazards.find(h=>h.enemyZone===0);
   const id=h.enemyId;
   g.inv=10;g.proj.push({x:h.x,y:h.y,vx:0,vy:0,age:0,life:1,damage:1000,r:20,weapon:'basic'});
   fishmanTest.step(.075);
   const killed=!g.hazards.some(x=>x.enemyId===id);
   // P2 still in zone 0: P1 going away and coming back MUST NOT respawn it.
   fishmanTest.teleport(1300,425);fishmanTest.step(.075);
   fishmanTest.teleport(300,425);fishmanTest.step(.075);
   const stillDead=!g.hazards.some(x=>x.enemyId===id);
   // Once P1 and P2 leave, returning should re-create the original spawn.
   fishmanTest.teleport(1300,425);p2.x=1300;fishmanTest.step(.075);
   fishmanTest.teleport(300,425);fishmanTest.step(.075);
   return {count:FishmanLocal.count,killed,stillDead,respawned:g.hazards.some(x=>x.enemyId===id)};
  });
  assert.equal(coop.count,2,name+' two-player game was not preserved');
  assert.equal(coop.killed,true,name+' coop enemy not defeated');
  assert.equal(coop.stillDead,true,name+' enemy reappeared while P2 occupied scene');
  assert.equal(coop.respawned,true,name+' enemy did not respawn after both players left');
  assert.deepEqual(errors,[],name+' browser errors: '+errors.join('; '));
  console.log('PASS '+name+' roots, jellyfish and mines defeated; no respawn until zone re-entry; co-op holds zone');
 } finally {await page.close();await browser.close();}
}
