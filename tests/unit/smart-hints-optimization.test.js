import { expect, test } from 'vitest';
import { searchSmartHint } from '../../src/engine/smart-hints.js';
import { assertInvariants } from '../../src/engine/game.js';
import { visibleCards } from '../../src/engine/knowledge.js';
import { h05, h09 } from '../fixtures/smart-hints.js';
import { completedFoundations, makeState } from '../fixtures/boards.js';

function finish(state, known = visibleCards(state)) {
  const iterator = searchSmartHint(state, known, { maxStates: 100, maxDepth: 3 });
  let step;
  do { step = iterator.next(); } while (!step.done);
  return step.value;
}

test('information prefers one draw over an unrelated waste transfer before drawing', () => {
  const result = finish(h05());
  expect(result).toMatchObject({ goal: 'INFORMATION', plan: [{ type: 'draw' }], components: { I: 1, W: 0, L: 1 } });
});

test('equal foundation progress prefers the direct move over unrelated waste preparation', () => {
  const root = h05();
  const state = { ...root, stock: root.stock.map(id => id === 10 ? 11 : id),
    tableau: root.tableau.map((col, index) => index === 4 ? { cards: [10], faceUpStart: 0 } : col) };
  assertInvariants(state);
  expect(finish(state, Array.from({ length: 52 }, (_, id) => id)))
    .toMatchObject({ goal: 'FOUNDATION_ADVANCE', score: 36, components: { F: 1, W: 0, L: 1 },
      plan: [{ type: 'move', from: { pile: 'tableau', index: 4, cardIndex: 0 }, to: { pile: 'foundation', index: 0 } }] });
});

test('unknown foundation card is not counted again as a tableau placement', () => {
  const root = h09();
  const state = { ...root, stock: root.stock.map(id => id === 33 ? 25 : id),
    tableau: root.tableau.map((col, index) => index === 4 ? { cards: [33], faceUpStart: 0 } : col) };
  assertInvariants(state);
  const result = finish(state, Array.from({ length: 52 }, (_, id) => id).filter(id => id !== 6));
  expect(result.diagnostics.expectedPostRevealScore).toBe(2); // 7♣: foundation, also fits 8♥.
});

test('unknown king entering a foundation is not counted again for an empty column', () => {
  const foundations = completedFoundations();
  foundations[0] = foundations[0].slice(0, 12);
  const state = makeState({ foundations });
  assertInvariants(state);
  expect(finish(state).diagnostics.expectedPostRevealScore).toBe(2); // Only K♣ is unknown.
});
