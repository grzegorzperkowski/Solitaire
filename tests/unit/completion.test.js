import { afterEach, describe, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { getCompletionPlan } from '../../src/engine/hints.js';
import { applyMove, assertInvariants, isWon } from '../../src/engine/game.js';
import { restoreSession, STORAGE_KEY } from '../../src/persistence.js';
import { createApp } from '../../src/app.js';
import { nearWin } from '../fixtures/wins.js';
import { formatSmartHintMessage } from '../../src/ui/smart-hints.js';
import { makeState, pile, card } from '../fixtures/boards.js';

const save = readFileSync(new URL('../fixtures/completion-save.json', import.meta.url), 'utf8');
const board = () => restoreSession(save).session.state;
let app;
afterEach(() => { app?.destroy(); app = null; vi.useRealTimers(); });
function setup() {
  vi.useFakeTimers();
  const bytes = new Map([[STORAGE_KEY, save]]);
  const storage = { getItem: k => bytes.get(k) ?? null, setItem: (k, v) => bytes.set(k, v) };
  const document = new EventTarget(); document.hidden = false;
  const window = new EventTarget();
  app = createApp({ storage, lockManager: null, document, window }).init();
  app.resume();
  return { storage, document, window };
}

describe('T016 completion preflight', () => {
  test('real cursor-126 save wins in 15 legal foundation moves without mutation', () => {
    const initial = board(); const before = JSON.stringify(initial);
    const plan = getCompletionPlan(initial);
    expect(plan).toHaveLength(15);
    let state = initial;
    for (const command of plan) {
      expect(command.to.pile).toBe('foundation');
      const result = applyMove(state, command); expect(result.ok).toBe(true);
      state = result.state; assertInvariants(state);
    }
    expect(isWon(state)).toBe(true); expect(JSON.stringify(initial)).toBe(before);
    expect(getCompletionPlan(state)).toBeNull();
  });
  test.each([1, 3])('empty-waste completion in Draw %i uses the same legal commands', drawCount => {
    const initial = nearWin(drawCount).session.state;
    const plan = getCompletionPlan(initial);
    expect(plan).toHaveLength(1);
    expect(isWon(applyMove(initial, plan[0]).state)).toBe(true);
  });
  test('a winning hint explicitly says the sequence ends the game', () => {
    const state = board();
    expect(formatSmartHintMessage(state, { status: 'FOUND', plan: getCompletionPlan(state), completesGame: true })).toContain('Ta sekwencja kończy grę');
  });
  test('rejects stock, hidden tableau and an all-visible foundation deadlock', () => {
    const initial = board();
    expect(getCompletionPlan({ ...initial, stock: [initial.waste[0]], waste: [] })).toBeNull();
    expect(getCompletionPlan({ ...initial, tableau: initial.tableau.map((c, i) => i === 1 ? { ...c, faceUpStart: 1 } : c) })).toBeNull();
    const foundations = Array.from({ length: 4 }, (_, s) => Array.from({ length: 11 }, (_, r) => card(s, r + 1)));
    expect(getCompletionPlan(makeState({ foundations, stock: [], waste: [11, 12], tableau: [pile([24]), pile([25]), pile([37]), pile([38]), pile([50]), pile([51])] }))).toBeNull();
  });
});

describe('T016 scheduled session commands', () => {
  test('completes, persists every move, and Undo/Redo/reload award once', () => {
    const { storage } = setup();
    const wins = app.getState().session.statistics.draw1.wins;
    expect(app.getState().completionPlan).toHaveLength(15);
    expect(app.startCompletion()).toBe(true);
    expect(app.startCompletion()).toBe(false);
    expect(app.executeCommand({ type: 'recycle' })).toMatchObject({ ok: false, reason: 'completion-running' });
    vi.advanceTimersByTime(0);
    for (let cursor = 127; cursor <= 141; cursor++) {
      expect(restoreSession(storage.getItem(STORAGE_KEY)).session.cursor).toBe(cursor);
      vi.advanceTimersByTime(160);
    }
    expect(app.getState()).toMatchObject({ isWon: true, isCompleting: false, moveCount: 141 });
    expect(restoreSession(storage.getItem(STORAGE_KEY)).session.state).toEqual(app.getState().state);
    expect(app.getState().session.statistics.draw1.wins).toBe(wins + 1);
    app.finishVictoryAnimation(); app.closeDialog(); app.undo();
    expect(app.getState().isWon).toBe(false); app.redo();
    expect(app.getState().session.statistics.draw1.wins).toBe(wins + 1);
    app.destroy(); app = createApp({ storage, lockManager: null }).init();
    expect(app.getState().session.statistics.draw1.wins).toBe(wins + 1);
    expect(app.getState().isCompleting).toBe(false);
  });
  test.each(['undo', 'pause', 'dialog', 'hide', 'pagehide', 'conflict', 'destroy', 'restart', 'newGame'])('%s stops at the last committed move', action => {
    const { document, window } = setup();
    app.startCompletion(); vi.advanceTimersByTime(170);
    expect(app.getState().session.cursor).toBe(128);
    if (action === 'hide') { document.hidden = true; document.dispatchEvent(new Event('visibilitychange')); }
    else if (action === 'pagehide') window.dispatchEvent(new Event('pagehide'));
    else if (action === 'conflict') {
      const event = new Event('storage'); event.key = STORAGE_KEY; event.newValue = JSON.stringify({ revision: 999999 }); window.dispatchEvent(event);
    } else if (action === 'dialog') app.openDialog('menu');
    else app[action]();
    const stopped = app.getState().session.cursor;
    vi.advanceTimersByTime(3000);
    expect(app.getState().session.cursor).toBe(stopped);
    expect(app.getState().isCompleting).toBe(false);
    if (action === 'undo') expect(stopped).toBe(127);
  });
  test('does not start paused, hidden, in a dialog, read-only, or with no plan', () => {
    const { document, window } = setup();
    app.pause(); expect(app.startCompletion()).toBe(false); app.resume();
    app.openDialog('menu'); expect(app.startCompletion()).toBe(false); app.closeDialog();
    document.hidden = true; expect(app.startCompletion()).toBe(false); document.hidden = false;
    app.newGame({ seed: 42 }); expect(app.startCompletion()).toBe(false);
    const event = new Event('storage'); event.key = STORAGE_KEY; event.newValue = JSON.stringify({ revision: 999999 }); window.dispatchEvent(event);
    expect(app.startCompletion()).toBe(false);
  });
  test('a failed write retains the prior save and shows the existing recovery warning', () => {
    const { storage } = setup();
    const before = storage.getItem(STORAGE_KEY);
    storage.setItem = () => { throw new Error('disk unavailable'); };
    app.startCompletion(); vi.advanceTimersByTime(170);
    expect(app.getState().session.cursor).toBe(128);
    expect(app.getState().saveError).toBeTruthy();
    expect(storage.getItem(STORAGE_KEY)).toBe(before);
    app.pause();
  });
});
