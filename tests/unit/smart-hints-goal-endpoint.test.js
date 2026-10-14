import { expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { searchSmartHint, analyzeHintPlan } from '../../src/engine/smart-hints.js';
import { applyMove, assertInvariants } from '../../src/engine/game.js';
import { visibleCards } from '../../src/engine/knowledge.js';
import { createGame } from '../../src/engine/cards.js';
import { formatSmartHintMessage } from '../../src/ui/smart-hints.js';
import { card, makeState, pile } from '../fixtures/boards.js';
import { fixtureSession } from '../fixtures/progress.js';
import { createApp } from '../../src/app.js';

function cancelAfter(state, known, expansions) {
  const controller = new AbortController();
  const iterator = searchSmartHint(state, known, {
    maxStates: 10000, maxDepth: 30, signal: controller.signal,
  });
  let step;
  do {
    step = iterator.next();
    if (!step.done && step.value.visitedStates >= expansions) {
      controller.abort();
      return iterator.next().value;
    }
  } while (!step.done);
  return step.value;
}

function blockedBoard(waste, lastColumn) {
  const exposed = [
    [card(0, 1)], [card(3, 7)], [card(0, 10)], [card(1, 10)],
    [card(2, 10)], [card(3, 10)], [lastColumn],
  ];
  const used = new Set([...exposed.flat(), waste]);
  const hidden = Array.from({ length: 52 }, (_, id) => id).filter(id => !used.has(id));
  const tableau = exposed.map(cards => pile(cards));
  tableau[2] = pile([...hidden, ...exposed[2]], hidden.length);
  const state = makeState({ tableau, stock: [], waste: [waste] });
  assertInvariants(state);
  return state;
}

test('a known waste preparation cannot pad an already completed foundation hint', () => {
  const state = blockedBoard(card(2, 13), card(0, 12));
  const foundationMove = {
    type: 'move', from: { pile: 'tableau', index: 0, cardIndex: 0 }, to: { pile: 'foundation', index: 0 },
  };
  const preparation = { type: 'move', from: { pile: 'waste' }, to: { pile: 'tableau', index: 0 } };
  const known = visibleCards(state);
  expect(analyzeHintPlan(state, known, [foundationMove, preparation])).toMatchObject({
    ok: true, score: 32, components: { F: 1, W: 1, L: 2 }, verification: { accepted: true },
  });

  const result = cancelAfter(state, known, 2);

  expect(result).toMatchObject({ status: 'FOUND', score: 36, components: { F: 1, W: 0, L: 1 } });
  expect(result.plan).toEqual([foundationMove]);
});

function cursor78() {
  const replay = JSON.parse(readFileSync(
    new URL('../fixtures/smart-hint-seed2560240634-draw1-78.json', import.meta.url), 'utf8',
  ));
  let state = createGame({ seed: replay.seed, drawCount: replay.drawCount });
  for (const command of replay.commands) {
    const moved = applyMove(state, command);
    expect(moved.ok).toBe(true);
    state = moved.state;
  }
  assertInvariants(state);
  return { state, known: replay.knownCards };
}

test('A cursor 78 hints one foundation move, not sixteen further preparations', () => {
  const { state, known } = cursor78();
  const move = {
    type: 'move', from: { pile: 'tableau', index: 4, cardIndex: 3 }, to: { pile: 'foundation', index: 0 },
  };

  const result = cancelAfter(state, known, 666);

  expect(result).toMatchObject({ status: 'FOUND', goal: 'FOUNDATION_ADVANCE',
    score: 36, components: { H: 0, F: 1, I: 0, W: 0, L: 1 }, cancelled: true, truncated: true });
  expect(result.plan).toEqual([move]);
  expect(formatSmartHintMessage(state, result))
    .toBe('Przenieś Czwórka trefl z kolumny 5 do bazy trefl. Ten ruch przenosi kartę do bazy.');
});

test('the app describes the completed single goal before returning uncertainty on B', () => {
  vi.useFakeTimers();
  const { state, known } = cursor78();
  const session = fixtureSession(state, known);
  const app = createApp({
    storage: null, performance: { now: () => 0 }, hintMaxStates: 1600,
    load: () => ({ ok: true, session, metadata: { revision: 1, preferences: { drawCount: 1 } } }),
  }).init();
  try {
    app.requestSmartHint();
    vi.advanceTimersByTime(100);
    const hint = app.getState().hint;
    expect(hint).toMatchObject({ status: 'FOUND', goal: 'FOUNDATION_ADVANCE' });
    expect(hint.plan).toHaveLength(1);
    expect(formatSmartHintMessage(state, hint)).toContain('Ten ruch przenosi kartę do bazy.');
    expect(app.executeCommand(hint.plan[0]).ok).toBe(true);
    app.requestSmartHint();
    vi.advanceTimersByTime(100);
    expect(app.getState().hint).toMatchObject({ status: 'INCONCLUSIVE', plan: [], truncated: true });
  } finally {
    app.destroy();
    vi.useRealTimers();
  }
});

test('search still continues past a first goal to a later foundation advance', () => {
  const state = blockedBoard(card(0, 2), card(0, 13));

  const result = cancelAfter(state, visibleCards(state), 2);

  expect(result).toMatchObject({ status: 'FOUND', score: 72, components: { F: 2, W: 1, L: 2 } });
  expect(result.plan).toEqual([
    { type: 'move', from: { pile: 'tableau', index: 0, cardIndex: 0 }, to: { pile: 'foundation', index: 0 } },
    { type: 'move', from: { pile: 'waste' }, to: { pile: 'foundation', index: 0 } },
  ]);
});
