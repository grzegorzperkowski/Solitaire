import { readFileSync, writeFileSync, mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';
import { createGame } from '../../src/engine/cards.js';
import { applyMove, getLegalMoves } from '../../src/engine/game.js';
import { visibleCards } from '../../src/engine/knowledge.js';
import { h01, h05, h07, h15 } from '../fixtures/smart-hints.js';
import {
  ALGORITHMS, parseOptions, runHint, inspectPlan, playDeal, compareGames,
  summarizeGames, selectPositions, percentile,
} from '../../scripts/hint-benchmark.js';

test('previous planner is the pinned source with only relocated imports', () => {
  const source = readFileSync(new URL('../../scripts/baselines/smart-hints-90fba4f.js', import.meta.url), 'utf8')
    .replaceAll('../../src/engine/', './').replaceAll('\r\n', '\n');
  expect(createHash('sha256').update(source).digest('hex'))
    .toBe('77bacb4aebc3f2ba582f3ffc6948c41aa2fe0ba034245a7fcd6f1f8b93e388d9');
  expect(ALGORITHMS.map(a => a.id)).toEqual(['rank', 'previous', 'current']);
});

test('quick/full profiles have explicit reproducible budgets; overrides are bounded', () => {
  expect(parseOptions([])).toMatchObject({ profile: 'quick', count: 3, maxSteps: 30, maxStates: 128, activeMs: 20, budget: 'both' });
  expect(parseOptions(['--profile=full'])).toMatchObject({ count: 100, maxSteps: 100, maxStates: 10000, activeMs: 100 });
  expect(parseOptions(['--count=2', '--start-seed=10000', '--budget=time', '--output=report.json']))
    .toMatchObject({ count: 2, startSeed: 10000, budget: 'time', output: 'report.json' });
  for (const arg of ['--count=0', '--count=1x', '--max-states=10001', '--active-ms=0', '--profile=bad', '--budget=bad', '--bogus=2', '--output=']) {
    expect(() => parseOptions([arg]), arg).toThrow();
  }
  expect(() => parseOptions(['--start-seed=4294967295', '--count=2'])).toThrow();
});

test('invalid CLI options fail before producing output', () => {
  const result = spawnSync(process.execPath, ['scripts/benchmark-hints.mjs', '--count=0'], { encoding: 'utf8' });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('count');
});

test('time cutoff retains the latest plan, closes generator and marks truncation', () => {
  let closed = false;
  let time = 0;
  const plan = [{ type: 'draw' }];
  const algorithm = { search: function* () {
    try {
      yield { status: 'EXPLORATION', plan, goal: 'INFORMATION', visitedStates: 1, truncated: false };
      throw Error('should stop at the time budget');
    } finally { closed = true; }
  } };
  const result = runHint(algorithm, createGame({ seed: 0, drawCount: 1 }), [],
    { budget: 'time', activeMs: 100 }, () => (time += 101));
  expect(result).toMatchObject({ status: 'EXPLORATION', plan, truncated: true, timeCutoff: true });
  expect(closed).toBe(true);
});

test('completed-over-budget result is complete; state mode ignores clock cutoff', () => {
  let time = 0;
  const result = { status: 'INCONCLUSIVE', plan: [], goal: null, visitedStates: 1, truncated: false };
  const completed = { search: function* () { return result; } };
  expect(runHint(completed, h07(), [], { budget: 'time', activeMs: 1 }, () => (time += 10)))
    .toMatchObject({ ...result, timeCutoff: false });
  const yielding = { search: function* () { yield result; return result; } };
  expect(runHint(yielding, h07(), [], { budget: 'states', activeMs: 1 }, () => (time += 10)))
    .toMatchObject({ ...result, timeCutoff: false });
});

test('cooperative cutoff returns the cancelled result and forwards the remembered plan', () => {
  let time = 0;
  let closed = false;
  const previousHint = { state: h01(), plan: [{ type: 'draw' }] };
  const plan = [{ type: 'draw' }];
  const algorithm = { cancellable: true, search: function* (state, known, options) {
    expect(options.previousHint).toBe(previousHint);
    try {
      yield { status: 'INCONCLUSIVE', plan: [], goal: null, visitedStates: 1 };
      expect(options.signal.aborted).toBe(true);
      return { phase: 'CANCELLED', cancelled: true, status: 'EXPLORATION', goal: 'INFORMATION', plan, visitedStates: 1 };
    } finally { closed = true; }
  } };
  expect(runHint(algorithm, h01(), [], { budget: 'time', activeMs: 100, previousHint }, () => (time += 101)))
    .toMatchObject({ phase: 'CANCELLED', cancelled: true, plan, truncated: true, timeCutoff: true });
  expect(closed).toBe(true);
});

test('an exhaustive negative result is recorded separately from a cutoff', () => {
  const algorithm = { id: 'test', search: function* () {
    return { status: 'NO_STRATEGIC_PROGRESS', plan: [], goal: null, truncated: false };
  } };
  const game = playDeal(algorithm, 0, 1, { budget: 'states', maxSteps: 4 });
  expect(game).toMatchObject({ stop: 'NO_STRATEGIC_PROGRESS', steps: 0 });
  expect(summarizeGames([game])).toMatchObject({ noStrategicProgress: 1, inconclusive: 0 });
});

test('independent replay measures actual goals and forbids hidden-information continuation', () => {
  const state = h01();
  const reveal = { type: 'move', from: { pile: 'tableau', index: 0, cardIndex: 1 }, to: { pile: 'tableau', index: 1 } };
  const known = state.tableau.flatMap(c => c.cards).concat(state.stock, state.waste, state.foundations.flat());
  expect(inspectPlan(state, known, [reveal])).toMatchObject({ reveal: 1, information: false, preparationOnly: false });
  const next = applyMove(state, reveal).state;
  expect(() => inspectPlan(state, known, [reveal, getLegalMoves(next)[0]])).toThrow('information boundary');
  expect(() => inspectPlan(state, [], [{ type: 'draw', extra: true }])).toThrow('illegal');
  const initial = createGame({ seed: 0, drawCount: 1 });
  expect(inspectPlan(initial, visibleCards(initial), [{ type: 'draw' }]))
    .toMatchObject({ information: true, preparationOnly: false });
});

test('stops distinguish won, inconclusive and move limit; cycles are counted without stopping early', () => {
  const idle = { id: 'test', search: function* () { return { status: 'INCONCLUSIVE', plan: [] }; } };
  const config = { budget: 'states', maxStates: 16, maxDepth: 2, maxSteps: 4 };
  expect(playDeal(idle, 0, 1, config).stop).toBe('INCONCLUSIVE');
  expect(playDeal(idle, 0, 1, config, [], h15()).stop).toBe('WON');
  const cycle = { id: 'test', search: function* (state) {
    const move = getLegalMoves(state).find(m => m.type === 'move' && m.to.pile === 'tableau');
    return { status: 'FOUND', plan: [move], goal: 'WASTE' };
  } };
  const result = playDeal(cycle, 0, 1, config, [], h07());
  expect(result).toMatchObject({ stop: 'MOVE_LIMIT', steps: 4, revealed: 0 });
  expect(result.cycles).toBeGreaterThan(0);
  expect(result.calls.every(c => c.preparationOnly)).toBe(true);
});

test('invalid recommendations abort the run instead of counting as an ordinary stop', () => {
  const broken = { id: 'broken', search: function* () { return { status: 'FOUND', plan: [{ type: 'nope' }] }; } };
  expect(() => playDeal(broken, 42, 3, { budget: 'states', maxSteps: 1 })).toThrow(/broken.*42.*illegal/);
});

test('paired aggregation counts discordant wins and seed-by-seed reveal regressions', () => {
  const games = [
    { algorithm: 'previous', seed: 0, drawCount: 1, stop: 'WON', revealed: 21 },
    { algorithm: 'current', seed: 0, drawCount: 1, stop: 'MOVE_LIMIT', revealed: 18 },
    { algorithm: 'previous', seed: 1, drawCount: 1, stop: 'INCONCLUSIVE', revealed: 10 },
    { algorithm: 'current', seed: 1, drawCount: 1, stop: 'WON', revealed: 21 },
  ];
  expect(compareGames(games)).toMatchObject({ bothWon: 0, previousOnlyWon: 1, currentOnlyWon: 1, neitherWon: 0,
    revealBetter: 1, revealWorse: 1, revealEqual: 0, meanRevealDelta: 4 });
  expect(compareGames(games).discordantCurrentWinShare95).toHaveLength(2);
  expect(compareGames([]).discordantCurrentWinShare95).toBe(null);
  expect(() => compareGames(games.slice(1))).toThrow('pair');
});

test('both real revisions remain runnable and disagree on standalone waste preparation', () => {
  const state = h05();
  const known = state.tableau.flatMap(c => c.cards).concat(state.stock, state.waste, state.foundations.flat());
  const options = { budget: 'states', maxStates: 16, maxDepth: 1 };
  const before = JSON.stringify(state);
  const old = runHint(ALGORITHMS[1], state, known, options);
  const current = runHint(ALGORITHMS[2], state, known, options);
  expect(old).toMatchObject({ status: 'FOUND', goal: 'WASTE' });
  expect(inspectPlan(state, known, old.plan).preparationOnly).toBe(true);
  expect(current).toMatchObject({ status: 'INCONCLUSIVE', plan: [] });
  expect(JSON.stringify(state)).toBe(before);
});

test('summaries count actual observations; empty timing data is null', () => {
  expect(percentile([], 0.95)).toBe(null);
  expect(percentile([3, 1, 2], 0.5)).toBe(2);
  expect(percentile([3, 1, 2], 0.95)).toBe(3);
  const game = { stop: 'MOVE_LIMIT', revealed: 2, steps: 2, cycles: 1, boardReturns: 2,
    calls: [{ planLength: 1, preparationOnly: true, elapsedMs: 2, visitedStates: 4, truncated: true, timeCutoff: true }] };
  expect(summarizeGames([game])).toMatchObject({ wins: 0, inconclusive: 0, moveLimit: 1,
    revealed: 2, steps: 2, cycles: 1, boardReturns: 2, calls: 1, medianMs: 2, p95Ms: 2,
    medianStates: 4, p95States: 4, truncated: 1, timeCutoffs: 1, preparationOnly: 1 });
  expect(summarizeGames([]).medianMs).toBe(null);
});

test('paired corpus deduplicates observation and respects limit including zero', () => {
  const a = createGame({ seed: 0, drawCount: 1 });
  const b = createGame({ seed: 1, drawCount: 3 });
  const positions = [{ id: 'a', state: a, known: visibleCards(a) }, { id: 'duplicate', state: a, known: visibleCards(a) },
    { id: 'b', state: b, known: visibleCards(b) }];
  expect(selectPositions(positions, 3).map(p => p.id)).toEqual(['a', 'b']);
  expect(selectPositions(positions, 1)).toHaveLength(1);
  expect(selectPositions(positions, 0)).toEqual([]);
});

test('CLI writes replayable paired JSON and preserves the previous report on invalid input', () => {
  const directory = mkdtempSync(join(tmpdir(), 'solitaire-benchmark-'));
  const output = join(directory, 'report.json');
  try {
    writeFileSync(output, 'previous report');
    const invalid = spawnSync(process.execPath, ['scripts/benchmark-hints.mjs', '--count=0', `--output=${output}`], { encoding: 'utf8' });
    expect(invalid.status).not.toBe(0);
    expect(readFileSync(output, 'utf8')).toBe('previous report');
    const valid = spawnSync(process.execPath, ['scripts/benchmark-hints.mjs', '--count=1', '--max-steps=1',
      '--max-states=1', '--positions=1', '--budget=states', `--output=${output}`], { encoding: 'utf8' });
    expect(valid.status, valid.stderr).toBe(0);
    const report = JSON.parse(readFileSync(output, 'utf8'));
    expect(report.sources.previousCommit).toBe('90fba4f336081367a8d28e25cde1b13d9923f227');
    expect(report.sources.files['src/engine/smart-hints.js']).toMatch(/^[a-f0-9]{64}$/);
    expect(report.runs[0].games).toHaveLength(6);
    expect(report.runs[0].modes.map(m => m.drawCount)).toEqual([1, 3]);
    expect(report.positions[0]).toMatchObject({ seed: 2284836135, step: 114, stage: 'diagnostic' });
    expect(report.runs[0].pairedPositions).toHaveLength(1);
    expect(Object.keys(report.runs[0].pairedPositions[0].results).sort()).toEqual(['current', 'previous', 'rank']);
  } finally {
    unlinkSync(output);
    rmdirSync(directory);
  }
});
