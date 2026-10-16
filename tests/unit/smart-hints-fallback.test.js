import { expect, test, vi } from 'vitest';
import { createFallback } from '../../scripts/experiments/smart-hint-fallback.mjs';
import { loadPlanners } from '../../scripts/experiments/smart-hint-bfs.mjs';
import { readFileSync } from 'node:fs';
import { createGame } from '../../src/engine/cards.js';
import { applyMove } from '../../src/engine/game.js';
import { rememberVisible } from '../../src/engine/knowledge.js';
import { inspectPlan } from '../../scripts/hint-benchmark.js';

const empty = { status: 'INCONCLUSIVE', plan: [], goal: null, score: null, visitedStates: 2, truncated: true };
const finish = iterator => { let step; do { step = iterator.next(); } while (!step.done); return step.value; };
const planners = await loadPlanners({ observe: true });
const plain = await loadPlanners();
const cases = JSON.parse(readFileSync('.project/reports/T028-bfs-diagnostics.json', 'utf8')).cases;
function position(c) {
  let state = createGame({ seed: c.seed, drawCount: c.drawCount }), known = rememberVisible(state, []);
  const snapshots = [state];
  for (const move of c.commands) { state = applyMove(state, move).state; snapshots.push(state); known = rememberVisible(state, known); }
  return { state, known, context: planners.baseline.createHintContext(snapshots, known) };
}

test('observation preserves complete A/C results and measures depth and all applyMove categories', () => {
  for (const c of [cases[0], cases[2]]) {
    const { state, known, context } = position(c);
    for (const id of ['baseline', 'bfs']) {
      const options = { maxStates: c.maxStates, maxDepth: 32, plannerContext: context };
      const reference = finish(plain[id].searchSmartHint(state, known, options));
      const observed = finish(planners[id].searchSmartHint(state, known, options));
      const { work, ...diagnostics } = observed.diagnostics;
      expect({ ...observed, diagnostics }).toEqual(reference);
      expect(work.expandedByDepth.reduce((a, b) => a + b, 0)).toBe(observed.visitedStates);
      expect(work.applyMovesSearch).toBeGreaterThan(0);
      expect(work.maxFrontierSize).toBeGreaterThan(0);
      expect(work.maxExpandedDepth).toBe(c === cases[0] ? id === 'baseline' ? 32 : 10 : id === 'baseline' ? 24 : 11);
      if (id === 'baseline' && c === cases[0]) expect(work.applyMovesShortening).toBeGreaterThan(0);
    }
  }
});

test('fallback skips A, rescues C and preserves legal goals', () => {
  for (const c of [cases[0], cases[2]]) {
    const { state, known, context } = position(c);
    const result = finish(createFallback(planners.baseline.searchSmartHint, planners.bfs.searchSmartHint)(state, known,
      { maxStates: 1024, maxDepth: 32, plannerContext: context }));
    expect(result.status).toBe('FOUND');
    expect(result.diagnostics.fallback.used).toBe(c === cases[2]);
    expect(result.plan.length).toBe(c === cases[0] ? 25 : 11);
    expect(result.visitedStates).toBeLessThanOrEqual(1024);
    expect(inspectPlan(state, known, result.plan).preparationOnly).toBe(false);
  }
});

test('only final uncertainty starts the secondary, preserving input references and half budgets', () => {
  const state = {}, known = [], options = { maxStates: 8, previousHint: {}, plannerContext: {} };
  const primary = vi.fn(function* () { yield empty; return { ...empty, status: 'NO_STRATEGIC_PROGRESS', truncated: false }; });
  const secondary = vi.fn(function* () { return empty; });
  expect(finish(createFallback(primary, secondary)(state, known, options)).status).toBe('NO_STRATEGIC_PROGRESS');
  expect(secondary).not.toHaveBeenCalled();
  expect(primary.mock.calls[0]).toEqual([state, known, { ...options, maxStates: 4 }]);
});

test.each(['between', 'secondary'])('cancellation %s cannot start/restart work or lose a verified secondary plan', phase => {
  const controller = new AbortController();
  const accepted = { status: 'FOUND', goal: 'REVEAL', plan: [{ type: 'draw' }], score: 1, visitedStates: 2 };
  const primary = function* () { return empty; };
  const secondary = vi.fn(function* () { yield accepted; return { ...accepted, truncated: true, cancelled: true }; });
  const iterator = createFallback(primary, secondary)({}, [], { maxStates: 8, signal: controller.signal });
  let step = iterator.next();
  expect(step.done).toBe(false); // Explicit checkpoint between the two runs.
  if (phase === 'secondary') { step = iterator.next(); expect(step.value.plan).toEqual(accepted.plan); }
  controller.abort();
  const result = finish(iterator);
  expect(result.truncated).toBe(true);
  if (phase === 'between') expect(secondary).not.toHaveBeenCalled();
  else expect(result.plan).toEqual(accepted.plan);
});

test('two uncertain runs remain uncertainty, with combined visits and original commitment forwarded', () => {
  const commitment = { state: {}, plan: [{ type: 'draw' }] };
  const previousHint = { commitment };
  const primary = vi.fn(function* () { return empty; });
  const secondary = vi.fn(function* () { return { ...empty, diagnostics: { work: { applyMovesSearch: 7 } } }; });
  const result = finish(createFallback(primary, secondary)({}, [], { maxStates: 8, previousHint }));
  expect(result).toMatchObject({ status: 'INCONCLUSIVE', plan: [], visitedStates: 4,
    diagnostics: { fallback: { used: true, secondaryStatus: 'INCONCLUSIVE' } } });
  expect(secondary.mock.calls[0][2].previousHint.commitment).toBe(commitment);
});
