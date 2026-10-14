import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { cpus } from 'node:os';
import { searchSmartHint } from '../src/engine/smart-hints.js';
import { createGame } from '../src/engine/cards.js';
import { applyMove, assertInvariants, isWon } from '../src/engine/game.js';
import { rememberVisible, visibleCards } from '../src/engine/knowledge.js';
import { restoreSession } from '../src/persistence.js';
import { runHint, inspectPlan, playDeal, summarizeGames, percentile } from './hint-benchmark.js';

assert(process.argv.slice(2).every(arg => ['--full', '--positions-only'].includes(arg)), 'use --full and/or --positions-only');
const full = process.argv.includes('--full');
const positionsOnly = process.argv.includes('--positions-only');
const sha = source => createHash('sha256').update(source.replaceAll('\r\n', '\n')).digest('hex');
const sources = {};
async function revision(id, commit, cancellable) {
  const source = execFileSync('git', ['show', `${commit}:src/engine/smart-hints.js`], { encoding: 'utf8' });
  sources[id] = { commit, sha256: sha(source) };
  const relocated = source.replace(/from '\.\/(.*?)'/g, (_, file) => `from '${pathToFileURL(path.resolve('src/engine', file)).href}'`);
  const { searchSmartHint: search } = await import(`data:text/javascript;base64,${Buffer.from(relocated).toString('base64')}`);
  return { id, search, cancellable };
}
const algorithms = [await revision('advanced', '2447cff', true), await revision('repaired', '5320616', false),
  { id: 'integrated', search: searchSmartHint, cancellable: true }];
sources.integrated = { commit: 'working tree', sha256: sha(readFileSync('src/engine/smart-hints.js', 'utf8')) };
const budget = { maxStates: 10000, maxDepth: 32, activeMs: 100, budget: 'time', maxSteps: 100 };
const { positions } = JSON.parse(readFileSync('.project/reports/T028-repair-positions.json', 'utf8'));
for (const file of ['solitaire-stan-2284836135-draw1-114.json', 'solitaire-stan-2560240634-draw1-73.json',
  'smart-hint-seed1-draw1-76.json', 'smart-hint-seed21-draw1-61.json', 'smart-hint-seed2560240634-draw1-78.json']) {
  const data = JSON.parse(readFileSync(`tests/fixtures/${file}`, 'utf8'));
  let state, known;
  if (data.save) {
    const restored = restoreSession(JSON.stringify(data.save));
    assert(restored.ok);
    ({ state, knownCards: known } = restored.session);
  } else {
    state = createGame(data);
    known = rememberVisible(state, []);
    for (const command of data.commands) {
      const moved = applyMove(state, command);
      assert(moved.ok);
      state = moved.state;
      known = rememberVisible(state, known);
    }
    known = data.knownCards ?? known;
  }
  positions.push({ id: file, state, known });
}
for (const p of positions) assertInvariants(p.state);
const report = {
  format: 'pl.solitaire.hint-integration-benchmark', formatVersion: 1,
  createdAt: new Date().toISOString(), sources,
  environment: { node: process.version, platform: process.platform, arch: process.arch, cpu: cpus()[0]?.model },
  engineSha256: sha(readFileSync('src/engine/game.js', 'utf8')), runnerSha256: sha(readFileSync('scripts/hint-benchmark.js', 'utf8')),
  budget, seedCount: full ? 100 : 3, positions, positionRuns: [], games: [], summaries: {},
};
mkdirSync('.cache', { recursive: true });
const output = `.cache/hints-integration-${positionsOnly ? 'positions' : full ? 'full' : 'quick'}.json`;
const save = () => writeFileSync(output, JSON.stringify(report) + '\n');
const ordered = index => algorithms.slice(index % 3).concat(algorithms.slice(0, index % 3));
for (const config of [{ ...budget, budget: 'states', maxStates: 128 }, budget]) {
  const rows = positions.map((p, index) => {
    const results = {};
    for (const a of ordered(index)) {
      const result = runHint(a, p.state, p.known, config);
      assert(['FOUND', 'EXPLORATION', 'INCONCLUSIVE', 'NO_STRATEGIC_PROGRESS', 'WON'].includes(result.status));
      assert(result.plan.length <= config.maxDepth);
      // 5320616 counts the limit-detecting pop without expanding it.
      assert(result.visitedStates <= config.maxStates + (a.id === 'repaired' ? 1 : 0));
      const effects = inspectPlan(p.state, p.known, result.plan);
      if (result.status === 'FOUND') assert(effects.reveal > 0 || effects.foundationAdvance > 0);
      if (result.status === 'EXPLORATION') assert(effects.information);
      if (['INCONCLUSIVE', 'NO_STRATEGIC_PROGRESS'].includes(result.status)) assert.equal(result.plan.length, 0);
      if (result.status === 'NO_STRATEGIC_PROGRESS') assert.equal(result.truncated, false);
      if (result.status === 'WON') assert(isWon(p.state));
      results[a.id] = { ...result, effects };
    }
    return { id: p.id, results };
  });
  const summaries = Object.fromEntries(algorithms.map(a => {
    const calls = rows.map(r => r.results[a.id]);
    return [a.id, { found: calls.filter(c => c.status === 'FOUND').length,
      exploration: calls.filter(c => c.status === 'EXPLORATION').length,
      inconclusive: calls.filter(c => c.status === 'INCONCLUSIVE').length,
      noStrategicProgress: calls.filter(c => c.status === 'NO_STRATEGIC_PROGRESS').length,
      revealPlans: calls.filter(c => c.effects.reveal > 0).length,
      foundationPlans: calls.filter(c => c.effects.foundationAdvance > 0).length,
      medianMs: percentile(calls.map(c => c.elapsedMs), 0.5), p95Ms: percentile(calls.map(c => c.elapsedMs), 0.95),
      medianStates: percentile(calls.map(c => c.visitedStates), 0.5), truncated: calls.filter(c => c.truncated).length,
      shortened: calls.filter(c => c.diagnostics?.savedMovesCount > 0).length }];
  }));
  const comparisons = Object.fromEntries(['advanced', 'repaired'].map(id => {
    const counters = { baselineOnlyStrategic: 0, integratedOnlyStrategic: 0, bothStrategic: 0, neitherStrategic: 0, sameFirstMove: 0 };
    for (const r of rows) {
      const before = r.results[id], after = r.results.integrated;
      const a = before.status === 'FOUND', b = after.status === 'FOUND';
      counters[a && b ? 'bothStrategic' : a ? 'baselineOnlyStrategic' : b ? 'integratedOnlyStrategic' : 'neitherStrategic']++;
      if (JSON.stringify(before.plan[0]) === JSON.stringify(after.plan[0])) counters.sameFirstMove++;
    }
    return [id, counters];
  }));
  report.positionRuns.push({ budget: config, summaries, comparisons, rows });
  console.log(JSON.stringify({ positions: positions.length, budget: config, summaries, comparisons }));
  save();
}
if (!positionsOnly) {
  for (const drawCount of [1, 3]) {
    for (let seed = 0; seed < report.seedCount; seed++) {
      for (const a of ordered(seed + drawCount)) {
        const game = playDeal(a, seed, drawCount, budget);
        assert(game.calls.every(c => !c.preparationOnly));
        report.games.push(game);
      }
      if ((seed + 1) % 10 === 0 || seed + 1 === report.seedCount) {
        console.log(JSON.stringify({ drawCount, completedSeeds: seed + 1, summaries: Object.fromEntries(algorithms.map(a =>
          [a.id, summarizeGames(report.games.filter(g => g.drawCount === drawCount && g.algorithm === a.id))])) }));
        save();
      }
    }
  }
  report.summaries = Object.fromEntries([1, 3].map(drawCount => [drawCount, Object.fromEntries(algorithms.map(a =>
    [a.id, summarizeGames(report.games.filter(g => g.drawCount === drawCount && g.algorithm === a.id))]))]));
}
save();
console.log(JSON.stringify({ output, summaries: report.summaries }));
