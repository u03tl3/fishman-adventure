import {chromium, webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
const art=fs.readFileSync('art-v29.js','utf8');
assert.match(art,/window\.FishmanV29Art=/,'Missing approved v29 art layer');
assert.match(html,/FishmanVisualMaster/);
assert.match(html,/FishmanV28Art/);
assert.match(html,/drawAquaHoverPod/);
assert.match(html,/TERRAIN_CHAPTERS/);
assert.match(html,/CHAPTER_BOSSES/);
assert.match(html,/drawSyncedFrame|drawPlayer/);
const webps=[...[html,art].flatMap(source=>[...source.matchAll(/data:image\/webp;base64,([A-Za-z0-9+/=]+)/g)])];
assert.ok(webps.length>=20,'Approved illustration assets have disappeared');
for(const m of webps){
 const data=Buffer.from(m[1],'base64');
 assert.equal(data.subarray(0,4).toString(),'RIFF','damaged image header');
 assert.equal(data.subarray(8,12).toString(),'WEBP','image is not WebP');
 assert.ok(data.length>200,'empty embedded illustration');
}
console.log('PASS approved art asset integrity: '+webps.length+' WebP illustrations');

const failures=[];
async function suite(browser,label,name,fn){
 const page=await browser.newPage({viewport:{width:1200,height:780},deviceScaleFactor:1});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 try{
  await page.goto('http://127.0.0.1:8765/?test=1',{waitUntil:'domcontentloaded',timeout:35000});
  await page.waitForFunction(()=>!!window.fishmanTest&&!!window.FishmanMultiplayerBridge,{timeout:15000});
  await fn(page);
  assert.deepEqual(errors,[],'browser exceptions');
  console.log('PASS '+label+' '+name);
 }catch(e){
  failures.push(label+' '+name+': '+(e.stack||e.message));
  await page.screenshot({path:'/tmp/fishman-root-'+label+'-'+name+'.png'}).catch(()=>{});
 }finally{await page.close();}
}
for(const [label,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true,args:label==='chromium'?['--no-sandbox','--disable-dev-shm-usage']:[]});
 await suite(browser,label,'all-ten-chapters',async page=>{
  for(let chapter=0;chapter<10;chapter++){
   const data=await page.evaluate(i=>{
    fishmanTest.intro(i);fishmanTest.start(0);
    return {scene:fishmanTest.get().scene,chapter:fishmanTest.get().level,hasWorld:!!FishmanMultiplayerBridge.getG()};
   },chapter);
   assert.equal(data.scene,'playing','chapter '+(chapter+1));
   assert.equal(data.chapter,chapter);
   assert.ok(data.hasWorld);
  }
 });
 await suite(browser,label,'full-body-and-terrain',async page=>{
  await page.evaluate(()=>{
   window.__heroDraws=[];
   const master=FishmanVisualMaster.hero, modern=FishmanV29Art.fish;
   FishmanVisualMaster.hero=(canvas,opts)=>{window.__heroDraws.push({...opts});return master(canvas,opts);};
   FishmanV29Art.fish=(canvas,opts)=>{window.__heroDraws.push({...opts});return modern(canvas,opts);};
   fishmanTest.intro(0);fishmanTest.start(0);fishmanTest.selectHero('fish');
  });
  await page.waitForFunction(()=>window.__heroDraws.some(x=>x.type==='fish'&&x.fullBody===true),{timeout:6000});
  const land=await page.evaluate(()=>({
   mode:fishmanTest.modeFor('fish',400),
   draws:window.__heroDraws.filter(x=>x.type==='fish')
  }));
  assert.equal(land.mode,'hover');
  assert.ok(land.draws.some(x=>x.fullBody===true),'Chapter 1 hover pod cropped Fishman');
  await page.evaluate(()=>{window.__heroDraws=[];fishmanTest.teleport(1300,340);});
  await page.waitForFunction(()=>window.__heroDraws.some(x=>x.type==='fish'&&x.fullBody===true),{timeout:6000});
  const sea=await page.evaluate(()=>({
   mode:fishmanTest.modeFor('fish',1300),
   draws:window.__heroDraws.filter(x=>x.type==='fish')
  }));
  assert.equal(sea.mode,'swim');
  assert.ok(sea.draws.some(x=>x.fullBody===true),'swimming Fishman did not use full-body image');
  const modes=await page.evaluate(()=>({
   roxyWater:fishmanTest.modeFor('roxy',1300),
   humptyLand:fishmanTest.modeFor('humpty',400),
   humptyWater:fishmanTest.modeFor('humpty',1300),
   kaiLand:fishmanTest.modeFor('kai',400)
  }));
  assert.equal(modes.roxyWater,'blocked');
  assert.equal(modes.humptyLand,'roll');
  assert.equal(modes.humptyWater,'float');
  assert.equal(modes.kaiLand,'run');
 });
 await suite(browser,label,'three-dimensional-pickups',async page=>{
  await page.evaluate(()=>{
   window.__weaponDraws=[];
   const prior=FishmanV28Art.weapon,modern=FishmanV29Art.weapon;
   FishmanV28Art.weapon=(canvas,...args)=>{window.__weaponDraws.push(args[0]);return prior(canvas,...args);};
   FishmanV29Art.weapon=(canvas,...args)=>{window.__weaponDraws.push(args[0]);return modern(canvas,...args);};
   fishmanTest.intro(0);fishmanTest.start(0);
   FishmanMultiplayerBridge.getG().weaponPickups=[{x:430,y:325,type:'rapid',got:false},{x:540,y:380,type:'charge',got:false}];
  });
  await page.waitForTimeout(200);
  const seen=await page.evaluate(()=>window.__weaponDraws);
  assert.ok(seen.includes('rapid')&&seen.includes('charge'),'Dimensional weapon objects did not render');
 });
 await suite(browser,label,'player-two-movement-aim-and-synchronisation',async page=>{
  const before=await page.evaluate(()=>{
   FishmanNet.role='host';FishmanNet.connected=true;FishmanNet.remoteHero='kai';
   FishmanNet.input={x:.82,y:-.30,aim:{x:-.85,y:.25},fire:false,skill:false,interact:false,hero:null};
   FishmanNet.lastInputAt=Date.now();
   FishmanMultiplayerBridge.startCoop(0);
   const g=FishmanMultiplayerBridge.getG();
   return {x:g.x,p2x:g.coopP2.x,p2phase:g.coopP2.stepPhase};
  });
  await page.waitForFunction(threshold=>{FishmanNet.lastInputAt=Date.now();return FishmanMultiplayerBridge.getG()?.coopP2?.x>threshold;},before.p2x+20,{timeout:8000,polling:100});
  const after=await page.evaluate(()=>{
   const g=FishmanMultiplayerBridge.getG(),p=g.coopP2;
   return {hostX:g.x,p2x:p.x,phase:p.stepPhase,poseFacing:p.poseFacing,poseAngle:p.poseAngle,aim:p.lastAim,mode:fishmanTest.modeFor(p.hero,p.x)};
  });
  assert.ok(after.p2x>before.p2x+20,'P2 joystick did not move P2');
  assert.ok(Math.abs(after.hostX-before.x)<5,'P2 input moved P1');
  assert.ok(after.phase>before.p2phase,'P2 animation phase frozen');
  assert.ok(Number.isFinite(after.poseFacing)&&Number.isFinite(after.poseAngle),'P2 pose is NaN');
  assert.ok(after.aim.x<-.7,'P2 independent right-stick aim lost');
  const synced=await page.evaluate(()=>{
   const packet=structuredClone(FishmanMultiplayerBridge.getPacket());
   const authoritativeX=packet.g.coopP2.x;
   FishmanNet.role='guest';FishmanNet.connected=true;
   FishmanMultiplayerBridge.applySnapshot(packet);
   const g=FishmanMultiplayerBridge.getG();
   return {scene:FishmanMultiplayerBridge.getScene(),p2:g.coopP2.hero,
    hostX:g.x,p2x:g.coopP2.x,authoritativeX,p2Pose:g.coopP2.poseFacing,remote:FishmanNet.remoteHero};
  });
  assert.equal(synced.scene,'playing');
  assert.equal(synced.p2,'kai');
  assert.equal(synced.remote,'kai');
  assert.ok(Number.isFinite(synced.p2Pose));
  assert.equal(synced.p2x,synced.authoritativeX,'snapshot changed authoritative P2 position');
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>FishmanMultiplayerBridge.getG().coopP2.x),synced.authoritativeX,
   'guest visual interpolation mutated authoritative coordinates');
  const ordered=await page.evaluate(()=>{
   const n=FishmanNet,sent=[];
   n.connection={open:true,dataChannel:{bufferedAmount:0},send:packet=>sent.push(packet)};
   n.role='host';n.connected=true;n.nextSnapshotSeq=0;
   n.sendSnapshot(performance.now(),true);n.sendSnapshot(performance.now()+90,true);
   n.role='guest';n.nextInputSeq=0;n.lastControlSend=0;
   n.sendInput(performance.now()+1000,{x:1,y:0,fire:false,aim:null});
   n.sendInput(performance.now()+1100,{x:.2,y:0,fire:true,aim:{x:1,y:0}});
   n.connection=null;
   return {snapshots:sent.filter(x=>x.kind==='sync').map(x=>x.seq),
    inputs:sent.filter(x=>x.kind==='input').map(x=>x.seq)};
  });
  assert.deepEqual(ordered.snapshots,[1,2],'snapshots lack monotonic sequence');
  assert.deepEqual(ordered.inputs,[1,2],'guest joystick commands lack sequence');
 });
 await browser.close();
}
if(failures.length){
 console.error(failures.join('\n\n'));
 process.exitCode=1;
}else console.log('All Fishman master visual / terrain / co-op browser suites passed.');
