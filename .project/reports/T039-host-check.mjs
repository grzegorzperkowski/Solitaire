// Browser integration checks for the assembled Playground; isolated browser data.
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const base = process.argv[2] || 'http://localhost:5196/mygame/';
const browser = await chromium.launch();
const errors = [];

async function context(pwa = true, navigationApi = true) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx.route(/goatcounter\.com|gc\.zgo\.at/, route => route.abort());
  await ctx.addInitScript(({ pwa, navigationApi }) => {
    const match = window.matchMedia.bind(window);
    window.matchMedia = query => query === '(display-mode: standalone)'
      ? { ...match(query), matches: pwa } : match(query);
    if (!navigationApi) Object.defineProperty(window, 'navigation', { value: undefined });
  }, { pwa, navigationApi });
  ctx.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  return ctx;
}

async function game(page) {
  const frame = page.frameLocator('#playground-solitaire');
  await expect(frame.locator('#game-app')).toBeVisible();
  await page.waitForFunction(() => document.querySelector('#playground-solitaire')?.contentWindow.__SOLITAIRE_APP__?.getState().isWriter);
  const resume = frame.getByRole('button', { name: 'Wznów grę', exact: true });
  if (await resume.isVisible()) await resume.click();
  return frame;
}

async function exit(page, frame) {
  await frame.locator('[data-playground-breadcrumb]').click();
  await expect(page.locator('#playground-solitaire')).toHaveCount(0);
  await expect(page.locator('a.game-card.solitaire')).toBeFocused();
  assert.equal(new URL(page.url()).hash, '');
}

try {
  const ctx = await context();
  const page = await ctx.newPage();
  await page.goto(base);
  await page.locator('a.game-card.solitaire').click();
  let frame = await game(page);
  await expect(page).toHaveURL(/#solitaire$/);
  const historyLength = await page.evaluate(() => history.length);
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(async () => (await page.locator('#playground-solitaire').boundingBox()).width).toBe(viewport.width);
    const box = await page.locator('#playground-solitaire').boundingBox();
    assert.equal(box.x, 0); assert.equal(box.y, 0); assert.equal(box.height, viewport.height);
    await expect(frame.locator('.tableau-column')).toHaveCount(7);
    if (viewport.width < 500) {
      await expect.poll(() => frame.locator('#column-0').evaluate(el => el.getBoundingClientRect().left)).toBeLessThan(16);
      const card = await frame.locator('#column-0').boundingBox();
      assert.ok(card.width > (viewport.width === 320 ? 39 : 48));
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await frame.locator('#game-app').evaluate(() => {
    window.__SOLITAIRE_APP__.newGame({ seed: 0, drawCount: 1 });
    window.__SOLITAIRE_APP__.setDancingCompanion(true);
  });
  const from = await frame.locator('#column-0 .card-face-up').boundingBox();
  const to = await frame.locator('#foundation-1').boundingBox();
  const cdp = await ctx.newCDPSession(page);
  const touch = (x, y) => ({ x, y, id: 1 });
  const x = from.x + 2, y = from.y + from.height / 2;
  assert.ok(x < 20);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(x, y)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touch(x + 10, y)] });
  await expect(frame.locator('#drag-overlay')).toBeVisible();
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove', touchPoints: [touch(to.x + to.width / 2, to.y + to.height / 2)],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(frame.locator('#moves-display')).toHaveText('1');
  await page.evaluate(() => navigation.addEventListener('navigate', event => {
    window.__hostBack = { type: event.navigationType, user: event.userInitiated,
      cancelable: event.cancelable, prevented: event.defaultPrevented, same: event.destination.sameDocument };
  }));
  await frame.locator('#column-1 .card-face-up').tap();
  const entries = await cdp.send('Page.getNavigationHistory');
  await cdp.send('Page.navigateToHistoryEntry', { entryId: entries.entries[entries.currentIndex - 1].id });
  await expect.poll(() => page.evaluate(() => window.__hostBack?.type)).toBe('traverse');
  const browserBack = await page.evaluate(() => window.__hostBack);
  assert.equal(browserBack.user, true);
  assert.equal(browserBack.cancelable, true);
  assert.equal(browserBack.prevented, true);
  assert.equal(browserBack.same, true);
  await expect(page).toHaveURL(/#solitaire$/);
  await cdp.detach();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('pl.solitaire.pwa.save')).session.cursor), 1);
  assert.equal(await page.evaluate(() => localStorage.getItem('pl.solitaire.browser.save')), null);
  const back = await page.evaluate(async () => {
    const attempt = navigation.back();
    const results = await Promise.allSettled([attempt.committed, attempt.finished]);
    return results[1].status === 'rejected' ? results[1].reason.name : 'committed';
  });
  assert.equal(back, 'AbortError');
  await expect(page).toHaveURL(/#solitaire$/);
  await expect(frame.locator('#moves-display')).toHaveText('1');
  console.log('PASS full viewport/card widths, native Chromium edge-card drag, PWA save namespace and same-document Back cancellation');

  await page.reload();
  frame = await game(page);
  await expect(frame.locator('#moves-display')).toHaveText('1');
  assert.equal(await page.evaluate(() => history.length), historyLength);
  const reloaded = page.waitForEvent('load');
  await frame.locator('#game-app').evaluate(() => parent.postMessage({ type: 'PLAYGROUND_RELOAD' }, location.origin));
  await reloaded;
  frame = await game(page);
  await expect(frame.locator('#moves-display')).toHaveText('1');
  await page.screenshot({ path: 'test-results/screenshots/t039-host-390.png' });
  await exit(page, frame);
  await page.locator('a.game-card.solitaire').click();
  frame = await game(page);
  await expect(frame.locator('#moves-display')).toHaveText('1');
  await exit(page, frame);
  assert.equal(await page.evaluate(() => history.length), historyLength);
  console.log('PASS reload/update reload, explicit return/focus, writer release/reopen and preserved saved move');

  await expect(page.locator('#offline-status')).toHaveText('All games ready offline', { timeout: 30000 });
  await ctx.setOffline(true);
  await page.reload();
  await page.locator('a.game-card.solitaire').click();
  frame = await game(page);
  await expect(frame.locator('#moves-display')).toHaveText('1');
  await exit(page, frame);
  await ctx.setOffline(false);
  const saved = await page.evaluate(() => localStorage.getItem('pl.solitaire.pwa.save'));
  await ctx.close();
  console.log('PASS offline shell reload, game launch and saved-state restore');

  const direct = await context();
  const deep = await direct.newPage();
  await deep.goto(`${base}#solitaire`);
  await exit(deep, await game(deep));
  await direct.addInitScript(({ origin, saved }) => {
    if (location.origin === origin) localStorage.setItem('pl.solitaire.pwa.save', saved);
  }, { origin: new URL(base).origin, saved });
  await deep.goto(new URL('apps/solitaire/index.html', base).href);
  await expect(deep).toHaveURL(/\/mygame\/index\.html#solitaire$/);
  const migrated = await game(deep);
  await expect(migrated.locator('#moves-display')).toHaveText('1');
  await exit(deep, migrated);
  await direct.close();

  const fallback = await context(true, false);
  const legacy = await fallback.newPage();
  await legacy.goto(base);
  await legacy.locator('a.game-card.solitaire').click();
  await game(legacy);
  await legacy.goBack();
  await expect(legacy.locator('#playground-solitaire')).toHaveCount(0);
  await fallback.close();

  const normal = await context(false);
  const tab = await normal.newPage();
  await tab.goto(base);
  await tab.locator('a.game-card.solitaire').click();
  await expect(tab).toHaveURL(/\/apps\/solitaire\/index\.html$/);
  await expect(tab.locator('#playground-solitaire')).toHaveCount(0);
  await normal.close();
  assert.deepEqual(errors, []);
  console.log('PASS direct route/exit, legacy PWA URL migration/save, missing-API fallback, ordinary browser navigation and zero page errors');
  console.log('No physical Android/iPhone gesture result is asserted.');
} finally {
  await browser.close();
}
