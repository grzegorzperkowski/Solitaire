import assert from 'node:assert/strict';
import { readFileSync,writeFileSync } from 'node:fs';
import { applyMove,isWon } from '../../src/engine/game.js';
import { rememberVisible } from '../../src/engine/knowledge.js';
import { loadPlanners } from './smart-hint-bfs.mjs';
import { loadSelectionPlanners } from './smart-hint-selection.mjs';
import { progressStateKey } from '../../src/engine/progress.js';
const d=JSON.parse(readFileSync('.cache/T028-prefix-switch.json','utf8'));
const before=d.records.find(r=>r.prefixLength===92),after=d.records.find(r=>r.prefixLength===93);assert(before&&after);
const {baseline}=await loadPlanners();
let state=after.root.state,known=after.root.knownCards;const draws=[];
while(state.stock.length){const command={type:'draw'},n=applyMove(state,command);assert(n.ok);state=n.state;known=rememberVisible(state,known);draws.push(command);}
assert.deepEqual(state,before.root.state);assert.deepEqual(known,before.root.knownCards);
const suffix=before.game.history.slice(92),witness=[...draws,...suffix];
for(const command of suffix){const n=applyMove(state,command);assert(n.ok);state=n.state;known=rememberVisible(state,known);}
assert(isWon(state));
const firstGoalPlan=[...draws,...before.firstHint.plan];
const entries=[];
for(let n=1;n<=firstGoalPlan.length;n++){
 const a=baseline.analyzeHintPlan(after.root.state,after.root.knownCards,firstGoalPlan.slice(0,n));
 assert(a.ok);
 const novel=a.goal && (a.goal!=='FOUNDATION_ADVANCE'||a.state.foundations.flat().length>after.root.foundationHighWater);
 if(novel&&a.verification.accepted)entries.push({length:n,goal:a.goal,score:a.score,key:progressStateKey(a.state,after.root.knownCards)});
}
const source=JSON.parse(readFileSync('.project/reports/T028-bfs-diagnostics.json','utf8')).cases[1];
const snapshots=[]; // Rebuild genuine prefix history for the same-root candidate audit.
const {createGame}=await import('../../src/engine/cards.js');let current=createGame({seed:202,drawCount:1});snapshots.push(current);
for(const command of source.commands.slice(0,93)){current=applyMove(current,command).state;snapshots.push(current);}
const {baseline:audit}=await loadSelectionPlanners();
const iterator=audit.searchSmartHint(after.root.state,after.root.knownCards,{maxStates:10000,maxDepth:32,plannerContext:audit.createHintContext(snapshots,after.root.knownCards)});
let step;do{step=iterator.next();}while(!step.done);
for(const e of entries)e.endpointFoundByPolicy=audit.selectionProbe.candidates.some(c=>c.key===e.key);
const result={prefixBefore:92,prefixAfter:93,differingCommand:{type:'recycle'},knownCardsUnchanged:true,returnDraws:draws.length,
  policyBefore:{outcome:before.bestFirstOutcome,totalCommands:before.totalCommands},policyAfter:{outcome:after.bestFirstOutcome,totalCommands:after.totalCommands},
  recoveryWitness:witness,recoveryTotalCommands:93+witness.length,firstOriginalRevealLength:firstGoalPlan.length,
  qualifyingGoalPrefixes:entries,note:'A posteriori legal recovery witness, not a new hint policy or proof that the existing policy can find it. Original winning suffix is replayed only after identical board+knowledge is restored.'};
writeFileSync('.project/reports/T028-prefix-recovery.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,recoveryWitness:`${witness.length} commands`,qualifyingGoalPrefixes:entries.map(({key,...e})=>e)}));
