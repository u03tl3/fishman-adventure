import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
const visuals=fs.readFileSync('weapon-effects-v31.js','utf8');
assert.match(html,/function weaponTier\(/);
assert.match(html,/function fireElectric\(/);
assert.match(html,/persistWeaponProgress/);
assert.match(html,/weapon-effects-v31\.js/);
assert.match(visuals,/FishmanWeaponVisuals=\{shot,effect/);
assert.equal([...html.matchAll(/title:'[^']+'/g)].length>=10,true,'Chapter content lost');
new Function(visuals);
console.log('PASS v31 weapon effect code and historical content preserved');

const failures=[];
for(const [label,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true,args:label==='chromium'?['--no-sandbox','--disable-dev-shm-usage']:[]});
 const page=await browser.newPage({viewport:{width:1200,height:780}});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8765/?test=1',{waitUntil:'domcontentloaded',timeout:35000});
  await page.waitForFunction(()=>!!window.fishmanTest&&!!window.FishmanWeaponVisuals&&!!window.FishmanMultiplayerBridge,{timeout:18000});
  const comparison=await page.evaluate(()=>{
   fishmanTest.intro(2);fishmanTest.start(0);
   const g=FishmanMultiplayerBridge.getG();
   g.hero='fish';g.x=280;g.y=320;g.inv=10;
   const hazards=[[480,320],[515,340],[542,319],[565,325],[600,342],[631,322]].map(([x,y])=>({x,y,bx:x,by:y,ax:0,ay:0,rate:0,phase:0,stun:0,hp:3}));
   g.hazards=hazards;
   const result={};
   for(const level of [1,5]){
    for(const weapon of ['basic','rapid','spread','charge','homing','electric']){
     g.weapon=weapon;g.weaponsOwned=['basic','rapid','spread','charge','homing','electric'];g.weaponLevels[weapon]=level;
     g.proj=[];g.weaponFX=[];g.cool=0;for(const h of hazards){h.stun=0;h.hp=3;}
     fishmanTest.attack();
     result[weapon+level]={shots:g.proj.length,damage:g.proj[0]?.damage||0,radius:g.proj[0]?.r||0,
      splash:g.proj[0]?.splash||0,homing:g.proj[0]?.homing||0,pierce:g.proj[0]?.pierceRemaining||0,
      electricHits:hazards.filter(x=>x.stun>0).length,fx:g.weaponFX.map(f=>f.kind),cool:g.cool};
    }
   }
   return result;
  });
  const c=comparison;
  assert.equal(c.basic1.shots,1);assert.equal(c.rapid1.shots,2);assert.equal(c.spread1.shots,5);
  assert.equal(c.charge1.shots,1);assert.equal(c.homing1.shots,2);assert.equal(c.electric1.shots,0);
  assert.equal(c.basic5.shots,3);assert.equal(c.rapid5.shots,3);assert.equal(c.spread5.shots,9);
  assert.equal(c.homing5.shots,4);assert.ok(c.charge5.splash>c.charge1.splash);
  assert.ok(c.charge1.damage>c.basic1.damage*2);
  assert.ok(c.rapid1.damage<c.basic1.damage);assert.ok(c.rapid1.cool<c.charge1.cool);
  assert.ok(c.homing1.homing>0);assert.ok(c.rapid5.pierce>=2);
  assert.ok(c.electric1.electricHits>=1);
  assert.ok(c.electric5.electricHits>=c.electric1.electricHits);
  assert.ok(c.electric1.fx.includes('beam'));
  console.log('PASS '+label+' weapon individuality and level-5 mechanical milestones');

  const projectileHit=await page.evaluate(()=>{
   const g=FishmanMultiplayerBridge.getG();
   g.x=280;g.y=320;g.hero='fish';g.cool=0;g.weapon='charge';g.weaponLevels.charge=5;
   g.proj=[];g.weaponFX=[];
   g.hazards=[{x:405,y:320,bx:405,by:320,ax:0,ay:0,rate:0,phase:0,stun:0,hp:4},
    {x:448,y:320,bx:448,by:320,ax:0,ay:0,rate:0,phase:0,stun:0,hp:4}];
   fishmanTest.attack();
   fishmanTest.step(.24);
   return {secondary:g.hazards[1].stun,fx:g.weaponFX.map(e=>e.kind)};
  });
  assert.ok(projectileHit.secondary>0,'Charge cannon failed to damage/stun in its area');
  assert.ok(projectileHit.fx.includes('shock'),'Plasma explosion VFX absent');
  console.log('PASS '+label+' area-of-effect damage and blast visuals');

  const saved=await page.evaluate(()=>{
   const g=FishmanMultiplayerBridge.getG();g.cool=99;
   g.weapon='rapid';g.weaponLevels.rapid=1;g.weaponsOwned=['basic','rapid'];
   g.weaponPickups=[{x:g.x,y:g.y,type:'rapid',key:'v31-duplicate',got:false}];
   fishmanTest.step(.025);
   const upgraded=g.weaponLevels.rapid,after=JSON.parse(localStorage.getItem('fishmanV9'));
   fishmanTest.intro(2);fishmanTest.start(0);
   const restored=FishmanMultiplayerBridge.getG();
   return {upgraded,stored:after?.weaponLevels?.rapid,restored:restored.weaponLevels.rapid,owned:restored.weaponsOwned.includes('rapid')};
  });
  assert.equal(saved.upgraded,2,'Duplicate core must increase weapon level');
  assert.equal(saved.stored,2,'Weapon upgrade not saved');
  assert.equal(saved.restored,2,'Upgrade did not survive next chapter start');
  assert.equal(saved.owned,true);
  console.log('PASS '+label+' duplicate pickups and persistent weapon ownership');

  const coop=await page.evaluate(()=>{
   FishmanNet.role='host';FishmanNet.connected=true;FishmanNet.remoteHero='fish';
   FishmanMultiplayerBridge.startCoop(2);
   const g=FishmanMultiplayerBridge.getG();
   g.coopP2.weapon='homing';g.coopP2.weaponLevels.homing=3;
   g.coopP2.weaponsOwned.push('homing');
   const pack=FishmanMultiplayerBridge.getPacket();
   return {host:g.weapon,guest:pack.g.coopP2.weapon,guestLv:pack.g.coopP2.weaponLevels.homing,chapters:fishmanTest.get().level};
  });
  assert.equal(coop.guest,'homing');assert.equal(coop.guestLv,3);assert.equal(coop.chapters,2);
  console.log('PASS '+label+' independent multiplayer weapon levels in snapshots');
  assert.deepEqual(errors,[],'Browser runtime errors');
 }catch(e){
  failures.push(label+': '+(e.stack||e));
  await page.screenshot({path:'/tmp/fishman-v31-weapon-'+label+'.png'}).catch(()=>{});
 }finally{await browser.close();}
}
if(failures.length){console.error(failures.join('\n\n'));process.exit(1);}
console.log('PASS all v31 weapon mechanics in Chromium and WebKit');
