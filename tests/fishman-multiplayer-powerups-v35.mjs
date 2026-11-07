import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync('index.html','utf8');
for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
 if(!/src=|type=.module|application\//.test(match[1]))new vm.Script(match[2]);
}
const part=(start,end)=>{
 const i=html.indexOf(start),j=html.indexOf(end,i+start.length);
 assert.ok(i>=0&&j>i,'missing '+start);
 return html.slice(i,j);
};
const actorSrc=[
 part('function newPlayerLevels(){','function skillRecharge(hero)'),
 part('function skillLevelUp(hero,reason){','function skillStun('),
 part('function levelUp(hero,reason){','function aimVector()')
].join('\n');

const mk=new Function('progress','onSave',`
 let g=null,coopAimOverride=null,level=0;
 const skillNames={fish:'Vortex',kai:'Alchemy',roxy:'Comet',humpty:'Ricochet',gozilla:'Gravity',sub:'Sonar'};
 const heroNames={fish:'Fishman',kai:'Kai',roxy:'Roxy',humpty:'Humpty',gozilla:'Gozilla',sub:'Sub'};
 function saveProgress(){onSave(progress);}
 function sfx(){}function burst(){}function say(){}function updateSkillButton(){}
 function awardIcon(){return '★';}
 function upgradeWeapon(p){p.weaponLevel=(p.weaponLevel||1)+1;}
 ${actorSrc}
 return {set(p,aim){g=p;coopAimOverride=aim;},skillLevelUp,levelUp,collectRewards,heroSkillLevel,heroUpgrade};
`);
const base={fish:1,kai:1,roxy:1,humpty:1,gozilla:1,sub:1};
const progress={localPlayers:{},picked:{},stars:0,upgrades:{...base},skillUpgrades:{...base}};
let saveCount=0;
const game=mk(progress,()=>saveCount++);
function player(localSlot,hero){
 return {localSlot,hero,x:300,y:280,hp:4,maxHp:6,stars:[],awards:[],skillCrystals:[],
 playerHeroUpgrades:{...base},playerSkillUpgrades:{...base},playerStars:0,weaponLevel:1};
}
for(const [localSlot,hero] of [[1,'kai'],[2,'roxy'],[3,'humpty']]){
 const p=player(localSlot,hero);
 p.skillCrystals.push({x:300,y:280,key:'skill'+localSlot,hero:'fish',anyHero:true,got:false});
 p.awards.push({x:300,y:280,key:'food'+localSlot,hero:'fish',anyHero:true,got:false});
 game.set(p,{x:1,y:0});
 game.collectRewards();
 assert.equal(game.heroSkillLevel(hero),2,'P'+(localSlot+1)+' must get its own ability');
 assert.equal(game.heroUpgrade(hero),2,'P'+(localSlot+1)+' must get its own hero power');
 assert.equal(progress.localPlayers[localSlot+1].skillUpgrades[hero],2,'power is saved separately');
}
assert.deepEqual(progress.skillUpgrades,base,'teammates must not modify P1 abilities');
assert.deepEqual(progress.upgrades,base,'teammates must not modify P1 hero strength');
const p2=player(1,'kai');
p2.stars=Array.from({length:5},(_,i)=>({x:300,y:280,key:'p2star'+i,got:false}));
game.set(p2,{x:1,y:0});game.collectRewards();
assert.equal(p2.playerStars,5,'P2 earns its own five-star milestone');
assert.equal(p2.playerSkillUpgrades.kai,2);
assert.equal(p2.weaponLevel,2,'P2 receives its own weapon level');
assert.equal(progress.stars,0,'P2 stars do not advance P1 five-star milestone');
const p1=player(undefined,'fish');
p1.skillCrystals=[{x:300,y:280,key:'p1crystal',hero:'fish',got:false}];
game.set(p1,null);game.collectRewards();
assert.equal(progress.skillUpgrades.fish,2,'P1 progression remains intact');
assert.ok(saveCount>0);

const coopSrc=part('const COOP_FIELDS=[','function coopRevive(');
new Function(`
 let g={hero:'fish',uniqueVortex:null,playerSkillUpgrades:{fish:1}},coopAimOverride=null;
 function net(){return {role:'local',input:{}};}
 ${coopSrc}
 const p={hero:'kai',lastAim:{x:0,y:1},playerSkillUpgrades:{kai:3},localSlot:1};
 g.coopP2=p;
 withCoopPlayer(()=>{g.uniqueAlchemy={ttl:4.5};g.playerSkillUpgrades.kai=4;});
 if(!p.uniqueAlchemy||p.playerSkillUpgrades.kai!==4)throw Error('Co-op ability not retained');
 if(g.uniqueAlchemy||g.playerSkillUpgrades.fish!==1)throw Error('P1 accidentally modified');
`)();

assert.ok(html.includes('const ENEMY_RANK_LOOT='));
for(const kind of ['GUARDIAN','RAIDER','WARDEN'])assert.ok(html.includes(kind+':['));
assert.ok(html.includes('anyHero:true'),'tracker ability drops must be usable by every hero');
console.log('PASS P1-P4 independent ability, hero and weapon upgrades; saved local progress; unique effects; predictable tracker rewards');
