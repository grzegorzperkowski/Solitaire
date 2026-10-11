import { describe, expect, test, vi } from 'vitest';
import { searchSmartHint } from '../../src/engine/smart-hints.js';
import { visibleCards } from '../../src/engine/knowledge.js';
import { createGame } from '../../src/engine/cards.js';
import { assertInvariants, applyMove } from '../../src/engine/game.js';
import * as game from '../../src/engine/game.js';
import { progressStateKey } from '../../src/engine/progress.js';
import {
  h01, h02, h03, h04, h05, h06, h07, h08, h09, h10, h11, h15
} from '../fixtures/smart-hints.js';

function runSearch(state, known = visibleCards(state), options = {}) {
  const iterator = searchSmartHint(state, known, options);
  let res;
  do {
    res = iterator.next();
  } while (!res.done);
  return res.value;
}

test('H05 does not rescan unchanged root mobility for every successor', () => {
  const state = h05();
  const spy = vi.spyOn(game, 'getLegalMoves');
  let rootScans;
  let result;
  try {
    result = runSearch(state, visibleCards(state), { maxStates: 16, maxDepth: 4 });
    rootScans = spy.mock.calls.filter(([board]) => board === state).length;
  } finally {
    spy.mockRestore();
  }
  expect(['FOUND', 'EXPLORATION', 'INCONCLUSIVE']).toContain(result.status);
  expect(result.goal).not.toBe('WASTE');
  expect(rootScans).toBeLessThanOrEqual(2);
});

test.each([0, 44])('hidden tableau destinations cannot affect the hint (seed %i)', (seed) => {
  const state = createGame({ seed, drawCount: 1 });
  const changed = structuredClone(state);
  const column = changed.tableau[seed === 0 ? 5 : 4];
  const hiddenIndex = column.faceUpStart - 1;
  [changed.stock[0], column.cards[hiddenIndex]] = [column.cards[hiddenIndex], changed.stock[0]];
  assertInvariants(changed);
  expect(visibleCards(changed)).toEqual(visibleCards(state));
  const options = { maxDepth: 1, maxStates: 100 };
  expect(runSearch(changed, visibleCards(state), options))
    .toEqual(runSearch(state, visibleCards(state), options));
});

test.each([1, 2])('retained search states never exceed a budget of %i', (maxStates) => {
  const state = createGame({ seed: 0, drawCount: 1 });
  const known = visibleCards(state);
  const rootKey = progressStateKey(state, known);
  const set = Map.prototype.set;
  let searchMap;
  let peakStates = 0;
  // Observe actual storage use without changing Map behavior or the planner API.
  const spy = vi.spyOn(Map.prototype, 'set').mockImplementation(function (key, value) {
    const result = set.call(this, key, value);
    if (key === rootKey && value === 0) searchMap = this;
    if (this === searchMap) peakStates = Math.max(peakStates, this.size);
    return result;
  });
  let result;
  try {
    result = runSearch(state, known, { maxStates, maxDepth: 3 });
  } finally {
    spy.mockRestore();
  }
  expect(peakStates).toBeGreaterThan(0);
  expect(peakStates).toBeLessThanOrEqual(maxStates);
  expect(result.truncated).toBe(true);
  expect(result.plan).toEqual([{
    type: 'move', from: { pile: 'tableau', index: 5, cardIndex: 5 },
    to: { pile: 'foundation', index: 3 },
  }]);
});

test.each([1, 3])('unknown stock values cannot affect scores in Draw %i', (drawCount) => {
  for (let seed = 0; seed < 100; seed++) {
    const state = createGame({ seed, drawCount });
    const changed = { ...state, stock: [...state.stock].reverse() };
    assertInvariants(changed);
    const options = { maxDepth: 1, maxStates: 100 };
    expect(runSearch(changed, visibleCards(state), options), `seed ${seed}`)
      .toEqual(runSearch(state, visibleCards(state), options));
  }
});

test('unknown card exposed by a waste transfer cannot affect scores', () => {
  for (let seed = 0; seed < 100; seed++) {
    const initial = createGame({ seed, drawCount: 1 });
    const state = { ...initial, stock: initial.stock.slice(0, -2), waste: initial.stock.slice(-2) };
    const stock = [...state.stock];
    const waste = [...state.waste];
    [stock[0], waste[0]] = [waste[0], stock[0]];
    const changed = { ...state, stock, waste };
    assertInvariants(state);
    assertInvariants(changed);
    const options = { maxDepth: 1, maxStates: 100 };
    expect(runSearch(changed, visibleCards(state), options), `seed ${seed}`)
      .toEqual(runSearch(state, visibleCards(state), options));
  }
});

describe('SmartHint v1 — Engine & Acceptance H01–H15', { timeout: 15000 }, () => {
  test('all fixtures satisfy full-deck board invariants', () => {
    expect(() => assertInvariants(h01())).not.toThrow();
    expect(() => assertInvariants(h02())).not.toThrow();
    expect(() => assertInvariants(h03())).not.toThrow();
    expect(() => assertInvariants(h04())).not.toThrow();
    expect(() => assertInvariants(h05())).not.toThrow();
    expect(() => assertInvariants(h06())).not.toThrow();
    expect(() => assertInvariants(h07())).not.toThrow();
    expect(() => assertInvariants(h08())).not.toThrow();
    expect(() => assertInvariants(h09())).not.toThrow();
    expect(() => assertInvariants(h10(0))).not.toThrow();
    expect(() => assertInvariants(h10(1))).not.toThrow();
    expect(() => assertInvariants(h11())).not.toThrow();
    expect(() => assertInvariants(h15())).not.toThrow();
  });

  test('H15: WON board returns WON status, empty plan, no goal', () => {
    const state = h15();
    const res = runSearch(state);
    expect(res).toEqual({
      status: 'WON',
      plan: [],
      goal: null,
      score: null,
      visitedStates: 0,
      truncated: false,
    });
  });

  test('H01: Direct reveal — selects move that reveals hidden card', () => {
    const state = h01();
    const res = runSearch(state);
    expect(res.status).toBe('FOUND');
    expect(res.goal).toBe('REVEAL');
    expect(res.plan.length).toBe(1);
    expect(res.plan[0]).toEqual({
      type: 'move',
      from: { pile: 'tableau', index: 0, cardIndex: 1 },
      to: { pile: 'tableau', index: 1 },
    });
  });

  test('H02: Second move reveals — identifies sequence of length 2 and initial step', () => {
    const state = h02();
    const res = runSearch(state);
    expect(res.status).toBe('FOUND');
    expect(res.goal).toBe('REVEAL');
    expect(res.plan.length).toBe(2);
    // Move 1: return J♦ from foundation 1 onto Q♣ in col 1
    expect(res.plan[0]).toEqual({
      type: 'move',
      from: { pile: 'foundation', index: 1 },
      to: { pile: 'tableau', index: 1 },
    });
    // Move 2: move suffix 10♠ from col 0 to col 1
    expect(res.plan[1]).toEqual({
      type: 'move',
      from: { pile: 'tableau', index: 0, cardIndex: 1 },
      to: { pile: 'tableau', index: 1 },
    });
  });

  test('H03: Foundation vs reveal — full U score prefers reveal over foundation move', () => {
    const state = h03();
    const res = runSearch(state);
    expect(res.status).toBe('FOUND');
    expect(res.goal).toBe('REVEAL');
    expect(res.plan[0].to.pile).toBe('tableau');
  });

  test('H04: Foundation return enables reveal as first move', () => {
    const state = h04();
    const res = runSearch(state);
    expect(res.status).toBe('FOUND');
    expect(res.goal).toBe('REVEAL');
    expect(res.plan[0].from.pile).toBe('foundation');
  }, 15000);

  test('H05: Waste alone is preparation, not a strategic goal', () => {
    const state = h05();
    const known = [...state.stock, ...state.waste, ...state.tableau.flatMap(c => c.cards), ...state.foundations.flat()];
    const res = runSearch(state, known, { maxDepth: 1 });
    expect(res.status).toBe('INCONCLUSIVE');
    expect(res.plan).toEqual([]);
    expect(res.truncated).toBe(true);
  });

  test('H07: King between empty columns does not yield idle suggestion', () => {
    const state = h07();
    const res = runSearch(state);
    expect(res.status).toBe('INCONCLUSIVE');
    expect(res.plan).toEqual([]);
  });

  test('H08: Only unknown stock draw available returns EXPLORATION', () => {
    const state = h08();
    const res = runSearch(state, []);
    expect(res.status).toBe('EXPLORATION');
    expect(res.goal).toBe('INFORMATION');
    expect(res.plan).toEqual([{ type: 'draw' }]);
  });

  test('H09: Two paths compared by U score', () => {
    const state = h09();
    const res = runSearch(state);
    expect(res.status).toBe('FOUND');
    expect(res.goal).toBe('REVEAL');
    expect(res.plan.length).toBeGreaterThan(0);
  });

  test('H10: Permutations of hidden cards produce identical plan & score', () => {
    const state0 = h10(0);
    const state1 = h10(1);
    const res0 = runSearch(state0);
    const res1 = runSearch(state1);
    expect(res0.status).toBe(res1.status);
    expect(res0.goal).toBe(res1.goal);
    expect(res0.score).toBe(res1.score);
    expect(res0.plan).toEqual(res1.plan);
  }, 15000);

  test('H11: Limited search budget never reports NO_PROGRESS', () => {
    const state = h11();
    const res = runSearch(state, visibleCards(state), { maxStates: 2, maxDepth: 2 });
    expect(res.status).not.toBe('NO_PROGRESS');
    expect(['INCONCLUSIVE', 'FOUND', 'EXPLORATION']).toContain(res.status);
    expect(res.truncated).toBe(true);
  });

  test('H14: Deterministic repeatability for same state, knowledge, budget', () => {
    const state = h01();
    const resA = runSearch(state, visibleCards(state), { maxStates: 50 });
    const resB = runSearch(state, visibleCards(state), { maxStates: 50 });
    expect(resA).toEqual(resB);
  });

  test('input state is not mutated by search', () => {
    const state = h01();
    const clone = JSON.parse(JSON.stringify(state));
    runSearch(state);
    expect(state).toEqual(clone);
  });

  test('every command in generated plan is legally applicable in sequence', () => {
    const state = h02();
    const res = runSearch(state);
    expect(res.plan.length).toBeGreaterThan(0);
    let cur = state;
    for (const cmd of res.plan) {
      const stepRes = applyMove(cur, cmd);
      expect(stepRes.ok).toBe(true);
      cur = stepRes.state;
    }
  });
});
