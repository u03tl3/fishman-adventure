/* Fishman v32: deterministic city rescue and bomb mission logic.
   Engine-independent so host can own mission state and synchronize snapshots.
   Integration with Chapter 4 rendering/input is a separate task. */
(function(root){
 'use strict';
 const PHASES=Object.freeze(['rescue','defence','bomb','boss','complete']);
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function createCityMission(options={}){
  const required=clamp(Math.floor(options.requiredRescues??3),1,10);
  return {version:32,phase:'rescue',rescued:0,requiredRescues:required,
   civilians:Array.from({length:required},(_,i)=>({id:'civilian-'+(i+1),rescued:false})),
   generators:2,generatorsDisabled:0,bombSeconds:Math.max(15,Number(options.bombSeconds)||75),initialBombSeconds:Math.max(15,Number(options.bombSeconds)||75),
   bombStabilized:false,bossDefeated:false,failed:false,events:[]};
 }
 function dispatch(state,action){
  if(!state||!action)return state;
  if(action.type==='RETRY'&&state.failed)return createCityMission({requiredRescues:state.requiredRescues,bombSeconds:state.initialBombSeconds});
  if(state.failed||state.phase==='complete')return state;
  const s={...state,civilians:state.civilians.map(c=>({...c})),events:[]};
  const emit=(type)=>s.events.push(type);
  if(action.type==='RESCUE'&&s.phase==='rescue'){
   const c=s.civilians.find(c=>c.id===action.id);
   if(c&&!c.rescued){c.rescued=true;s.rescued++;emit('rescue');}
   if(s.rescued===s.requiredRescues){s.phase='defence';emit('defence-start');}
  }else if(action.type==='DISABLE_GENERATOR'&&s.phase==='defence'){
   const id=action.id;
   if((id==='generator-1'||id==='generator-2')&&!s['disabled'+id]){
    s['disabled'+id]=true;s.generatorsDisabled++;emit('generator-disabled');
    if(s.generatorsDisabled>=s.generators){s.phase='bomb';emit('bomb-start');}
   }
  }else if(action.type==='TICK'&&s.phase==='bomb'&&!s.bombStabilized){
   s.bombSeconds=Math.max(0,s.bombSeconds-clamp(Number(action.dt)||0,0,60));
   if(s.bombSeconds<=0){s.failed=true;emit('bomb-expired');}
  }else if(action.type==='STABILIZE_BOMB'&&s.phase==='bomb'&&action.pufferFishPresent===true){
   s.bombStabilized=true;s.phase='boss';emit('bomb-stabilized');
  }else if(action.type==='BOSS_DEFEATED'&&s.phase==='boss'){
   s.bossDefeated=true;s.phase='complete';emit('city-complete');
  }
  return s;
 }
 function objective(s){
  if(s.failed)return 'Bomb detonated — retry from checkpoint';
  switch(s.phase){
   case 'rescue':return 'Rescue civilians '+s.rescued+'/'+s.requiredRescues;
   case 'defence':return 'Disable shield generators '+s.generatorsDisabled+'/'+s.generators;
   case 'bomb':return 'Bring the spiky puffer fish to stabilize the bomb · '+Math.ceil(s.bombSeconds)+'s';
   case 'boss':return 'Defeat giant Naughty with Roxy';
   default:return 'City saved!';
  }
 }
 root.FishmanCityMission={createCityMission,dispatch,objective,PHASES};
})(typeof window!=='undefined'?window:globalThis);
