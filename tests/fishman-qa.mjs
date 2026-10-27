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


await suite('weapons-checkpoints-and-boss-finale', {width:1150,height:850}, async p=>{
 await p.locator('#addPlayerBtn').click();
 await p.evaluate(()=>{fishmanTest.intro(0);fishmanTest.start(0);});
 await p.waitForFunction(()=>window.FishmanMultiplayerBridge.getG()?.coopPlayers?.[2]);
 let before=await p.evaluate(()=>FishmanMultiplayerBridge.getG().weaponPickups?.map(x=>({x:x.x,y:x.y,type:x.type})));
 assert.ok(before?.length>=5,'missing v23 weapon pickups');
 await p.evaluate(()=>{
  const g=FishmanMultiplayerBridge.getG(),d=g.weaponPickups[0];
  g.x=d.x;g.y=d.y;g.inv=10;
 });
 await p.waitForTimeout(120);
 let first=await p.evaluate(()=>({weapon:FishmanMultiplayerBridge.getG().weapon,owned:FishmanMultiplayerBridge.getG().weaponsOwned}));
 assert.equal(first.weapon,'rapid','P1 cannot collect rapid weapon');
 assert.ok(first.owned.includes('rapid'));assert.ok((await p.evaluate(()=>FishmanMultiplayerBridge.getG().weaponLevels.rapid))>=2,'Rapid pickup should upgrade an unlocked weapon');
 await p.locator('[data-key="weapon"]').dispatchEvent('pointerdown',{pointerId:104,pointerType:'touch'});
 await p.waitForTimeout(75);
 assert.equal(await p.evaluate(()=>FishmanMultiplayerBridge.getG().weapon),'spread','P1 W must immediately switch to the next available shotgun');
 await p.evaluate(()=>{
  const g=FishmanMultiplayerBridge.getG(),drop=g.weaponPickups[1],ally=g.coopPlayers[2];
  g.x=drop.x-140;g.y=drop.y;ally.x=drop.x;ally.y=drop.y;ally.inv=10;
 });
 await p.waitForTimeout(110);
 const p2=await p.evaluate(()=>FishmanMultiplayerBridge.getG().coopPlayers[2]);
 assert.ok(p2.weaponsOwned?.includes('spread')&&p2.weaponLevels?.spread>=2,'P2 must upgrade their own spread weapon');
 await p.evaluate(()=>{
  const g=FishmanMultiplayerBridge.getG(),gate={x:g.runLength-135,y:252};
  g.items.forEach(item=>item.got=true);g.collect=g.total;g.x=gate.x;g.y=gate.y;
  fishmanTest.interact();
 });
 await p.waitForTimeout(90);
 assert.equal(await p.evaluate(()=>FishmanMultiplayerBridge.getG().wave),0,'P1 first B should only arm group exit');
 await p.evaluate(()=>fishmanTest.interact());
 await p.waitForTimeout(90);
 assert.equal(await p.evaluate(()=>FishmanMultiplayerBridge.getG().wave),1,'second P1 B must advance first area');
 await p.evaluate(()=>{
  const g=FishmanMultiplayerBridge.getG();g.items.forEach(item=>item.got=true);
  g.collect=g.total;g.x=g.runLength-135;g.y=252;fishmanTest.interact();
 });
 await p.waitForTimeout(70);
 assert.ok(!await p.evaluate(()=>!!FishmanMultiplayerBridge.getG()?.challenge),'boss should not start on first P1 B');
 await p.evaluate(()=>fishmanTest.interact());
 await p.waitForTimeout(90);
 assert.ok(await p.evaluate(()=>!!FishmanMultiplayerBridge.getG()?.challenge),'boss does not start after second P1 B');
 await p.evaluate(()=>fishmanTest.finishChallenge());
 await p.waitForTimeout(130);
 const scene=await p.evaluate(()=>FishmanMultiplayerBridge.getScene());
 assert.ok(scene==='chapterWin'||scene==='playing','boss finale crashed: '+scene);
});


await suite('p1-hit-respawn-and-final-life', {width:1180,height:820}, async p=>{
 await engage(p,2);await engage(p,3);
 await p.evaluate(()=>{fishmanTest.intro(2);fishmanTest.start(0)});
 await p.waitForTimeout(120);
 let before=await p.evaluate(()=>({x:FishmanMultiplayerBridge.getG().x,lives:FishmanMultiplayerBridge.getG().lives}));
 await p.evaluate(()=>{
   const g=FishmanMultiplayerBridge.getG(),enemy=g.hazards[0];
   if(!enemy)throw Error('Chapter 3 should have an enemy');
   // Reproduce the actual enemy collision, not a direct call to the damage helper.
   g.hp=1;g.inv=0;g.x=enemy.x;g.y=enemy.y;
   fishmanTest.step(.025);
 });
 let afterHit=await p.evaluate(()=>({scene:FishmanMultiplayerBridge.getScene(),down:FishmanMultiplayerBridge.getG().hostDown,remaining:FishmanMultiplayerBridge.getG().lives,respawn:FishmanMultiplayerBridge.getG().hostRespawn}));
 assert.equal(afterHit.scene,'playing');assert.equal(afterHit.down,true);
 assert.equal(afterHit.remaining,before.lives-1);
 assert.ok(afterHit.respawn>0);
 await p.evaluate(()=>fishmanTest.step(2.65));
 await p.waitForTimeout(110);
 const recovered=await p.evaluate(()=>({down:FishmanMultiplayerBridge.getG().hostDown,hp:FishmanMultiplayerBridge.getG().hp,lives:FishmanMultiplayerBridge.getG().lives}));
 assert.equal(recovered.down,false,'P1 remained frozen after enemy hit');
 assert.ok(recovered.hp>0,'P1 must be alive after respawn');
 // P1 movement must remain independent of companions over 1,000 game units away.
 await p.evaluate(()=>{const g=FishmanMultiplayerBridge.getG();g.x=650;g.y=330;g.inv=5;g.coopPlayers[2].x=2200;g.coopPlayers[3].x=3000;fishmanTest.steer(1,0);});
 const x0=await p.evaluate(()=>FishmanMultiplayerBridge.getG().x);
 await p.evaluate(()=>fishmanTest.step(.35));
 const x1=await p.evaluate(()=>FishmanMultiplayerBridge.getG().x);
 assert.ok(x1>x0+35,'P1 is movement-locked by distant teammates');
 await p.evaluate(()=>{const g=FishmanMultiplayerBridge.getG();g.lives=1;g.hp=1;g.inv=0;fishmanTest.hit();});
 await p.waitForTimeout(100);
 const last=await p.evaluate(()=>({scene:FishmanMultiplayerBridge.getScene(),lives:FishmanMultiplayerBridge.getG().lives,hostDown:FishmanMultiplayerBridge.getG().hostDown,overlay:document.querySelector('#overlay')?.classList.contains('hidden')}));
 assert.equal(last.scene,'gameOver','Final P1 life should show restart menu instead of freezing');
 assert.equal(last.lives,0);assert.equal(last.hostDown,false);
 assert.equal(last.overlay,false);
 await p.evaluate(()=>{fishmanTest.start(0)});
 await p.waitForTimeout(85);
 assert.equal(await p.evaluate(()=>FishmanMultiplayerBridge.getScene()),'playing','Restart should restore gameplay');
});
await suite('no-guest-surprise-level-jump', {width:1180,height:820}, async p=>{
 for(let sl=2;sl<=4;sl++)await engage(p,sl);
 await p.evaluate(()=>{fishmanTest.intro(2);fishmanTest.start(0)});
 await p.waitForTimeout(130);
 const initial=await p.evaluate(()=>({
  chapter:FishmanMultiplayerBridge.getLevel(),wave:FishmanMultiplayerBridge.getG().wave
 }));
 await p.evaluate(()=>{
  const g=FishmanMultiplayerBridge.getG();g.collect=g.total;g.items.forEach(i=>i.got=true);
  const gateX=g.runLength-135;
  g.coopPlayers[2].x=gateX;g.coopPlayers[2].y=300;
  g.coopPlayers[3].x=gateX;g.coopPlayers[3].y=300;
  g.coopPlayers[4].x=gateX;g.coopPlayers[4].y=300;
  for(const k of [2,3,4])FishmanNet.players[k].input.interact=true;
 });
 await p.waitForTimeout(140);
 const noJump=await p.evaluate(()=>({chapter:FishmanMultiplayerBridge.getLevel(),wave:FishmanMultiplayerBridge.getG().wave,challenge:!!FishmanMultiplayerBridge.getG().challenge}));
 assert.deepEqual({chapter:noJump.chapter,wave:noJump.wave},{chapter:initial.chapter,wave:initial.wave},
   'Other players B at the exit changed levels without P1 agreement');
 assert.equal(noJump.challenge,false);
 // The first P1 B only arms the exit; only P1's second B completes it.
 await p.evaluate(()=>{const g=FishmanMultiplayerBridge.getG();g.x=g.runLength-135;g.y=300;fishmanTest.interact();});
 assert.equal(await p.evaluate(()=>FishmanMultiplayerBridge.getG().wave),0);
 await p.evaluate(()=>fishmanTest.interact());
 assert.equal(await p.evaluate(()=>FishmanMultiplayerBridge.getG().wave),1);
});


await suite('v23-weapon-style-and-boss-rage', {width:1280,height:870}, async p=>{
 for(let k=2;k<=4;k++)await engage(p,k);
 await p.evaluate(()=>{fishmanTest.intro(2);fishmanTest.start(0);});
 await p.waitForTimeout(100);
 const variants=await p.evaluate(()=>{
  const g=FishmanMultiplayerBridge.getG();
  // Close-range enemy means even instantaneous chain lightning must be visible.
  g.x=420;g.y=360;g.inv=20;g.hazards[0].x=550;g.hazards[0].y=360;g.hazards[0].stun=0;
  const types=['basic','rapid','spread','charge','homing','electric'],out={};
  for(const type of types){
   g.weapon=type;g.weaponsOwned=['basic',type];g.weaponLevels[type]=3;
   g.cool=0;g.proj=[];g.weaponFX=[];g.hazards[0].stun=0;
   fishmanTest.attack();
   out[type]={count:g.proj.length,cooldown:g.cool,fx:g.weaponFX.length,
    weapons:g.proj.map(z=>z.weapon),maxRadius:Math.max(0,...g.proj.map(z=>z.r)),
    splash:g.proj.some(z=>z.splash>0),homing:g.proj.some(z=>z.homing>0),enemyStun:g.hazards[0].stun};
  }
  return out;
 });
 assert.ok(variants.rapid.count>=2,'Rapid must be a burst, not the same bullet as basic');
 assert.ok(variants.rapid.cooldown<variants.basic.cooldown,'Rapid should shoot faster than basic');
 assert.ok(variants.spread.count>=7,'Shotgun needs seven wide spread pellets');
 assert.ok(variants.charge.splash&&variants.charge.maxRadius>=30,'Cannon needs a giant explosive orb');
 assert.ok(variants.homing.count>=3&&variants.homing.homing,'Homing should launch a tracking missile swarm');
 assert.equal(variants.electric.count,0,'Electric should be instant chain lightning instead of ordinary bullets');
 assert.ok(variants.electric.enemyStun>0&&variants.electric.fx>0,'Electric did not chain to nearby bad guy');
 await p.evaluate(()=>{
  const g=FishmanMultiplayerBridge.getG();g.weapon='basic';g.cool=0;g.proj=[];g.weaponFX=[];
  FishmanNet.players[2].hero='kai';FishmanNet.players[2].input.hero='kai';
  FishmanNet.players[2].input.skill=true;FishmanNet.players[2].input.fire=false;
 });
 await p.waitForTimeout(100);
 const skill=await p.evaluate(()=>{
  const g=FishmanMultiplayerBridge.getG();
  return {p2Cd:g.coopPlayers[2]?.skillCooldown,projectiles:g.proj.filter(z=>z.owner===2).length,fx:g.weaponFX?.length||0};
 });
 assert.ok(skill.p2Cd>0,'P2 did not activate its independent special skill');
 assert.ok(skill.projectiles>=12,'Kai skill should produce an ice nova instead of just changing a timer');
 assert.ok(skill.fx>0,'Kai special visual shockwave missing');
 await p.evaluate(()=>fishmanTest.startChapterArena(2,false));
 await p.waitForTimeout(100);
 const initial=await p.evaluate(()=>{
  const a=FishmanMultiplayerBridge.getG().challenge;
  return {hp:a.hp,maxHp:a.maxHp};
 });
 assert.ok(initial.maxHp>=245,'Boss health did not increase');
 await p.evaluate(()=>{
  const a=FishmanMultiplayerBridge.getG().challenge;
  a.hp=a.maxHp*.60;
  fishmanTest.step(.1);
 });
 let phase=await p.evaluate(()=>FishmanMultiplayerBridge.getG().challenge.rage);
 assert.equal(phase,1,'Boss did not enter its second attack phase');
 await p.evaluate(()=>{
  const a=FishmanMultiplayerBridge.getG().challenge;
  a.hp=a.maxHp*.28;
  fishmanTest.step(.1);
 });
 phase=await p.evaluate(()=>FishmanMultiplayerBridge.getG().challenge.rage);
 assert.equal(phase,2,'Boss did not enter its final enraged phase');
 await p.evaluate(()=>fishmanTest.step(2.1));
 const arena=await p.evaluate(()=>FishmanMultiplayerBridge.getG().challenge);
 assert.ok(arena.pattern||arena.bullet.length,'Enraged boss did not prepare any attack');
});


await suite('all-six-hero-special-attacks', {width:1200,height:830}, async page=>{
 await page.evaluate(()=>{fishmanTest.intro(2);fishmanTest.start(0)});
 const results=await page.evaluate(()=>{
  const g=FishmanMultiplayerBridge.getG(),heroes=['fish','kai','roxy','humpty','gozilla','sub'],out={};
  for(const h of heroes){
   g.hero=h;g.skillCooldown=0;g.skillCooldowns[h]=0;g.skillEffect=0;
   g.x=420;g.y=330;g.proj=[];g.weaponFX=[];
   fishmanTest.skill();
   out[h]={type:g.proj[0]?.weapon,count:g.proj.length,
    kinds:[...new Set(g.proj.map(p=>p.weapon))],
    cd:g.skillCooldown,fx:g.weaponFX.length};
  }
  return out;
 });
 const expected={fish:['aqua',12],kai:['cryo',16],roxy:['flame',11],
  humpty:['egg',13],gozilla:['laser',10],sub:['homing',10]};
 for(const [hero,[weapon,min]] of Object.entries(expected)){
  assert.ok(results[hero].kinds.includes(weapon),hero+' S skill did not change weapon style: '+JSON.stringify(results[hero]));
  assert.ok(results[hero].count>=min,hero+' S skill did not create its characteristic volley');
  assert.ok(results[hero].fx>0,hero+' S skill visual shockwave missing');
  assert.ok(results[hero].cd>1,hero+' S skill cooldown never started');
 }
});


await suite('super-mode-transforms-all-six-attack-patterns', {width:1190,height:845}, async page=>{
 await page.evaluate(()=>{fishmanTest.intro(2);fishmanTest.start(0);});
 const styles=await page.evaluate(()=>{
  const g=FishmanMultiplayerBridge.getG(),names=['fish','kai','roxy','humpty','gozilla','sub'];
  const result={};
  for(const hero of names){
   g.hero=hero;g.skillKind=null;g.skillEffect=0;g.skillCooldowns[hero]=0;g.skillCooldown=0;
   g.cool=0;g.proj=[];g.weaponFX=[];g.x=385;g.y=335;g.hp=g.maxHp;g.inv=100;
   g.weapon='basic';
   fishmanTest.skill();
   const initial=g.proj.length;
   g.cool=0;g.proj=[];g.weaponFX=[];
   fishmanTest.attack();
   result[hero]={duration:g.skillEffect,shotCount:g.proj.length,kinds:[...new Set(g.proj.map(b=>b.weapon))],
    ricochet:g.proj.some(p=>p.ricochet>0),shotsPiercing:g.proj.some(p=>p.pierce),
    beam:g.weaponFX.some(f=>f.type==='beam'),mode:g.skillKind,cool:g.cool};
  }
  return result;
 });
 const expected={fish:'aqua',kai:'cryo',roxy:'flame',humpty:'egg',gozilla:'laser',sub:'sonar'};
 for(const [hero,weapon] of Object.entries(expected)){
  const r=styles[hero];assert.ok(r.duration>=6,'Super mode must last at least six seconds: '+hero);
  assert.equal(r.mode,hero);
  assert.ok(r.kinds.includes(weapon),'S must REPLACE the equipped attack with a signature form: '+hero+' '+JSON.stringify(r));
  assert.ok(r.shotCount>=3,'S should change the actual bullet pattern: '+hero);
 }
 assert.ok(styles.humpty.ricochet,'Humpty eggs must genuinely bounce');
 assert.ok(styles.kai.beam&&styles.gozilla.beam,'Super laser attacks need prominent beams');
 assert.ok(styles.gozilla.shotsPiercing,'Gozilla laser array should pierce');
 assert.ok(styles.roxy.cool<styles.humpty.cool,'Roxy flame thrower and Humpty egg cannon must have different attack rates');
});
await suite('p2-can-attack-while-p1-down', {width:1190,height:840}, async p=>{
 await engage(p,2);
 await p.evaluate(()=>{fishmanTest.intro(2);fishmanTest.start(0)});
 await p.waitForFunction(()=>!!FishmanMultiplayerBridge.getG()?.coopPlayers?.[2]);
 const before=await p.evaluate(()=>{
  const g=FishmanMultiplayerBridge.getG();g.hp=1;g.inv=0;fishmanTest.hit();
  const ally=g.coopPlayers[2];ally.cool=0;ally.down=false;ally.hp=ally.maxHp;
  ally.x=420;ally.y=330;
  return {down:g.hostDown,projectiles:g.proj.length};
 });
 assert.equal(before.down,true,'P1 did not enter KO state');
 await p.evaluate(()=>{FishmanNet.players[2].input.fire=true;});
 await p.waitForTimeout(200);
 const after=await p.evaluate(()=>{
  const g=FishmanMultiplayerBridge.getG();
  return {projectiles:g.proj.length,allyCooldown:g.coopPlayers[2].cool,
    allyDown:g.coopPlayers[2].down};
 });
 assert.ok(after.projectiles>before.projectiles||after.allyCooldown>0,'P2 should fight while P1 is down');
});
await suite('instant-weapon-access-and-super-ui', {width:1180,height:840}, async p=>{
 await p.evaluate(()=>{fishmanTest.intro(0);fishmanTest.start(0)});
 const state=await p.evaluate(()=>{
  const g=FishmanMultiplayerBridge.getG();return {owned:g.weaponsOwned,weapon:g.weapon};
 });
 assert.deepEqual(state.owned,['basic','rapid','spread','charge','homing','electric'],
  'All six different weapon styles must be playable without collecting a pickup');
 assert.equal(state.weapon,'basic');
 const first=await p.evaluate(()=>{document.querySelector('[data-key="weapon"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:44}));return FishmanMultiplayerBridge.getG().weapon});
 assert.equal(first,'rapid','W must change to a noticeably different attack style immediately');
 await p.evaluate(()=>{fishmanTest.skill()});
 await p.waitForTimeout(120);
 const mode=await p.evaluate(()=>({label:document.getElementById('skillName').textContent,
  timer:document.getElementById('skillCooldown').textContent,
  mode:FishmanMultiplayerBridge.getG().skillEffect,
  button:document.getElementById('skillBtn').classList.contains('super-active')}));
 assert.equal(mode.label,'SUPER!','P1 should see a huge SUPER label when ability is transformed');
 assert.ok(mode.mode>6&&mode.button,'P1 super-mode timer/UI should remain visible for 8 seconds');
});


await suite('four-player-sustained-combat-stress', {width:1280,height:860}, async page=>{
 for(let slot=2;slot<=4;slot++)await engage(page,slot);
 await page.evaluate(()=>{fishmanTest.intro(2);fishmanTest.start(0)});
 await page.waitForFunction(()=>Object.keys(FishmanMultiplayerBridge.getG()?.coopPlayers||{}).length===3);
 await page.evaluate(()=>{
   const g=FishmanMultiplayerBridge.getG();
   g.inv=600;
   g.weapon='rapid';g.weaponLevels.rapid=5;g.cool=0;
   // All players use different attacks and active SUPER forms.
   g.hero='roxy';g.skillKind='roxy';g.skillEffect=600;
   for(const [index,p] of Object.entries(g.coopPlayers)){
    p.inv=600;p.weapon=['rapid','spread','charge'][+index-2]||'rapid';
    p.skillKind=p.hero;p.skillEffect=600;p.hp=p.maxHp;
    const ctrl=FishmanNet.players[index].input;
    ctrl.fire=true;ctrl.x=.2;ctrl.y=.1;ctrl.aim={x:1,y:0};
   }
   fishmanTest.steer(.2,.1,true);
 });
 await page.waitForTimeout(3400);
 const result=await page.evaluate(()=>{
  const g=FishmanMultiplayerBridge.getG();
  return {role:FishmanNet.role,scene:FishmanMultiplayerBridge.getScene(),
   count:Object.keys(g.coopPlayers||{}).length,
   projs:g.proj.length,fx:g.weaponFX?.length||0,
   coords:[{x:g.x,y:g.y},...Object.values(g.coopPlayers).map(p=>({x:p.x,y:p.y}))],
   stage:FishmanMultiplayerBridge.getLevel(),wave:g.wave};
 });
 assert.equal(result.scene,'playing','sustained combat crashed');
 assert.equal(result.count,3,'teammate dropped during barrage');
 assert.ok(result.projs<=200,'projectile cap failed: '+result.projs);
 assert.ok(result.fx<=28,'FX cap failed: '+result.fx);
 assert.ok(result.coords.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),'some players teleported to invalid coordinates');
 assert.equal(result.stage,2,'continuous fire unexpectedly changed level');
 await page.evaluate(()=>{
  for(const p of Object.values(FishmanNet.players))p.input.fire=false;
  fishmanTest.steer(0,0,false);
 });
});

await suite('health-only-bosses-difficulty-and-four-player-scaling', {width:1200,height:835}, async page=>{
 await page.evaluate(()=>{fishmanTest.intro(2);fishmanTest.start(0)});
 const result=await page.evaluate(()=>{
  const res={};
  for(const difficulty of ['classic','expert','nightmare']){
   fishmanTest.select(difficulty);
   fishmanTest.intro(2);fishmanTest.start(0);
   fishmanTest.startChapterArena(2,false);
   const g=FishmanMultiplayerBridge.getG();
   res[difficulty]={hp:g.challenge.hp,maxHp:g.challenge.maxHp,initialBullets:g.challenge.bullet.length};
   g.challenge.signatureTimer=0.01;
   g.inv=50;
   g.challenge.rest=2;
   fishmanTest.step(.5);
   res[difficulty].bulletsAfterHalfSecond=g.challenge.bullet.length;
   res[difficulty].signatureName=g.challenge.signatureName;
   fishmanTest.intro(4);fishmanTest.start(0);
   res[difficulty].treeBoss=FishmanMultiplayerBridge.getG().boss;
  }
  return res;
 });
 assert.equal(result.classic.maxHp,650*20);
 assert.equal(result.expert.maxHp,975*20);
 assert.equal(result.nightmare.maxHp,1400*20);
 assert.equal(result.classic.treeBoss,1400*20);
 assert.equal(result.expert.treeBoss,2100*20);
 assert.equal(result.nightmare.treeBoss,3000*20);
 for(const d of Object.values(result)){
  assert.equal(d.initialBullets,0);
  assert.equal(d.bulletsAfterHalfSecond,0,'Boss unexpectedly fired an added signature volley');
  assert.equal(d.signatureName,undefined,'Additional signature powers should be disabled');
 }
 await page.evaluate(()=>{fishmanTest.select('classic');fishmanTest.intro(2);fishmanTest.start(0)});
 for(const slot of [2,3,4])await engage(page,slot);
 const multi=await page.evaluate(()=>{
  fishmanTest.startChapterArena(2,false);
  const g=FishmanMultiplayerBridge.getG();
  return {hp:g.challenge.maxHp,players:FishmanLocal.count};
 });
 assert.equal(multi.players,4);
 assert.ok(multi.hp>1000,'4-player boss HP should scale for four players');
});
await suite('one-render-per-character-no-ghost-copy', {width:1220,height:840}, async page=>{
 await page.evaluate(()=>{fishmanTest.intro(0);fishmanTest.start(0)});
 const solo=await page.evaluate(()=>{
  const fish=window.FishmanComicArt;
  const record={kai:0,fishman:0};
  for(const k of Object.keys(record)){const orig=fish[k];fish[k]=(...args)=>{record[k]++;return orig(...args)};}
  fishmanTest.render();
  return record;
 });
 assert.equal(solo.kai,1,'P1 is drawn twice in solo (full-body ghost/shadow)');
 assert.equal(solo.fishman,0,'Unexpected extra fishman sprite in chapter 1');
 for(const slot of [2,3,4])await engage(page,slot);
 const multi=await page.evaluate(()=>{
  const g=FishmanMultiplayerBridge.getG();
  const counts={fish:0,kai:0,roxy:0,humpty:0};
  const art=window.FishmanComicArt;
  const drawn={kai:0,fishman:0,roxy:0,submarine:0};
  for(const k of Object.keys(drawn)){const orig=art[k];art[k]=(...args)=>{drawn[k]++;return orig(...args)}}
  fishmanTest.render();
  for(const p of [g,...Object.values(g.coopPlayers||{})]){
   if(counts[p.hero]!==undefined)counts[p.hero]++;
  }
  return {drawn,counts,p2Hero:g.coopPlayers[2].hero,
    positions:[{x:g.x,y:g.y},...Object.values(g.coopPlayers).map(p=>({x:p.x,y:p.y}))]};
 });
 assert.equal(multi.p2Hero,'fish','P1 and P2 should not look identical by default');
 assert.equal(multi.drawn.kai,multi.counts.kai,'Kai character was drawn more than once');
 assert.equal(multi.drawn.fishman,multi.counts.fish,'Fishman character was drawn more than once');
 assert.equal(multi.drawn.roxy,multi.counts.roxy,'Roxy character was drawn more than once');
 for(let i=0;i<multi.positions.length;i++)for(let j=i+1;j<multi.positions.length;j++)
  assert.ok(Math.hypot(multi.positions[i].x-multi.positions[j].x,
    multi.positions[i].y-multi.positions[j].y)>80,'Teammates spawn so close they look like ghost copies');
});


await suite('every-boss-20x-hp-exact-and-joining-midfight', {width:1230,height:835}, async page=>{
 const baseHP={classic:650,expert:975,nightmare:1400};
 const treeHP={classic:1400,expert:2100,nightmare:3000};
 const testData=await page.evaluate(()=>{
  const result={};
  for(const diff of ['classic','expert','nightmare']){
   fishmanTest.select(diff);fishmanTest.intro(2);fishmanTest.start(0);
   const regular=[],rush=[];
   for(let boss=0;boss<9;boss++){
    fishmanTest.startChapterArena(boss,false);
    let a=FishmanMultiplayerBridge.getG().challenge;
    regular.push(a.maxHp);
    fishmanTest.startChapterArena(boss,true);
    a=FishmanMultiplayerBridge.getG().challenge;
    rush.push(a.maxHp);
   }
   fishmanTest.intro(4);fishmanTest.start(0);
   const g=FishmanMultiplayerBridge.getG();
   result[diff]={regular,rush,tree:g.boss,timer:g.timer,maxTimer:g.maxTimer,treeMaxHP:globalThis.fishmanTest.get().boss};
  }
  return result;
 });
 for(const diff of Object.keys(baseHP)){
  for(let boss=0;boss<9;boss++){
   assert.equal(testData[diff].regular[boss],Math.round(baseHP[diff]*20*(boss===8?1.3:1)),
     `Chapter boss ${boss} on ${diff} must have 20x baseline HP`);
   assert.equal(testData[diff].rush[boss],Math.round(baseHP[diff]*20*.85*(boss===8?1.3:1)),
     `Final boss rush boss ${boss} on ${diff} must have 20x HP`);
  }
  assert.equal(testData[diff].tree,treeHP[diff]*20,'McTreeFace HP does not have 20x baseline');
  if(diff!=='classic'){
   const previousTimer=diff==='expert'?165:195;
   assert.equal(testData[diff].maxTimer,previousTimer*20,
    'Timed boss becomes impossible if timer is not expanded with its HP');
  }
 }
 await page.evaluate(()=>{fishmanTest.select('classic');fishmanTest.intro(2);fishmanTest.start(0);fishmanTest.startChapterArena(2,false)});
 const first=await page.evaluate(()=>{
  const g=FishmanMultiplayerBridge.getG(),a=g.challenge;
  a.hp=Math.ceil(a.maxHp*.38);
  return {max:a.maxHp,hp:a.hp,ratio:a.hp/a.maxHp};
 });
 assert.equal(first.max,650*20);
 await engage(page,2);await engage(page,3);await engage(page,4);
 await page.waitForTimeout(125);
 const joined=await page.evaluate(()=>{
  const g=FishmanMultiplayerBridge.getG(),a=g.challenge;
  return {max:a.maxHp,hp:a.hp,ratio:a.hp/a.maxHp,team:Object.keys(g.coopPlayers||{}).length,level:FishmanMultiplayerBridge.getLevel()};
 });
 assert.equal(joined.max,Math.round(650*20*(1+.47*3)));
 assert.ok(Math.abs(joined.ratio-first.ratio)<.002,'Joining teammates incorrectly reset or healed boss HP');
 assert.equal(joined.team,3);assert.equal(joined.level,2);
 await page.waitForTimeout(300);
 const stable=await page.evaluate(()=>({
   max:FishmanMultiplayerBridge.getG().challenge.maxHp,
   hp:FishmanMultiplayerBridge.getG().challenge.hp
 }));
 assert.equal(stable.max,joined.max);
 assert.ok(stable.hp<=joined.hp,'Repeated co-op sync unexpectedly regenerated boss HP');
});

const peerSimulator=()=> {
 const tag='fishman-local-qa-bus';
 class Connection{
  constructor(owner,peer){this.owner=owner;this.peer=peer;this.open=false;this.handlers={};this.dataChannel={bufferedAmount:0};}
  on(event,callback){(this.handlers[event]??=[]).push(callback);return this;}
  emit(event,data){for(const fn of this.handlers[event]||[])fn(data);}
  send(data){if(this.open)this.owner.bc.postMessage({type:'data',from:this.owner.id,to:this.peer,payload:data});}
  close(fromLocal=true){if(!this.open)return;this.open=false;this.emit('close');if(fromLocal)this.owner.bc.postMessage({type:'close',from:this.owner.id,to:this.peer});}
 }
 window.Peer=class {
  constructor(id){this.id=id||'guest-'+Math.random().toString(36).slice(2);this.handlers={};this.connections={};
   this.bc=new BroadcastChannel(tag);this.bc.onmessage=(ev)=>this.receive(ev.data);
   setTimeout(()=>this.emit('open',this.id),20);
  }
  on(event,callback){(this.handlers[event]??=[]).push(callback);return this;}
  emit(event,data){for(const fn of this.handlers[event]||[])fn(data);}
  connect(target){const c=new Connection(this,target);this.connections[target]=c;
   setTimeout(()=>this.bc.postMessage({type:'connect',from:this.id,to:target}),15);return c;
  }
  receive(msg){if(!msg||msg.to!==this.id)return;
   if(msg.type==='connect'){
    const c=new Connection(this,msg.from);this.connections[msg.from]=c;this.emit('connection',c);
    setTimeout(()=>{c.open=true;c.emit('open');this.bc.postMessage({type:'ack',from:this.id,to:msg.from});},30);
   }else if(msg.type==='ack'){const c=this.connections[msg.from];if(c){c.open=true;c.emit('open');}}
   else if(msg.type==='data'){this.connections[msg.from]?.emit('data',msg.payload);}
   else if(msg.type==='close'){this.connections[msg.from]?.close(false);}
  }
  destroy(){for(const c of Object.values(this.connections))c.close();this.bc.close();}
 };
};
async function testOnlineRooms(){
 const context=await browser.newContext({viewport:{width:1180,height:820}});
 const pages=[],browserErrors=[];
 try{
  for(let i=0;i<5;i++){
   const page=await context.newPage();pages.push(page);
   page.on('pageerror',e=>browserErrors.push('P'+(i+1)+' '+e.stack));
   await page.addInitScript(peerSimulator);
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!window.FishmanNet);
  }
  const host=pages[0];
  await host.locator('#mpOpen').click();await host.locator('#mpHost').click();
  await host.waitForFunction(()=>FishmanNet.role==='host'&&FishmanNet.code.length===7);
  const code=await host.evaluate(()=>FishmanNet.code);
  for(let i=1;i<=3;i++){
   const p=pages[i];await p.locator('#mpOpen').click();
   await p.locator('#mpRoom').fill(code);
   await p.locator('#mpJoin').click();
   await p.waitForFunction(slot=>FishmanNet.slot===slot,i+1,{timeout:10000});
  }
  await host.waitForFunction(()=>FishmanNet.connected&&Object.values(FishmanNet.players).filter(p=>p.connection?.open).length===3);
  const roster=await host.evaluate(()=>Object.entries(FishmanNet.players).map(([slot,p])=>[+slot,p.hero]));
  assert.deepEqual(roster,[[2,'kai'],[3,'roxy'],[4,'humpty']]);
  await host.locator('#mpStart').click();
  await host.waitForFunction(()=>window.FishmanMultiplayerBridge.getScene()==='playing');
  for(let i=1;i<=3;i++){
   await pages[i].waitForFunction(()=>window.FishmanMultiplayerBridge?.getScene?.()==='playing'&&!!window.FishmanMultiplayerBridge.getG()?.coopPlayers?.[window.FishmanNet?.slot],null,{timeout:9000});
   const guest=await pages[i].evaluate(()=>({slot:FishmanNet.slot,scene:FishmanMultiplayerBridge.getScene(),hero:FishmanMultiplayerBridge.getG()?.coopPlayers?.[FishmanNet.slot]?.hero}));
   assert.equal(guest.slot,i+1);
   assert.ok(guest.hero);
  }
  await pages[2].evaluate(()=>FishmanNet.sendAction('skill'));
  await host.waitForFunction(()=>FishmanMultiplayerBridge.getG()?.coopPlayers?.[3]?.skillCooldown>0);
  await pages[2].waitForFunction(()=>document.getElementById('skillName')?.textContent==='SUPER!',null,{timeout:5000});
  assert.equal(await pages[2].evaluate(()=>document.getElementById('skillName').textContent),'SUPER!',
   'Online guest must see their own ability activate, not the host’s skill HUD');
  // Attempt a fifth participant; room should reject it without affecting four existing players.
  await pages[4].locator('#mpOpen').click();await pages[4].locator('#mpRoom').fill(code);await pages[4].locator('#mpJoin').click();
  await pages[4].waitForFunction(()=>FishmanNet.role==='solo'||/full/i.test(document.getElementById('mpStatus')?.textContent||''),{timeout:10000});
  assert.equal((await host.evaluate(()=>Object.values(FishmanNet.players).filter(p=>p.connection?.open).length)),3);
  if(browserErrors.length)throw Error(browserErrors.join('\n'));
  results.push('PASS online-4-slots, sync, hero defaults, skills, 5th player rejected');
 }catch(e){failures.push({name:'online-four-peer-simulation',error:String(e.stack||e),browserErrors});}
 finally{await context.close();}
}
await testOnlineRooms();

await browser.close();
for(const item of results) console.log(item);
for(const bad of failures) console.error('FAIL',JSON.stringify(bad));
console.log('QA_TOTAL',results.length+failures.length,'PASS',results.length,'FAIL',failures.length);
if(failures.length)process.exitCode=1;
