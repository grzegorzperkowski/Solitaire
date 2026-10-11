import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { progressFixture, fixtureSession } from '../fixtures/progress.js';
import { h01, h02, h07, h15 } from '../fixtures/smart-hints.js';
import { visibleCards } from '../../src/engine/knowledge.js';
import { createGame } from '../../src/engine/cards.js';
import { searchSmartHint } from '../../src/engine/smart-hints.js';

afterEach(() => vi.useRealTimers());

function createTestApp(state, options = {}) {
  vi.useFakeTimers();
  const session = fixtureSession(state, visibleCards(state));
  return createApp({
    storage: null,
    load: () => ({ ok: true, session, metadata: { revision: 1, preferences: { drawCount: 1 } } }),
    ...options,
  }).init();
}

describe('SmartHint v1 — App Controller Integration (H12, H13, Cancellation, Time-slicing)', { timeout: 15000 }, () => {
  test('time cutoff marks the best result truncated while retaining its plan', () => {
    let clock = 0;
    const state = createGame({ seed: 0, drawCount: 1 });
    const search = searchSmartHint(state, visibleCards(state));
    const first = search.next();
    expect(first.done).toBe(false);
    expect(first.value.truncated).toBe(false);
    search.return();
    const app = createTestApp(state, {
      performance: { now: () => (clock += 101) },
    });
    try {
      app.requestSmartHint();
      vi.advanceTimersByTime(10);
      const hint = app.getState().hint;
      expect(hint).not.toBeNull();
      expect(hint.plan.length).toBeGreaterThan(0);
      expect(hint.plan).toEqual(first.value.plan);
      expect(hint.truncated).toBe(true);
      expect(app.getState().isHintLoading).toBe(false);
    } finally {
      app.destroy();
    }
  });

  test('completed search does not claim truncation even if the final batch exceeds the budget', () => {
    let clock = 0;
    const app = createTestApp(createGame({ seed: 42, drawCount: 1 }), {
      performance: { now: () => (clock += 101) },
    });
    try {
      app.requestSmartHint();
      vi.advanceTimersByTime(10);
      expect(app.getState().hint.truncated).toBe(false);
    } finally {
      app.destroy();
    }
  });
  test('requestSmartHint performs time-sliced search and publishes result to getState()', () => {
    const state = h01();
    const app = createTestApp(state);
    expect(app.getState().hint).toBe(null);

    app.requestSmartHint();
    expect(app.getState().isHintLoading).toBe(true);

    vi.advanceTimersByTime(100);
    const result = app.getState().hint;
    expect(result).not.toBe(null);
    expect(result.status).toBe('FOUND');
    expect(result.goal).toBe('REVEAL');
    expect(result.plan.length).toBe(1);
    expect(app.getState().isHintLoading).toBe(false);
    app.destroy();
  });

  test('repeated click on same board/knowledge re-exposes current result without recalculation', () => {
    const state = h01();
    const app = createTestApp(state);
    app.requestSmartHint();
    vi.advanceTimersByTime(100);
    const firstResult = app.getState().hint;

    const listener = vi.fn();
    app.subscribe(listener);

    app.requestSmartHint();
    expect(app.getState().hint).toBe(firstResult);
    expect(listener).toHaveBeenCalled();
    app.destroy();
  });

  test('board move invalidates existing hint and cancels running search (H12)', () => {
    const state = h01();
    const app = createTestApp(state);
    app.requestSmartHint();
    vi.advanceTimersByTime(100);
    expect(app.getState().hint.status).toBe('FOUND');

    // Execute move
    const move = app.getState().hint.plan[0];
    app.executeCommand(move);

    // Old hint must be immediately invalidated
    expect(app.getState().hint).toBe(null);
    app.destroy();
  });

  test('Undo and Redo invalidate hint (H13)', () => {
    const state = h01();
    const app = createTestApp(state);
    app.requestSmartHint();
    vi.advanceTimersByTime(100);
    const move = app.getState().hint.plan[0];
    app.executeCommand(move);

    app.requestSmartHint();
    vi.advanceTimersByTime(100);
    expect(app.getState().hint).not.toBe(null);

    app.undo();
    expect(app.getState().hint).toBe(null);

    app.redo();
    expect(app.getState().hint).toBe(null);
    app.destroy();
  }, 30000);

  test('time tick does not cancel or restart hint search', () => {
    const state = h01();
    let clock = 1000;
    const app = createTestApp(state, { performance: { now: () => (clock += 2) } });

    app.requestSmartHint();
    vi.advanceTimersByTime(100);
    const hint = app.getState().hint;
    expect(hint.status).toBe('FOUND');

    // Timer tick (advance by 1s)
    vi.advanceTimersByTime(1000);
    expect(app.getState().hint).toBe(hint);
    app.destroy();
  });

  test('pause and dialog cancel in-flight hint search without crashing', () => {
    const state = h02();
    let clock = 1000;
    const app = createTestApp(state, { performance: { now: () => (clock += 5) } });

    app.requestSmartHint();
    expect(app.getState().isHintLoading).toBe(true);

    app.pause();
    vi.advanceTimersByTime(100);
    expect(app.getState().isHintLoading).toBe(false);
    app.destroy();
  });

  test('WON state returns WON status immediately with empty plan', () => {
    const state = h15();
    const app = createTestApp(state);
    app.requestSmartHint();
    expect(app.getState().hint).toEqual({
      status: 'WON',
      plan: [],
      goal: null,
      score: null,
      visitedStates: 0,
      truncated: false,
    });
    app.destroy();
  });
});
