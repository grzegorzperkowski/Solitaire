import { expect, test } from 'vitest';
import { analyzeHintPlan, searchSmartHint } from '../../src/engine/smart-hints.js';
import { applyMove, assertInvariants } from '../../src/engine/game.js';
import { visibleCards } from '../../src/engine/knowledge.js';
import { card, makeState, pile } from '../fixtures/boards.js';
import { h02 } from '../fixtures/smart-hints.js';

function finish(iterator) {
  let step;
  do { step = iterator.next(); } while (!step.done);
  return step.value;
}

test('remembered continuation retains a real foundation advance without promising another goal', () => {
  const exposed = [
    [card(3, 2), card(2, 1)], [card(1, 3)], [card(3, 10)],
    [card(2, 10)], [card(1, 10)], [card(0, 10)], [card(3, 8)],
  ];
  const used = new Set(exposed.flat());
  const hidden = Array.from({ length: 52 }, (_, id) => id).filter(id => !used.has(id));
  const tableau = exposed.map(cards => pile(cards));
  // Bury the remaining deck under a blocked 10♠: no stock or hidden-value choices.
  tableau[2] = pile([...hidden, ...exposed[2]], hidden.length);
  const state = makeState({ tableau, stock: [] });
  const known = visibleCards(state);
  const plan = [
    { type: 'move', from: { pile: 'tableau', index: 0, cardIndex: 0 }, to: { pile: 'tableau', index: 1 } },
    { type: 'move', from: { pile: 'tableau', index: 1, cardIndex: 2 }, to: { pile: 'foundation', index: 2 } },
  ];
  assertInvariants(state);
  expect(analyzeHintPlan(state, known, plan)).toMatchObject({
    ok: true, goal: 'FOUNDATION_ADVANCE', verification: { accepted: true, continuation: 'UNPROVEN' },
  });
  const moved = applyMove(state, plan[0]);
  expect(moved.ok).toBe(true);
  assertInvariants(moved.state);
  expect(analyzeHintPlan(moved.state, known, plan.slice(1))).toMatchObject({
    ok: true, verification: { accepted: true, continuation: 'UNPROVEN', horizon: 0 },
  });

  const result = finish(searchSmartHint(moved.state, known, { previousHint: { state, plan } }));

  expect(result).toMatchObject({ status: 'FOUND', goal: 'FOUNDATION_ADVANCE', continued: true });
  expect(result.plan).toEqual(plan.slice(1));
});

test('remembered continuation must respect an already aborted signal', () => {
  const state = h02();
  const known = visibleCards(state);
  const plan = [
    { type: 'move', from: { pile: 'foundation', index: 1 }, to: { pile: 'tableau', index: 1 } },
    { type: 'move', from: { pile: 'tableau', index: 0, cardIndex: 1 }, to: { pile: 'tableau', index: 1 } },
  ];
  const moved = applyMove(state, plan[0]);
  expect(moved.ok).toBe(true);
  const previousHint = { state, plan };
  expect(finish(searchSmartHint(moved.state, known, { previousHint })))
    .toMatchObject({ status: 'FOUND', continued: true, verification: { accepted: true } });
  const controller = new AbortController();
  controller.abort();

  const result = searchSmartHint(moved.state, known, { previousHint, signal: controller.signal }).next();

  expect(result.done).toBe(true);
  expect(result.value).toMatchObject({
    phase: 'CANCELLED', cancelled: true, reason: 'CANCELLED', truncated: true,
  });
});

test('remembered continuation respects an explicit zero-command depth', () => {
  const state = h02();
  const plan = [
    { type: 'move', from: { pile: 'foundation', index: 1 }, to: { pile: 'tableau', index: 1 } },
    { type: 'move', from: { pile: 'tableau', index: 0, cardIndex: 1 }, to: { pile: 'tableau', index: 1 } },
  ];
  const moved = applyMove(state, plan[0]);
  const result = finish(searchSmartHint(moved.state, visibleCards(moved.state), {
    previousHint: { state, plan }, maxDepth: 0,
  }));
  expect(result).toMatchObject({ status: 'INCONCLUSIVE', plan: [], truncated: true });
});
