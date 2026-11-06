import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const files=['index.html','v35-4p-retry/index.html'];
const marker='/* Fishman v35 entity budgets:';
for(const file of files){
 const html=fs.readFileSync(file,'utf8');
 const mark=html.indexOf(marker);
 assert.ok(mark>0,file+': missing entity budget guard');
 const scriptStart=html.lastIndexOf('<script>',mark);
 const scriptEnd=html.indexOf('</script>',mark);
 assert.ok(scriptStart>=0&&scriptEnd>mark,file+': game script not found');
 new vm.Script(html.slice(scriptStart+8,scriptEnd),{filename:file});
 const hazardStart=html.indexOf('function hazard(',mark);
 const helper=html.slice(mark,hazardStart);
 const game={x:500,hazards:[],proj:[],shots:[],challenge:{bullet:[]},arena:{orbs:[]}};
 const context=vm.createContext({g:game});
 const B=vm.runInContext(helper+';({spawnHazards,pushCapped,enforceEntityBudgets,MAX_ACTIVE_HAZARDS,MAX_PLAYER_PROJECTILES,MAX_BOSS_PROJECTILES,MAX_PARTICLES})',context);
 assert.equal(B.MAX_ACTIVE_HAZARDS,64);
 for(let i=0;i<500;i++)B.spawnHazards({x:i,y:250});
 assert.equal(game.hazards.length,B.MAX_ACTIVE_HAZARDS,file+': runaway enemy spawn');
 for(let i=0;i<500;i++)B.pushCapped(game.proj,B.MAX_PLAYER_PROJECTILES,{i});
 assert.equal(game.proj.length,B.MAX_PLAYER_PROJECTILES);
 assert.equal(game.proj.at(-1).i,499,'latest projectile should remain');
 for(let i=0;i<1000;i++)B.pushCapped(game.shots,B.MAX_BOSS_PROJECTILES,{i});
 assert.equal(game.shots.length,B.MAX_BOSS_PROJECTILES);
 game.hazards=Array.from({length:1000},(_,i)=>({x:i*10,y:250}));
 game.challenge.bullet=Array.from({length:300},(_,i)=>({i}));
 game.arena.orbs=Array.from({length:300},(_,i)=>({i}));
 B.enforceEntityBudgets();
 assert.equal(game.hazards.length,B.MAX_ACTIVE_HAZARDS,'restored enemies must be capped');
 assert.ok(game.hazards.every(h=>Math.abs(h.x-game.x)<=320),'keep nearest enemies');
 assert.equal(game.challenge.bullet.length,B.MAX_BOSS_PROJECTILES);
 assert.equal(game.arena.orbs.length,B.MAX_BOSS_PROJECTILES);
 console.log('PASS v35 entity overload guard: '+file);
}
