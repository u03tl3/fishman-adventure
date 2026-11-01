/* Fishman Adventure v33 — story-specific gameplay, not another collect-and-gate loop.
   Deterministic, serializable mission state. Host controls updates; snapshots show to guests.
   The original bosses, characters, approved art and optional pickups are untouched. */
(function(root){
 'use strict';
 const BLUEPRINTS={
  0:{title:'THE FISHMAN EXPERIMENT',steps:[
   ['switch','Prime Kai\'s formula mixer'],['shoot','Shoot the coolant relay'],
   ['switch','Set the final formula ratio'],['shoot','Stabilise the experiment']]},
  1:{title:'NAUGHTY\'S FOREST',steps:[
   ['shoot','Destroy the living root heart'],['shoot','Break the thorn nest'],
   ['shoot','Destroy the spreading roots'],['shoot','Stop the forest takeover']]},
  2:{title:'UNDERWATER ALLIES',steps:[
   ['defend','Protect the first shark'],['defend','Defend the young sharks'],
   ['defend','Protect the shark family'],['defend','Secure the ocean passage']]},
  3:{title:'ROXY\'S CITY BATTLE',steps:[
   ['rescue','Evacuate the street'],['shoot','Destroy Naughty\'s root generator'],
   ['rescue','Save the trapped passengers'],['bomb','Disarm Naughty\'s bomb']]},
  5:{title:'YELLOW SUBMARINE',steps:[
   ['shoot','Torpedo the prison lock'],['switch','Activate the sonar dock'],
   ['shoot','Destroy the mine controller'],['switch','Seal Naughty\'s cell']]},
  6:{title:'SUNKEN LIBRARY',steps:[
   ['shoot','Illuminate the archive mirror'],['switch','Decode the ancient runes'],
   ['shoot','Power the history projector'],['switch','Reveal Barky\'s secret map']]},
  7:{title:'WHIRLPOOL CAVERNS',steps:[
   ['ring','Ride the first current'],['ring','Navigate the twisting current'],
   ['ring','Escape the deep whirlpool'],['ring','Reach the calm-water passage']]},
  8:{title:'BARKY\'S ROOT FORTRESS',steps:[
   ['stealth','Sneak to the root controls'],['stealth','Disable the sentry network'],
   ['stealth','Sabotage the root engine'],['stealth','Open the fortress escape']]},
 };
 const PALETTE={switch:'#85f9db',shoot:'#ffbc70',defend:'#8dcaff',rescue:'#b7ff94',bomb:'#ff888d',ring:'#94e9ff',stealth:'#d6afff'};
 const ICON={switch:'⚙',shoot:'✦',defend:'♥',rescue:'♥',bomb:'!',ring:'◎',stealth:'◇'};
 const DISTANCES=[.43,1.43,2.43,3.43];
 const HEIGHTS=[350,440,295,405];
 function create(chapter,wave,width){
  if(chapter===5&&wave===0)return null; // keep the original Naughty capture vehicle mission
  const def=BLUEPRINTS[chapter];if(!def)return null;
  const W=Math.max(600,Number(width)||1000);
  return {version:33,chapter,wave,title:def.title,progress:0,alert:0,alarmCooldown:0,
   nodes:def.steps.map(([kind,label],i)=>({
    id:i,kind,label,x:DISTANCES[i]*W,y:HEIGHTS[i],done:false,active:false,
    hold:0,hp:kind==='shoot'?3:0,flash:0
   }))};
 }
 function next(m){return m?.nodes?.find(n=>!n.done)||null;}
 function complete(m){return !!m&&m.nodes.every(n=>n.done);}
 function finish(m,n){if(n.done)return false;n.done=true;n.active=false;n.hold=0;n.flash=1;m.progress=m.nodes.filter(x=>x.done).length;return true;}
 function closest(m,x,y,r=105){
  if(!m)return null;
  return m.nodes.find(n=>!n.done&&Math.hypot(n.x-x,n.y-y)<=r)||null;
 }
 function interact(m,x,y){
  const n=closest(m,x,y);if(!n)return {handled:false};
  if(n.kind==='shoot'||n.kind==='ring')return {handled:true,message:n.kind==='shoot'?'AIM AND FIRE AT THE GLOWING TARGET!':'SWIM THROUGH THE CURRENT RING!'};
  if(n.kind==='stealth'&&m.alert>1.25)return {handled:true,message:'ALERT! EVADE THE SENTRY AND TRY AGAIN.'};
  if(n.kind==='defend'||n.kind==='bomb'){
   n.active=true;
   return {handled:true,message:n.kind==='bomb'?'BOMB DISARMING — STAY CLOSE!':'PROTECT THE SHARK — HOLD THIS POSITION!'};
  }
  if(finish(m,n))return {handled:true,completed:true,node:n,message:n.kind==='rescue'?'CIVILIANS RESCUED!':n.kind==='stealth'?'ROOT SECURITY DISABLED!':'MECHANISM ACTIVATED!'};
  return {handled:true};
 }
 function projectile(m,p){
  if(!m||!p)return null;
  for(const n of m.nodes){
   if(n.done||n.kind!=='shoot'||Math.hypot(n.x-p.x,n.y-p.y)>(p.r||10)+34)continue;
   n.hp-=Math.max(1,Math.round((Number(p.damage)||12)/28));
   n.flash=.24;
   if(n.hp<=0){finish(m,n);return {hit:true,completed:true,node:n,message:'TARGET DESTROYED!'};}
   return {hit:true,completed:false,node:n,message:'TARGET HIT'};
  }
  return null;
 }
 function update(m,dt,players,movement=0){
  if(!m||complete(m))return [];
  const events=[];dt=Math.max(0,Math.min(.1,Number(dt)||0));
  const ps=(players||[]).filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y));
  const near=(n,r)=>ps.some(p=>Math.hypot(p.x-n.x,p.y-n.y)<=r);
  const n=next(m);
  if(!n)return events;
  if(n.kind==='defend'||n.kind==='bomb'){
   if(n.active){
    n.hold=Math.max(0,n.hold+(near(n,155)?dt:-dt*.85));
    if(n.hold>=(n.kind==='bomb'?2.8:3.2)){
     finish(m,n);events.push({type:'complete',node:n,message:n.kind==='bomb'?'BOMB DEFUSED!':'SHARK SAFELY RESCUED!'});
    }
   }
  }else if(n.kind==='ring'){
   if(near(n,62)){finish(m,n);events.push({type:'complete',node:n,message:'CURRENT NAVIGATED!'});}
  }else if(n.kind==='stealth'){
   m.alarmCooldown=Math.max(0,m.alarmCooldown-dt);
   if(near(n,220)&&movement>.65)m.alert=Math.min(2,m.alert+dt*.72);
   else m.alert=Math.max(0,m.alert-dt*.6);
   if(m.alert>=1.9&&m.alarmCooldown<=0){
    m.alert=1.2;m.alarmCooldown=8;events.push({type:'alarm',node:n,message:'SENTRY ALERT! ROOT GUARDIANS INCOMING!'});
   }
  }
  for(const node of m.nodes)node.flash=Math.max(0,(node.flash||0)-dt);
  return events;
 }
 function message(m){
  if(!m)return '';
  if(complete(m))return m.title+' · MISSION CLEAR — CONTINUE TO THE NEXT SCENE';
  const n=next(m),verb={
   switch:'PRESS B',shoot:'AIM + FIRE',defend:n.active?'DEFEND · STAY NEAR':'PRESS B TO START RESCUE',
   rescue:'PRESS B',bomb:n.active?'STAY CLOSE TO DISARM':'PRESS B TO DISARM',
   ring:'STEER THROUGH THE CURRENT',stealth:'SNEAK SLOWLY · PRESS B'
  }[n.kind]||'COMPLETE';
  return m.title+' · '+m.progress+'/'+m.nodes.length+' · '+n.label.toUpperCase()+' · '+verb;
 }
 function draw(ctx,m,t){
  if(!m||!ctx)return;
  for(const n of m.nodes){
   const color=n.done?'#8cffa8':PALETTE[n.kind];
   const pulse=1+Math.sin(t*3+n.id)*.09;
   ctx.save();ctx.translate(n.x,n.y);ctx.globalAlpha=n.done?.36:1;
   ctx.shadowColor=color;ctx.shadowBlur=n.done?4:23;
   const r=(n.kind==='ring'?57:37)*pulse;
   ctx.strokeStyle=color;ctx.lineWidth=n.done?3:6;
   ctx.beginPath();ctx.ellipse(0,0,r,r*.78,0,0,Math.PI*2);ctx.stroke();
   ctx.strokeStyle='#f8ffff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r*.7,t*.8,t*.8+Math.PI*1.45);ctx.stroke();
   ctx.fillStyle='#102e48df';ctx.beginPath();ctx.arc(0,0,r*.58,0,Math.PI*2);ctx.fill();
   ctx.fillStyle=n.done?'#aaffb0':color;ctx.textAlign='center';ctx.font='900 31px system-ui';
   ctx.fillText(n.done?'✓':ICON[n.kind],0,11);
   if(n.kind==='shoot'&&!n.done){ctx.fillStyle='#35435e';ctx.fillRect(-33,46,66,7);ctx.fillStyle=color;ctx.fillRect(-33,46,66*Math.max(0,n.hp)/3,7);}
   if((n.kind==='defend'||n.kind==='bomb')&&n.active&&!n.done){ctx.strokeStyle='#e8faff';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,r+11,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,n.hold/(n.kind==='bomb'?2.8:3.2)));ctx.stroke();}
   if(n.flash>0){ctx.globalAlpha=Math.min(1,n.flash*3);ctx.strokeStyle='#ffffff';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,55+(1-n.flash)*24,0,Math.PI*2);ctx.stroke();}
   ctx.shadowBlur=0;ctx.globalAlpha=n.done?.55:1;ctx.font='800 13px system-ui';
   ctx.strokeStyle='#08273d';ctx.lineWidth=4;ctx.strokeText(n.done?'COMPLETE':n.label.toUpperCase(),0,-r-29);
   ctx.fillStyle=n.done?'#baf7ca':'#ffffff';ctx.fillText(n.done?'COMPLETE':n.label.toUpperCase(),0,-r-29);
   ctx.restore();
  }
  if(m.chapter===7){
   for(const n of m.nodes){if(n.done)continue;ctx.save();ctx.globalAlpha=.35;ctx.strokeStyle='#6ee6ff';ctx.lineWidth=3;for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(n.x,n.y,98+i*33,t*(i%2?-1:1)+i,t*(i%2?-1:1)+i+Math.PI*1.35);ctx.stroke();}ctx.restore();}
  }
 }
 root.FishmanAdventureV33={BLUEPRINTS,create,next,complete,closest,interact,projectile,update,message,draw,version:'v33-distinct-missions'};
})(typeof window!=='undefined'?window:globalThis);
