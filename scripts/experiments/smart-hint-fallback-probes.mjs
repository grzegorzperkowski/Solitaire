import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { loadPlanners } from './smart-hint-bfs.mjs';
import { createFallback } from './smart-hint-fallback.mjs';
import { createGame } from '../../src/engine/cards.js';
import { applyMove, getLegalMoves, assertInvariants } from '../../src/engine/game.js';
import { rememberVisible, visibleCards } from '../../src/engine/knowledge.js';
import { searchProgress } from '../../src/engine/progress.js';
import { fullStateKey } from '../../tests/helpers/smart-hint-bfs.js';
import { inspectPlan, playDeal } from '../hint-benchmark.js';

const finish = iterator => { let step; do { step = iterator.next(); } while (!step.done); return step.value; };
const cases = JSON.parse(readFileSync('.project/reports/T028-bfs-diagnostics.json', 'utf8')).cases;
const { baseline, bfs, metadata } = await loadPlanners({ observe: true });
const fallback = createFallback(baseline.searchSmartHint, bfs.searchSmartHint);
const output = { metadata, notes: 'Fresh searches, same active-prefix context, no previousHint; counters do not steer search.', cases: [] };
mkdirSync('.cache', { recursive: true });
for (const c of cases) {
  let state = createGame({ seed: c.seed, drawCount: c.drawCount }), known = rememberVisible(state, []);
  const snapshots = [state];
  for (const move of c.commands) {
    const result = applyMove(state, move); assert(result.ok);
    state = result.state; snapshots.push(state); known = rememberVisible(state, known);
  }
  assert.deepEqual(state, c.state); assert.deepEqual(known, c.knownCards); assertInvariants(state);
  const context = baseline.createHintContext(snapshots, known);
  const results = [];
  for (const states of c.id.includes('seed202') ? [10000] : [512, 1024, 2048]) {
    for (const [id, search, maxStates] of [['baseline', baseline.searchSmartHint, states], ['fifo', bfs.searchSmartHint, states], ['fallback', fallback, states * 2]]) {
      const result = finish(search(state, known, { maxStates, maxDepth: 32, plannerContext: context }));
      assert(!inspectPlan(state, known, result.plan).preparationOnly);
      results.push({ id, maxStates, result });
      console.log(JSON.stringify({ case: c.id, id, states, status: result.status, length: result.plan.length,
        work: result.diagnostics?.work, fallback: result.diagnostics?.fallback?.used }));
    }
  }
  output.cases.push({ id: c.id, results });
  writeFileSync('.cache/T028-fallback-probes.json', JSON.stringify(output));
}

// Independent bounded FIFO: exact mechanical keys, no SmartHint score/depth cuts.
function reachable(root, known, limit) {
  const knownSet = new Set(rememberVisible(root, known));
  const initialF = root.foundations.flat().length;
  const nodes = [{ state: root, parent: -1, move: null }], seen = new Set([fullStateKey(root)]);
  let truncated = false, transitions = 0;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    for (const move of getLegalMoves(node.state)) {
      const next = applyMove(node.state, move); transitions++; assert(next.ok);
      const goal = next.revealed != null ? 'REVEAL' : next.state.foundations.flat().length > initialF ? 'FOUNDATION_ADVANCE' :
        visibleCards(next.state).some(id => !knownSet.has(id)) ? 'INFORMATION' : null;
      if (goal) {
        const plan = [move]; let index = i;
        while (nodes[index].parent !== -1) { plan.push(nodes[index].move); index = nodes[index].parent; }
        plan.reverse(); assert(!inspectPlan(root, known, plan).preparationOnly);
        return { status: 'PROGRESS_FOUND', goal, plan, visited: seen.size, expanded: i + 1, transitions, truncated };
      }
      const key = fullStateKey(next.state);
      if (seen.has(key)) continue;
      if (seen.size >= limit) { truncated = true; continue; }
      seen.add(key); nodes.push({ state: next.state, parent: i, move });
    }
    node.state = null;
  }
  return { status: truncated ? 'UNKNOWN' : 'NO_PROGRESS', plan: [], visited: seen.size, expanded: nodes.length, transitions, truncated };
}
const b = cases[1];
const oracle = reachable(b.state, b.knownCards, 100000);
const f04 = finish(searchProgress(b.state, b.knownCards, { maxStates: 100000 }));
assert.equal(oracle.status, f04.status);
output.bReachability = { limit: 100000, oracle, f04 };
console.log(JSON.stringify({ bReachability: output.bReachability }));
writeFileSync('.cache/T028-fallback-probes.json', JSON.stringify(output));

assert.equal(b.commonPrefix, 52);
output.counterfactual = [];
for (const [branch, move] of Object.entries(b.firstDifferentCommands)) {
  const forced = [...b.commands.slice(0, b.commonPrefix), move];
  let step = 0;
  const algorithm = { id: branch, cancellable: true, search: function* (state, known, options) {
    if (step < forced.length) return { status: 'FOUND', plan: [forced[step++]], goal: null, score: null, visitedStates: 0, truncated: false };
    return yield* baseline.searchSmartHint(state, known, options);
  } };
  const game = playDeal(algorithm, b.seed, b.drawCount, { maxSteps: 500, maxStates: 10000, maxDepth: 32, budget: 'states' });
  assert(game.calls.slice(forced.length).every(call => !call.preparationOnly));
  output.counterfactual.push({ branch, forcedPrefixLength: forced.length, firstChoice: move,
    note: 'Same Best-First(10000) after forced common prefix plus one differing move; no inherited unfinished plan.', game });
  console.log(JSON.stringify({ branch, stop: game.stop, steps: game.steps }));
  writeFileSync('.cache/T028-fallback-probes.json', JSON.stringify(output));
}
