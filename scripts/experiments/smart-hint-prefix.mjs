import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPlanners } from './smart-hint-bfs.mjs';
import { playDeal, inspectPlan } from '../hint-benchmark.js';

export function planIntervals(lengths, commandCount) {
  assert.equal(lengths.length, commandCount + 1);
  assert.equal(lengths.at(-1), 0);
  const intervals = [];
  for (let i = 0; i < commandCount;) {
    const n = lengths[i];
    assert(Number.isSafeInteger(n) && n > 0 && i + n <= commandCount);
    for (let j = 0; j < n; j++) assert.equal(lengths[i + j], n - j, 'Recorded commitment interrupted; cannot infer boundaries');
    intervals.push([i, i + n]); i += n;
  }
  return intervals;
}

export function prefixSwitch(search, trajectory, prefixLength) {
  assert(Number.isSafeInteger(prefixLength) && prefixLength >= 0 && prefixLength <= trajectory.commands.length);
  let forced = 0, firstHint = null, lastHint = null, root = null;
  const algorithm = { id: 'switch', cancellable: true, search: function* (state, known, options) {
    if (forced < prefixLength) return { status: 'FOUND', plan: [trajectory.commands[forced++]], goal: null, score: null, visitedStates: 0, truncated: false };
    root ??= { state, knownCards: known, knownCount: known.length,
      hiddenCount: state.tableau.reduce((n, c) => n + c.faceUpStart, 0), foundationCount: state.foundations.flat().length,
      foundationHighWater: options.plannerContext.foundationHighWater };
    const result = yield* search(state, known, options);
    firstHint ??= result; lastHint = result;
    return result;
  } };
  const game = playDeal(algorithm, trajectory.seed, trajectory.drawCount,
    { maxSteps: 500, maxStates: 10000, maxDepth: 32, budget: 'states' });
  assert(game.calls.slice(prefixLength).every(c => !c.preparationOnly));
  assert.deepEqual(game.history.slice(0, prefixLength), trajectory.commands.slice(0, prefixLength));
  const nextFifoCommand = trajectory.commands[prefixLength] ?? null;
  const nextBestFirstCommand = firstHint?.plan[0] ?? null;
  const stopHint = game.stop === 'WON' ? null : lastHint;
  return { prefixLength, root, nextFifoCommand, nextBestFirstCommand,
    sameFirstCommand: nextFifoCommand && nextBestFirstCommand ? JSON.stringify(nextFifoCommand) === JSON.stringify(nextBestFirstCommand) : null,
    firstHint, bestFirstOutcome: game.stop, totalCommands: game.steps,
    stopReason: stopHint?.reason ?? game.stop, firstStopRawGoals: stopHint?.diagnostics?.work?.rawGoalsBeforeDedup ?? null,
    maxExpandedDepth: stopHint?.diagnostics?.work?.maxExpandedDepth ?? null, game };
}

async function main() {
  const { baseline, bfs, metadata } = await loadPlanners({ observe: true });
  const trajectory = JSON.parse(readFileSync('.project/reports/T028-bfs-diagnostics.json','utf8')).cases[1];
  const fixture = JSON.parse(readFileSync('tests/fixtures/smart-hint-seed202-fifo-plan-lengths.json','utf8'));
  assert.equal(trajectory.commands.length, fixture.commandCount);
  const intervals = planIntervals(fixture.planLengths, fixture.commandCount);
  const checkpoints = [...new Set([52,142,...intervals.map(([,b])=>b).filter(b=>b>=52)])].sort((a,b)=>a-b);
  const runnerSha256 = createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
  const file = '.cache/T028-prefix-switch.json'; mkdirSync('.cache',{recursive:true});
  const report = existsSync(file) ? JSON.parse(readFileSync(file,'utf8')) : { metadata, runnerSha256, checkpoints, records: [] };
  assert.equal(report.runnerSha256, runnerSha256, 'Keep old cache; runner changed, use a separate output before resuming');
  assert.equal(report.metadata.baselineSha256, metadata.baselineSha256);
  const records = new Map(report.records.map(r=>[r.prefixLength,r]));
  const run = t => {
    if (records.has(t)) return records.get(t);
    const r = prefixSwitch(baseline.searchSmartHint, trajectory, t);
    records.set(t,r);report.records=[...records.values()].sort((a,b)=>a.prefixLength-b.prefixLength);
    writeFileSync(file,JSON.stringify(report));
    console.log(JSON.stringify({ prefix:t,outcome:r.bestFirstOutcome,total:r.totalCommands,reason:r.stopReason,rawGoals:r.firstStopRawGoals }));
    return r;
  };
  for (const t of checkpoints) run(t);
  report.lossWindows = checkpoints.slice(1).flatMap((t,i)=>
    records.get(checkpoints[i]).bestFirstOutcome==='WON' && records.get(t).bestFirstOutcome!=='WON' ? [[checkpoints[i],t]] : []);
  // Predeclared refinement: every command in the earliest observed loss window.
  if (report.lossWindows.length) {
    const [a,b] = report.lossWindows[0];
    for(let t=a+1;t<b;t++) run(t);
    const before=records.get(a), after=records.get(b), plan=trajectory.commands.slice(a,b);
    assert(intervals.some(([start,end])=>start===a&&end===b));
    const analysis=bfs.analyzeHintPlan(before.root.state,before.root.knownCards,plan);
    assert(analysis.ok && analysis.verification.accepted);
    assert(!inspectPlan(before.root.state,before.root.knownCards,plan).preparationOnly);
    report.localIntervention={prefix:a,end:b,fifoPlan:plan,fifoPlanAnalysis:analysis,
      controlOutcome:after.bestFirstOutcome,interventionOutcome:before.bestFirstOutcome,
      note:'Control executes the one recorded complete FIFO plan then switches; intervention switches immediately. Same policy/budget/chronological knowledge after each handover.'};
  }
  writeFileSync(file,JSON.stringify(report));
  const summary={...report,records:report.records.map(({game,firstHint,...r})=>({...r,
    firstHint:firstHint?{plan:firstHint.plan,goal:firstHint.goal,score:firstHint.score,components:firstHint.components}:null}))};
  writeFileSync('.project/reports/T028-prefix-switch-summary.json',JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify({checkpoints,lossWindows:report.lossWindows,results:summary.records.map(r=>[r.prefixLength,r.bestFirstOutcome])}));
}
if(process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url) await main();
