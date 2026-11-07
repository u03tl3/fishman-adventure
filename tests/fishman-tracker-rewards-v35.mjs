import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const rewards={
 root:{weapon:'electric',ability:'VINE GUARD',status:'shield',value:7},
 jelly:{weapon:'homing',ability:'RIPTIDE DASH',status:'speedBoost',value:8},
 mine:{weapon:'charge',ability:'EMP PULSE',status:'weaponShield',value:7}
};

for(const file of ['index.html','v35-full-v16-4p/index.html']){
 const html=fs.readFileSync(file,'utf8');
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))
  if(!/src=|application\//.test(match[1]))new vm.Script(match[2]);
 const combat=html.slice(html.indexOf('function hazard('),html.indexOf('function heroFor('));
 const pickups=html.slice(html.indexOf('function collectRewards()'),html.indexOf('function aimVector()'));
 assert.ok(combat.includes('TRACKER_REWARDS'),'tracker table missing');
 for(const [kind,expected] of Object.entries(rewards)){
  const skillCalls=[];
  const ctx={
   g:{x:350,y:330,hero:'fish',hp:5,maxHp:5,inv:0,wave:0,shield:0,weaponShield:0,speedBoost:0,
    enemyBlueprints:[[],[],[],[]],nextEnemyId:0,hazards:[],stars:[],awards:[],skillCrystals:[],weaponPickups:[]},
   hardMode:true,nightmare:()=>false,level:1,RUN_SECTORS:4,W:1000,
   clamp:(n,a,b)=>Math.min(b,Math.max(a,n)),Date,Math,
   progress:{picked:{},stars:0},skillNames:{fish:'BUBBLE VORTEX'},
   WEAPON_COLORS:{},WEAPON_LABEL:{electric:'Electric Arc',homing:'Homing Pod',charge:'Charge Cannon'},
   burst(){},weaponVisual(){},say(){},sfx(){},saveProgress(){},upgradeWeapon(){},
   skillLevelUp(hero,reason){skillCalls.push({hero,reason});},levelUp(){},awardIcon(){return '';}
  };
  vm.createContext(ctx);vm.runInContext(combat+'\n'+pickups,ctx);
  ctx.h={x:350,y:330,type:kind,hunter:true,elite:false,defeated:false,hp:8,maxHp:8};
  assert.equal(vm.runInContext('defeatEnemy(h)',ctx),true);
  assert.equal(vm.runInContext('defeatEnemy(h)',ctx),false,'one defeat only');
  assert.equal(ctx.g.stars.length,1,'star always drops');
  const wp=ctx.g.weaponPickups.filter(p=>p.type===expected.weapon);
  const cores=ctx.g.skillCrystals.filter(p=>p.trackerType===kind);
  assert.equal(wp.length,1,'expected exact '+kind+' weapon');
  assert.equal(cores.length,1,'expected exact '+kind+' skill core');
  assert.equal(cores[0].hero,'any','any local player may claim the core');
  ctx.g.stars=[];ctx.g.hazards=[{x:410,y:330,stun:0,defeated:false}];
  ctx.g.x=cores[0].x;ctx.g.y=cores[0].y;
  vm.runInContext('collectRewards()',ctx);
  assert.equal(cores[0].got,true,'skill core must be collectible');
  assert.equal(ctx.g[expected.status],expected.value,expected.ability+' did not activate');
  assert.equal(skillCalls.length,1,'skill should upgrade once');
  assert.equal(skillCalls[0].hero,'fish','collector hero should receive skill level');
  if(kind==='mine')assert.equal(ctx.g.hazards[0].stun,3,'EMP must stun nearby enemies');
  vm.runInContext('collectRewards()',ctx);
  assert.equal(skillCalls.length,1,'must not award a core twice');
 }
 console.log('PASS '+file+': named trackers, unique cores, skill levels and live combat abilities');
}
