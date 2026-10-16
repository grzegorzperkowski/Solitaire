import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { loadSelectionPlanners } from './smart-hint-selection.mjs';
import { loadPlanners } from './smart-hint-bfs.mjs';
import { createGame } from '../../src/engine/cards.js';
import { applyMove, assertInvariants } from '../../src/engine/game.js';
import { rememberVisible } from '../../src/engine/knowledge.js';
import { progressStateKey } from '../../src/engine/progress.js';
import { inspectPlan } from '../hint-benchmark.js';
const finish=i=>{let s;do{s=i.next();}while(!s.done);return s.value;};
const { baseline,variant,metadata }=await loadSelectionPlanners({trace:true});
const {bfs}=await loadPlanners();
const original=JSON.parse(readFileSync('.project/reports/T028-bfs-diagnostics.json','utf8')).cases[1];
const benchmark=JSON.parse(readFileSync('.cache/T028-selection-4096.json','utf8'));
const g=benchmark.games.find(g=>g.algorithm==='previous'&&g.seed===204&&g.drawCount===1);
assert(g);
const fresh=g.calls.map((c,i)=>[c,i]).filter(([c])=>c.visitedStates>0).map(([,i])=>i);
assert.equal(fresh.length,g.choices.length);
const choice=g.choices.findIndex(c=>c.firstMoveChanged);assert(choice>=0);
const specs=[{id:'seed204-first-changed-root',seed:204,drawCount:1,commands:g.history.slice(0,fresh[choice]),maxStates:4096},
  {id:'seed202-prefix89',seed:202,drawCount:1,commands:original.commands.slice(0,89),maxStates:10000}];
const results=[];
for(const s of specs) {
 let state=createGame({seed:s.seed,drawCount:s.drawCount}),known=rememberVisible(state,[]);const snapshots=[state];
 for(const command of s.commands){const n=applyMove(state,command);assert(n.ok);state=n.state;snapshots.push(state);known=rememberVisible(state,known);assertInvariants(state);}
 const options={maxStates:s.maxStates,maxDepth:32,plannerContext:baseline.createHintContext(snapshots,known)};
 const a=finish(baseline.searchSmartHint(state,known,options)),b=finish(variant.searchSmartHint(state,known,options));
 assert.deepEqual(baseline.selectionProbe.trace,variant.selectionProbe.trace);
 assert.deepEqual(baseline.selectionProbe.candidates,variant.selectionProbe.candidates);
 assert(!inspectPlan(state,known,a.plan).preparationOnly);assert(!inspectPlan(state,known,b.plan).preparationOnly);
 const r={...s,state,knownCards:known,traceEntries:baseline.selectionProbe.trace.length,
   traceSha256:createHash('sha256').update(JSON.stringify(baseline.selectionProbe.trace)).digest('hex'),
   candidateCount:baseline.selectionProbe.candidates.length,
   baseline:{plan:a.plan,goal:a.goal,score:a.score,components:a.components},variant:{plan:b.plan,goal:b.goal,score:b.score,components:b.components}};
 if(s.id==='seed204-first-changed-root') {
   assert.deepEqual(a.plan,g.choices[choice].baseline.plan);assert.deepEqual(b.plan,g.choices[choice].variant.plan);
 } else {
   const plan=original.commands.slice(89,103),analysis=bfs.analyzeHintPlan(state,known,plan);
   assert(analysis.ok&&analysis.verification.accepted);
   const key=progressStateKey(analysis.state,known);
   r.fifo={plan,goal:analysis.goal,score:analysis.score,components:analysis.components,
     endpointFoundByBestFirst:baseline.selectionProbe.candidates.some(c=>c.key===key),
     exactPlanFoundByBestFirst:baseline.selectionProbe.candidates.some(c=>JSON.stringify(c.plan)===JSON.stringify(plan))};
   let fifoSource=readFileSync('SMART_HINT_BFS_CODE.md','utf8').match(/## src\/engine\/smart-hints.js\n\n```javascript\n([\s\S]*?)\n```/)[1]+'\n';
   fifoSource=fifoSource.replace('  // Pre-check WON','  auditCandidates.length=0;\n  // Pre-check WON').replace('        candidate.completesGame = isWon(nextState);','        candidate.completesGame = isWon(nextState);\n        auditCandidates.push({ ...candidate });');
   fifoSource+='\nexport const auditCandidates=[];\n';
   fifoSource=fifoSource.replace(/from '\.\/(.*?)'/g,(_,f)=>`from '${pathToFileURL(path.resolve('src/engine',f)).href}'`);
   const audit=await import(`data:text/javascript;base64,${Buffer.from(fifoSource).toString('base64')}`);
   const fifoResult=finish(audit.searchSmartHint(state,known,options));
   assert.deepEqual(fifoResult.plan,plan);
   const bfEnd=baseline.analyzeHintPlan(state,known,a.plan);assert(bfEnd.ok);
   const bfKey=progressStateKey(bfEnd.state,known);
   r.fifo.bestFirstWinningEndpointFound=audit.auditCandidates.some(c=>c.key===bfKey);
   r.fifo.qualifiedCandidateCount=audit.auditCandidates.length;

 }
 results.push(r);console.log(JSON.stringify({id:r.id,trace:r.traceEntries,candidates:r.candidateCount,baseline:r.baseline.components,variant:r.variant.components,fifo:r.fifo}));
}
writeFileSync('.project/reports/T028-selection-graph-probes.json',JSON.stringify({metadata,results},null,2)+'\n');
