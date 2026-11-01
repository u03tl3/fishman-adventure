/* Fishman Adventure v34 — standard-mapped Xbox / browser Gamepad API input.
   No framework or permissions required. Keyboard, pointer, touch and network inputs remain independent. */
(function(root){
 'use strict';
 const NAMES=['a','b','x','y','lb','rb','lt','rt','view','menu','ls','rs','up','down','left','right'];
 const TRIGGER=0.22,DEADZONE=0.19;
 let index=null,previous=Array(16).fill(false),menuAxis=0,lastRumble=0;
 let status={connected:false,index:null,id:'',left:{x:0,y:0},right:{x:0,y:0},down:{},pressed:[],fire:false,nav:0};

 function axis(x,y){
  x=Number.isFinite(x)?Math.max(-1,Math.min(1,x)):0;
  y=Number.isFinite(y)?Math.max(-1,Math.min(1,y)):0;
  const d=Math.min(1,Math.hypot(x,y));
  if(d<=DEADZONE)return {x:0,y:0};
  const magnitude=(d-DEADZONE)/(1-DEADZONE),length=Math.max(1e-6,Math.hypot(x,y));
  return {x:x/length*magnitude,y:y/length*magnitude};
 }
 function pads(){
  try{return typeof navigator!=='undefined'&&typeof navigator.getGamepads==='function'?(navigator.getGamepads()||[]):[];}catch{return [];}
 }
 function getActive(){
  const all=pads();
  const prev=index!==null?all[index]:null;
  if(prev?.connected)return prev;
  return Array.from(all).find(p=>p?.connected&&(p.mapping==='standard'||(!p.mapping&&(p.buttons?.length||0)>=10)))||null;
 }
 function isDown(button,i){
  if(!button)return false;
  const value=Number(button.value)||0;
  return !!button.pressed||value>=(i===6||i===7?TRIGGER:0.5);
 }
 function poll(){
  const pad=getActive();
  if(!pad){
   index=null;previous=Array(16).fill(false);menuAxis=0;
   status={connected:false,index:null,id:'',left:{x:0,y:0},right:{x:0,y:0},down:{},pressed:[],fire:false,nav:0};
   return status;
  }
  if(pad.index!==index){index=pad.index;previous=Array(16).fill(false);menuAxis=0;}
  const pressed=[],down={};
  for(let i=0;i<NAMES.length;i++){
   const name=NAMES[i],active=isDown(pad.buttons?.[i],i);
   down[name]=active;
   if(active&&!previous[i])pressed.push(name);
   previous[i]=active;
  }
  const left=axis(pad.axes?.[0],pad.axes?.[1]),right=axis(pad.axes?.[2],pad.axes?.[3]);
  // D-pad works as movement when the left stick is neutral.
  if(Math.hypot(left.x,left.y)<.05){
   left.x=Number(down.right)-Number(down.left);
   left.y=Number(down.down)-Number(down.up);
   const length=Math.hypot(left.x,left.y);
   if(length>1){left.x/=length;left.y/=length;}
  }
  const newMenuAxis=left.y>.60?1:left.y<-.60?-1:0;
  let nav=newMenuAxis!==menuAxis?newMenuAxis:0;
  if(pressed.includes('down'))nav=1;
  if(pressed.includes('up'))nav=-1;
  menuAxis=newMenuAxis;
  status={connected:true,index:pad.index,id:String(pad.id||'Gamepad'),left,right,down,pressed,fire:down.rt,nav};
  return status;
 }
 function current(){return status;}
 function rumble(kind='tap'){
  const now=Date.now();
  if(now-lastRumble<(kind==='shot'?125:55))return false;
  const pad=getActive();
  const actuator=pad?.vibrationActuator;
  if(!actuator||typeof actuator.playEffect!=='function')return false;
  const pattern=kind==='hit'?{duration:290,strongMagnitude:.7,weakMagnitude:.38}:
   kind==='skill'?{duration:180,strongMagnitude:.42,weakMagnitude:.7}:
   kind==='shot'?{duration:55,strongMagnitude:.11,weakMagnitude:.15}:
   {duration:85,strongMagnitude:.14,weakMagnitude:.22};
  lastRumble=now;
  try{Promise.resolve(actuator.playEffect('dual-rumble',pattern)).catch(()=>{});return true;}catch{return false;}
 }
 root.FishmanGamepad={poll,current,rumble,axis,version:'v34-xbox-gamepad'};
})(typeof window!=='undefined'?window:globalThis);
