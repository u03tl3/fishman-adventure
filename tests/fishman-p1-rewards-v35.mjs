import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// Regression: a saved P1 pickup flag must never disable a fresh run's rewards.
const html=fs.readFileSync('index.html','utf8');
for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))
 if(!/src=|application\//.test(match[1]))new vm.Script(match[2]);
function fn(name){
 const start=html.indexOf('function '+name+'('),end=html.indexOf('\nfunction ',start+1);
 assert.ok(start>=0,'missing '+name);
 return html.slice(start,end);
}
const previous=['star-1-0-0','award-1-0-kai','skill-core-1-0-kai','weapon-1-0-0'];
const counts={food:0,skill:0,weapon:0};
const g={x:400,y:300,hero:'kai',hp:3,maxHp:6,stars:[],awards:[],skillCrystals:[],weaponPickups:[],
 weapon:'basic',weaponLevels:{basic:1,rapid:1},weaponsOwned:['basic'],hazards:[]};
const ctx={g,level:1,localCount:4,coopAimOverride:null,
 net:()=>({role:'local',connected:false}),
 progress:{picked:Object.fromEntries(previous.map(k=>[k,true])),stars:0},
 Math,Date,saveProgress(){},sfx(){},burst(){},say(){},awardIcon(){return '*';},
 ensureWeaponState(){},persistWeaponProgress(){},
 skillLevelUp(){counts.skill++;},levelUp(){counts.food++;},
 upgradeWeapon(){counts.weapon++;},
 WEAPON_LABEL:{rapid:'Rapid Blaster'},WEAPON_POWER_INFO:{rapid:'Twin burst'}};
vm.createContext(ctx);
vm.runInContext(['initRewards','pickupOwner','pickupPlayers','canClaimPickup','claimPickup',
 'collectRewards','collectWeapons'].map(fn).join('\n'),ctx);
vm.runInContext('initRewards(0)',ctx);
assert.ok(g.stars.some(p=>p.key==='star-1-0-0'),'old P1 stars must reappear in a new run');
assert.ok(g.awards.some(p=>p.key==='award-1-0-kai'),'old P1 food must reappear in a new run');
assert.ok(g.skillCrystals.some(p=>p.key==='skill-core-1-0-kai'),'old P1 skill must reappear in a new run');

g.x=186;g.y=205;vm.runInContext('collectRewards()',ctx);
assert.equal(ctx.progress.stars,1,'P1 must receive a star even if its old key was saved');
g.x=455;g.y=380;vm.runInContext('collectRewards()',ctx);
assert.equal(counts.food,1,'P1 must receive food even if its old key was saved');
g.x=665;g.y=325;vm.runInContext('collectRewards()',ctx);
assert.equal(counts.skill,1,'P1 must receive a skill even if its old key was saved');

g.weaponPickups=[{x:400,y:300,key:'weapon-1-0-0',type:'rapid',got:false}];
g.x=400;g.y=300;vm.runInContext('collectWeapons()',ctx);
assert.equal(g.weapon,'rapid','P1 must receive weapon cores even if previously collected');
vm.runInContext('collectWeapons()',ctx);
assert.equal(counts.weapon,0,'P1 must not collect the same core twice in one run');

vm.runInContext('initRewards(0)',ctx);
g.x=186;g.y=205;vm.runInContext('collectRewards()',ctx);
assert.equal(ctx.progress.stars,2,'P1 must receive rewards again on the next run');
g.weaponPickups=[{x:400,y:300,key:'weapon-1-0-0',type:'rapid',got:false}];
g.x=400;g.y=300;vm.runInContext('collectWeapons()',ctx);
assert.equal(counts.weapon,1,'P1 must be able to upgrade a weapon on a repeat run');

// When P2–P4 claimed first, P1 still gets an independent claim.
const shared={x:400,y:300,key:'new-star',got:false,claimedBy:{p2:true,p3:true,p4:true}};
g.stars=[shared];g.awards=[];g.skillCrystals=[];
vm.runInContext('collectRewards()',ctx);
assert.equal(ctx.progress.stars,3,'P1 must claim after teammates');
assert.equal(shared.got,true,'pickup hides only after all four players claim');
vm.runInContext('collectRewards()',ctx);
assert.equal(ctx.progress.stars,3,'pickup must not be claimed twice in the same run');
assert.match(html,/g\.stars\.push\(\{\.\.\.st,x:st\.x\+sector\*W,key,got:false,claimedBy:\{\}\}\)/,
 'scrolling-zone rewards must not be blocked by old P1 saves');
console.log('PASS P1 repeat-run stars, food, skill crystals, weapon cores, tracker ownership and P2–P4 coexistence');
