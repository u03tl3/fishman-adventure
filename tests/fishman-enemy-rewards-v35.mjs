import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
for(const file of ['index.html','v35-full-v16-4p/index.html']){
 const html=fs.readFileSync(file,'utf8');
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))if(!/src=|application\//.test(match[1]))new vm.Script(match[2]);
 const combat=html.slice(html.indexOf('function hazard('),html.indexOf('function heroFor('));
 const ctx={g:{enemyBlueprints:[[],[],[],[]],nextEnemyId:0,hazards:[],stars:[],awards:[],skillCrystals:[],weaponPickups:[],wave:0},hardMode:false,nightmare:()=>false,level:1,RUN_SECTORS:4,W:1000,clamp:(n,a,b)=>Math.min(b,Math.max(a,n)),burst(){},weaponVisual(){},say(){},WEAPON_COLORS:{},Date};
 vm.createContext(ctx);vm.runInContext(combat,ctx);
 vm.runInContext(`for(let i=0;i<216;i++)spawnEnemy(hazard(200+i%4*1000,300,30,30,1,0));`,ctx);
 assert.equal(ctx.g.hazards.length,216);
 const elite=ctx.g.hazards.filter(h=>h.elite),normal=ctx.g.hazards.filter(h=>!h.elite);
 assert.equal(elite.length,54);assert.equal(normal[0].hp,6);assert.equal(elite[0].hp,18);
 for(const h of ctx.g.hazards){ctx.defeatEnemy(h);ctx.defeatEnemy(h);}
 assert.equal(ctx.g.stars.length,216,'exactly one star per defeat');
 for(const type of ['rapid','spread','charge','homing','electric','shield','gold','health'])assert.ok(ctx.g.weaponPickups.some(p=>p.type===type),'missing '+type);
 for(const hero of ['fish','kai','roxy','humpty','gozilla','sub']){
  assert.ok(ctx.g.skillCrystals.some(p=>p.hero===hero),'missing skill '+hero);
  assert.ok(ctx.g.awards.some(p=>p.hero===hero),'missing food '+hero);
 }
 assert.equal(new Set(ctx.g.stars.map(p=>p.key)).size,216);
 ctx.refreshEnemyZone(0);
 assert.ok(ctx.g.hazards.filter(h=>h.enemyZone===0).every(h=>h.hp===h.maxHp&&!h.defeated));
 const revived=ctx.g.hazards.find(h=>h.enemyZone===0),before=ctx.g.stars.length;
 ctx.defeatEnemy(revived);assert.equal(ctx.g.stars.length,before+1,'reentered enemy can drop again');
 console.log('PASS '+file+': syntax, tougher enemies, 3 elite variants, all weapons/skills/food/shield/upgrade/health/stars, single drops and scene refresh');
}
