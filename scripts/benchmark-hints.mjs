/**
 * scripts/benchmark-hints.mjs
 *
 * Evaluation comparing baseline `rankHints` vs `searchSmartHint` per T028-spec §8:
 * - Seeds 0..99 for Draw 1 and Draw 3
 * - Max 100 suggestions/actions per deal
 * - Same game engine, actual knowledge updates via rememberVisible after each action
 * - Baseline picks rankHints(state)[0] after each board change
 * - SmartHint executes the first move of FOUND/EXPLORATION, stops on INCONCLUSIVE/WON
 *
 * Reports:
 * - Tableau hidden cards revealed
 * - Returns to previously visited states
 * - Step count, stops, completions
 * - Search runtime (median & p95)
 * - Visited states count & truncation percentage
 */

import { createGame } from '../src/engine/cards.js';
import { applyMove, isWon } from '../src/engine/game.js';
import { rankHints } from '../src/engine/hints.js';
import { searchSmartHint } from '../src/engine/smart-hints.js';
import { rememberVisible } from '../src/engine/knowledge.js';
import { progressStateKey } from '../src/engine/progress.js';

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function countHiddenCards(state) {
  return state.tableau.reduce((sum, col) => sum + col.faceUpStart, 0);
}

function runBaselineGame(seed, drawCount, maxSteps = 100) {
  let state = createGame({ seed, drawCount });
  let known = rememberVisible(state, []);
  const initialHidden = countHiddenCards(state);
  const visited = new Set();
  visited.add(progressStateKey(state, known));

  let steps = 0;
  let cycleReturns = 0;
  let won = false;
  let stopped = false;
  const runtimes = [];

  for (let s = 0; s < maxSteps; s++) {
    if (isWon(state)) {
      won = true;
      break;
    }
    const t0 = performance.now();
    const hints = rankHints(state);
    const t1 = performance.now();
    runtimes.push(t1 - t0);

    if (hints.length === 0) {
      stopped = true;
      break;
    }

    const move = hints[0];
    const res = applyMove(state, move);
    if (!res.ok) {
      stopped = true;
      break;
    }

    state = res.state;
    known = rememberVisible(state, known);
    steps++;

    const key = progressStateKey(state, known);
    if (visited.has(key)) {
      cycleReturns++;
    } else {
      visited.add(key);
    }
  }

  if (isWon(state)) won = true;

  const finalHidden = countHiddenCards(state);
  const revealed = initialHidden - finalHidden;

  return {
    won,
    stopped,
    steps,
    revealed,
    cycleReturns,
    runtimes,
    visitedStates: [1], // rankHints does 1 state per call
    truncatedCount: 0,
    totalCalls: runtimes.length,
  };
}

function runSmartHintGame(seed, drawCount, maxSteps = 100) {
  let state = createGame({ seed, drawCount });
  let known = rememberVisible(state, []);
  const initialHidden = countHiddenCards(state);
  const visited = new Set();
  visited.add(progressStateKey(state, known));

  let steps = 0;
  let cycleReturns = 0;
  let won = false;
  let stopped = false;
  let truncatedCount = 0;
  const runtimes = [];
  const statesVisited = [];

  for (let s = 0; s < maxSteps; s++) {
    if (isWon(state)) {
      won = true;
      break;
    }

    const t0 = performance.now();
    const gen = searchSmartHint(state, known, { maxStates: 10000, maxDepth: 12 });
    let stepRes;
    let latestValue;
    do {
      stepRes = gen.next();
      if (stepRes.value) latestValue = stepRes.value;
    } while (!stepRes.done && performance.now() - t0 < 100);
    const t1 = performance.now();
    const result = stepRes.done ? stepRes.value : {
      ...(latestValue || { status: 'INCONCLUSIVE', plan: [], goal: null, score: null, visitedStates: 0 }),
      truncated: true,
    };

    runtimes.push(t1 - t0);
    statesVisited.push(result.visitedStates || 1);
    if (result.truncated) truncatedCount++;

    if (result.status === 'WON') {
      won = true;
      break;
    }

    if (result.status === 'INCONCLUSIVE' || !result.plan || result.plan.length === 0) {
      stopped = true;
      break;
    }

    const move = result.plan[0];
    const applyRes = applyMove(state, move);
    if (!applyRes.ok) {
      stopped = true;
      break;
    }

    state = applyRes.state;
    known = rememberVisible(state, known);
    steps++;

    const key = progressStateKey(state, known);
    if (visited.has(key)) {
      cycleReturns++;
    } else {
      visited.add(key);
    }
  }

  if (isWon(state)) won = true;

  const finalHidden = countHiddenCards(state);
  const revealed = initialHidden - finalHidden;

  return {
    won,
    stopped,
    steps,
    revealed,
    cycleReturns,
    runtimes,
    visitedStates: statesVisited,
    truncatedCount,
    totalCalls: runtimes.length,
  };
}

function evaluateMode(drawCount, seedCount = 100) {
  console.log(`\n========================================`);
  console.log(`Evaluating Draw ${drawCount} (Seeds 0..${seedCount - 1})`);
  console.log(`========================================`);

  const baselineResults = [];
  const smartResults = [];

  for (let seed = 0; seed < seedCount; seed++) {
    baselineResults.push(runBaselineGame(seed, drawCount));
    smartResults.push(runSmartHintGame(seed, drawCount));
    if ((seed + 1) % 10 === 0 || seed + 1 === seedCount) {
      console.log(`Completed Draw ${drawCount}: ${seed + 1}/${seedCount} seeds`);
    }
  }

  function aggregate(results, name) {
    const totalWins = results.filter(r => r.won).length;
    const totalRevealed = results.reduce((s, r) => s + r.revealed, 0);
    const totalCycleReturns = results.reduce((s, r) => s + r.cycleReturns, 0);
    const totalSteps = results.reduce((s, r) => s + r.steps, 0);
    const totalStops = results.filter(r => r.stopped).length;

    const allRuntimes = results.flatMap(r => r.runtimes);
    const medianTime = percentile(allRuntimes, 50).toFixed(2);
    const p95Time = percentile(allRuntimes, 95).toFixed(2);

    const allVisited = results.flatMap(r => r.visitedStates);
    const medianVisited = Math.round(percentile(allVisited, 50));
    const p95Visited = Math.round(percentile(allVisited, 95));

    const totalCalls = results.reduce((s, r) => s + r.totalCalls, 0);
    const totalTruncated = results.reduce((s, r) => s + r.truncatedCount, 0);
    const truncPct = totalCalls > 0 ? ((totalTruncated / totalCalls) * 100).toFixed(1) : '0.0';

    console.log(`--- ${name} ---`);
    console.log(`  Completions (Wins):       ${totalWins} / ${results.length}`);
    console.log(`  Tableau cards revealed:   ${totalRevealed} (avg ${(totalRevealed / results.length).toFixed(1)}/deal)`);
    console.log(`  Returns to visited state: ${totalCycleReturns} (avg ${(totalCycleReturns / results.length).toFixed(1)}/deal)`);
    console.log(`  Steps executed:           ${totalSteps} (avg ${(totalSteps / results.length).toFixed(1)}/deal)`);
    console.log(`  Stops (no hint/inconcl):  ${totalStops}`);
    console.log(`  Runtime:                  median ${medianTime}ms | p95 ${p95Time}ms`);
    console.log(`  Visited states:           median ${medianVisited} | p95 ${p95Visited}`);
    console.log(`  Truncated calls:          ${totalTruncated} / ${totalCalls} (${truncPct}%)`);

    return {
      name,
      totalWins,
      totalRevealed,
      totalCycleReturns,
      totalSteps,
      totalStops,
      medianTime,
      p95Time,
      medianVisited,
      p95Visited,
      truncPct,
    };
  }

  const bStats = aggregate(baselineResults, 'Baseline (rankHints)');
  const sStats = aggregate(smartResults, 'SmartHint v1 (searchSmartHint)');

  return { bStats, sStats };
}

console.log(`Klondike Solitaire — SmartHint v1 Benchmark per T028-spec §8`);
console.log(`Environment: Node ${process.version} on ${process.platform} (${process.arch})`);
console.log('SmartHint search budget: max 100 ms active time, 10000 states, depth 12');

const countArg = process.argv.find(a => a.startsWith('--count='));
const seedCount = countArg ? parseInt(countArg.split('=')[1], 10) : 100;

const d1 = evaluateMode(1, seedCount);
const d3 = evaluateMode(3, seedCount);

console.log(`\nBenchmark complete.`);
