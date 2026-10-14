import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { analyzeHintPlan, searchSmartHint } from '../../src/engine/smart-hints.js';
import { applyMove, assertInvariants, getLegalMoves } from '../../src/engine/game.js';
import { rememberVisible, visibleCards } from '../../src/engine/knowledge.js';
import { progressStateKey } from '../../src/engine/progress.js';
import { createGame } from '../../src/engine/cards.js';
import { makeState, pile } from '../fixtures/boards.js';
import { h01, h02, h10 } from '../fixtures/smart-hints.js';

const cycles = JSON.parse(readFileSync(new URL('../../.project/reports/T028-benchmark-cycles.json', import.meta.url))).examples;

function search(state, known = visibleCards(state), options = {}) {
  const iterator = searchSmartHint(state, known, options);
  let step;
  const results = [];
  do {
    step = iterator.next();
    results.push(step.value);
  } while (!step.done);
  return results;
}

function terminalFoundation(cards) {
  const tops = [4, 6, 8, 10, 43, 45].slice(0, 7 - cards.length);
  const used = new Set([...tops, ...cards]);
  const hidden = Array.from({ length: 52 }, (_, id) => id).filter(id => !used.has(id));
  return makeState({
    stock: [],
    tableau: [pile([...hidden, tops[0]], hidden.length), ...tops.slice(1).map(id => pile([id])), ...cards.map(id => pile([id]))],
  });
}

describe('T028 strategic regressions', () => {
  test('remembering an unseen tableau card cannot change reveal scoring', () => {
    const state = h10();
    const move = { type: 'move', from: { pile: 'tableau', index: 0, cardIndex: 1 }, to: { pile: 'tableau', index: 1 } };
    const unseen = analyzeHintPlan(state, visibleCards(state), [move]);
    const remembered = analyzeHintPlan(state, [...visibleCards(state), state.tableau[0].cards[0]], [move]);
    expect(unseen.ok).toBe(true);
    expect(remembered.components).toEqual(unseen.components);
    expect(remembered.score).toBe(unseen.score);
    expect(remembered.components.I).toBe(0);
    expect(search(state, visibleCards(state), { maxStates: 64, maxDepth: 3 }).at(-1))
      .toEqual(search(state, [...visibleCards(state), state.tableau[0].cards[0]], { maxStates: 64, maxDepth: 3 }).at(-1));
  });

  test.each([{ cards: [0] }, { cards: [0, 1] }])('foundation progress remains a goal even with no further goal: $cards', ({ cards }) => {
    const state = terminalFoundation(cards);
    assertInvariants(state);
    const result = search(state, visibleCards(state), { maxStates: 256, maxDepth: 6 }).at(-1);
    expect(result.status).toBe('FOUND');
    expect(result.goal).toBe('FOUNDATION_ADVANCE');
    expect(result.components.F).toBe(cards.length);
    expect(result.plan).toHaveLength(cards.length);
    expect(result.verification.accepted).toBe(true);
    let end = state;
    for (const move of result.plan) end = applyMove(end, move).state;
    expect(getLegalMoves(end)).toEqual([]);
  });

  test('yields never discard or downgrade an accepted recommendation', () => {
    const state = terminalFoundation([0, 1]);
    let accepted;
    for (const result of search(state, visibleCards(state), { maxStates: 256, maxDepth: 6 })) {
      if (accepted) {
        expect(result.status).toBe('FOUND');
        expect(result.score).toBeGreaterThanOrEqual(accepted.score);
      }
      if (result.status === 'FOUND') accepted = result;
    }
    expect(accepted).toBeDefined();
  });

  test.each(cycles)('replanning the saved seed $seed / Draw $drawCount avoids its foundation cycle', ({ state, known }) => {
    let board = state;
    let knowledge = known;
    assertInvariants(board);
    const seen = new Set([progressStateKey(board, knowledge)]);
    let executed = 0;
    for (let step = 0; step < 8; step++) {
      const result = search(board, knowledge, { maxStates: 256, maxDepth: 12 }).at(-1);
      if (!result.plan.length) break;
      expect(analyzeHintPlan(board, knowledge, result.plan).ok).toBe(true);
      const next = applyMove(board, result.plan[0]);
      expect(next.ok).toBe(true);
      board = next.state;
      assertInvariants(board);
      knowledge = rememberVisible(board, knowledge);
      const key = progressStateKey(board, knowledge);
      expect(seen.has(key), `repeated observation at step ${step + 1}`).toBe(false);
      seen.add(key);
      executed++;
    }
    expect(executed).toBeGreaterThan(1);
  });

  test('necessary foundation return still reaches the reveal', () => {
    const result = search(h02(), visibleCards(h02()), { maxStates: 256 }).at(-1);
    expect(result.goal).toBe('REVEAL');
    expect(result.plan[0].from.pile).toBe('foundation');
    expect(result.plan).toHaveLength(2);
  });

  test('masked nonempty column supplies neither a source nor a destination', () => {
    const state = h01();
    const masked = { ...state, tableau: state.tableau.map((c, i) => i === 1
      ? { cards: c.cards.map(() => undefined), faceUpStart: c.cards.length } : c) };
    const moves = getLegalMoves(masked);
    expect(moves.some(m => m.from?.pile === 'tableau' && m.from.index === 1)).toBe(false);
    expect(moves.some(m => m.to?.pile === 'tableau' && m.to.index === 1)).toBe(false);
  });

  test('known stock navigation can reach a real goal after more than twelve commands', () => {
    const tops = [4, 6, 8, 10, 43, 45, 47];
    // A♣ is last to draw; the other cards cannot fit the odd-ranked black tops.
    const stock = [0, 1, 2, 3, 5, 7, 9, 11, 12, 17, 19, 21, 23, 25, 30, 32, 34, 36, 38, 40, 41, 42, 44, 46];
    const used = new Set([...tops, ...stock]);
    const hidden = Array.from({ length: 52 }, (_, id) => id).filter(id => !used.has(id));
    const state = makeState({ stock, tableau: [pile([...hidden, tops[0]], hidden.length), ...tops.slice(1).map(id => pile([id]))] });
    assertInvariants(state);
    const result = search(state, [...visibleCards(state), ...stock], { maxStates: 256 }).at(-1);
    expect(result.status).toBe('FOUND');
    expect(result.components.F).toBeGreaterThan(0);
    expect(result.plan.length).toBeGreaterThan(12);
    expect(result.plan[0]).toEqual({ type: 'draw' });
    expect(analyzeHintPlan(state, [...visibleCards(state), ...stock], result.plan).ok).toBe(true);
    expect(search(state, [...visibleCards(state), ...stock], { maxStates: 256, maxDepth: 12 }).at(-1).status).toBe('INCONCLUSIVE');
  });

  test('waste transfer can prepare a reveal without being published alone', () => {
    const state = structuredClone(h02());
    state.waste.push(state.foundations[1].pop());
    assertInvariants(state);
    const move = { type: 'move', from: { pile: 'waste' }, to: { pile: 'tableau', index: 1 } };
    const preparation = analyzeHintPlan(state, visibleCards(state), [move]);
    expect(preparation.goal).toBeNull();
    expect(preparation.verification.accepted).toBe(false);
    const result = search(state, visibleCards(state), { maxStates: 256, maxDepth: 4 }).at(-1);
    expect(result.goal).toBe('REVEAL');
    expect(result.components).toMatchObject({ H: 1, F: 0, W: 1, I: 0, L: 2 });
    expect(result.plan[0]).toEqual(move);
  });

  test.each([1, 3])('waste fan information stays value-independent in Draw %i', drawCount => {
    const state = makeState({
      drawCount,
      waste: drawCount === 1 ? [11, 30] : [11, 4, 6, 30],
      tableau: [pile([44])],
    });
    const changed = structuredClone(state);
    [changed.waste[0], changed.stock[0]] = [changed.stock[0], changed.waste[0]];
    assertInvariants(state);
    assertInvariants(changed);
    const move = { type: 'move', from: { pile: 'waste' }, to: { pile: 'tableau', index: 0 } };
    const known = visibleCards(state);
    const a = analyzeHintPlan(state, known, [move]);
    const b = analyzeHintPlan(changed, known, [move]);
    expect(a.ok).toBe(true);
    expect(a.goal).toBe('INFORMATION');
    expect(a.components).toMatchObject({ H: 0, I: 1, W: 1 });
    expect(b.components).toEqual(a.components);
    expect(b.score).toBe(a.score);
    expect(analyzeHintPlan(state, known, [move, { type: 'draw' }])).toMatchObject({ ok: false, reason: 'information-boundary' });
  });

  test('omitting already visible cards from knowledge does not change results', () => {
    const state = h01();
    const options = { maxStates: 64, maxDepth: 4 };
    expect(search(state, [], options)).toEqual(search(state, visibleCards(state), options));
  });

  test('an available reveal is not delayed by unrelated foundation advances', () => {
    const tops = [30, 44, 0, 39, 13, 26, 12];
    const hidden = Array.from({ length: 52 }, (_, id) => id).filter(id => !tops.includes(id));
    const state = makeState({ stock: [], tableau: [pile([...hidden, tops[0]], hidden.length), ...tops.slice(1).map(id => pile([id]))] });
    assertInvariants(state);
    const result = search(state, visibleCards(state), { maxStates: 256, maxDepth: 6 }).at(-1);
    expect(result.goal).toBe('REVEAL');
    expect(result.plan).toEqual([{
      type: 'move', from: { pile: 'tableau', index: 0, cardIndex: hidden.length }, to: { pile: 'tableau', index: 1 },
    }]);
  });

  test('a reveal that also advances its foundation retains both benefits', () => {
    const state = createGame({ seed: 22, drawCount: 1 });
    assertInvariants(state);
    const result = search(state, visibleCards(state), { maxStates: 256, maxDepth: 4 }).at(-1);
    expect(result.components).toMatchObject({ H: 1, F: 1 });
    expect(result.plan).toEqual([{
      type: 'move', from: { pile: 'tableau', index: 3, cardIndex: 3 }, to: { pile: 'foundation', index: 2 },
    }]);
  });
});
