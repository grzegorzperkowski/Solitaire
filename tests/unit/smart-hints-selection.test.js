import { expect, test } from 'vitest';
import { loadSelectionPlanners } from '../../scripts/experiments/smart-hint-selection.mjs';
import { h02 } from '../fixtures/smart-hints.js';
import { visibleCards } from '../../src/engine/knowledge.js';
import { inspectPlan } from '../../scripts/hint-benchmark.js';
import { applyMove } from '../../src/engine/game.js';
import { rememberVisible } from '../../src/engine/knowledge.js';

const { baseline, variant } = await loadSelectionPlanners({ trace: true });
const candidate = (H,B,length,win=false) => ({ goal:'REVEAL',components:{H,B},plan:Array(length).fill({type:'draw'}),
  completesGame:win,expectedPostRevealScore:0,score:10,historyReturns:0,order:0 });
const finish = iterator => { let s; do{s=iterator.next();}while(!s.done);return s.value; };
test('X2 chooses lower B before length only for equal-H reveals',()=>{
  const short=candidate(1,1,1),preserved=candidate(1,0,3);
  expect(baseline.compareCandidates(short,preserved)).toBeLessThan(0);
  expect(variant.compareCandidates(short,preserved)).toBeGreaterThan(0);
});
test('greater H and a real winning candidate retain priority',()=>{
  expect(variant.compareCandidates(candidate(2,2,10),candidate(1,0,1))).toBeLessThan(0);
  expect(variant.compareCandidates(candidate(0,0,20,true),candidate(1,0,1))).toBeLessThan(0);
});
test('same real root has exactly identical expansions, generated states and qualified candidates',()=>{
  const state=h02(),known=visibleCards(state),options={maxStates:512,maxDepth:8};
  const a=finish(baseline.searchSmartHint(state,known,options));
  const b=finish(variant.searchSmartHint(state,known,options));
  expect(variant.selectionProbe.trace).toEqual(baseline.selectionProbe.trace);
  expect(variant.selectionProbe.candidates).toEqual(baseline.selectionProbe.candidates);
  expect(inspectPlan(state,known,a.plan).preparationOnly).toBe(false);
  expect(inspectPlan(state,known,b.plan).preparationOnly).toBe(false);
});
test('X2 preserves hidden-card permutations and the original commitment after the first move',()=>{
  const state=h02(),known=visibleCards(state);
  const options={maxStates:1000,maxDepth:2,plannerContext:variant.createHintContext([state],known)};
  const result=finish(variant.searchSmartHint(state,known,options));
  const unknown=Array.from({length:52},(_,i)=>i).filter(id=>!known.includes(id));
  const renamed=new Map(unknown.map((id,i)=>[id,unknown[unknown.length-1-i]]));
  const permute=cards=>cards.map(id=>renamed.get(id)??id);
  const other={...state,stock:permute(state.stock),waste:permute(state.waste),
    tableau:state.tableau.map(c=>({...c,cards:permute(c.cards)}))};
  const changed=finish(variant.searchSmartHint(other,known,{...options,plannerContext:variant.createHintContext([other],known)}));
  expect([changed.plan,changed.score,changed.visitedStates]).toEqual([result.plan,result.score,result.visitedStates]);
  const next=applyMove(state,result.plan[0]).state,nextKnown=rememberVisible(next,known),commitment={state,plan:result.plan};
  const continued=finish(variant.searchSmartHint(next,nextKnown,{...options,
    plannerContext:variant.createHintContext([state,next],nextKnown),previousHint:{state,plan:result.plan,commitment}}));
  expect(continued.continued).toBe(true);
  expect(continued.plan).toEqual(result.plan.slice(1));
  expect(continued.commitment).toBe(commitment);
});
