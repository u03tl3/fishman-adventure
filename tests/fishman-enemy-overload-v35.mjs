import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Run from repository root: node tests/fishman-enemy-overload-v35.mjs
const scope={}; scope.globalThis=scope;
vm.runInNewContext(fs.readFileSync('adventure-v35.js','utf8'),scope);
const A=scope.FishmanAdventureV35;

function atObjective(chapter,wave,kind){
 const mission=A.create(chapter,wave);
 const target=mission.nodes.find(n=>n.kind===kind);
 assert.ok(target,`Missing ${kind} mission objective`);
 for(const n of mission.nodes){if(n===target)break;A.finish(mission,n);}
 return {mission,target};
}
// Four independent players may press interact hundreds of times on the same frame.
// The defence must create exactly two enemy hazards, not hundreds.
for(const kind of ['defend','escort','bomb']){
 const {mission,target}=atObjective(kind==='bomb'?3:2,0,kind);
 const spawned=[];
 for(let tick=0;tick<200;tick++){
  for(let player=0;player<4;player++){
   const action=A.interact(mission,target.x,target.y);
   assert.equal(action.handled,true);
   if(action.started)spawned.push(...(kind==='defend'?[{},{}]:[{}]));
  }
 }
 assert.equal(spawned.length,kind==='defend'?2:1,`${kind} started multiple times in 4-player mode`);
 assert.equal(target.active,true);
}
// Ordinary repeat interactions must not reset elapsed defence progress.
const {mission,target}=atObjective(2,0,'defend');
assert.equal(A.interact(mission,target.x,target.y).started,true);
target.hold=2.4;
assert.equal(A.interact(mission,target.x,target.y).started,false);
assert.equal(target.hold,2.4,'repeat interaction reset defence timer');

// Stealth alarms can create new enemies only while below the fixed budget.
const stealth=atObjective(8,0,'stealth').mission;
stealth.alarm=2;
const crowd=Array.from({length:48},()=>({x:0,y:0,stun:0}));
let alarms=A.update(stealth,.025,[],0,crowd,10).filter(e=>e.type==='alarm');
assert.equal(alarms.length,0,'enemy reinforcement was allowed above the limit');
stealth.alarm=2;stealth.alarmCooldown=0;
alarms=A.update(stealth,.025,[],0,[],10).filter(e=>e.type==='alarm');
assert.equal(alarms.length,1,'normal reinforcement was removed below the limit');
console.log('PASS Fishman v35 four-player repeated interactions + enemy reinforcement cap');
