import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const url = 'http://127.0.0.1:8765/?test=1';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const errors = [], passed = [];
page.on('pageerror', e => errors.push(e.stack || e.message));
page.on('console', m => { if (m.type() === 'error' && !/peerjs|cdn\.jsdelivr/i.test(m.text())) errors.push(m.text()); });
async function check(name, fn) {
  try { await fn(); passed.push('PASS ' + name); }
  catch (e) { throw Error(name + ': ' + e.message, { cause: e }); }
}
try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => !!window.fishmanTest && !!window.FishmanMultiplayerBridge && !!window.FishmanV28Art?.hero, { timeout: 20000 });

  await check('all ten original chapters start', async () => {
    for (let ch = 0; ch < 10; ch++) {
      const st = await page.evaluate(ch => {
        fishmanTest.intro(ch);
        fishmanTest.start(0);
        return fishmanTest.get();
      }, ch);
      assert.equal(st.level, ch, 'Chapter index ' + ch);
      assert.equal(st.scene, 'playing', 'Chapter ' + (ch + 1));
    }
  });

  await check('full-body Fishman and open Aqua Hover Pod in chapter 1', async () => {
    await page.evaluate(() => {
      fishmanTest.intro(0);
      fishmanTest.start(0);
      const g = FishmanMultiplayerBridge.getG();
      g.hero = 'fish'; g.x = 200; g.y = 350;
      window.__fishArtCalls = [];
      // v29 is the preferred approved illustrator; v28/master is a retained fallback.
      for (const [renderer, method] of [[window.FishmanV29Art,'fish'],[window.FishmanVisualMaster,'hero']]) {
        if (typeof renderer?.[method] !== 'function') continue;
        const original = renderer[method];
        renderer[method] = function(ctx, pose) {
          const painted = original(ctx, pose);
          if (pose?.type === 'fish') window.__fishArtCalls.push({ renderer:method, mode:pose.mode, fullBody:pose.fullBody, painted });
          return painted;
        };
      }
    });
    await page.waitForFunction(() => window.FishmanV28Art.hero(document.getElementById('game').getContext('2d'), {
      type: 'fish', x: 200, y: 280, phase: 0, motion: 0, fullBody: true
    }), { timeout: 15000 });
    await page.evaluate(() => fishmanTest.renderNow());
    const found = await page.evaluate(() => ({
      mode: fishmanTest.get().movement,
      fullBody: __fishArtCalls.some(x => x.mode === 'hover' && x.fullBody && x.painted),
      calls: __fishArtCalls.slice(-18), scene: fishmanTest.get().scene, drawMode:fishmanTest.get().movement,
      master:typeof window.FishmanVisualMaster?.hero, v29Fish:typeof window.FishmanV29Art?.fish
    }));
    assert.equal(found.mode, 'hover');
    assert.equal(found.fullBody, true, 'Hover Pod did not render approved full-body Fishman: '+JSON.stringify({found, errors}));
  });

  await check('approved full-body Fishman across land and water chapters', async () => {
    const locations = [
      { chapter: 0, x: 220, mode: 'hover' },
      { chapter: 0, x: 1220, mode: 'swim' },
      { chapter: 1, x: 220, mode: 'hover' },
      { chapter: 2, x: 220, mode: 'swim' },
      { chapter: 3, x: 220, mode: 'hover' },
      { chapter: 6, x: 220, mode: 'swim' },
      { chapter: 7, x: 220, mode: 'swim' },
      { chapter: 8, x: 220, mode: 'hover' }
    ];
    for (const location of locations) {
      const actual = await page.evaluate(({chapter,x}) => {
        fishmanTest.intro(chapter); fishmanTest.start(0);
        const g = FishmanMultiplayerBridge.getG();
        g.hero='fish';g.x=x;g.y=345;
        window.__fishArtCalls.length=0;
        fishmanTest.renderNow();
        return {mode:fishmanTest.get().movement,
          drawn:__fishArtCalls.some(call=>call.painted&&call.fullBody===true),
          calls:__fishArtCalls.slice(-4)};
      },location);
      assert.equal(actual.mode,location.mode,'Terrain mismatch in chapter '+(location.chapter+1));
      assert.equal(actual.drawn,true,'Full body not rendered in chapter '+(location.chapter+1)+': '+JSON.stringify(actual));
    }
  });

  await check('original approved artwork is drawn without source-image cropping',async()=>{
    const sample=await page.evaluate(()=>{
      const cv=document.createElement('canvas');cv.width=cv.height=240;
      const ctx=cv.getContext('2d'),calls=[],original=ctx.drawImage.bind(ctx);
      ctx.drawImage=(...args)=>{
        if(args[0] instanceof HTMLImageElement)calls.push({
          count:args.length,w:args[0].naturalWidth,h:args[0].naturalHeight,
          renderW:args[3],renderH:args[4]});
        return original(...args);
      };
      const drawn=FishmanV28Art.hero(ctx,{
        type:'fish',x:120,y:120,fullBody:true,mode:'hover',phase:0,motion:1});
      const pixels=ctx.getImageData(0,0,240,240).data;let filled=0,minY=240,maxY=0;
      for(let y=0;y<240;y++)for(let x=0;x<240;x++){
        if(pixels[(y*240+x)*4+3]>24){filled++;minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
      }
      return {drawn,calls,filled,pixelHeight:maxY-minY};
    });
    assert.equal(sample.drawn,true);
    assert.ok(sample.calls.some(x=>x.count===5&&x.w>300&&x.h>300&&x.renderW>90&&x.renderH>60),
      'Source-cropped image: '+JSON.stringify(sample));
    assert.ok(sample.filled>500&&sample.pixelHeight>38,'Blank or clipped artwork: '+JSON.stringify(sample));
  });

  await check('water transition switches hover to swimming', async () => {
    await page.evaluate(()=>{fishmanTest.intro(0);fishmanTest.start(0);});
    const result = await page.evaluate(() => {
      const g = FishmanMultiplayerBridge.getG();
      g.hero = 'fish'; g.x = 1280;
      return { terrain: fishmanTest.get().terrain, mode: fishmanTest.get().movement };
    });
    assert.equal(result.terrain, 'water');
    assert.equal(result.mode, 'swim');
  });

  await check('all sculpted weapon pickup variants render without icon tiles', async () => {
    const result = await page.evaluate(() => {
      const c = document.getElementById('game').getContext('2d');
      const types = ['basic', 'rapid', 'spread', 'charge', 'homing', 'electric',
        'shield', 'gold', 'roxy_fire', 'humpty_egg', 'gozilla_beam', 'sub_torpedo'];
      return types.map(type => ({ type, drawn: FishmanV28Art.weapon(c, type, 380, 330, 0, 1) }));
    });
    assert.ok(result.every(x => x.drawn === true), JSON.stringify(result));
  });

  await check('independent Player 2 movement, roll boost and position', async () => {
    await page.evaluate(() => {
      FishmanNet.role = 'host';
      FishmanNet.connected = true;
      FishmanNet.remoteHero = 'kai';
      FishmanNet.input = { x: 1, y: 0, hero: null, skill: false, interact: false, fire: false, aim: null };
      FishmanNet.lastInputAt = Date.now();
      FishmanMultiplayerBridge.startCoop(0);
    });
    const before = await page.evaluate(() => {
      const g = FishmanMultiplayerBridge.getG();
      return { host: g.x, guest: g.coopP2?.x };
    });
    assert.ok(Number.isFinite(before.guest));
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => {
      const g = FishmanMultiplayerBridge.getG();
      return { host: g.x, guest: g.coopP2?.x };
    });
    assert.ok(after.guest > before.guest + 15, 'P2 did not move under remote input');
    assert.ok(Math.abs(after.host - before.host) < 6, 'P2 input incorrectly moved P1');

    await page.evaluate(() => {
      const g = FishmanMultiplayerBridge.getG();
      g.coopP2.hero = 'humpty';
      FishmanNet.input.hero = 'humpty';
      FishmanNet.input.x = 1;
      FishmanNet.lastInputAt = Date.now();
    });
    await page.waitForTimeout(230);
    const roll = await page.evaluate(() => FishmanMultiplayerBridge.getG().coopP2.rollBoost);
    assert.ok(roll > 1, 'P2 rolling animation/boost did not advance');
  });

  await check('host packets ordered and stale guest snapshots ignored', async () => {
    const result = await page.evaluate(() => {
      const bridge = FishmanMultiplayerBridge;
      const old = bridge.getPacket();
      const fresh = bridge.getPacket();
      const guestX = fresh.g.coopP2.x;
      FishmanNet.role = 'guest';
      bridge.resetGuestSync();
      bridge.applySnapshot(fresh);
      const expectedX = bridge.getG().coopP2.x;
      const stale = { ...old, g: { ...old.g, coopP2: { ...old.g.coopP2, x: 9 } } };
      bridge.applySnapshot(stale);
      return { oldSeq: old.seq, freshSeq: fresh.seq, expectedX, actualX: bridge.getG().coopP2.x, guestX };
    });
    assert.ok(result.freshSeq > result.oldSeq);
    assert.equal(result.actualX, result.expectedX);
    assert.equal(result.guestX, result.actualX);
    await page.waitForTimeout(150);
  });

  assert.deepEqual(errors, [], 'Browser JavaScript errors');
  console.log(passed.join('\n'));
  console.log('PASS Fishman v30 main-site smoke and co-op regression QA');
} finally {
  await browser.close();
}
