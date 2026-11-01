import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const sandbox={};sandbox.globalThis=sandbox;
vm.runInNewContext(fs.readFileSync('encounters-v32.js','utf8'),sandbox);
const E=sandbox.FishmanEncounterV32;
assert.equal(Object.keys(E.CHAPTERS).length,10);
assert.match(E.chapter(4).name,/City Battle/);
assert.equal(E.chapter(4).mechanic,'city');
assert.equal(E.chapter(10).mechanic,'gauntlet');
const mechanics=Object.values(E.CHAPTERS).map(x=>x.mechanic);
assert.equal(new Set(mechanics).size,10,'Every chapter must have a distinct mechanic');
for(let id=1;id<=10;id++){
 let s=E.create(id);
 const beats=E.chapter(id).beats;
 assert.equal(s.beat,0);
 assert.equal(E.dispatch(s,{type:'ADVANCE',completedBeat:'wrong'}).beat,0);
 for(const beat of beats)s=E.dispatch(s,{type:'ADVANCE',completedBeat:beat});
 assert.equal(s.complete,true,'chapter '+id+' did not finish');
 assert.equal(E.objective(s),'Chapter objectives complete');
}
console.log('PASS v32 story-preserving chapter mechanics and progression');
