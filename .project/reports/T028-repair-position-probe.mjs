import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createGame } from '../../src/engine/cards.js';
import { assertInvariants, isWon } from '../../src/engine/game.js';
import { visibleCards } from '../../src/engine/knowledge.js';
import { searchSmartHint } from '../../src/engine/smart-hints.js';
import { runHint, inspectPlan, percentile } from '../../scripts/hint-benchmark.js';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
mkdirSync(new URL('../../.cache/', import.meta.url), { recursive: true });
const beforeSource = execFileSync('git', ['show', '02fb845:src/engine/smart-hints.js'], { encoding: 'utf8' });
writeFileSync(new URL('../../.cache/smart-hints-before-repair.mjs', import.meta.url), beforeSource.replaceAll("from './", "from '../src/engine/"));
const { searchSmartHint: beforeSearch } = await import(new URL('../../.cache/smart-hints-before-repair.mjs', import.meta.url));
const raw = readFileSync(new URL('T028-repair-positions.json', import.meta.url));
const { positions } = JSON.parse(raw);
assert.equal(positions.length, 100);
for (const position of positions) {
  assertInvariants(position.state);
  assert.ok(position.known.every(id => Number.isInteger(id) && id >= 0 && id < 52));
}
const algorithms = [{ id: 'before', search: beforeSearch }, { id: 'after', search: searchSmartHint }];
const options = [
  { budget: 'states', maxStates: 128, maxDepth: 12 },
  { budget: 'time', maxStates: 10000, maxDepth: 12, activeMs: 100 },
  { budget: 'time', maxStates: 10000, maxDepth: 32, activeMs: 100 },
];
const warmup = createGame({ seed: 4294967295, drawCount: 1 });
for (const a of algorithms) runHint(a, warmup, visibleCards(warmup), { budget: 'states', maxStates: 16, maxDepth: 2 });
const report = {
  format: 'pl.solitaire.hint-repair-position-comparison', formatVersion: 1,
  beforeCommit: '02fb845', node: process.version, createdAt: new Date().toISOString(),
  corpusSha256: sha(raw), beforeSourceSha256: sha(beforeSource.replaceAll('\r\n', '\n')),
  afterSourceSha256: sha(readFileSync(new URL('../../src/engine/smart-hints.js', import.meta.url), 'utf8').replaceAll('\r\n', '\n')),
  sourceReportSha256: JSON.parse(raw).sourceReportSha256, positions, runs: [],
};
for (const option of options) {
  const rows = positions.map((p, i) => {
    const results = {};
    for (const a of (i % 2 ? [...algorithms].reverse() : algorithms)) {
      const result = runHint(a, p.state, p.known, option);
      assert.ok(['FOUND', 'EXPLORATION', 'INCONCLUSIVE', 'NO_STRATEGIC_PROGRESS', 'WON'].includes(result.status));
      if (['INCONCLUSIVE', 'NO_STRATEGIC_PROGRESS'].includes(result.status)) assert.equal(result.plan.length, 0);
      if (result.status === 'NO_STRATEGIC_PROGRESS') assert.equal(result.truncated, false);
      if (result.status === 'WON') assert.ok(isWon(p.state));
      const effects = inspectPlan(p.state, p.known, result.plan);
      if (result.status === 'FOUND') assert.ok(effects.reveal > 0 || effects.foundationAdvance > 0);
      if (result.status === 'EXPLORATION') assert.equal(effects.information, true);
      results[a.id] = { ...result, effects };
    }
    return { id: p.id, results };
  });
  const summaries = Object.fromEntries(algorithms.map(a => {
    const calls = rows.map(r => r.results[a.id]);
    return [a.id, {
      found: calls.filter(c => c.status === 'FOUND').length,
      exploration: calls.filter(c => c.status === 'EXPLORATION').length,
      inconclusive: calls.filter(c => c.status === 'INCONCLUSIVE').length,
      revealPlans: calls.filter(c => c.effects.reveal > 0).length,
      foundationPlans: calls.filter(c => c.effects.foundationAdvance > 0).length,
      medianMs: percentile(calls.map(c => c.elapsedMs), 0.5),
      p95Ms: percentile(calls.map(c => c.elapsedMs), 0.95),
      medianStates: percentile(calls.map(c => c.visitedStates), 0.5),
      truncated: calls.filter(c => c.truncated).length,
    }];
  }));
  const comparison = { beforeOnlyStrategic: 0, afterOnlyStrategic: 0, bothStrategic: 0, neitherStrategic: 0, sameFirstMove: 0 };
  for (const { results: { before, after } } of rows) {
    const a = before.effects.reveal > 0 || before.effects.foundationAdvance > 0;
    const b = after.effects.reveal > 0 || after.effects.foundationAdvance > 0;
    comparison[a && b ? 'bothStrategic' : a ? 'beforeOnlyStrategic' : b ? 'afterOnlyStrategic' : 'neitherStrategic']++;
    if (JSON.stringify(before.plan[0]) === JSON.stringify(after.plan[0])) comparison.sameFirstMove++;
  }
  report.runs.push({ options: option, summaries, comparison, rows });
  console.log(JSON.stringify({ options: option, summaries, comparison }));
}
writeFileSync(new URL('../../.cache/hints-repair-before-after-positions.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
