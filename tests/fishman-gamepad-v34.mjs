import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';

// Synthetic standard-mapped Xbox controller: exercises the same browser Gamepad API as USB/Bluetooth hardware.
const errors=[];
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true,args:name==='chromium'?['--no-sandbox','--disable-dev-shm-usage']:[]});
 const page=await browser.newPage({viewport:{width:1200,height:780}});
 const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
 try{
  await page.addInitScript(()=>{
   window.__xbox=null;window.__rumbles=[];
   Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>window.__xbox?[window.__xbox]:[]});
   window.__connectXbox=()=>{
    window.__xbox={id:'Xbox Wireless Controller (STANDARD GAMEPAD)',index:0,connected:true,mapping:'standard',
     axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0})),
     vibrationActuator:{playEffect:(type,settings)=>{window.__rumbles.push({type,settings});return Promise.resolve('complete');}}};
   };
   window.__button=(i,on)=>{const b=window.__xbox.buttons[i];b.pressed=!!on;b.value=on?1:0;};
   window.__axis=(i,value)=>{window.__xbox.axes[i]=value;};
  });
  await page.goto('http://127.0.0.1:8765/?test=1',{waitUntil:'domcontentloaded',timeout:35000});
  await page.waitForFunction(()=>!!window.fishmanTest&&!!window.FishmanGamepad,null,{timeout:18000});
  await page.evaluate(()=>{__connectXbox();__button(0,true);});
  await page.waitForFunction(()=>fishmanTest.get().scene==='intro',null,{timeout:9000});
  await page.evaluate(()=>__button(0,false));
  await page.waitForTimeout(95);
  await page.evaluate(()=>__button(9,true)); // Xbox Menu starts the selected chapter.
  await page.waitForFunction(()=>fishmanTest.get().scene==='playing',null,{timeout:6000});
  await page.evaluate(()=>__button(9,false));
  await page.waitForTimeout(95);
  console.log('PASS '+name+' Xbox A selects menu and Menu starts a chapter');

  await page.evaluate(()=>{
   fishmanTest.intro(3);fishmanTest.start(0); // Roxy city: two available heroes, rescue missions.
   const g=FishmanMultiplayerBridge.getG();
   g.x=200;g.y=350;g.inv=999;g.hazards=[];g.weaponsOwned=['basic','rapid'];g.weapon='basic';
   __axis(0,.95);
  });
  const x0=200;
  await page.waitForFunction(x=>FishmanMultiplayerBridge.getG().x>x+20,x0,{timeout:4000});
  await page.evaluate(()=>__axis(0,0));
  console.log('PASS '+name+' left analogue stick moves character');

  await page.evaluate(()=>{__axis(2,-.95);__axis(3,0);__button(7,true);FishmanMultiplayerBridge.getG().cool=0;});
  await page.waitForFunction(()=>FishmanMultiplayerBridge.getG().lastAim?.x<-.8&&FishmanMultiplayerBridge.getG().basicShotCount>0,null,{timeout:5000});
  await page.evaluate(()=>{__button(7,false);__axis(2,0);});
  console.log('PASS '+name+' right stick aims and RT continuously fires');

  await page.evaluate(()=>__button(1,true)); // B weapon
  await page.waitForFunction(()=>FishmanMultiplayerBridge.getG().weapon==='rapid',null,{timeout:4000});
  await page.waitForTimeout(170);
  assert.equal(await page.evaluate(()=>FishmanMultiplayerBridge.getG().weapon),'rapid','B held must not keep cycling');
  await page.evaluate(()=>__button(1,false));
  await page.waitForTimeout(90);
  await page.evaluate(()=>__button(1,true));
  await page.waitForFunction(()=>FishmanMultiplayerBridge.getG().weapon==='basic',null,{timeout:4000});
  await page.evaluate(()=>__button(1,false));
  console.log('PASS '+name+' B cycles unlocked weapons once per press');

  await page.waitForTimeout(90);
  await page.evaluate(()=>{const g=FishmanMultiplayerBridge.getG();g.skillCooldown=0;g.skillCooldowns[g.hero]=0;__button(2,true);});
  await page.waitForFunction(()=>FishmanMultiplayerBridge.getG().skillCooldown>0,null,{timeout:4000});
  await page.evaluate(()=>__button(2,false));
  console.log('PASS '+name+' X activates hero special skill');

  await page.waitForTimeout(90);
  await page.evaluate(()=>__button(3,true)); // Y next hero
  await page.waitForFunction(()=>FishmanMultiplayerBridge.getG().hero==='humpty',null,{timeout:5000});
  await page.evaluate(()=>__button(3,false));
  console.log('PASS '+name+' Y changes to next available hero');

  await page.waitForTimeout(90);
  await page.evaluate(()=>{
   const g=FishmanMultiplayerBridge.getG(),node=g.adventureMission.nodes[0];
   g.x=node.x;g.y=node.y;__button(0,true); // A rescue/interact
  });
  await page.waitForFunction(()=>FishmanMultiplayerBridge.getG().adventureMission.progress===1,null,{timeout:4000});
  await page.evaluate(()=>__button(0,false));
  console.log('PASS '+name+' A interacts with the new city rescue mission');

  await page.waitForTimeout(90);
  await page.evaluate(()=>__button(9,true));
  await page.waitForFunction(()=>fishmanTest.get().scene==='paused',null,{timeout:4000});
  await page.evaluate(()=>__button(9,false));
  await page.waitForFunction(()=>FishmanGamepad.current().down.menu===false,null,null,{timeout:6000});
  await page.evaluate(()=>__button(9,true));
  await page.waitForFunction(()=>fishmanTest.get().scene==='playing',null,null,{timeout:6000});
  await page.evaluate(()=>__button(9,false));
  console.log('PASS '+name+' Xbox Menu pauses and resumes');

  await page.evaluate(()=>{__button(7,true);__axis(0,.7);__axis(2,.8);});
  await page.waitForTimeout(90);
  await page.evaluate(()=>{__xbox.connected=false;});
  await page.waitForFunction(()=>!FishmanGamepad.current().connected,null,{timeout:4000});
  const stopped=await page.evaluate(()=>FishmanMultiplayerBridge.getG().x);
  await page.waitForTimeout(160);
  const after=await page.evaluate(()=>FishmanMultiplayerBridge.getG().x);
  assert.ok(Math.abs(after-stopped)<1.5,'Movement did not stop on disconnect');
  await page.keyboard.down('d');await page.waitForTimeout(150);await page.keyboard.up('d');
  const withKeyboard=await page.evaluate(()=>FishmanMultiplayerBridge.getG().x);
  assert.ok(withKeyboard>after+10,'Keyboard no longer works after controller disconnect');
  assert.ok(await page.evaluate(()=>__rumbles.length)>0,'Controller feedback was never attempted');
  console.log('PASS '+name+' disconnect releases motion, keyboard stays functional, rumble supported');

  assert.deepEqual(pageErrors,[],'Unexpected browser runtime errors');
 }catch(e){errors.push(name+': '+(e.stack||e));}
 finally{await browser.close();}
}
if(errors.length){console.error(errors.join('\n\n'));process.exit(1);}
console.log('PASS Xbox ABXY + twin-stick + RT + Menu + disconnect on Chromium and WebKit');
