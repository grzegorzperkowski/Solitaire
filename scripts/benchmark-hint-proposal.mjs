import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createGame } from '../src/engine/cards.js';
import { applyMove, isWon } from '../src/engine/game.js';
import { rememberVisible } from '../src/engine/knowledge.js';
import { progressStateKey } from '../src/engine/progress.js';
import { analyzeHintPlan, searchSmartHint } from '../src/engine/smart-hints.js';

const baselineCommit = '54d6c7e';
const source = execFileSync('git', ['show', `${baselineCommit}:src/engine/smart-hints.js`], { encoding: 'utf8' })
  .replace(/from '\.\/(.*?)'/g, (_, file) => `from '${pathToFileURL(path.resolve('src/engine', file)).href}'`);
const baseline = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
// Fixed budgets make paired results deterministic; these are measurement budgets, not app defaults.
const budget = { maxStates: 300, maxDepth: 30 };
const hidden = state => state.tableau.reduce((sum, column) => sum + column.faceUpStart, 0);

function run(search, state, known, previousHint) {
  const start = performance.now();
  const iterator = search(state, known, { ...budget, previousHint });
  let step;
  do { step = iterator.next(); } while (!step.done);
  const result = step.value;
  const ms = performance.now() - start;
  assert.ok(result.visitedStates <= budget.maxStates);
  if (result.plan.length) {
    const replay = analyzeHintPlan(state, known, result.plan);
    assert.equal(replay.ok, true);
    assert.equal(replay.goal, result.goal);
    assert.equal(replay.verification.accepted, true);
    assert.equal(replay.score, result.score);
    assert.ok(result.plan.length <= budget.maxDepth);
  }
  return { result, ms };
}

function play(search, seed, drawCount) {
  let state = createGame({ seed, drawCount });
  let known = rememberVisible(state);
  const seen = new Set([progressStateKey(state, known)]);
  const row = { steps: 0, repeats: 0, reveals: 0, won: false, stopped: false, calls: [] };
  let previousHint;
  for (let step = 0; step < 100 && !isWon(state); step++) {
    const { result, ms } = run(search, state, known, previousHint);
    row.calls.push({ ms, visited: result.visitedStates, truncated: result.truncated, length: result.plan.length });
    if (!result.plan.length) { row.stopped = true; break; }
    previousHint = { state, plan: result.plan };
    const next = applyMove(state, result.plan[0]);
    assert.equal(next.ok, true);
    row.reveals += hidden(state) - hidden(next.state);
    state = next.state;
    known = rememberVisible(state, known);
    const key = progressStateKey(state, known);
    if (seen.has(key)) row.repeats++;
    seen.add(key);
    row.steps++;
  }
  row.won = isWon(state);
  return row;
}

function summarize(rows) {
  const calls = rows.flatMap(row => row.calls);
  const percentile = (field, p) => {
    const values = calls.map(row => row[field]).sort((a, b) => a - b);
    return +values[Math.min(values.length - 1, Math.floor(values.length * p))].toFixed(3);
  };
  return { games: rows.length, calls: calls.length,
    wins: rows.filter(row => row.won).length, stops: rows.filter(row => row.stopped).length,
    steps: rows.reduce((sum, row) => sum + row.steps, 0),
    reveals: rows.reduce((sum, row) => sum + row.reveals, 0),
    repeats: rows.reduce((sum, row) => sum + row.repeats, 0),
    medianMs: percentile('ms', 0.5), p95Ms: percentile('ms', 0.95),
    medianVisited: percentile('visited', 0.5), p95Visited: percentile('visited', 0.95),
    truncatedPercent: +(100 * calls.filter(row => row.truncated).length / calls.length).toFixed(2),
  };
}

console.log(JSON.stringify({ baselineCommit, candidate: 'working tree', node: process.version,
  platform: `${process.platform} ${process.arch}`, budget, seeds: '0–99', drawCounts: [1, 3], maxSteps: 100 }));
for (const drawCount of [1, 3]) {
  const before = [], after = [], pairedBefore = [], pairedAfter = [];
  let changedFirstPlan = 0, shorterFirstPlan = 0;
  for (let seed = 0; seed < 100; seed++) {
    const state = createGame({ seed, drawCount });
    const known = rememberVisible(state);
    const pair = [run(baseline.searchSmartHint, state, known), run(searchSmartHint, state, known)];
    if (JSON.stringify(pair[0].result.plan) !== JSON.stringify(pair[1].result.plan)) changedFirstPlan++;
    if (pair[1].result.plan.length < pair[0].result.plan.length) shorterFirstPlan++;
    for (const [index, rows] of [pairedBefore, pairedAfter].entries()) rows.push({
      steps: 0, repeats: 0, reveals: 0,
      calls: [{ ms: pair[index].ms, visited: pair[index].result.visitedStates, truncated: pair[index].result.truncated }],
    });
    before.push(play(baseline.searchSmartHint, seed, drawCount));
    after.push(play(searchSmartHint, seed, drawCount));
    if ((seed + 1) % 25 === 0) console.log(JSON.stringify({ progress: { drawCount, completedSeeds: seed + 1 } }));
  }
  console.log(JSON.stringify({ drawCount, pairedInitial: { before: summarize(pairedBefore), after: summarize(pairedAfter),
    changedFirstPlan, shorterFirstPlan }, trajectories: { before: summarize(before), after: summarize(after) } }));
}
