/* Fishman Adventure v35 — story missions with different *ways of playing*.
   These are mission puzzles/defences/escorts/chases, not item-count gates.
   Pure, serializable mission state; host authoritative; old boss encounters preserved. */
(function(root){
'use strict';
const TAU=Math.PI*2,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const PLANS={
 0:{title:'KAI’S LABORATORY',waves:[
  [['switch','Start the bubble reactor'],['shoot','Destroy the leaking coolant valve'],['align','Balance the glowing formula']],
  [['sequence','Mix the formula in three stages'],['shoot','Break the runaway crystal'],['align','Stabilise Finn’s transformation']]
 ]},
 1:{title:'NAUGHTY’S FOREST',waves:[
  [['hunt','Track and destroy the roaming root heart'],['defend','Protect the woodland clearing'],['shoot','Destroy the root power source']],
  [['shoot','Cut down the thorn guardian'],['hunt','Catch the runaway roots'],['escape','Escape the collapsing forest']]
 ]},
 2:{title:'SHARK FAMILY RESCUE',waves:[
  [['rescue','Free the trapped young shark'],['escort','Escort the shark to safety'],['defend','Hold back the jellyfish swarm']],
  [['escort','Guide the shark family through the reef'],['defend','Protect the family’s hiding place'],['rescue','Reunite the lost shark']]
 ]},
 3:{title:'ROXY’S CITY BATTLE',waves:[
  [['rescue','Evacuate the city street'],['shoot','Destroy Naughty’s root generator'],['escort','Escort the spiky puffer fish'],['bomb','Defuse Naughty’s bomb with the puffer fish']],
  [['defend','Protect the city shelter'],['rescue','Rescue the trapped passengers'],['shoot','Break the rooftop root cannon'],['bomb','Stop the second bomb']]
 ]},
 5:{title:'YELLOW SUBMARINE PRISON',waves:[
  [],
  [['shoot','Torpedo the cell’s magnetic lock'],['switch','Activate the sonar transmitter'],['defend','Repel the prison mines'],['sequence','Seal the cell with three security pads']]
 ]},
 6:{title:'SUNKEN LIBRARY',waves:[
  [['align','Align the ancient star chart'],['shoot','Light the archive mirror'],['sequence','Decode three hidden runes']],
  [['sequence','Rebuild the broken map'],['align','Synchronise the ocean clock'],['shoot','Reveal Barky’s secret trail']]
 ]},
 7:{title:'WHIRLPOOL CAVERNS',waves:[
  [['ring','Swim through the first current'],['ring','Navigate the twisting vortex'],['escape','Reach the sheltered channel']],
  [['ring','Cross the split current'],['ring','Swim through the eye of the whirlpool'],['escape','Escape the collapsing cavern']]
 ]},
 8:{title:'BARKY’S ROOT FORTRESS',waves:[
  [['stealth','Slip past the root sentries'],['disable','Sabotage the surveillance panel'],['stealth','Infiltrate Barky’s inner wall']],
  [['stealth','Avoid the final patrol'],['disable','Cut the root engine power'],['escape','Escape before Barky seals the fortress']]
 ]}
};
const COLORS={switch:'#8cfbd0',shoot:'#ffcd71',hunt:'#f99d7f',align:'#c2afff',sequence:'#a4cfff',
 rescue:'#a2ffb5',escort:'#96fce1',defend:'#92ceff',bomb:'#ffa19b',ring:'#8eefff',escape:'#ffec96',stealth:'#c6a8fc',disable:'#b7ffd6'};
const ICONS={switch:'⚙',shoot:'✦',hunt:'◆',align:'◉',sequence:'◇',rescue:'♥',escort:'➤',defend:'♥',bomb:'!',ring:'◎',escape:'➜',stealth:'◈',disable:'⚡'};
function create(chapter,wave,width=1000){
 const plan=PLANS[chapter],steps=plan?.waves?.[wave];if(!steps?.length)return null;
 const W=Math.max(600,Number(width)||1000);
 const nodes=steps.map(([kind,label],i)=>{
  const distance=steps.length===4?.43+i:steps.length===3?.55+i*1.48:.7+i*1.2;
  const x=distance*W,y=[352,433,293,412][i];
  return {id:i,kind,label,x,y,baseX:x,baseY:y,done:false,active:false,
   hold:0,hp:['shoot','hunt'].includes(kind)?(kind==='hunt'?3:3):0,
   flash:0,angle:i*.9,goalAngle:1.65+i*.75,solved:0,sequenceIndex:0,
   escortX:x,escortY:y,escortGoal:x+255,alert:0,seconds:0};
 });
 return {version:35,chapter,wave,title:plan.title,nodes,progress:0,
  alarm:0,alarmCooldown:0,escapeClock:0,pufferReady:false,doneNotified:false,events:[]};
}
function next(m){return m?.nodes?.find(n=>!n.done)||null;}
function complete(m){return !!m&&m.nodes.every(n=>n.done);}
function finish(m,n){
 if(!m||!n||n.done)return false;
 n.done=true;n.active=false;n.flash=1;m.progress=m.nodes.filter(x=>x.done).length;
 if(n.kind==='escort'&&m.chapter===3)m.pufferReady=true;
 return true;
}
function within(a,x,y,r){return Math.hypot(a.x-x,a.y-y)<=r;}
function targetPosition(n){
 if(!n)return null;
 if(n.kind==='sequence'){
  const xs=[n.x-88,n.x,n.x+88],ys=[n.y-57,n.y+66,n.y-57];
  return {x:xs[n.sequenceIndex]??n.x,y:ys[n.sequenceIndex]??n.y};
 }
 return {x:n.x,y:n.y};
}
function closest(m,x,y,r=120){
 const n=next(m);if(!n)return null;
 const p=targetPosition(n);
 return within(p,x,y,r)?n:null;
}
function interact(m,x,y){
 if(!m)return {handled:false};
 const n=closest(m,x,y,145);
 if(!n)return {handled:false};
 if(n.kind==='shoot'||n.kind==='hunt'||n.kind==='ring'||n.kind==='escape')
  return {handled:true,message:{shoot:'AIM AND FIRE TO BREAK THE TARGET!',hunt:'AIM AT THE MOVING ROOT HEART!',ring:'SWIM THROUGH THE CURRENT RING!',escape:'FOLLOW THE ESCAPE ARROW!'}[n.kind]};
 if(n.kind==='escort'||n.kind==='defend'||n.kind==='bomb'){
  if(n.kind==='bomb'&&m.chapter===3&&m.wave===0&&!m.pufferReady)return {handled:true,message:'FIND AND ESCORT THE PUFFER FISH FIRST!'};
  n.active=true;
  return {handled:true,started:true,node:n,message:n.kind==='escort'?'THE ESCORT HAS STARTED! STAY WITH YOUR FRIEND.':n.kind==='defend'?'DEFEND THE SAFE AREA! STUN THE ATTACKERS.':'BOMB DISARMING — STAY NEAR, KEEP ENEMIES AWAY!'};
 }
 if(n.kind==='stealth'||n.kind==='disable'){
  if(m.alarm>.8)return {handled:true,message:'ALERT! STOP MOVING FAST AND WAIT FOR THE SENTRIES.'};
  if(n.kind==='disable'){
   n.active=true;n.hold=0;return {handled:true,started:true,node:n,message:'DISABLING ROOT ENGINE — HOLD THIS POSITION QUIETLY!'};
  }
 }
 if(n.kind==='align'){
  const err=Math.abs(Math.atan2(Math.sin(n.angle-n.goalAngle),Math.cos(n.angle-n.goalAngle)));
  if(err>.66)return {handled:true,message:'WAIT FOR THE GLOWING POINTER TO REACH THE GREEN ARC!'};
  n.solved++;n.flash=.35;
  if(n.solved<2){n.goalAngle=(n.goalAngle+2.25)%TAU;return {handled:true,message:'GOOD! ALIGN THE SECOND SYMBOL.'};}
 }
 if(n.kind==='sequence'){
  const p=targetPosition(n);
  if(!within(p,x,y,73))return {handled:true,message:'MOVE TO THE NEXT GLOWING PAD!'};
  n.sequenceIndex++;n.flash=.35;
  if(n.sequenceIndex<3)return {handled:true,message:'PAD '+n.sequenceIndex+'/3 — FIND THE NEXT MARKED PAD!'};
 }
 if(finish(m,n))return {handled:true,completed:true,node:n,message:{
  rescue:'CIVILIAN / SHARK RESCUED!',switch:'SYSTEM ACTIVATED!',stealth:'SENTRY BYPASSED!',align:'PUZZLE SOLVED!',sequence:'SEQUENCE COMPLETE!'
 }[n.kind]||'OBJECTIVE COMPLETE!'};
 return {handled:true};
}
function projectile(m,p){
 if(!m||!p)return null;
 const n=next(m);if(!n)return null;
 if(n.kind==='switch'&&p.weapon==='electric'&&within(n,p.x,p.y,(p.r||10)+40)){
  finish(m,n);return {hit:true,completed:true,node:n,message:'ELECTRIC CIRCUIT ACTIVATED!'};
 }
 if(!['shoot','hunt'].includes(n.kind)||!within(n,p.x,p.y,(p.r||10)+36))return null;
 n.hp-=clamp(Math.round((Number(p.damage)||16)/26),1,4);
 n.flash=.24;
 if(n.hp<=0){finish(m,n);return {hit:true,completed:true,node:n,message:n.kind==='hunt'?'ROOT HEART DESTROYED!':'TARGET DESTROYED!'};}
 return {hit:true,completed:false,node:n,message:'TARGET HIT!'};
}
function update(m,dt,players,movement=0,hazards=[],time=0){
 if(!m||complete(m))return [];
 dt=clamp(Number(dt)||0,0,.11);
 const events=[],n=next(m),ps=(players||[]).filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y));
 const nearby=(p,r)=>ps.some(h=>Math.hypot(h.x-p.x,h.y-p.y)<r);
 const threatened=(p,r)=>hazards.some(h=>(h.stun||0)<.2&&Math.hypot(h.x-p.x,h.y-p.y)<r);
 const done=(msg)=>{if(finish(m,n))events.push({type:'complete',node:n,message:msg});};
 if(n.kind==='hunt'){
  n.x=n.baseX+Math.sin(time*2.05+n.id)*78;
  n.y=n.baseY+Math.cos(time*2.5+n.id)*45;
 }else if(n.kind==='align'){
  n.angle=(n.angle+dt*(m.chapter===6?1.24:1.63))%TAU;
 }else if(n.kind==='ring'){
  if(nearby(n,57))done('CURRENT PASSED!');
 }else if(n.kind==='escape'){
  if(nearby(n,100))done('ESCAPED THE DANGER ZONE!');
 }else if(n.kind==='escort'&&n.active){
  const partner={x:n.escortX,y:n.escortY};
  const playerNear=nearby(partner,210);
  const danger=threatened(partner,99);
  if(playerNear&&!danger){
   n.escortX=Math.min(n.escortGoal,n.escortX+dt*(m.chapter===3?100:130));
   n.escortY=n.baseY+Math.sin(n.escortX/85)*20;
  }
  if(n.escortX>=n.escortGoal-1)done(m.chapter===3?'SPIKY PUFFER FISH IS SAFE!':'SHARK FAMILY REACHED SAFETY!');
 }else if(['defend','bomb','disable'].includes(n.kind)&&n.active){
  const position=targetPosition(n),safe=nearby(position,n.kind==='disable'?100:145);
  const danger=threatened(position,n.kind==='disable'?120:165);
  const quiet=n.kind!=='disable'||m.alarm<.85;
  n.hold=clamp(n.hold+(safe&&!danger&&quiet?dt:-dt*.65),0,6);
  const required=n.kind==='defend'?3.6:n.kind==='bomb'?3.1:2.2;
  if(n.hold>=required)done(n.kind==='defend'?'FRIENDS PROTECTED!':n.kind==='bomb'?'BOMB DEFUSED!':'ROOT ENGINE DISABLED!');
 }
 if(['stealth','disable'].includes(n.kind)){
  m.alarmCooldown=Math.max(0,m.alarmCooldown-dt);
  const sentry={x:n.baseX+130+Math.sin(time*1.2)*90,y:n.baseY+Math.cos(time*1.4)*70};
  const speed=Math.max(movement*320,...ps.map(p=>Math.hypot(p.motionVX||0,p.motionVY||0)),0);
  const exposed=ps.some(p=>within(sentry,p.x,p.y,245))&&speed>158;
  m.alarm=clamp(m.alarm+(exposed?dt*.85:-dt*.75),0,2);
  if(m.alarm>=1.88&&m.alarmCooldown<=0){
   m.alarm=1.1;m.alarmCooldown=8;
   events.push({type:'alarm',node:n,message:'ROOT SENTRY ALERT! NEW GUARDS APPROACHING!'});
  }
 }else m.alarm=Math.max(0,m.alarm-dt);
 for(const p of m.nodes)p.flash=Math.max(0,(p.flash||0)-dt);
 return events;
}
function message(m){
 if(!m)return '';
 if(complete(m))return m.title+' · OBJECTIVE COMPLETE! NEXT STORY SCENE...';
 const n=next(m),verb={
  shoot:'AIM + FIRE',hunt:'TRACK + FIRE',align:'PRESS B WHEN NEEDLE ENTERS GREEN ARC',
  sequence:'FIND THE GLOWING PAD · PRESS B',rescue:'PRESS B TO RESCUE',switch:'PRESS B OR USE ELECTRIC',
  escort:n.active?'STAY NEAR ESCORT':'PRESS B TO START ESCORT',
  defend:n.active?'PROTECT FRIENDS · STUN ENEMIES':'PRESS B TO DEFEND',
  bomb:n.active?'DEFUSE · STAY NEAR':'PRESS B TO DISARM',
  ring:'STEER THROUGH THE RING',escape:'RUN / SWIM TO THE ESCAPE MARKER',
  stealth:'APPROACH QUIETLY · B',disable:n.active?'STAY STILL · DISABLE':'SNEAK NEAR · PRESS B'
 }[n.kind]||'COMPLETE OBJECTIVE';
 return m.title+' · '+m.progress+'/'+m.nodes.length+' · '+n.label.toUpperCase()+' · '+verb;
}
function draw(ctx,m,t=0){
 if(!ctx||!m)return;
 const current=next(m);
 for(const n of m.nodes){
  const active=n===current,col=n.done?'#8effbc':COLORS[n.kind];
  ctx.save();ctx.translate(n.x,n.y);
  ctx.globalAlpha=n.done?.24:active?1:.29;
  const pulse=1+Math.sin(t*4+n.id)*.08,r=n.kind==='ring'||n.kind==='escape'?59:42;
  ctx.shadowColor=col;ctx.shadowBlur=active?25:7;
  ctx.strokeStyle=col;ctx.lineWidth=active?5:3;
  ctx.beginPath();ctx.ellipse(0,0,r*pulse,r*pulse*.78,0,0,TAU);ctx.stroke();
  if(['align','sequence','bomb'].includes(n.kind)&&active){
   ctx.strokeStyle='#ffffffbb';ctx.lineWidth=2;
   ctx.beginPath();ctx.arc(0,0,r+9,t*.7,t*.7+TAU*.68);ctx.stroke();
  }
  ctx.fillStyle='#10354bcc';ctx.beginPath();ctx.arc(0,0,r*.60,0,TAU);ctx.fill();
  ctx.fillStyle=col;ctx.font='900 32px system-ui';ctx.textAlign='center';
  ctx.fillText(n.done?'✓':ICONS[n.kind],0,11);
  if(['shoot','hunt'].includes(n.kind)&&!n.done){
   ctx.shadowBlur=0;ctx.fillStyle='#303f57';ctx.fillRect(-35,r+13,70,8);
   ctx.fillStyle=col;ctx.fillRect(-35,r+13,70*clamp(n.hp/3,0,1),8);
  }
  if(n.kind==='align'&&active){
   ctx.strokeStyle='#66ffb6';ctx.lineWidth=6;ctx.beginPath();ctx.arc(0,0,65,n.goalAngle-.6,n.goalAngle+.6);ctx.stroke();
   ctx.strokeStyle='#ffffff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(n.angle)*65,Math.sin(n.angle)*65);ctx.stroke();
  }
  if(n.kind==='sequence'&&active){
   const p=targetPosition(n);ctx.save();ctx.translate(p.x-n.x,p.y-n.y);
   ctx.strokeStyle='#fef3a0';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,31+Math.sin(t*5)*3,0,TAU);ctx.stroke();
   ctx.fillStyle='#fff8d6';ctx.font='900 20px system-ui';ctx.fillText(String(n.sequenceIndex+1),0,7);ctx.restore();
  }
  if(['defend','bomb','disable'].includes(n.kind)&&n.active&&!n.done){
   const required=n.kind==='defend'?3.6:n.kind==='bomb'?3.1:2.2;
   ctx.strokeStyle='#e5ffff';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,67,-Math.PI/2,-Math.PI/2+TAU*clamp(n.hold/required,0,1));ctx.stroke();
  }
  if(n.kind==='escort'&&active){
   const px=n.escortX-n.x,py=n.escortY-n.y;
   ctx.save();ctx.translate(px,py);ctx.fillStyle=m.chapter===3?'#ffd6a7':'#87f3f4';
   ctx.beginPath();ctx.ellipse(0,0,22,15,0,0,TAU);ctx.fill();
   ctx.beginPath();ctx.moveTo(-12,0);ctx.lineTo(-29,-12);ctx.lineTo(-29,12);ctx.closePath();ctx.fill();
   ctx.fillStyle='#113b56';ctx.beginPath();ctx.arc(10,-5,3.5,0,TAU);ctx.fill();
   if(m.chapter===3){for(let j=0;j<5;j++){const a=j*TAU/5;ctx.beginPath();ctx.moveTo(Math.cos(a)*14,Math.sin(a)*11);ctx.lineTo(Math.cos(a)*29,Math.sin(a)*24);ctx.strokeStyle='#ffe9a7';ctx.lineWidth=3;ctx.stroke();}}
   ctx.restore();
  }
  if(n.kind==='stealth'&&active){
   ctx.strokeStyle=m.alarm>.8?'#ff7f81':'#bbabff';ctx.lineWidth=5;
   ctx.beginPath();ctx.arc(130+Math.sin(t*1.2)*90,Math.cos(t*1.4)*70,69,-1.8,-.1);ctx.stroke();
  }
  if(n.kind==='ring'&&active){
   for(let j=1;j<=3;j++){ctx.strokeStyle='#8cfaff99';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(0,0,r+j*18,t*(j%2?-1:1),t*(j%2?-1:1)+TAU*.7);ctx.stroke();}
  }
  if(n.flash>0){ctx.strokeStyle='#fff';ctx.lineWidth=5;ctx.globalAlpha=clamp(n.flash,0,1);ctx.beginPath();ctx.arc(0,0,r+24*(1-n.flash),0,TAU);ctx.stroke();}
  ctx.shadowBlur=0;ctx.font='800 13px system-ui';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#09253c';
  const label=n.done?'DONE':active?n.label.toUpperCase():'UPCOMING';
  ctx.strokeText(label,0,-r-29);ctx.fillStyle=n.done?'#aaffc5':'#fff';ctx.fillText(label,0,-r-29);
  ctx.restore();
 }
}
root.FishmanAdventureV35={PLANS,create,next,complete,finish,targetPosition,closest,interact,projectile,update,message,draw,version:'v35-varied-story-missions'};
})(typeof window!=='undefined'?window:globalThis);
