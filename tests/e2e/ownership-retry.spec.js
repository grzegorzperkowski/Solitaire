import { test, expect } from '@playwright/test';

for (const trigger of ['menu', 'focus', 'visibility']) {
  test(`ownership retry via ${trigger} restores the latest save before writing`, async ({ context }) => {
    const writer = await context.newPage();
    const reader = await context.newPage();
    // Control foreground triggers so closing the writer cannot race the tested action.
    await reader.addInitScript(() => {
      window.addEventListener('focus', e => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);
      document.addEventListener('visibilitychange', e => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);
    });
    try {
      await writer.goto('/');
      await writer.waitForFunction(() => window.__SOLITAIRE_APP__?.getState().isWriter);
      await writer.evaluate(() => window.__SOLITAIRE_APP__.executeCommand({ type: 'draw' }));
      await reader.goto('/');
      await reader.waitForFunction(() => window.__SOLITAIRE_APP__?.getState().hasConflict);
      await reader.locator('#btn-pause-menu').click();
      await reader.getByRole('button', { name: 'Ponów dostęp do zapisu' }).click({ timeout: 1500 });
      expect(await reader.evaluate(() => window.__SOLITAIRE_APP__.getState().isWriter)).toBe(false);
      await writer.evaluate(() => {
        window.__SOLITAIRE_APP__.executeCommand({ type: 'draw' });
        window.__SOLITAIRE_APP__.setDancingCompanion(true);
      });
      await writer.close();
      const reload = reader.waitForEvent('load');
      if (trigger === 'menu') await reader.getByRole('button', { name: 'Ponów dostęp do zapisu' }).click();
      else await reader.evaluate(type => {
        if (type === 'focus') window.dispatchEvent(new Event('focus'));
        else document.dispatchEvent(new Event('visibilitychange'));
      }, trigger);
      await reload;
      await reader.waitForFunction(() => window.__SOLITAIRE_APP__?.getState().isWriter);
      expect(await reader.evaluate(() => {
        const app = window.__SOLITAIRE_APP__;
        const s = app.getState();
        app.resume();
        const result = app.executeCommand({ type: 'draw' });
        return { moves: s.moveCount, companion: s.preferences.dancingCompanion, paused: s.isPaused,
          savedMoves: JSON.parse(localStorage.getItem('pl.solitaire.browser.save')).session.cursor, ok: result.ok };
      })).toEqual({ moves: 2, companion: true, paused: true, savedMoves: 3, ok: true });
    } finally {
      if (!writer.isClosed()) await writer.close();
      await reader.close();
    }
  });
}
