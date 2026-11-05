import assert from 'node:assert/strict';
import {chromium, webkit} from 'playwright';

// Run against a local server at the repository root:
//   python3 -m http.server 8765
//   node tests/fishman-boss-gauntlet-transition-v35.mjs
// Tests the actual game engine, not a mocked boss controller.
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch({
    headless: true,
    args: name === 'chromium' ? ['--no-sandbox', '--disable-dev-shm-usage'] : []
  });
  try {
    for (const path of ['/', '/v35-4p-fixed/', '/v35-4p-retry/']) {
      const page = await browser.newPage({viewport: {width: 1200, height: 780}});
      const pageErrors = [];
      page.on('pageerror', e => pageErrors.push(e.message));
      try {
        await page.goto('http://127.0.0.1:8765' + path + '?test=1', {
          waitUntil: 'domcontentloaded', timeout: 35000
        });
        await page.waitForFunction(() => !!window.fishmanTest && !!window.FishmanMultiplayerBridge, {
          timeout: 15000
        });
        await page.evaluate(() => {fishmanTest.intro(9); fishmanTest.start(0);});

        for (let index = 0; index < 9; index++) {
          const result = await page.evaluate(() => {
            const g = FishmanMultiplayerBridge.getG();
            const a = g.challenge;
            if (!a) return {error: 'missing boss'};
            const index = a.index;
            g.lives = 2;
            g.inv = 999;
            a.phase = 2;
            a.hp = 1;
            a.barrier = 0;
            // Iteration goes backwards: the LAST projectile kills the boss.
            // The previous projectile makes the old code dereference undefined
            // after startChapterArena() replaces g.proj with an empty array.
            g.proj = [
              {x: 130, y: 200, vx: 0, vy: 0, life: 1, age: 0, r: 10, damage: 1},
              {x: a.x, y: a.y, vx: 0, vy: 0, life: 1, age: 0,
               r: 22, damage: 99999, weapon: 'basic'}
            ];
            fishmanTest.step(.025);
            const next = FishmanMultiplayerBridge.getG();
            return {index, scene: fishmanTest.get().scene,
              nextIndex: next.challenge?.index ?? null,
              nextHp: next.challenge?.hp ?? null,
              nextMaxHp: next.challenge?.maxHp ?? null,
              shots: next.proj.length, lives: next.lives};
          });
          assert.equal(result.error, undefined, path + ' boss ' + index);
          assert.equal(result.index, index, path + ' boss index');
          if (index < 8) {
            assert.equal(result.scene, 'playing', path + ' boss ' + index + ' ended gameplay');
            assert.equal(result.nextIndex, index + 1, path + ' did not advance boss');
            assert.equal(result.nextHp, result.nextMaxHp, path + ' new boss did not reset');
            assert.equal(result.shots, 0, path + ' old bullets leaked into new round');
            assert.equal(result.lives, 2, path + ' lives reset between rounds');
          } else {
            assert.equal(result.scene, 'gameWin', path + ' final boss did not complete');
            assert.equal(result.nextIndex, null);
          }
        }
        assert.deepEqual(pageErrors, [], path + ' browser errors');
        console.log('PASS ' + name + ' ' + path + ' all nine boss transitions under multi-shot load');
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}
