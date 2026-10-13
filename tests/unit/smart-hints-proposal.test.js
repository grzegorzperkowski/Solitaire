import { expect, test } from 'vitest';
import { analyzeHintPlan, searchSmartHint } from '../../src/engine/smart-hints.js';
import { assertInvariants } from '../../src/engine/game.js';
import { visibleCards } from '../../src/engine/knowledge.js';
import { h01, h02, h04, h09 } from '../fixtures/smart-hints.js';

const allCards = Array.from({ length: 52 }, (_, id) => id);

function finish(state, known = visibleCards(state), options = {}) {
  const iterator = searchSmartHint(state, known, options);
  let step;
  do { step = iterator.next(); } while (!step.done);
  return step.value;
}

test('a direct reveal beats an unnecessary waste transfer with a higher raw score', () => {
  const root = h01();
  const state = { ...root, stock: root.stock.filter(id => id !== 10), waste: [10] }; // J♣
  assertInvariants(state);
  const result = finish(state, allCards, { maxStates: 500, maxDepth: 3 });
  expect(result).toMatchObject({ status: 'FOUND', goal: 'REVEAL', score: 116, components: { H: 1, W: 0, L: 1 } });
  expect(result.plan).toEqual([{
    type: 'move', from: { pile: 'tableau', index: 0, cardIndex: 1 }, to: { pile: 'tableau', index: 1 },
  }]);
});

test('post-reveal estimate counts only opposite-color placements and never the revealed top', () => {
  const root = h01();
  const state = { ...root,
    stock: root.stock.map(id => id === 35 ? 37 : id), // swap 10♥ and Q♥
    tableau: root.tableau.map((col, index) => index === 5 ? { cards: [35], faceUpStart: 0 } : col),
  };
  assertInvariants(state);
  // Only J♣, J♥ and J♠ are unknown. After the reveal, only J♥ fits Q♣/Q♠.
  const known = allCards.filter(id => ![10, 36, 49].includes(id));
  const result = finish(state, known, { maxStates: 100, maxDepth: 1 });
  expect(result).toMatchObject({ goal: 'REVEAL', diagnostics: { expectedPostRevealScore: 1 / 3 } });
});

test('a remembered newly revealed jack cannot inflate the post-reveal estimate', () => {
  const root = h01();
  const state = { ...root,
    stock: root.stock.map(id => id === 10 ? 12 : id), // swap hidden K♣ with J♣
    tableau: root.tableau.map((column, index) => index === 0
      ? { cards: [10, column.cards[1]], faceUpStart: 1 } : column),
  };
  assertInvariants(state);
  const known = allCards.filter(id => id !== 35); // Only 10♥ is unknown.
  // The newly revealed J♣ would accept 10♥, but its future moves must stay masked.
  expect(finish(state, known, { maxStates: 100, maxDepth: 1 }))
    .toMatchObject({ goal: 'REVEAL', diagnostics: { expectedPostRevealScore: 0 } });
});

test('a shorter two-command reveal outranks a higher-scoring foundation advance', () => {
  const root = h04();
  const state = { ...root, stock: root.stock.filter(id => id !== 35), waste: [35] }; // 10♥
  assertInvariants(state);
  const result = finish(state, allCards, { maxStates: 100, maxDepth: 2 });
  expect(result).toMatchObject({ goal: 'REVEAL', components: { H: 1, F: -1, L: 2 } });
  expect(result.plan[0].from.pile).toBe('foundation');
});

test('equal-length reveals use the estimate from known tops to break a tie', () => {
  const root = h09();
  const removed = [...root.foundations[1].slice(1), ...root.foundations[2].slice(1)];
  const state = { ...root, stock: [...root.stock, ...removed],
    foundations: root.foundations.map((pile, index) => index === 1 || index === 2 ? pile.slice(0, 1) : pile),
  };
  assertInvariants(state);
  const known = allCards.filter(id => id !== 17); // Only 5♦ is unknown.
  const result = finish(state, known, { maxStates: 100, maxDepth: 1 });
  // Revealing column 2 leaves 6♠ available for the unknown 5♦. Revealing column 0 covers it.
  expect(result).toMatchObject({ goal: 'REVEAL', diagnostics: { expectedPostRevealScore: 1 } });
  expect(result.plan[0].from.index).toBe(2);
});

test('different first moves survive as legal, boundary-safe alternatives', () => {
  const state = h09();
  const known = visibleCards(state);
  const result = finish(state, known, { maxStates: 100, maxDepth: 1 });
  expect(result.alternatives).toBeDefined();
  expect(result.alternatives.length).toBeGreaterThanOrEqual(2);
  expect(result.alternatives.length).toBeLessThanOrEqual(5);
  expect(result.alternatives[0].plan).toEqual(result.plan);
  const firstMoves = result.alternatives.map(alt => JSON.stringify(alt.plan[0]));
  expect(new Set(firstMoves).size).toBe(firstMoves.length);
  expect(result.alternatives.some(alt => alt.plan[0].from?.index === 0)).toBe(true);
  expect(result.alternatives.some(alt => alt.plan[0].from?.index === 2)).toBe(true);
  for (const alternative of result.alternatives) {
    const replay = analyzeHintPlan(state, known, alternative.plan);
    expect(replay).toMatchObject({ ok: true, goal: alternative.goal,
      verification: { accepted: true, continuation: 'INFORMATION_BOUNDARY' } });
    expect(alternative.score).toBe(replay.score);
    expect(alternative.components).toEqual(replay.components);
  }
});

test.each([0, 1, 2])('proposal adaptation respects a strict %i-command depth', (maxDepth) => {
  const state = h02();
  const result = finish(state, allCards, { maxStates: 100, maxDepth });
  expect(result.plan.length).toBeLessThanOrEqual(maxDepth);
  expect(result.diagnostics.retainedStates).toBeLessThanOrEqual(100);
  if (maxDepth < 2) {
    expect(result).toMatchObject({ status: 'INCONCLUSIVE', truncated: true, plan: [] });
  } else {
    expect(result.goal).toBe('REVEAL');
  }
});
