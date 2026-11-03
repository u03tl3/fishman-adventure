import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';

// Regression: the 1–4 local-player controller deck must not cover v35 artwork.
const cases=[
 {width:1200,height:750,touch:false,name:'desktop'},
 {width:844,height:390,touch:true,name:'phone-landscape'},
 {width:390,height:844,touch:true,name:'phone-portrait'}
];
for (const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]) {
 const browser=await engine.launch({headless:true,args:name==='Chromium'?['--no-sandbox','--disable-dev-shm-usage']:[]});
 try {
  for (const size of cases) {
   const page=await browser.newPage({viewport:{width:size.width,height:size.height},hasTouch:size.touch,isMobile:size.touch});
   const errors=[];page.on('pageerror',err=>errors.push(err.message));
   try {
    await page.goto('http://127.0.0.1:8765/v35-4p-clear/?test=1',{waitUntil:'domcontentloaded',timeout:35000});
    await page.waitForFunction(()=>!!window.fishmanTest&&!!window.FishmanLocalControls,{timeout:20000});
    await page.evaluate(()=>{fishmanTest.intro(0);fishmanTest.start(0);});
    await page.waitForSelector('html.fishman-compact-playing',{timeout:5000});
    for (let count=1;count<=4;count++) {
     await page.evaluate(n=>{
      const sel=document.getElementById('localCount');
      sel.value=String(n);
      sel.dispatchEvent(new Event('change',{bubbles:true}));
     },count);
     await page.waitForFunction(n=>document.getElementById('onBoardControlDeck')?.dataset.players===String(n),count);
     const m=await page.evaluate(()=>{
      const stage=document.querySelector('.stage-wrap');
      const deck=document.getElementById('onBoardControlDeck');
      const canvas=document.getElementById('game');
      const controls=[document.getElementById('touchControl'),...document.querySelectorAll('.local-touch-panel')];
      const box=x=>{const r=x.getBoundingClientRect();return {x:r.x,y:r.y,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
      return {stage:box(stage),deck:box(deck),canvas:box(canvas),pads:controls.map(box),
       classOn:document.documentElement.classList.contains('fishman-compact-playing'),
       gameIsPlaying:window.FishmanMultiplayerBridge?.getScene?.()==='playing',
       mode:getComputedStyle(deck).display};
     });
     const id=`${name} ${size.name} ${count}P`;
     assert(m.classOn&&m.gameIsPlaying,id+' did not enter game');
     assert.equal(m.pads.length,count,id+' wrong number of control sets');
     assert.equal(m.mode,'grid',id+' deck hidden');
     assert(m.stage.height>100,id+' gameplay area too small');
     assert(m.deck.top>=m.stage.bottom-2,id+' controls cover the game canvas');
     assert(m.deck.bottom<=size.height+3,id+' controls overflow viewport');
     for(const p of m.pads){
      assert(p.width>25&&p.height>20,id+' collapsed controls');
      assert(p.left>=m.deck.left-3&&p.right<=m.deck.right+3,id+' control not horizontally contained');
      assert(p.top>=m.deck.top+18&&p.bottom<=m.deck.bottom+3,id+' control not vertically contained');
     }
    }
    assert.deepEqual(errors,[],name+' '+size.name+' Javascript errors');
    console.log('PASS',name,size.name,'1–4 control sets below canvas, stage visible');
   } finally {await page.close();}
  }
 } finally {await browser.close();}
}
