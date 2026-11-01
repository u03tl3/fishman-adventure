/* Fishman v32: reusable chapter encounter pacing, deterministic and host-owned.
   Integration into index.html is pending; do not replace existing story/boss scripts. */
(function(root){
 'use strict';
 const CHAPTERS={
  1:{name:'Fishman Experiment',mechanic:'escape',beats:['explore','switch','chase','boss']},
  2:{name:"Naughty's Secret Power",mechanic:'forest',beats:['explore','ambush','puzzle','boss']},
  3:{name:'Underwater Allies',mechanic:'rescue',beats:['swim','rescue','defend','boss']},
  4:{name:"Roxy's City Battle",mechanic:'city',beats:['rescue','defend','bomb','boss']},
  5:{name:'McTreeFace Boss Battle',mechanic:'boss-phases',beats:['dodge','shield','counter','boss']},
  6:{name:'Yellow Submarine',mechanic:'vehicle',beats:['navigate','torpedoes','repair','boss']},
  7:{name:'Sunken Library',mechanic:'puzzle',beats:['explore','decode','switch','boss']},
  8:{name:'Whirlpool Caverns',mechanic:'currents',beats:['navigate','current','escape','boss']},
  9:{name:"Barky's Root Fortress",mechanic:'infiltration',beats:['sneak','disable','defend','boss']},
  10:{name:'Ocean Light Festival',mechanic:'gauntlet',beats:['prepare','rematch','survive','finale']}
 };
 function chapter(id){return CHAPTERS[id]||null;}
 function create(id){const def=chapter(id);if(!def)throw new RangeError('Unknown chapter');return {chapter:id,beat:0,complete:false,events:[],mechanic:def.mechanic};}
 function dispatch(state,action){
  if(!state||!action||state.complete)return state;
  const def=chapter(state.chapter);if(!def)return state;
  const next={...state,events:[]};
  if(action.type==='ADVANCE'&&action.completedBeat===def.beats[state.beat]){
   next.beat=Math.min(def.beats.length,state.beat+1);
   next.complete=next.beat===def.beats.length;
   next.events=[next.complete?'chapter-objectives-complete':'beat-changed'];
  }
  return next;
 }
 function objective(state){const def=chapter(state.chapter);return !def?'':state.complete?'Chapter objectives complete':def.beats[state.beat];}
 root.FishmanEncounterV32={CHAPTERS,chapter,create,dispatch,objective};
})(typeof window!=='undefined'?window:globalThis);
