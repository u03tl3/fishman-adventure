/* Fishman v35: six different movement models + visible movement FX.
   Approved Fishman character artwork is intentionally untouched.
   Pure stepping logic is shared by P1 and networked P2. */
(function(root){
'use strict';
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const STYLES={
 fish:{title:'AQUA GLIDE',tint:'#7ef2ff',launch:10.5,stop:6.5,top:1.14},
 kai:{title:'QUICKSTEP / TARGET SCAN',tint:'#b8ffc0',launch:17,stop:18,top:1.09},
 roxy:{title:'T-REX SPRINT / RAM',tint:'#ffb473',launch:4.5,stop:9.5,top:1.08},
 humpty:{title:'ROLL / RICOCHET',tint:'#ffe28c',launch:3.0,stop:2.1,top:1.43},
 gozilla:{title:'HEAVY STOMP',tint:'#b1ffd2',launch:4.0,stop:7,top:.86},
 sub:{title:'SUB PROPELLER / SONAR',tint:'#8fe3ff',launch:2.7,stop:2.1,top:1.19}
};
function reset(player){
 player.motionVX=0;player.motionVY=0;player.motionCharge=0;player.motionHero=player.hero;
 player.motionTrail=[];player.motionTrailClock=0;player.motionPassiveClock=0;player.motionPulse=0;
}
function step(player,dx,dy,dt,mode,bounds,baseSpeed=250){
 if(!player)return {speed:0,intensity:0,charged:false};
 const hero=STYLES[player.hero]?player.hero:'fish',style=STYLES[hero];
 if(player.motionHero!==player.hero||!Number.isFinite(player.motionVX))reset(player);
 dt=clamp(Number(dt)||0,0,.06);if(dt<=0)return {speed:Math.hypot(player.motionVX,player.motionVY),intensity:0,charged:false};
 dx=clamp(Number(dx)||0,-1,1);dy=clamp(Number(dy)||0,-1,1);
 const input=Math.min(1,Math.hypot(dx,dy)),mag=Math.max(1,Math.hypot(dx,dy));
 const water=mode==='swim'||mode==='float'||mode==='cruise'||mode==='power-swim'||mode==='paddle';
 let charge=player.motionCharge||0;
 if(hero==='roxy')charge=input>.4?clamp(charge+dt*.86,0,1):Math.max(0,charge-dt*1.5);
 else if(hero==='humpty')charge=input>.2?clamp(charge+dt*.5,0,1):Math.max(0,charge-dt*.18);
 else if(hero==='gozilla')charge=input>.2?clamp(charge+dt*.9,0,1):Math.max(0,charge-dt*.8);
 else charge=input>.15?clamp(charge+dt*.25,0,1):Math.max(0,charge-dt*.5);
 player.motionCharge=charge;
 const maxSpeed=baseSpeed*style.top*(hero==='roxy'?(1+charge*.68):hero==='humpty'?(1+charge*.35):1);
 const targetX=dx/mag*maxSpeed, targetY=dy/mag*maxSpeed*(mode==='float'?.73:1);
 const turn=Math.hypot(targetX-player.motionVX,targetY-player.motionVY)>maxSpeed*.6;
 const rate=input>.06?(turn&&hero==='humpty'?1.9:style.launch):style.stop;
 const mix=1-Math.exp(-rate*dt);
 player.motionVX+=(targetX-player.motionVX)*mix;
 player.motionVY+=(targetY-player.motionVY)*mix;
 const oldX=Number(player.x)||0,oldY=Number(player.y)||0;
 const lowerX=bounds?.minX??60,upperX=bounds?.maxX??4000,lowerY=bounds?.minY??160,upperY=bounds?.maxY??540;
 player.x=clamp(oldX+player.motionVX*dt,lowerX,upperX);
 player.y=clamp(oldY+player.motionVY*dt,lowerY,upperY);
 if(player.x!==oldX+player.motionVX*dt)player.motionVX=hero==='humpty'?-player.motionVX*.28:0;
 if(player.y!==oldY+player.motionVY*dt)player.motionVY=hero==='humpty'?-player.motionVY*.28:0;
 if(mode==='float'&&Math.abs(dy)<.18)player.y+=(376-player.y)*Math.min(.1,dt*.35);
 const speed=Math.hypot(player.motionVX,player.motionVY);
 player.motionPulse=Math.max(0,(player.motionPulse||0)-dt);
 if(!Array.isArray(player.motionTrail))player.motionTrail=[];
 player.motionTrailClock=(player.motionTrailClock||0)+dt;
 if(speed>85&&player.motionTrailClock>.07){
  player.motionTrailClock=0;
  player.motionTrail.push({x:player.x,y:player.y,life:.45,vx:player.motionVX,vy:player.motionVY});
  if(player.motionTrail.length>9)player.motionTrail.shift();
 }
 for(let i=player.motionTrail.length-1;i>=0;i--){
  const p=player.motionTrail[i];p.life-=dt;
  if(p.life<=0)player.motionTrail.splice(i,1);
 }
 return {speed,intensity:clamp(speed/Math.max(1,maxSpeed),0,1),charged:charge>.62,charge,hero,water};
}
function passive(player,dt,mode,hazards){
 if(!player||!Array.isArray(hazards)||!STYLES[player.hero])return [];
 const events=[],hero=player.hero,speed=Math.hypot(player.motionVX||0,player.motionVY||0);
 player.motionPassiveClock=Math.max(0,(player.motionPassiveClock||0)-Math.max(0,dt));
 if(player.motionPassiveClock>0||speed<72)return events;
 const find=(r)=>hazards.filter(h=>(h.stun||0)<9&&Math.hypot(h.x-player.x,h.y-player.y)<r);
 let targets=[],effect='',stun=.35,damage=0,period=.85;
 if(hero==='fish'&&mode==='swim'&&speed>170){
  targets=find(93);effect='bubble-wake';stun=.58;period=.8;
 }else if(hero==='kai'&&player.aimHold){
  targets=find(115);effect='scan';stun=.46;period=.95;
 }else if(hero==='roxy'&&(player.motionCharge||0)>.63&&speed>255){
  targets=find(77);effect='ram';stun=1.15;damage=1;period=.4;
 }else if(hero==='humpty'&&speed>245){
  targets=find(59);effect='ricochet';stun=1.0;damage=1;period=.46;
 }else if(hero==='gozilla'&&speed>70){
  targets=find(115);effect='stomp';stun=.82;damage=1;period=1.10;
 }else if(hero==='sub'&&mode==='cruise'){
  targets=find(175);effect='sonar';stun=.72;period=1.25;
 }
 if(!targets.length)return events;
 player.motionPassiveClock=period;
 for(const h of targets){
  h.stun=Math.max(h.stun||0,stun);
  if(damage&&Number.isFinite(h.hp))h.hp=Math.max(0,h.hp-damage);
  events.push({kind:effect,x:h.x,y:h.y,hero});
 }
 player.motionPulse=.37;
 return events;
}
function draw(ctx,player,t=0){
 if(!ctx||!player||!STYLES[player.hero])return;
 const style=STYLES[player.hero],trail=player.motionTrail||[],speed=Math.hypot(player.motionVX||0,player.motionVY||0);
 ctx.save();
 for(const p of trail){
  const k=clamp(p.life/.45,0,1);
  ctx.globalAlpha=.17*k;
  ctx.fillStyle=style.tint;
  ctx.shadowBlur=16;ctx.shadowColor=style.tint;
  ctx.beginPath();ctx.ellipse(p.x,p.y+(player.hero==='sub'?14:16),player.hero==='humpty'?24:player.hero==='sub'?36:17,player.hero==='sub'?11:7,0,0,Math.PI*2);ctx.fill();
  if(player.hero==='fish'||player.hero==='sub'){
   ctx.globalAlpha=.35*k;ctx.strokeStyle=style.tint;ctx.lineWidth=2;
   ctx.beginPath();ctx.arc(p.x-12,p.y-10,8+7*(1-k),0,Math.PI*2);ctx.stroke();
  }
  if(player.hero==='roxy'){
   ctx.globalAlpha=.5*k;ctx.fillStyle='#ffd08c';
   for(let i=0;i<3;i++)ctx.fillRect(p.x-8+i*6,p.y+30+(i%2)*5,4,4);
  }
 }
 if(speed>85){
  ctx.globalAlpha=.15+Math.min(.25,speed/1400);
  ctx.strokeStyle=style.tint;ctx.lineWidth=player.hero==='gozilla'?5:2.4;
  const length=Math.min(55,14+speed*.09),nx=-(player.motionVX||0)/speed,ny=-(player.motionVY||0)/speed;
  for(let i=-1;i<=1;i++){
   ctx.beginPath();ctx.moveTo(player.x+nx*8+ny*i*15,player.y+ny*8-nx*i*15);
   ctx.lineTo(player.x+nx*length+ny*i*15,player.y+ny*length-nx*i*15);ctx.stroke();
  }
 }
 if((player.motionPulse||0)>0){
  ctx.globalAlpha=clamp(player.motionPulse/.37,0,.5);
  ctx.strokeStyle=style.tint;ctx.lineWidth=4;
  ctx.beginPath();ctx.ellipse(player.x,player.y,70+(1-player.motionPulse/.37)*28,32,0,0,Math.PI*2);ctx.stroke();
 }
 ctx.restore();
}
root.FishmanHeroMotionV35={STYLES,step,reset,passive,draw,version:'v35-distinct-mobility'};
})(typeof window!=='undefined'?window:globalThis);
