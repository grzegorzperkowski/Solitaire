import { expect, test } from 'vitest';
import { loadPlanners } from '../../scripts/experiments/smart-hint-bfs.mjs';
import { progressFixture } from '../fixtures/progress.js';
import { h02 } from '../fixtures/smart-hints.js';
import { hintBfs } from '../helpers/smart-hint-bfs.js';
import { applyMove } from '../../src/engine/game.js';
import { visibleCards, rememberVisible } from '../../src/engine/knowledge.js';
import { inspectPlan } from '../../scripts/hint-benchmark.js';

const { baseline, bfs } = await loadPlanners();
const finish = iterator => { let step; do { step = iterator.next(); } while (!step.done); return step.value; };

test.each([1, 2, 3, 4, 5, 6, 7].flatMap(id => [1, 3].flatMap(draw =>
  [false, true].map(remembered => [id, draw, remembered]))))(
  'experimental FIFO matches independent complete graph: fixture %i, Draw %i, remembered %s',
  (id, draw, remembered) => {
    const state = progressFixture(id, draw);
    const known = remembered ? Array.from({ length: 52 }, (_, i) => i) : visibleCards(state);
    const oracle = hintBfs(state, known, 1000);
    const result = finish(bfs.searchSmartHint(state, known, { maxStates: 1000, maxDepth: 30 }));
    expect(oracle.truncated).toBe(false);
    expect(result.truncated).toBe(false);
    expect(result.diagnostics.retainedStates).toBe(oracle.uniqueStates);
    expect(result.visitedStates).toBe(oracle.expanded);
    expect(result.status === 'NO_STRATEGIC_PROGRESS').toBe(oracle.goalStates === 0);
    expect(inspectPlan(state, known, result.plan).preparationOnly).toBe(false);
  },
);

test('FIFO preserves necessary foundation return, hidden permutations and committed suffix', () => {
  const state = h02(), known = visibleCards(state);
  const options = { maxStates: 1000, maxDepth: 2, plannerContext: bfs.createHintContext([state], known) };
  const result = finish(bfs.searchSmartHint(state, known, options));
  expect(result).toMatchObject({ status: 'FOUND', goal: 'REVEAL' });
  expect(result.plan[0].from.pile).toBe('foundation');
  const unknown = Array.from({ length: 52 }, (_, i) => i).filter(id => !known.includes(id));
  const rename = new Map(unknown.map((id, i) => [id, unknown[unknown.length - 1 - i]]));
  const permute = cards => cards.map(id => rename.get(id) ?? id);
  const permuted = { ...state, stock: permute(state.stock), waste: permute(state.waste),
    tableau: state.tableau.map(col => ({ ...col, cards: permute(col.cards) })) };
  const other = finish(bfs.searchSmartHint(permuted, known, { ...options,
    plannerContext: bfs.createHintContext([permuted], known) }));
  expect([other.plan, other.goal, other.score, other.visitedStates])
    .toEqual([result.plan, result.goal, result.score, result.visitedStates]);
  const next = applyMove(state, result.plan[0]).state;
  const nextKnown = rememberVisible(next, known);
  const continued = finish(bfs.searchSmartHint(next, nextKnown, { ...options,
    plannerContext: bfs.createHintContext([state, next], nextKnown),
    previousHint: { state, plan: result.plan, commitment: { state, plan: result.plan } } }));
  expect(continued.continued).toBe(true);
  expect(continued.plan).toEqual(result.plan.slice(1));
  expect(inspectPlan(next, nextKnown, continued.plan).reveal).toBe(1);
});

test('FIFO cancellation retains the best complete plan and does not mutate its root', () => {
  const state = h02(), known = visibleCards(state), before = JSON.stringify(state);
  const controller = new AbortController();
  const iterator = bfs.searchSmartHint(state, known, { maxStates: 1000, maxDepth: 4, signal: controller.signal });
  let step;
  do { step = iterator.next(); } while (!step.done && !step.value?.plan.length);
  expect(step.done).toBe(false);
  const best = step.value;
  controller.abort();
  const result = iterator.next();
  expect(result.done).toBe(true);
  expect(result.value).toMatchObject({ truncated: true, cancelled: true, plan: best.plan });
  expect(JSON.stringify(state)).toBe(before);
  expect(inspectPlan(state, known, result.value.plan).preparationOnly).toBe(false);
  expect(typeof baseline.searchSmartHint).toBe('function');
});
