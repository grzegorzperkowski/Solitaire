import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { parseOptions, playDeal, summarizeGames, compareGames } from '../hint-benchmark.js';

const digest=s=>createHash('sha256').update(s).digest('hex');
export async function loadSelectionPlanners({trace=false}={}) {
  const root=fileURLToPath(new URL('../../',import.meta.url));
  const original=execFileSync('git',['show','2d1ecfc:src/engine/smart-hints.js'],{cwd:root,encoding:'utf8'}).replaceAll('\r\n','\n');
  const old=`return b.components.H - a.components.H || a.plan.length - b.plan.length ||
      b.expectedPostRevealScore - a.expectedPostRevealScore || a.components.B - b.components.B ||`;
  const changed=`return b.components.H - a.components.H || a.components.B - b.components.B ||
      a.plan.length - b.plan.length || b.expectedPostRevealScore - a.expectedPostRevealScore ||`;
  assert.equal(original.split(old).length-1,1);
  const variantSource=original.replace(old,changed);
  const load=async input=>{
    let source=input;
    const replace=(a,b)=>{assert.equal(source.split(a).length-1,1,`Selection anchor changed: ${a}`);source=source.replace(a,b);};
    // shortcut: capture is for serial R&D consumers; use per-generator capture if concurrent consumers are added.
    replace('  // Pre-check WON','  selectionProbe.candidates = []; selectionProbe.trace = [];\n  // Pre-check WON');
    replace('        candidate.completesGame = isWon(nextState);',`        candidate.completesGame = isWon(nextState);
        if (verifyEndState(nextState, evaluation, atBoundary).accepted) selectionProbe.candidates.push({ ...candidate });`);
    if(trace) {
      replace('    stateCount++;','    stateCount++;\n    selectionProbe.trace.push(["EXPAND", current.key, current.cost]);');
      replace('      const key = stateKey(nextState);','      const key = stateKey(nextState);\n      selectionProbe.trace.push(["GENERATE", key, nextCost]);');
      replace('      const { B } = components;','      const { B } = components;\n      selectionProbe.trace.push(["EVALUATE", key, score, components]);');
    }
    source+='\nexport const selectionProbe = { candidates: [], trace: [] };\nexport { compareCandidates };\n';
    source=source.replace(/from '\.\/(.*?)'/g,(_,file)=>`from '${pathToFileURL(path.join(root,'src/engine',file)).href}'`);
    return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  };
  return {baseline:await load(original),variant:await load(variantSource),metadata:{revision:'2d1ecfc',
    baselineSha256:digest(original),variantSha256:digest(variantSource),change:'Only REVEAL B before length/expected in compareCandidates; capture does not guide search.'}};
}

const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function measureSelection(actual,other,isVariant,onChoice) {
  return function* (...args) {
    const result=yield* actual.searchSmartHint(...args);
    if(result.continued) return result;
    const candidates=actual.selectionProbe.candidates;
    const best=compare=>candidates.reduce((winner,c)=>!winner||compare(c,winner)<0?c:winner,null);
    const own=best(actual.compareCandidates),alternate=best(other.compareCandidates);
    const different=!same(own?.plan,alternate?.plan);
    let shadow=result;
    if(different) {
      const iterator=other.searchSmartHint(...args);let step;
      try {do{step=iterator.next();if(!step.done)yield result;}while(!step.done);}finally{iterator.return();}
      shadow=step.value;
      assert.deepEqual(other.selectionProbe.candidates,candidates,'X2 changed the qualified candidate stream');
      assert.equal(shadow.visitedStates,result.visitedStates);
      for(const key of ['retainedStates','duplicateStatesRejected','staleQueueEntries','unresolvedCutoffs','unexpandedStates','strategicCandidates','explorationCandidates'])
        assert.equal(shadow.diagnostics[key],result.diagnostics[key],`X2 changed search ${key}`);
    }
    const base=isVariant?shadow:result,variant=isVariant?result:shadow;
    onChoice({acceptedRevealCandidates:candidates.filter(c=>c.goal==='REVEAL').length,
      distinctRevealFirstMoves:new Set(candidates.filter(c=>c.goal==='REVEAL').map(c=>JSON.stringify(c.plan[0]))).size,
      candidateChoiceChanged:different,choiceChanged:!same(base.plan,variant.plan),firstMoveChanged:!same(base.plan[0],variant.plan[0]),
      sameH:base.components&&variant.components?base.components.H===variant.components.H:null,
      deltaB:base.components&&variant.components?variant.components.B-base.components.B:null,
      deltaL:variant.plan.length-base.plan.length,shadowRun:different,
      ...(different?{baseline:{plan:base.plan,goal:base.goal,components:base.components},variant:{plan:variant.plan,goal:variant.goal,components:variant.components}}:{})});
    return result;
  };
}

async function main() {
  const options=parseOptions(process.argv.slice(2));assert.equal(options.budget,'states');
  const {baseline,variant,metadata}=await loadSelectionPlanners();
  const report={options,metadata,node:process.version,createdAt:new Date().toISOString(),games:[]};
  mkdirSync(path.dirname(options.output),{recursive:true});
  for(const drawCount of [1,3])for(let seed=options.startSeed;seed<options.startSeed+options.count;seed++) {
    const algorithms=[{id:'previous',module:baseline,other:variant,isVariant:false},{id:'current',module:variant,other:baseline,isVariant:true}];
    if(seed%2)algorithms.reverse();
    for(const a of algorithms) {
      const choices=[];
      const game=playDeal({id:a.id,cancellable:true,search:measureSelection(a.module,a.other,a.isVariant,c=>choices.push(c))},seed,drawCount,options);
      assert(game.calls.every(c=>!c.preparationOnly&&c.visitedStates<=options.maxStates));
      report.games.push({...game,choices});
    }
    writeFileSync(options.output,JSON.stringify(report));
    console.log(JSON.stringify({drawCount,seed,games:report.games.slice(-2).map(g=>({id:g.algorithm,stop:g.stop,steps:g.steps,
      changed:g.choices.filter(c=>c.firstMoveChanged).length}))}));
  }
  const summary={...report,games:report.games.map(({history,calls,choices,...g})=>({...g,choiceSummary:{fresh:choices.length,
    candidateChoiceChanged:choices.filter(c=>c.candidateChoiceChanged).length,choiceChanged:choices.filter(c=>c.choiceChanged).length,
    firstMoveChanged:choices.filter(c=>c.firstMoveChanged).length,changedChoices:choices.filter(c=>c.choiceChanged)}})),
    summaries:Object.fromEntries(['previous','current'].map(id=>[id,summarizeGames(report.games.filter(g=>g.algorithm===id))])),paired:compareGames(report.games),
    rawSha256:digest(JSON.stringify(report))};
  writeFileSync(options.output.replace(/\.json$/,'')+'-summary.json',JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify({summaries:summary.summaries,paired:summary.paired}));
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)await main();
