import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

// Test the actual v35 game with a P1 save from an earlier playthrough.
for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true,args:name==='Chromium'?['--no-sandbox','--disable-dev-shm-usage']:[]});
 const page=await browser.newPage({viewport:{width:1200,height:780}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.addInitScript(()=>{
   const picked={};
   for(const key of ['star-1-0-0','award-1-0-kai','skill-core-1-0-kai','weapon-1-0-0'])
    picked[key]=true;
   localStorage.setItem('fishmanV9',JSON.stringify({stars:0,picked,upgrades:{kai:1},skillUpgrades:{kai:1}}));
  });
  await page.goto('http://127.0.0.1:8765/?test=1',{waitUntil:'domcontentloaded',timeout:35000});
  await page.waitForFunction(()=>!!window.fishmanTest&&!!window.FishmanV16Adapter,{timeout:15000});
  const result=await page.evaluate(()=>{
   fishmanTest.intro(1);fishmanTest.start(0);
   FishmanV16Adapter.setCount(4);
   const g=FishmanMultiplayerBridge.getG();
   g.inv=999;g.hazards=[];
   const before={stars:fishmanTest.get().stars,food:fishmanTest.get().upgrades.kai,skill:fishmanTest.get().skillUpgrades.kai};
   const present={star:g.stars.some(p=>p.key==='star-1-0-0'),
    food:g.awards.some(p=>p.key==='award-1-0-kai'),
    skill:g.skillCrystals.some(p=>p.key==='skill-core-1-0-kai'),
    weapon:g.weaponPickups.some(p=>p.key==='weapon-1-0-0')};
   const visit=(x,y)=>{g.x=x;g.y=y;fishmanTest.step(.025);};
   visit(186,205);const afterStar=fishmanTest.get().stars;
   visit(455,380);const afterFood=fishmanTest.get().upgrades.kai;
   visit(665,325);const afterSkill=fishmanTest.get().skillUpgrades.kai;
   const core=g.weaponPickups.find(p=>p.key==='weapon-1-0-0');
   if(core)visit(core.x,core.y);
   return {before,present,afterStar,afterFood,afterSkill,weapon:g.weapon,claimed:g.weaponPickups.find(p=>p.key==='weapon-1-0-0')?.claimedBy};
  });
  assert.deepEqual(result.present,{star:true,food:true,skill:true,weapon:true},'P1 old rewards must respawn');
  assert.ok(result.afterStar>result.before.stars,'P1 must receive star');
  assert.ok(result.afterFood>result.before.food,'P1 must receive food');
  assert.ok(result.afterSkill>result.before.skill,'P1 must receive skill core');
  assert.equal(result.weapon,'rapid','P1 must receive the old weapon core');
  assert.equal(result.claimed?.p1,true,'P1 must own the weapon pickup');
  assert.deepEqual(errors,[],'Browser errors');
  console.log('PASS '+name+': real v35 P1 old-save star, food, skill and weapon pickups with 4 players');
 }finally{await browser.close();}
}
