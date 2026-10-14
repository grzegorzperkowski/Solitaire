import { readFileSync, mkdirSync, writeFileSync, renameSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpus } from 'node:os';
import { restoreSession } from '../src/persistence.js';
import { createGame } from '../src/engine/cards.js';
import { visibleCards } from '../src/engine/knowledge.js';
import {
  ALGORITHMS, parseOptions, runHint, inspectPlan, playDeal, compareGames,
  percentile, summarizeGames, selectPositions,
} from './hint-benchmark.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const digest = path => createHash('sha256').update(readFileSync(resolve(root, path), 'utf8').replaceAll('\r\n', '\n')).digest('hex');
const orderedAlgorithms = index => index % 2 ? [...ALGORITHMS].reverse() : ALGORITHMS;

function writeReport(path, report) {
  const target = resolve(path);
  mkdirSync(dirname(target), { recursive: true });
  const temporary = target + '.' + process.pid + '.tmp';
  try {
    writeFileSync(temporary, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    renameSync(temporary, target);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

function positionComparison(rows) {
  const comparison = { sameFirstMove: 0, currentOnlyStrategic: 0, previousOnlyStrategic: 0,
    bothStrategic: 0, neitherStrategic: 0, medianPairedSpeedup: null };
  const speedups = [];
  for (const row of rows) {
    const previous = row.results.previous, current = row.results.current;
    if (JSON.stringify(previous.plan[0]) === JSON.stringify(current.plan[0])) comparison.sameFirstMove++;
    const a = previous.effects.reveal > 0 || previous.effects.foundationAdvance > 0;
    const b = current.effects.reveal > 0 || current.effects.foundationAdvance > 0;
    comparison[a && b ? 'bothStrategic' : a ? 'previousOnlyStrategic' : b ? 'currentOnlyStrategic' : 'neitherStrategic']++;
    if (current.elapsedMs > 0) speedups.push(previous.elapsedMs / current.elapsedMs);
  }
  comparison.medianPairedSpeedup = percentile(speedups, 0.5);
  return comparison;
}

function evaluatePositions(positions, options) {
  return positions.map((position, index) => {
    const results = {};
    for (const algorithm of orderedAlgorithms(index)) {
      const result = runHint(algorithm, position.state, position.known, options);
      const effects = inspectPlan(position.state, position.known, result.plan);
      results[algorithm.id] = { ...result, effects };
    }
    return { id: position.id, results };
  });
}

function run(options) {
  const started = performance.now();
  let revision = 'unknown';
  let dirty = null;
  try {
    revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim());
  } catch { /* Hashes below still identify the measured source without Git. */ }
  const report = { format: 'pl.solitaire.hint-benchmark', formatVersion: 1, createdAt: new Date().toISOString(),
    options, environment: { node: process.version, platform: process.platform, arch: process.arch,
      cpu: cpus()[0]?.model, revision, dirty },
    sources: { previousCommit: '90fba4f336081367a8d28e25cde1b13d9923f227',
      files: Object.fromEntries(['scripts/baselines/smart-hints-90fba4f.js', 'src/engine/smart-hints.js',
        'src/engine/hints.js', 'src/engine/game.js', 'src/engine/cards.js', 'src/engine/knowledge.js',
        'src/engine/progress.js', 'scripts/hint-benchmark.js', 'scripts/benchmark-hints.mjs'].map(path => [path, digest(path)])) },
    notes: [
      'Each recommendation executes only its first command; knowledge is updated after real moves.',
      'MOVE_LIMIT and INCONCLUSIVE are unresolved, not losses or proofs of unwinnability.',
      'Time mode measures active generator work, without browser scheduler wait or device calibration.',
      'Goal effects are measured independently; utility scores are not compared across planners.',
      'Wilson 95% interval describes current share among discordant wins, not absolute win rate.',
      'Quick profile is a smoke comparison; seed range 0..99 is development data, not held-out validation.',
    ], runs: [], positions: [] };
  const budgets = options.budget === 'both' ? ['states', 'time'] : [options.budget];
  const corpus = [];
  const warmup = createGame({ seed: 4294967295, drawCount: 1 });
  for (const algorithm of ALGORITHMS) runHint(algorithm, warmup, visibleCards(warmup), { ...options, budget: 'states', maxStates: 16, maxDepth: 2 });
  for (const budget of budgets) {
    const config = { ...options, budget };
    const games = [];
    console.log('\n' + options.profile + ': ' + budget + ', seeds ' + options.startSeed + '..' + (options.startSeed + options.count - 1)
      + ', states=' + options.maxStates + ', depth=' + options.maxDepth + ', activeMs=' + options.activeMs);
    for (const drawCount of [1, 3]) {
      for (let seed = options.startSeed; seed < options.startSeed + options.count; seed++) {
        for (const algorithm of orderedAlgorithms(seed + drawCount)) {
          games.push(playDeal(algorithm, seed, drawCount, config, algorithm.id === 'rank' ? [] : corpus));
        }
        if ((seed - options.startSeed + 1) % Math.min(10, options.count) === 0) {
          console.log('  Draw ' + drawCount + ': ' + (seed - options.startSeed + 1) + '/' + options.count
            + ' deals per algorithm, elapsed ' + ((performance.now() - started) / 1000).toFixed(1) + 's');
        }
      }
    }
    const modes = [1, 3].map(drawCount => {
      const modeGames = games.filter(g => g.drawCount === drawCount);
      return { drawCount, summaries: Object.fromEntries(ALGORITHMS.map(a => [a.id, summarizeGames(modeGames.filter(g => g.algorithm === a.id))])),
        comparison: compareGames(modeGames) };
    });
    for (const mode of modes) {
      console.log('Draw ' + mode.drawCount + ' — ' + budget);
      console.table(Object.entries(mode.summaries).map(([algorithm, s]) => ({ algorithm, wins: s.wins,
        revealed: s.revealed, cycles: s.cycles, inconclusive: s.inconclusive, limit: s.moveLimit,
        medianMs: +s.medianMs?.toFixed(2), p95Ms: +s.p95Ms?.toFixed(2), preparationOnly: s.preparationOnly })));
      console.log('Previous/current paired:', JSON.stringify(mode.comparison));
    }
    report.runs.push({ budget, modes, games });
  }
  const diagnostic = JSON.parse(readFileSync(resolve(root, 'tests/fixtures/solitaire-stan-2284836135-draw1-114.json'), 'utf8'));
  const restored = restoreSession(JSON.stringify(diagnostic.save));
  if (!restored.ok) throw Error('Diagnostic fixture could not be restored');
  const session = restored.session;
  const fixture = { id: 'diagnostic/2284836135/draw1/cursor114', source: 'user-diagnostic',
    seed: 2284836135, drawCount: 1, step: 114, stage: 'diagnostic', state: session.state, known: session.knownCards };
  report.positions = [fixture, ...selectPositions(corpus, options.positions - 1)];
  for (const run of report.runs) {
    run.pairedPositions = evaluatePositions(report.positions, { ...options, budget: run.budget });
    run.positionComparison = positionComparison(run.pairedPositions);
    console.log('Identical positions — ' + run.budget + ':', JSON.stringify(run.positionComparison));
  }
  report.elapsedMs = performance.now() - started;
  writeReport(options.output, report);
  console.log('\nJSON: ' + resolve(options.output) + ' (' + (report.elapsedMs / 1000).toFixed(1) + 's)');
  console.log('No automatic winner: inspect paired wins, progress, uncertainty and latency together.');
}

try {
  run(parseOptions(process.argv.slice(2)));
} catch (error) {
  console.error('Benchmark failed: ' + error.message);
  process.exitCode = 1;
}
