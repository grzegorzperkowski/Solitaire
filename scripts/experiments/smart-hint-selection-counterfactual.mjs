import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {loadSelectionPlanners} from './smart-hint-selection.mjs';
import {playDeal} from '../hint-benchmark.js';
const data=JSON.parse(readFileSync('.cache/T028-selection-4096.json','utf8'));
const {baseline}=await loadSelectionPlanners();
const records=[];
for(const drawCount of [1,3]){
 const a=data.games.find(g=>g.algorithm==='previous'&&g.seed===211&&g.drawCount===drawCount);
 const b=data.games.find(g=>g.algorithm==='current'&&g.seed===211&&g.drawCount===drawCount);
 const fresh=b.calls.map((c,i)=>[c,i]).filter(([c])=>c.visitedStates>0).map(([,i])=>i);
 assert.equal(fresh.length,b.choices.length);
 const changed=b.choices.map((c,i)=>[c,i]).filter(([c])=>c.choiceChanged);
 assert.equal(changed.length,1);
 const [choice,index]=changed[0],prefixLength=fresh[index],plan=choice.variant.plan;
 assert.deepEqual(a.history.slice(0,prefixLength),b.history.slice(0,prefixLength));
 assert.deepEqual(b.history.slice(prefixLength,prefixLength+plan.length),plan);
 const forcedPrefix=b.history.slice(0,prefixLength+plan.length);let n=0;
 const game=playDeal({id:'one-alternative-then-baseline',cancellable:true,search:function*(...args){
  if(n<forcedPrefix.length)return {status:'FOUND',goal:null,score:null,plan:[forcedPrefix[n++]],visitedStates:0,truncated:false};
  return yield* baseline.searchSmartHint(...args);
 }},211,drawCount,{maxSteps:500,maxStates:4096,maxDepth:32,budget:'states'});
 assert.deepEqual(game.history.slice(0,forcedPrefix.length),forcedPrefix);
 assert(game.calls.slice(forcedPrefix.length).every(c=>!c.preparationOnly));
 records.push({seed:211,drawCount,prefixLength,choice,control:{stop:a.stop,steps:a.steps},
 intervention:{stop:game.stop,steps:game.steps,history:game.history},variant:{stop:b.stop,steps:b.steps},
 sameAsVariantTrajectory:JSON.stringify(game.history)===JSON.stringify(b.history)});
 console.log(JSON.stringify({...records.at(-1),intervention:{stop:game.stop,steps:game.steps}}));
}
writeFileSync('.project/reports/T028-selection-counterfactual.json',JSON.stringify({
 note:'Execute exactly one alternative accepted REVEAL plan, then cold handover to unchanged Best-First4096; chronological knowledge and snapshots; no future card information supplied.',records},null,2)+'\n');
