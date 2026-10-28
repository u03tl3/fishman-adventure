import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const site='http://127.0.0.1:8765/?test=1';
const folder='art-qa';
await mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
const errors=[],results=[];
page.on('pageerror',e=>errors.push('pageerror '+(e.stack||e.message)));
page.on('console',m=>{
 if(m.type()==='error'&&!/peerjs|cdn.jsdelivr|manifest/i.test(m.text()))errors.push(m.text());
});
async function run(name,fn){await fn();results.push('PASS '+name);}
try {
 await page.goto(site,{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>!!window.fishmanTest?.renderNow&&
   !!window.FishmanV29Art?.item&&!!window.FishmanV29Art?.weapon&&
   !!window.FishmanV28Art?.weapon&&!!window.FishmanVisuals?.paintBoss,
   {timeout:15000});
 await page.evaluate(()=>document.fonts.ready);

 await run('approved asset registries and supported categories loaded',async()=>{
  const registry=await page.evaluate(()=>({
    heroes:['fish','kai','roxy','humpty','gozilla','sub'],
    art:Object.keys(FishmanV29Art).sort(),
    paintBoss:typeof FishmanVisuals.paintBoss,
    oldAssets:FishmanV25Art?.names?.length||0,
    master:FishmanVisualMaster?.sourceCount||0,
    originalChapters:document.querySelectorAll('[data-start]').length
  }));
  assert.ok(['weapon','enemy','item','gate','fish','decor','effects','collect']
    .every(k=>registry.art.includes(k)),'approved v29 registry incomplete '+JSON.stringify(registry));
  assert.equal(registry.paintBoss,'function');
  assert.ok(registry.oldAssets>=10&&registry.master>=6,'historical approved artwork missing');
 });

 await run('every illustrated weapon model renders as a physical object',async()=>{
  const samples=await page.evaluate(()=>{
   const types=['basic','rapid','spread','charge','homing','electric','shield',
     'gold','roxy_fire','humpty_egg','gozilla_beam','sub_torpedo'];
   return types.map(type=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=180;
    const c=canvas.getContext('2d');
    let model=FishmanV29Art.weapon(c,type,90,90,0,1);
    let source=model?'approved-v29':'approved-v28';
    if(!model)model=FishmanV28Art.weapon(c,type,90,90,0,1);
    const data=c.getImageData(0,0,180,180).data;
    let pixels=0;
    for(let i=3;i<data.length;i+=4)if(data[i]>30)pixels++;
    return {type,model,source,pixels};
   });
  });
  for(const sample of samples){
   assert.equal(sample.model,true,'missing weapon: '+sample.type);
   assert.ok(sample.pixels>100,'blank weapon: '+JSON.stringify(sample));
  }
  console.log('Weapon art paths:',samples.map(s=>s.type+':'+s.source).join(' · '));
 });

 await run('all collectible types, skill crystals and stars render',async()=>{
  const samples=await page.evaluate(()=>{
   const types=['flask','seed','shark','bomb','pass','battery','crystal','pearl','relic','lantern'];
   const objects=types.map(type=>({kind:'item',type}));
   objects.push(...['skill','star','gold','shield','life'].map(type=>({kind:'collect',type})));
   return objects.map(o=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=180;
    const c=canvas.getContext('2d');
    let ok=false;
    if(o.kind==='item'){
      c.save();c.translate(90,90);ok=FishmanV29Art.item(c,o.type,0,0);c.restore();
    }else ok=FishmanV29Art.collect(c,o.type,90,90,0);
    if(!ok&&o.kind==='collect')ok=FishmanV26Art.star(c,90,90,0);
    const d=c.getImageData(0,0,180,180).data;let colored=0;
    for(let i=3;i<d.length;i+=4)if(d[i]>40)colored++;
    return {...o,ok,colored};
   });
  });
  for(const s of samples){assert.equal(s.ok,true,JSON.stringify(s));assert.ok(s.colored>85,JSON.stringify(s));}
 });

 await run('terrain enemies and obstacles are distinct sculpted artwork',async()=>{
  const types=[
   {type:'jelly',chapter:2,terrain:'water'},
   {type:'mine',chapter:2,terrain:'water'},
   {type:'root',chapter:1,terrain:'land'},
   {type:'root',chapter:3,terrain:'land'},
   {type:'root',chapter:6,terrain:'water'}
  ];
  const samples=await page.evaluate(types=>types.map(o=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=180;
   const c=canvas.getContext('2d');c.translate(90,90);
   const drawn=FishmanV29Art.enemy(c,o.type,o.chapter,1.4,o.terrain);
   const d=c.getImageData(0,0,180,180).data;let pixels=0;
   for(let i=3;i<d.length;i+=4)if(d[i]>40)pixels++;
   return {...o,drawn,pixels};
  }),types);
  samples.forEach(s=>{assert.equal(s.drawn,true,JSON.stringify(s));assert.ok(s.pixels>160,JSON.stringify(s));});
  assert.ok(new Set(samples.map(s=>s.pixels)).size>=3,'enemy models unexpectedly identical');
 });

 await run('all ten chapters display their illustrated worlds and characters',async()=>{
  for(let i=0;i<10;i++){
   const state=await page.evaluate(index=>{
    fishmanTest.intro(index);fishmanTest.start(0);
    const game=FishmanMultiplayerBridge.getG();
    if(!game)throw Error('Missing game state');
    game.inv=0;fishmanTest.renderNow();
    const ctx=document.getElementById('game').getContext('2d');
    const pixels=ctx.getImageData(440,210,100,100).data;
    const distinct=new Set();
    for(let k=0;k<pixels.length;k+=32)distinct.add([pixels[k],pixels[k+1],pixels[k+2]].join(','));
    return {chapter:fishmanTest.get().level,scene:fishmanTest.get().scene,
      colorCount:distinct.size,hero:game.hero,terrain:fishmanTest.get().terrain};
   },i);
   assert.equal(state.chapter,i,'Chapter '+(i+1));
   assert.equal(state.scene,'playing','Chapter '+(i+1));
   assert.ok(state.colorCount>15,'Scene art looks blank in chapter '+(i+1)+': '+JSON.stringify(state));
   if([0,1,2,3,4,5,6,7,8,9].includes(i)){
    await page.locator('#game').screenshot({path:folder+'/chapter-'+(i+1)+'.png'});
   }
  }
 });

 await run('each of nine chapter bosses has a renderable illustrated fight',async()=>{
  const signatures=[];
  for(let i=0;i<9;i++){
   const state=await page.evaluate(index=>{
     fishmanTest.intro(index);fishmanTest.start(0);
     fishmanTest.startChapterArena(index,false);fishmanTest.renderNow();
     const g=FishmanMultiplayerBridge.getG(),boss=g?.challenge;
     if(!boss)return {error:'boss absent'};
     const canvas=document.getElementById('game');
     const c=canvas.getContext('2d');
     const d=c.getImageData(300,150,460,365).data;
     let alpha=0,metric=0;
     for(let p=0;p<d.length;p+=20){alpha+=d[p+3]||0;metric=(metric*33+(d[p]||0)*3+(d[p+1]||0)*5+(d[p+2]||0)*7)>>>0;}
     return {index:boss.index,name:boss.def?.name,alpha,metric,phase:boss.phase};
   },i);
   assert.equal(state.index,i,'Boss '+(i+1)+' '+JSON.stringify(state));
   assert.ok(state.alpha>15000,'Boss '+(i+1)+' scene blank');
   signatures.push(state.metric);
   await page.locator('#game').screenshot({path:folder+'/boss-'+(i+1)+'.png'});
  }
  assert.ok(new Set(signatures).size>=7,'boss artwork lacks distinct presentations');
 });

 await run('Aqua Hover Pod remains complete; HUD uses dimensional weapons',async()=>{
  const model=await page.evaluate(()=>{
   fishmanTest.intro(0);fishmanTest.start(0);
   const g=FishmanMultiplayerBridge.getG();
   g.hero='fish';g.x=250;g.y=360;g.weapon='rapid';
   fishmanTest.renderNow();
   return {movement:fishmanTest.get().movement,
     terrain:fishmanTest.get().terrain,
     completeSprite:FishmanV29Art.fish(document.getElementById('game').getContext('2d'),
       {type:'fish',x:250,y:280,motion:0,phase:0,fullBody:true})};
  });
  assert.equal(model.movement,'hover');
  assert.equal(model.terrain,'land');
  assert.equal(model.completeSprite,true);
  await page.locator('#game').screenshot({path:folder+'/fishman-hover-pod.png'});
 });

 assert.deepEqual(errors,[],'Browser JavaScript exceptions');
 console.log(results.join('\n'));
 console.log('PASS Step 2 approved 3D-cartoon artwork renderer audit');
}finally{await browser.close();}
