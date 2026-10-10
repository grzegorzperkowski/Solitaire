import { describe, expect, test, vi, beforeEach } from 'vitest';
import { createApp, LOCK_NAME } from '../../src/app.js';
import { STORAGE_KEY } from '../../src/persistence.js';
import { nearWin } from '../fixtures/wins.js';

function createMockStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: vi.fn((k) => (map.has(k) ? map.get(k) : null)),
    setItem: vi.fn((k, v) => map.set(k, String(v))),
    removeItem: vi.fn((k) => map.delete(k)),
  };
}

describe('T008 app controller: clock, lifecycle and ownership', () => {
  let fakeNow = 1000;
  const mockPerformance = {
    now: () => fakeNow,
  };

  beforeEach(() => {
    fakeNow = 1000;
    vi.useFakeTimers();
  });

  test.each([1, 3])('T015 first win, reload and practice preserve one award in Draw %s', (drawCount) => {
    const fixture = nearWin(drawCount);
    const storage = createMockStorage({ [STORAGE_KEY]: fixture.save });
    let app = createApp({ storage, performance: mockPerformance });
    app.init();
    app.resume();
    fakeNow += 2000;
    expect(app.executeCommand(fixture.command).ok).toBe(true);
    expect(app.getState().activeDialog).toBe('win');
    expect(app.getState().elapsedMs).toBe(14000);
    const stats = app.getState().session.statistics;
    expect(stats[`draw${drawCount}`]).toEqual({ attempts: 1, wins: 1, bestTimeMs: 14000, fewestMoves: fixture.session.cursor + 1 });
    fakeNow += 10000;
    app.closeDialog();
    app.settleElapsed();
    expect(app.getState().elapsedMs).toBe(14000);
    app.destroy();

    app = createApp({ storage, performance: mockPerformance });
    app.init();
    expect(app.getState().activeDialog).toBe('win');
    expect(app.getState().isPaused).toBe(false);
    app.closeDialog();
    app.undo();
    fakeNow += 3000;
    app.settleElapsed();
    expect(app.getState().elapsedMs).toBe(17000);
    app.redo();
    expect(app.getState().activeDialog).toBe(null);
    app.undo();
    app.destroy();

    app = createApp({ storage, performance: mockPerformance });
    app.init();
    expect(app.getState().isPaused).toBe(true);
    app.resume();
    app.executeCommand(fixture.command);
    expect(app.getState().isWon).toBe(true);
    expect(app.getState().activeDialog).toBe(null);
    expect(app.getState().session.statistics).toEqual(stats);
    app.destroy();
  });

  test('T015 new game saves chosen mode and deal in one envelope', () => {
    const storage = createMockStorage();
    const app = createApp({ storage }).init();
    app.newGame({ seed: 0, drawCount: 3 });
    const saved = JSON.parse(storage.getItem(STORAGE_KEY));
    expect(saved.preferences.drawCount).toBe(3);
    expect(saved.session.options).toMatchObject({ seed: 0, drawCount: 3 });
    expect(saved.statistics.draw3.attempts).toBe(0);
    app.destroy();
  });

  test('T015 unreadable saves survive temporary play and preferences until explicit replacement', () => {
    const original = '{broken save';
    const storage = createMockStorage({ [STORAGE_KEY]: original });
    const app = createApp({ storage }).init();
    expect(app.getState().activeDialog).toBe('recovery');
    app.closeDialog();
    app.executeCommand({ type: 'draw' });
    app.setDrawPreference(3);
    app.restart();
    app.save();
    expect(storage.getItem(STORAGE_KEY)).toBe(original);
    app.newGame({ seed: 0, drawCount: 3, replaceSave: true });
    expect(JSON.parse(storage.getItem(STORAGE_KEY)).session.options.seed).toBe(0);
    app.destroy();
  });

  test('T015 recovery never overwrites a different save written after startup', () => {
    const storage = createMockStorage({ [STORAGE_KEY]: '{broken' });
    const app = createApp({ storage, lockManager: null }).init();
    const foreignSave = nearWin().save;
    storage.setItem(STORAGE_KEY, foreignSave);
    app.newGame({ seed: 0, replaceSave: true });
    expect(storage.getItem(STORAGE_KEY)).toBe(foreignSave);
    expect(app.getState().hasConflict).toBe(true);
    app.destroy();
  });

  test.each(['preference', 'newGame', 'restart'])('T015 %s cannot overwrite the next remote revision', (action) => {
    const storage = createMockStorage();
    const app = createApp({ storage, lockManager: null }).init();
    app.executeCommand({ type: 'draw' });
    const foreign = JSON.parse(storage.getItem(STORAGE_KEY));
    foreign.revision += 1;
    const raw = JSON.stringify(foreign);
    storage.setItem(STORAGE_KEY, raw);
    if (action === 'preference') app.setDrawPreference(3);
    else if (action === 'newGame') app.newGame({ seed: 0, drawCount: 3 });
    else app.restart();
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(app.getState().hasConflict).toBe(true);
    app.destroy();
  });

  test('clock does not start before first legal action; starts on first legal action', () => {
    const storage = createMockStorage();
    const app = createApp({
      storage,
      performance: mockPerformance,
      initialOptions: { seed: 42, drawCount: 1 },
    });
    app.init();

    expect(app.getState().started).toBe(false);
    expect(app.getState().elapsedMs).toBe(0);

    // Advance time before starting
    fakeNow += 5000;
    app.settleElapsed();
    expect(app.getState().elapsedMs).toBe(0);

    // Execute first legal action (draw)
    const res = app.executeCommand({ type: 'draw' });
    expect(res.ok).toBe(true);
    expect(app.getState().started).toBe(true);
    expect(app.getState().moveCount).toBe(1);

    // Advance time during active play
    fakeNow += 2500;
    app.settleElapsed();
    expect(app.getState().elapsedMs).toBe(2500);

    // Undo does not rewind elapsedMs
    app.undo();
    expect(app.getState().moveCount).toBe(0);
    expect(app.getState().elapsedMs).toBe(2500);

    app.destroy();
  });

  test('clock pauses and does not accumulate time during pause, dialog, or document hidden', () => {
    const storage = createMockStorage();
    let isHidden = false;
    const mockDoc = {
      get hidden() {
        return isHidden;
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const app = createApp({
      storage,
      performance: mockPerformance,
      document: mockDoc,
      initialOptions: { seed: 42, drawCount: 1 },
    });
    app.init();

    // Start game
    app.executeCommand({ type: 'draw' });
    fakeNow += 1000;
    app.settleElapsed();
    expect(app.getState().elapsedMs).toBe(1000);

    // 1. Explicit pause
    app.pause();
    expect(app.getState().isPaused).toBe(true);
    fakeNow += 3000;
    app.settleElapsed();
    expect(app.getState().elapsedMs).toBe(1000); // no time added

    app.resume();
    expect(app.getState().isPaused).toBe(false);
    fakeNow += 2000;
    app.settleElapsed();
    expect(app.getState().elapsedMs).toBe(3000); // 2000ms added

    // 2. Dialog open
    app.openDialog('help');
    expect(app.getState().activeDialog).toBe('help');
    fakeNow += 4000;
    app.settleElapsed();
    expect(app.getState().elapsedMs).toBe(3000); // no time added

    app.closeDialog();
    expect(app.getState().activeDialog).toBe(null);
    fakeNow += 1500;
    app.settleElapsed();
    expect(app.getState().elapsedMs).toBe(4500);

    // 3. Document hidden
    isHidden = true;
    fakeNow += 5000;
    app.settleElapsed();
    expect(app.getState().elapsedMs).toBe(4500); // no time added

    isHidden = false;
    fakeNow += 1000;
    app.settleElapsed();
    expect(app.getState().elapsedMs).toBe(5500);

    app.destroy();
  });

  test('restoring an already started session starts in paused state', () => {
    const storage = createMockStorage();

    // Setup and play 1 move
    const app1 = createApp({
      storage,
      performance: mockPerformance,
      initialOptions: { seed: 42, drawCount: 1 },
    });
    app1.init();
    app1.executeCommand({ type: 'draw' });
    fakeNow += 3000;
    app1.settleElapsed();
    app1.save();
    app1.destroy();

    // Reopen in app2 (reload)
    const app2 = createApp({
      storage,
      performance: mockPerformance,
    });
    app2.init();

    const state = app2.getState();
    expect(state.started).toBe(true);
    expect(state.moveCount).toBe(1);
    expect(state.elapsedMs).toBe(3000);
    // Requirements F07 & TEST_PLAN T13: reload starts paused!
    expect(state.isPaused).toBe(true);

    // Resuming continues time from 3000ms
    app2.resume();
    expect(app2.getState().isPaused).toBe(false);
    fakeNow += 2000;
    app2.settleElapsed();
    expect(app2.getState().elapsedMs).toBe(5000);

    app2.destroy();
  });

  test('periodic 5-second checkpoint and visibilitychange/pagehide settle and save', () => {
    const storage = createMockStorage();
    let pageHideCb;
    let visibilityCb;
    let isHidden = false;

    const mockWindow = {
      addEventListener: (type, cb) => {
        if (type === 'pagehide') pageHideCb = cb;
      },
      removeEventListener: vi.fn(),
    };
    const mockDocument = {
      get hidden() {
        return isHidden;
      },
      addEventListener: (type, cb) => {
        if (type === 'visibilitychange') visibilityCb = cb;
      },
      removeEventListener: vi.fn(),
    };

    const app = createApp({
      storage,
      performance: mockPerformance,
      window: mockWindow,
      document: mockDocument,
      initialOptions: { seed: 42, drawCount: 1 },
    });
    app.init();

    app.executeCommand({ type: 'draw' });
    const setItemCallsAfterDraw = storage.setItem.mock.calls.length;

    // Advance 5 seconds to trigger checkpoint interval
    fakeNow += 5000;
    vi.advanceTimersByTime(5000);

    expect(storage.setItem.mock.calls.length).toBeGreaterThan(setItemCallsAfterDraw);
    const savedEnvelope = JSON.parse(storage.getItem(STORAGE_KEY));
    expect(savedEnvelope.session.elapsedMs).toBe(5000);

    // Advance 2 seconds and trigger pagehide
    fakeNow += 2000;
    pageHideCb();
    const savedAfterPageHide = JSON.parse(storage.getItem(STORAGE_KEY));
    expect(savedAfterPageHide.session.elapsedMs).toBe(7000);

    // Advance 1 second and trigger visibilitychange to hidden
    fakeNow += 1000;
    isHidden = true;
    visibilityCb();
    const savedAfterHidden = JSON.parse(storage.getItem(STORAGE_KEY));
    expect(savedAfterHidden.session.elapsedMs).toBe(8000);

    app.destroy();
  });

  test('Web Lock grants exclusive writer to first tab and denies second tab', async () => {
    const storage = createMockStorage();
    let lockHolder = null;

    const mockLockManager = {
      request: vi.fn(async (name, options, callback) => {
        if (name === LOCK_NAME && options.ifAvailable) {
          if (!lockHolder) {
            lockHolder = 'tab1';
            const fakeLock = { name };
            callback(fakeLock);
          } else {
            // lock already held by another tab!
            callback(null);
          }
        }
      }),
    };

    // Tab 1
    const app1 = createApp({
      storage,
      lockManager: mockLockManager,
      initialOptions: { seed: 42, drawCount: 1 },
    });
    app1.init();
    expect(app1.getState().isWriter).toBe(true);
    expect(app1.getState().hasConflict).toBe(false);
    expect(app1.getState().lockNotice).toBe(null);

    // Tab 2 opens simultaneously
    const app2 = createApp({
      storage,
      lockManager: mockLockManager,
      initialOptions: { seed: 42, drawCount: 1 },
    });
    app2.init();

    expect(app2.getState().isWriter).toBe(false);
    expect(app2.getState().hasConflict).toBe(true);
    expect(app2.getState().lockNotice).toContain('tylko do odczytu');

    // Tab 2 cannot save over Tab 1
    const saveRes = app2.save();
    expect(saveRes.ok).toBe(false);
    expect(saveRes.reason).toBe('read-only');

    app1.destroy();
    app2.destroy();
  });

  test('fallback ownership detects revision conflicts from another tab', () => {
    const storage = createMockStorage();
    let storageCb;
    const mockWindow = {
      addEventListener: (type, cb) => {
        if (type === 'storage') storageCb = cb;
      },
      removeEventListener: vi.fn(),
    };

    const app = createApp({
      storage,
      window: mockWindow,
      lockManager: null, // no Web Locks -> fallback
      initialOptions: { seed: 42, drawCount: 1 },
    });
    app.init();

    expect(app.getState().isWriter).toBe(true);

    // Another tab writes a newer revision to storage
    const foreignEnvelope = {
      schemaVersion: 1,
      revision: 99,
      session: { elapsedMs: 1000 },
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(foreignEnvelope));

    // Simulate storage event
    storageCb({
      key: STORAGE_KEY,
      newValue: JSON.stringify(foreignEnvelope),
    });

    // Local tab detects conflict and becomes read-only
    expect(app.getState().hasConflict).toBe(true);
    expect(app.getState().isWriter).toBe(false);
    expect(app.getState().lockNotice).toContain('konflikt');

    // Trying to save rejects
    const res = app.save();
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('read-only');

    app.destroy();
  });

  test('game operations: newGame, restart, preferences and save errors', () => {
    const storage = createMockStorage();
    const app = createApp({
      storage,
      initialOptions: { seed: 42, drawCount: 1 },
    });
    app.init();

    // Change draw preference
    app.setDrawPreference(3);
    expect(app.getState().preferences.drawCount).toBe(3);

    // Mark touch help seen
    app.markTouchHelpSeen();
    expect(app.getState().preferences.touchHelpSeen).toBe(true);

    // Execute draw
    app.executeCommand({ type: 'draw' });
    expect(app.getState().moveCount).toBe(1);

    // Restart resets moveCount to 0, preserves seed/mode
    app.restart();
    expect(app.getState().moveCount).toBe(0);
    expect(app.getState().session.options.seed).toBe(42);

    // New game generates fresh attempt
    app.newGame({ seed: 77, drawCount: 1 });
    expect(app.getState().session.options.seed).toBe(77);
    expect(app.getState().moveCount).toBe(0);

    // Subscription listener
    let listenerState = null;
    const unsub = app.subscribe((s) => {
      listenerState = s;
    });
    app.executeCommand({ type: 'draw' });
    expect(listenerState).toBeTruthy();
    expect(listenerState.moveCount).toBe(1);
    unsub();

    app.destroy();
  });
});
