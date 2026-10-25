import { test, expect } from '@playwright/test';

for (const reducedMotion of ['no-preference', 'reduce']) {
  test(`T036 success effects respect ${reducedMotion} at 320px`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto('http://localhost:5186/');
    await page.waitForFunction(() => window.__SOLITAIRE_APP__?.getState().isWriter);
    const result = await page.evaluate(async () => {
      const { renderGame } = await import('/src/ui/render.js');
      const { makeState, pile } = await import('/tests/fixtures/boards.js');
      const { createSession, execute, undo, redo } = await import('/src/session.js');
      const root = document.createElement('div');
      document.querySelector('#game-app').remove();
      document.body.append(root);
      const base = window.__SOLITAIRE_APP__.getState();
      const draw = session => renderGame(root, { ...base, session, state: session.state, moveCount: session.cursor,
        activeDialog: null, isPaused: false, completionPlan: null });
      const board = makeState({ tableau: [pile([5, 0], 1)], waste: [3, 2, 1] });
      let session = { ...createSession({ seed: 0, drawCount: 1 }), state: board, snapshots: [board] };
      draw(session);
      const command = { type: 'move', from: { pile: 'tableau', index: 0, cardIndex: 1 }, to: { pile: 'foundation', index: 0 } };
      session = execute(session, command).session;
      draw(session);
      const effects = () => [...root.querySelectorAll('[class*="success-"]')].map(el => ({
        kind: el.className, animation: getComputedStyle(el).animationName,
        duration: getComputedStyle(el).animationDuration, level: el.style.getPropertyValue('--success-level'),
      }));
      const revealAce = effects();
      const card = root.querySelector('#column-0 .card-node');
      card.focus();
      draw(session);
      const focusPreserved = document.activeElement === card;
      session = undo(session); draw(session);
      const undoCount = effects().length;
      session = redo(session); draw(session);
      const redoCount = effects().length;
      const levels = [];
      for (let i = 0; i < 3; i++) {
        session = execute(session, { ...command, from: { pile: 'waste' } }).session;
        draw(session);
        levels.push(effects().find(el => el.kind.includes('success-streak'))?.level ?? null);
      }
      const emptyBoard = makeState({ tableau: [pile([0])] });
      session = { ...createSession({ seed: 0, drawCount: 1 }), state: emptyBoard, snapshots: [emptyBoard] };
      draw(session);
      session = execute(session, { ...command, from: { pile: 'tableau', index: 0, cardIndex: 0 } }).session;
      draw(session);
      const empty = effects();
      for (const animation of root.getAnimations({ subtree: true })) {
        animation.pause(); animation.currentTime = 72;
      }
      const overflow = document.documentElement.scrollWidth > innerWidth;
      return { revealAce, focusPreserved, undoCount, redoCount, levels, empty, overflow };
    });
    expect(result.focusPreserved).toBe(true);
    expect(result.undoCount).toBe(0);
    expect(result.redoCount).toBe(0);
    expect(result.overflow).toBe(false);
    if (reducedMotion === 'reduce') {
      expect(result.revealAce).toEqual([]);
      expect(result.empty).toEqual([]);
      expect(result.levels).toEqual([null, null, null]);
    } else {
      expect(result.revealAce.map(el => el.animation)).toEqual(['success-pulse', 'success-glow']);
      expect(result.revealAce.every(el => el.duration === '0.18s')).toBe(true);
      expect(result.levels).toEqual(['2', '3', '4']);
      expect(result.empty.some(el => el.kind.includes('success-empty'))).toBe(true);
      await page.screenshot({ path: '.cache/T036-320.png' });
    }
  });
}
