import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createGame } from '../src/engine/cards.js';
import { rememberVisible } from '../src/engine/knowledge.js';
import { searchSmartHint as currentSearch } from '../src/engine/smart-hints.js';
import { restoreSession } from '../src/persistence.js';

const baselineCommit = '276714c';
const speedBaselineCommit = '3594a20';
function loadRevision(commit) {
  const source = execFileSync('git', ['show', `${commit}:src/engine/smart-hints.js`], { encoding: 'utf8' })
  .replace(/from '\.\/(.*?)'/g, (_, file) => `from '${pathToFileURL(path.resolve('src/engine', file)).href}'`);
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
const { searchSmartHint: baselineSearch } = await loadRevision(baselineCommit);
const { searchSmartHint: speedBaselineSearch } = await loadRevision(speedBaselineCommit);
const budget = { maxStates: 10000, maxDepth: 12, activeMs: 100 };

function run(search, state, knownCards) {
  const start = performance.now();
  const generator = search(state, knownCards, budget);
  let step;
  let latest;
  do {
    step = generator.next();
    if (step.value) latest = step.value;
  } while (!step.done && performance.now() - start < budget.activeMs);
  const result = step.done ? step.value : {
    ...(latest || { status: 'INCONCLUSIVE', goal: null, plan: [], visitedStates: 0 }),
    truncated: true,
  };
  if (!step.done) generator.return();
  return {
    ms: performance.now() - start,
    visitedStates: result.visitedStates || 0,
    truncated: Boolean(result.truncated),
    result: JSON.stringify({ status: result.status, goal: result.goal, plan: result.plan }),
  };
}

function summarize(rows) {
  const percentile = (key, p) => {
    const values = rows.map((row) => row[key]).sort((a, b) => a - b);
    return +values[Math.floor(p / 100 * values.length)].toFixed(2);
  };
  return {
    positions: rows.length,
    medianMs: percentile('ms', 50),
    p95Ms: percentile('ms', 95),
    medianVisited: percentile('visitedStates', 50),
    p95Visited: percentile('visitedStates', 95),
    truncated: rows.filter((row) => row.truncated).length,
  };
}

function runComplete(search, state, knownCards) {
  const start = performance.now();
  const generator = search(state, knownCards, budget);
  let step;
  do step = generator.next(); while (!step.done);
  return {
    ms: performance.now() - start,
    result: JSON.stringify({
      status: step.value.status,
      goal: step.value.goal,
      plan: step.value.plan,
      visitedStates: step.value.visitedStates,
      truncated: step.value.truncated,
    }),
  };
}

const baseline = [];
const current = [];
let differentResults = 0;
for (const drawCount of [1, 3]) {
  for (let seed = 0; seed < 100; seed++) {
    const state = createGame({ seed, drawCount });
    const knownCards = rememberVisible(state, []);
    const before = run(baselineSearch, state, knownCards);
    const after = run(currentSearch, state, knownCards);
    baseline.push(before);
    current.push(after);
    if (before.result !== after.result) differentResults++;
  }
}

const diagnostic = JSON.parse(readFileSync(new URL('../tests/fixtures/solitaire-stan-2284836135-draw1-114.json', import.meta.url), 'utf8'));
const restored = restoreSession(JSON.stringify(diagnostic.save));
assert.equal(restored.ok, true);
const speedBefore = [];
const speedAfter = [];
for (let run = 0; run < 5; run++) {
  const before = runComplete(speedBaselineSearch, restored.session.state, restored.session.knownCards);
  const after = runComplete(currentSearch, restored.session.state, restored.session.knownCards);
  assert.equal(after.result, before.result);
  speedBefore.push(before.ms);
  speedAfter.push(after.ms);
}
const median = (values) => [...values].sort((a, b) => a - b)[2];

console.log(JSON.stringify({
  baselineCommit,
  speedBaselineCommit,
  currentSource: 'working tree',
  node: process.version,
  platform: `${process.platform} ${process.arch}`,
  budget,
  positions: 'same initial deals for seeds 0–99 in Draw 1 and Draw 3',
  differentFirstResults: differentResults,
  baseline: summarize(baseline),
  current: summarize(current),
  savedPositionSpeed: {
    position: 'seed 2284836135 / Draw 1 / cursor 114',
    budget: 'maxStates 10000, maxDepth 12; complete search, five runs each',
    identicalResults: true,
    beforeMs: speedBefore.map((value) => +value.toFixed(2)),
    afterMs: speedAfter.map((value) => +value.toFixed(2)),
    medianBeforeMs: +median(speedBefore).toFixed(2),
    medianAfterMs: +median(speedAfter).toFixed(2),
    speedup: +(median(speedBefore) / median(speedAfter)).toFixed(2),
  },
}, null, 2));
