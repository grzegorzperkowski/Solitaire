import { afterEach, expect, test, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { fixtureSession, progressFixture, foundationPreparation, revealAfterPreparation } from '../fixtures/progress.js';
import { visibleCards } from '../../src/engine/knowledge.js';

afterEach(() => vi.useRealTimers());
function fixtureApp(id, options = {}) {
  vi.useFakeTimers();
  const state = progressFixture(id);
  const session = fixtureSession(state, [...visibleCards(state), ...state.stock]);
  return createApp({ storage: null, load: () => ({ ok: true, session, metadata: { revision: 1, preferences: { drawCount: 1 } } }), ...options }).init();
}

test('completed negative analysis distinguishes no actions from neutral cycles', () => {
  for (const [id, noLegalMoves] of [[1, true], [2, false]]) {
    const app = fixtureApp(id);
    vi.advanceTimersByTime(100);
    expect(app.getState().progress).toMatchObject({ status: 'NO_PROGRESS', noLegalMoves });
    app.destroy();
  }
});
test('unfinished and cancelled analyses never publish stale negative results', () => {
  const app = fixtureApp(2, { progressMaxStates: 1 });
  vi.advanceTimersByTime(50);
  expect(app.getState().progress.status).toBe('UNKNOWN');
  app.newGame({ seed: 42 });
  expect(app.getState().progress.status).toBe('UNKNOWN');
  vi.advanceTimersByTime(50);
  expect(app.getState().progress.status).toBe('PROGRESS_FOUND');
  app.destroy();
});
test('UT17/18 board changes, Undo and Redo invalidate analysis and preserve knowledge', () => {
  const app = fixtureApp(3);
  app.executeCommand(foundationPreparation);
  app.executeCommand(revealAfterPreparation);
  vi.advanceTimersByTime(100);
  const after = app.getState();
  app.undo();
  expect(app.getState().progress.status).toBe('UNKNOWN');
  vi.advanceTimersByTime(100);
  expect(app.getState().progress.status).toBe('PROGRESS_FOUND');
  app.redo();
  vi.advanceTimersByTime(100);
  expect(app.getState().progress).toEqual(after.progress);
  expect(app.getState().session.knownCards).toEqual(after.session.knownCards);
  app.destroy();
});
test('replacement before scheduled work and destruction cancel old results', () => {
  const app = fixtureApp(2);
  app.newGame({ seed: 42 });
  const listener = vi.fn();
  app.subscribe(listener);
  vi.advanceTimersByTime(100);
  expect(app.getState().progress.status).toBe('PROGRESS_FOUND');
  app.destroy();
  listener.mockClear();
  vi.advanceTimersByTime(10000);
  expect(listener).not.toHaveBeenCalled();
});

test('active time budget gives UNKNOWN with work remaining', () => {
  let clock = 0;
  const app = fixtureApp(2, { performance: { now: () => (clock += 60) } });
  vi.advanceTimersByTime(20);
  expect(app.getState().progress.status).toBe('UNKNOWN');
  app.destroy();
});

test('progress analysis accepts an explicit active-time budget', () => {
  let clock = 0;
  const app = fixtureApp(2, { progressActiveMs: 1000, performance: { now: () => (clock += 60) } });
  vi.advanceTimersByTime(1000);
  expect(app.getState().progress.status).toBe('NO_PROGRESS');
  app.destroy();
});

test('cancels between batches and time ticks do not restart completed search', () => {
  let clock = 0;
  const app = fixtureApp(2, { performance: { now: () => (clock += 5) } });
  vi.advanceTimersToNextTimer();
  expect(app.getState().progress.status).toBe('UNKNOWN');
  app.newGame({ seed: 42 });
  vi.advanceTimersByTime(20);
  const completed = app.getState().progress;
  expect(completed.status).toBe('PROGRESS_FOUND');
  vi.advanceTimersByTime(2000);
  expect(app.getState().progress).toBe(completed);
  app.destroy();
});
