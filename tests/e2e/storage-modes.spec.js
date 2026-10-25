import { test, expect } from '@playwright/test';

function standaloneMode() {
  const matchMedia = window.matchMedia.bind(window);
  window.matchMedia = query => query === '(display-mode: standalone)'
    ? { ...matchMedia(query), matches: true }
    : matchMedia(query);
}

test('PWA and browser keep independent ownership, saves and preferences', async ({ context }) => {
  const browser = await context.newPage();
  const pwa = await context.newPage();
  await pwa.addInitScript(standaloneMode);
  try {
    await browser.goto('/');
    await browser.waitForFunction(() => window.__SOLITAIRE_APP__?.getState().isWriter);
    await browser.evaluate(() => {
      window.__SOLITAIRE_APP__.executeCommand({ type: 'draw' });
      window.__SOLITAIRE_APP__.setDancingCompanion(true);
    });
    await pwa.goto('/');
    await pwa.waitForFunction(() => {
      const s = window.__SOLITAIRE_APP__?.getState();
      return s?.isWriter || s?.hasConflict;
    });
    const initial = await pwa.evaluate(() => {
      const s = window.__SOLITAIRE_APP__.getState();
      return { writer: s.isWriter, moves: s.moveCount, companion: s.preferences.dancingCompanion };
    });
    expect(initial).toEqual({ writer: true, moves: 0, companion: false });
    await pwa.evaluate(() => {
      window.__SOLITAIRE_APP__.executeCommand({ type: 'draw' });
      window.__SOLITAIRE_APP__.executeCommand({ type: 'draw' });
    });
    await expect.poll(() => browser.evaluate(() => {
      const s = window.__SOLITAIRE_APP__.getState();
      return { writer: s.isWriter, moves: s.moveCount, companion: s.preferences.dancingCompanion };
    })).toEqual({ writer: true, moves: 1, companion: true });
    await expect.poll(() => browser.evaluate(() => ({
      browser: JSON.parse(localStorage.getItem('pl.solitaire.browser.save'))?.session.cursor,
      pwa: JSON.parse(localStorage.getItem('pl.solitaire.pwa.save'))?.session.cursor,
    }))).toEqual({ browser: 1, pwa: 2 });
    for (const [page, moves, companion] of [[browser, 1, true], [pwa, 2, false]]) {
      await page.reload();
      await page.waitForFunction(() => window.__SOLITAIRE_APP__?.getState().isWriter);
      expect(await page.evaluate(() => {
        const s = window.__SOLITAIRE_APP__.getState();
        return { moves: s.moveCount, companion: s.preferences.dancingCompanion };
      })).toEqual({ moves, companion });
    }
    const duplicate = await context.newPage();
    try {
      await duplicate.addInitScript(standaloneMode);
      await duplicate.goto('/');
      await duplicate.waitForFunction(() => window.__SOLITAIRE_APP__?.getState().hasConflict);
      expect(await duplicate.evaluate(() => window.__SOLITAIRE_APP__.executeCommand({ type: 'draw' })))
        .toMatchObject({ ok: false, reason: 'read-only' });
    } finally {
      await duplicate.close();
    }
  } finally {
    await browser.close();
    await pwa.close();
  }
});

for (const mode of ['browser', 'pwa']) {
  test(`${mode} ignores legacy saves without modifying them`, async ({ page }) => {
    if (mode === 'pwa') await page.addInitScript(standaloneMode);
    await page.addInitScript(() => localStorage.setItem('pl.solitaire.save', '{legacy'));
    await page.goto('/');
    await page.waitForFunction(() => window.__SOLITAIRE_APP__?.getState().isWriter);
    expect(await page.evaluate(() => {
      const s = window.__SOLITAIRE_APP__.getState();
      window.__SOLITAIRE_APP__.executeCommand({ type: 'draw' });
      return { moves: s.moveCount, blocked: s.persistenceBlocked, legacy: localStorage.getItem('pl.solitaire.save') };
    })).toEqual({ moves: 0, blocked: false, legacy: '{legacy' });
  });
}
