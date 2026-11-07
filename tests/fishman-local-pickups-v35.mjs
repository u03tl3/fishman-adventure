import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
function fn(src,name){const start=src.indexOf('function '+name+'('),end=src.indexOf('\nfunction ',start+1);assert.ok(start>=0);return src.slice(start,end);}
for(const path of ['index.html','v35-full-v16-4p/index.html']){
 const s=fs.readFileSync(path,'utf8');
 for(const m of s.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))if(!/src=|application\//.test(m[1]))new vm.Script(m[2]);
 for(let slot=1;slot<=3;slot++){
  const p={x:400,y:300,hero:'kai',hp:3,maxHp:9,inv:10,cool:1,shield:0,weapon:'basic',weaponLevels:{basic:1},weaponsOwned:['basic'],lastAim:{x:1,y:0}};
  const host={...p,x:100,y:250,hero:'fish',hp:8,weaponLevels:{basic:1},weaponsOwned:['basic'],items:[{x:400,y:300,type:'seed'}],collect:0,stars:[{x:400,y:300,key:'s'}],awards:[{x:400,y:300,key:'a',hero:'kai'}],skillCrystals:[{x:400,y:300,key:'c',hero:'kai'}],weaponPickups:[{x:400,y:300,type:'rapid'},{x:400,y:300,type:'health'}],hazards:[],runLength:4000};
  const fields=s.match(/const COOP_FIELDS=(\[[^;]+);/)[1];
  const ctx={g:host,scene:'playing',localCount:slot+1,localTeam:Array.from({length:slot+1},(_,i)=>i===slot?p:{...p,x:50,y:500}),localControls:Array.from({length:3},()=>({})),localHeld:{},navigator:{getGamepads:()=>[]},window:{FishmanNet:{players:{}}},net:()=>({role:'local'}),level:1,localPrepare(){},clamp:(n,a,b)=>Math.min(b,Math.max(a,n)),burst(){},sfx(){},say(){},awardIcon(){return '*';},saveProgress(){},persistWeaponProgress(){},weaponVisual(){},WEAPON_LABEL:{rapid:'Rapid'},WEAPON_POWER_INFO:{rapid:'Rapid'},ensureWeaponState(){},coopAimOverride:null,progress:{picked:{},stars:0},levelUp(){ctx.food=(ctx.food||0)+1;},skillLevelUp(){ctx.skills=(ctx.skills||0)+1;}};
  vm.createContext(ctx);vm.runInContext('const COOP_FIELDS='+fields+';'+['withCoopPlayer','localWith','collectRewards','collectWeapons','localTick'].map(n=>fn(s,n)).join('\n'),ctx);
  ctx.localTick(.025);
  assert.equal(host.collect,1);assert.equal(p.weapon,'rapid');assert.equal(p.hp,5);assert.equal(host.weapon,'basic');assert.equal(host.hp,8);assert.equal(host.x,100);
  assert.equal(ctx.progress.stars,1);assert.equal(ctx.food,1);assert.equal(ctx.skills,1);
  ctx.localTick(.025);assert.equal(host.collect,1);assert.equal(ctx.progress.stars,1);assert.equal(ctx.food,1);assert.equal(ctx.skills,1);
 }
 console.log('PASS '+path+': P2–P4 collect objectives, stars, food, skill cores, weapons and health once; P1 state preserved');
}
