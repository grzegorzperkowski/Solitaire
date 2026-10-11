import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { searchProgress, progressStateKey } from '../../src/engine/progress.js';
import { visibleCards } from '../../src/engine/knowledge.js';
import { getLegalMoves, assertInvariants } from '../../src/engine/game.js';
import { rankHints } from '../../src/engine/hints.js';
import { progressFixture, step, foundationPreparation } from '../fixtures/progress.js';
import { card } from '../fixtures/boards.js';
import { restoreSession } from '../../src/persistence.js';

function analyze(state, known = visibleCards(state), maxStates = 10000) {
  const iterator = searchProgress(state, known, { maxStates });
  let result;
  do { result = iterator.next(); } while (!result.done);
  return result.value;
}

function withStock(cards, drawCount) {
  const state = structuredClone(progressFixture(1, drawCount));
  state.stock = cards;
  for (const column of state.tableau) {
    const hidden = column.cards.slice(0, column.faceUpStart).filter((id) => !cards.includes(id));
    column.cards = [...hidden, ...column.cards.slice(column.faceUpStart)];
    column.faceUpStart = hidden.length;
  }
  assertInvariants(state);
  return state;
}

describe('T027 reachable progress', () => {
  test('T028: saved seed 2284836135 exhausts preparation without false waste progress', () => {
    const diagnostic = JSON.parse(readFileSync(new URL('../fixtures/solitaire-stan-2284836135-draw1-114.json', import.meta.url), 'utf8'));
    const restored = restoreSession(JSON.stringify(diagnostic.save));
    expect(restored.ok).toBe(true);
    expect(restored.session.cursor).toBe(114);
    expect(new Set([
      ...restored.session.state.stock, ...restored.session.state.waste,
      ...restored.session.state.tableau.flatMap((column) => column.cards),
      ...restored.session.state.foundations.flat(),
    ]).size).toBe(52);
    const actions = getLegalMoves(restored.session.state);
    expect(actions).toHaveLength(5);
    expect(analyze(restored.session.state, restored.session.knownCards)).toMatchObject({
      status: 'NO_PROGRESS', noLegalMoves: false,
    });
  });

  test.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('FX%s is a complete valid deck', (id) => {
    expect(() => assertInvariants(progressFixture(id))).not.toThrow();
  });
  test.each([1, 3])('UT01–10 fixtures in Draw %s', (drawCount) => {
    for (const [id, status] of [[1, 'NO_PROGRESS'], [2, 'NO_PROGRESS'], [3, 'PROGRESS_FOUND'], [4, 'PROGRESS_FOUND'], [5, 'PROGRESS_FOUND'], [6, 'PROGRESS_FOUND'], [7, 'NO_PROGRESS'], [10, 'WON']]) {
      const state = progressFixture(id, drawCount);
      const known = id === 7 ? [...visibleCards(state), ...state.stock] : visibleCards(state);
      const result = analyze(state, known);
      expect(result.status, `FX${id}`).toBe(status);
      if (id === 4) expect(result.goal).toBe('FOUNDATION_ADVANCE');
    }
    expect(getLegalMoves(progressFixture(1))).toEqual([]);
    expect(getLegalMoves(progressFixture(2)).length).toBeGreaterThan(0);
    expect(analyze(progressFixture(2), [], 1).status).toBe('UNKNOWN');
  });
  test('UT09 returning an original foundation card is neutral; another branch reveals', () => {
    const state = progressFixture(3);
    const intermediate = step(state, foundationPreparation);
    const back = { type: 'move', from: { pile: 'tableau', index: 2, cardIndex: intermediate.tableau[2].cards.length - 1 }, to: { pile: 'foundation', index: 0 } };
    expect(step(intermediate, back)).toEqual(state);
    expect(analyze(state)).toMatchObject({ status: 'PROGRESS_FOUND', goal: 'REVEAL' });
  });
  test('UT15/16 hidden permutations do not affect result or hint order', () => {
    const state = progressFixture(6);
    const swapped = structuredClone(state);
    [swapped.stock[0], swapped.tableau[2].cards[0]] = [swapped.tableau[2].cards[0], swapped.stock[0]];
    [swapped.tableau[3].cards[0], swapped.tableau[4].cards[0]] = [swapped.tableau[4].cards[0], swapped.tableau[3].cards[0]];
    expect(analyze(swapped)).toEqual(analyze(state));
    expect(rankHints(swapped)).toEqual(rankHints(state));
  });
  test('UT19–23 immutable, deterministic search deduplicates cycles and exhausts only at completion', () => {
    const state = progressFixture(2);
    const before = JSON.stringify(state);
    const result = analyze(state);
    expect(result).toMatchObject({ status: 'NO_PROGRESS', visitedStates: 2 });
    expect(analyze(state)).toEqual(result);
    expect(analyze(state, [], 1).status).toBe('UNKNOWN');
    expect(analyze(state, [], 2).status).toBe('NO_PROGRESS');
    expect(JSON.stringify(state)).toBe(before);
  });
  test('UT24 missing stock knowledge cannot prove no progress', () => {
    expect(analyze(progressFixture(7), undefined)).toMatchObject({ status: 'PROGRESS_FOUND', goal: 'INFORMATION' });
  });
  test('UT13 keys distinguish stock/waste order, mode and knowledge', () => {
    const state = progressFixture(5);
    const reversed = { ...state, waste: [...state.waste].reverse() };
    expect(progressStateKey(state, visibleCards(state))).not.toBe(progressStateKey(reversed, visibleCards(state)));
    expect(progressStateKey(state, [])).not.toBe(progressStateKey(state, state.waste));
    expect(progressStateKey(state, [])).not.toBe(progressStateKey({ ...state, drawCount: 3 }, []));
  });
  test.each([1, 2])('UT11 Draw 3 known remainder of %s cards is not progress', (count) => {
    const state = withStock([card(1, 12), card(2, 12)].slice(0, count), 3);
    const drawn = step(state, { type: 'draw' });
    expect(drawn.stock).toEqual([]);
    expect(drawn.waste).toEqual([...state.stock].reverse());
    expect(analyze(state, [...visibleCards(state), ...state.stock]).status).toBe('NO_PROGRESS');
  });
  test('UT12/13 Draw 3 grouping and waste order change reachable progress', () => {
    const state = withStock([card(1, 12), card(0, 7), card(0, 12)], 3);
    const known = [...visibleCards(state), ...state.stock];
    expect(analyze(state, known).status).toBe('NO_PROGRESS');
    const regrouped = { ...state, stock: [card(0, 7), card(1, 12), card(0, 12)] };
    expect(analyze(regrouped, known)).toMatchObject({ status: 'PROGRESS_FOUND', goal: 'FOUNDATION_ADVANCE' });
    const waste = step(state, { type: 'draw' });
    expect(analyze(waste, known).status).toBe('NO_PROGRESS');
    expect(analyze({ ...waste, waste: [card(0, 12), card(1, 12), card(0, 7)] }, known))
      .toMatchObject({ status: 'PROGRESS_FOUND', goal: 'FOUNDATION_ADVANCE' });
    // Removing a waste card changes the next recycled draw group.
    const fx5 = progressFixture(5, 3);
    const removed = step(fx5, { type: 'move', from: { pile: 'waste' }, to: { pile: 'tableau', index: 0 } });
    const recycled = step(removed, { type: 'recycle' });
    expect(step(recycled, { type: 'draw' }).waste).toEqual([card(0, 7)]);
    expect(analyze(recycled, visibleCards(fx5)).status).toBe('PROGRESS_FOUND');
  });
  test('T028 waste removal is progress when it exposes an unknown fan card', () => {
    const state = progressFixture(5, 1);
    const known = visibleCards(state);
    const wasteMove = getLegalMoves(state).find((move) => move.from?.pile === 'waste');
    expect(wasteMove).toBeDefined();
    const applied = step(state, wasteMove);
    expect(visibleCards(applied).some((id) => !known.includes(id))).toBe(true);
    expect(analyze(state, known)).toMatchObject({ status: 'PROGRESS_FOUND', goal: 'INFORMATION' });
  });
  test('UT14 progress requires three neutral draws, with no depth cutoff', () => {
    const state = withStock([card(0, 7), card(1, 12), card(0, 12)], 1);
    const known = [...visibleCards(state), ...state.stock];
    expect(analyze(state, known, 3).status).toBe('UNKNOWN');
    expect(analyze(state, known, 4).status).toBe('UNKNOWN');
    expect(analyze(state, known, 8)).toMatchObject({ status: 'PROGRESS_FOUND', goal: 'FOUNDATION_ADVANCE' });
  });
  test('UT09 a foundation round trip alone never becomes P2', () => {
    const state = structuredClone(progressFixture(1));
    // Only the black foundation nine can land on 10H; red nines cannot
    // land on it or uncover anything when the black nine returns.
    const visible = [card(2, 10), card(1, 11), card(2, 11), card(3, 11), card(0, 11), card(2, 9), card(1, 9)];
    state.foundations[0].push(card(0, 7), card(0, 8), card(0, 9));
    const used = new Set([...state.foundations.flat(), ...visible]);
    const hidden = Array.from({ length: 52 }, (_, i) => i).filter((id) => !used.has(id));
    state.tableau = visible.map((id, index) => ({ cards: index === 0 ? [id] : [...hidden.splice(0, index === 6 ? hidden.length : 2), id], faceUpStart: 0 }));
    state.tableau.forEach((c) => { c.faceUpStart = c.cards.length - 1; });
    assertInvariants(state);
    expect(getLegalMoves(state).some((m) => m.from?.pile === 'foundation')).toBe(true);
    expect(analyze(state).status).toBe('NO_PROGRESS');
  });
});
