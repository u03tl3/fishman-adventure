/* Fishman v31: signature projectile art. The approved character, scenery and collectible art is untouched. */
(()=>{'use strict';
 const TAU=Math.PI*2;
 const PALETTE={basic:['#efffff','#6ef8ff','#1973be'],rapid:['#f2ffff','#39dfff','#1682d8'],spread:['#fff1b9','#ffa64f','#ce4b38'],charge:['#fff4ff','#b985ff','#6941c2'],homing:['#ecfff1','#79fab6','#198c75'],electric:['#ffffff','#fff1a2','#6a9dff']};
 function disk(ctx,x,y,r,colors){const gr=ctx.createRadialGradient(x-r*.35,y-r*.45,1,x,y,r);gr.addColorStop(0,colors[0]);gr.addColorStop(.45,colors[1]);gr.addColorStop(1,colors[2]);ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fillStyle=gr;ctx.fill();}
 function path(ctx,points,color,width){ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();}
 function shot(ctx,p,t=0){
  const kind=p.weapon||'basic',colors=PALETTE[kind]||PALETTE.basic,r=Math.max(4,p.r||10);
  const angle=Math.atan2(p.vy||0,p.vx||1);
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);
  ctx.shadowColor=colors[1];ctx.shadowBlur=kind==='charge'?26:13;
  if(kind==='basic'){
   disk(ctx,0,0,r,colors);ctx.strokeStyle='#dcffffbb';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r*.78,.1,2.8);ctx.stroke();
   ctx.fillStyle='#ffffffb8';ctx.beginPath();ctx.ellipse(-r*.3,-r*.3,r*.26,r*.15,-.5,0,TAU);ctx.fill();
   for(let i=0;i<2;i++){ctx.globalAlpha=.36-i*.1;ctx.beginPath();ctx.arc(-r*(1.3+i*.65),0,r*(.55-i*.15),0,TAU);ctx.strokeStyle=colors[1];ctx.lineWidth=2;ctx.stroke();}
  }else if(kind==='rapid'){
   path(ctx,[[-r*4,0],[-r*.4,0]],colors[1]+'8c',r*.65);
   path(ctx,[[-r*2,0],[r*.15,0]],'#eaffff',r*.24);
   ctx.fillStyle=colors[2];ctx.beginPath();ctx.roundRect(-r,-r*.45,r*2,r*.9,r*.4);ctx.fill();
   ctx.fillStyle=colors[0];ctx.beginPath();ctx.moveTo(r*1.6,0);ctx.lineTo(r*.35,-r*.55);ctx.lineTo(r*.35,r*.55);ctx.closePath();ctx.fill();
  }else if(kind==='spread'){
   path(ctx,[[-r*2,0],[-r*.5,0]],'#ffb45c99',r*.45);
   ctx.fillStyle=colors[2];ctx.beginPath();ctx.moveTo(r*1.2,0);ctx.lineTo(-r*.85,-r*.66);ctx.lineTo(-r*.45,r*.65);ctx.closePath();ctx.fill();
   ctx.strokeStyle=colors[0];ctx.lineWidth=2.2;ctx.stroke();
  }else if(kind==='charge'){
   disk(ctx,0,0,r,colors);
   for(let j=0;j<3;j++){ctx.strokeStyle=j===0?'#fff4ffcc':'#bf8dffa9';ctx.lineWidth=j===0?3:2;ctx.beginPath();ctx.arc(0,0,r*(1.17+j*.20)+Math.sin(t*14+j)*2,0,TAU);ctx.stroke();}
   for(let j=0;j<6;j++){const a=j*TAU/6+t*3;path(ctx,[[Math.cos(a)*r*.8,Math.sin(a)*r*.8],[Math.cos(a)*r*1.45,Math.sin(a)*r*1.45]],'#f5d7ffb0',2);}
  }else if(kind==='homing'){
   path(ctx,[[-r*2.3,0],[-r*.45,0]],'#a0ffe084',r*.55);
   ctx.fillStyle='#ffe1a3';ctx.beginPath();ctx.moveTo(-r*.9,0);ctx.lineTo(-r*1.65,-r*.4);ctx.lineTo(-r*1.65,r*.4);ctx.closePath();ctx.fill();
   ctx.fillStyle=colors[2];ctx.beginPath();ctx.roundRect(-r*.9,-r*.54,r*1.8,r*1.08,r*.3);ctx.fill();
   ctx.fillStyle=colors[1];ctx.beginPath();ctx.moveTo(r*1.45,0);ctx.lineTo(r*.6,-r*.58);ctx.lineTo(r*.6,r*.58);ctx.closePath();ctx.fill();
   ctx.fillStyle='#e3ffff';ctx.beginPath();ctx.ellipse(0,0,r*.33,r*.27,0,0,TAU);ctx.fill();
   for(const side of [-1,1]){ctx.fillStyle='#d0ffd7';ctx.beginPath();ctx.moveTo(-r*.5,side*r*.2);ctx.lineTo(-r*.9,side*r*.95);ctx.lineTo(r*.2,side*r*.52);ctx.closePath();ctx.fill();}
  }else{disk(ctx,0,0,r,colors);}
  ctx.restore();return true;
 }
 function effect(ctx,e,t=0){
  const life=Math.max(.001,e.ttl||.4),ratio=Math.max(0,Math.min(1,1-(e.life||0)/life));
  ctx.save();ctx.globalAlpha=Math.max(0,1-ratio);
  const colors=PALETTE[e.weapon]||PALETTE.basic;ctx.shadowColor=colors[1];ctx.shadowBlur=15;
  if(e.kind==='beam'){
   const ps=e.points||[];if(ps.length>1){
    for(let k=0;k<ps.length-1;k++){
     const a=ps[k],b=ps[k+1],dx=b.x-a.x,dy=b.y-a.y;
     const zig=[[a.x,a.y],[a.x+dx*.25-dy*.07,a.y+dy*.25+dx*.07],[a.x+dx*.5+dy*.05,a.y+dy*.5-dx*.05],[a.x+dx*.75-dy*.06,a.y+dy*.75+dx*.06],[b.x,b.y]];
     path(ctx,zig,colors[2],11*(1-ratio*.5));path(ctx,zig,colors[1],5*(1-ratio*.45));path(ctx,zig,colors[0],2.1);
    }
    for(const a of ps.slice(1))disk(ctx,a.x,a.y,7+ratio*8,colors);
   }
  }else if(e.kind==='shock'||e.kind==='pulse'){
   const radius=(e.radius||50)*(.26+ratio*.85);
   ctx.strokeStyle=colors[1];ctx.lineWidth=Math.max(1,6*(1-ratio));ctx.beginPath();ctx.ellipse(e.x,e.y,radius,radius*.7,0,0,TAU);ctx.stroke();
   ctx.strokeStyle=colors[0];ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(e.x,e.y,radius*.65,radius*.47,0,0,TAU);ctx.stroke();
   if(e.kind==='shock')for(let j=0;j<8;j++){const a=j*TAU/8+t*.3;path(ctx,[[e.x+Math.cos(a)*radius*.7,e.y+Math.sin(a)*radius*.55],[e.x+Math.cos(a)*radius*1.25,e.y+Math.sin(a)*radius*.96]],colors[0],2);}
  }else if(e.kind==='muzzle'){
   const r=(e.radius||20)*(1-ratio*.65);
   disk(ctx,e.x,e.y,Math.max(2,r),colors);
   for(let j=0;j<5;j++){const a=j*TAU/5+t;path(ctx,[[e.x+Math.cos(a)*r*.5,e.y+Math.sin(a)*r*.5],[e.x+Math.cos(a)*r*1.6,e.y+Math.sin(a)*r*1.6]],colors[0],2.5);}
  }else if(e.kind==='impact'){
   const r=(e.radius||24)*(.3+ratio);
   disk(ctx,e.x,e.y,r*(1-ratio*.6),colors);
   for(let j=0;j<7;j++){const a=j*TAU/7+t*2;path(ctx,[[e.x+Math.cos(a)*r*.35,e.y+Math.sin(a)*r*.35],[e.x+Math.cos(a)*r*1.45,e.y+Math.sin(a)*r*1.45]],colors[1],2.8);}
  }
  ctx.restore();
 }
 window.FishmanWeaponVisuals={shot,effect,version:'v32-weapon-feedback'};
})();
