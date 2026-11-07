import { test, expect } from '@playwright/test';

test.describe('T039 First-column card gestures', () => {
  test.use({ viewport: { width: 320, height: 568 }, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await page.goto('./');
    await page.waitForFunction(() => window.__SOLITAIRE_APP__?.getState().isWriter);
  });

  test('contains horizontal browser overscroll on the document', async ({ page }) => {
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorX)).toBe('none');
  });

  test('native Chromium taps on the first column select and double tap moves exactly once', async ({ page }) => {
    await page.evaluate(() => window.__SOLITAIRE_APP__.newGame({ seed: 0, drawCount: 1 }));
    const card = page.locator('#column-0 .card-face-up');
    const box = await card.boundingBox();
    const x = box.x + 2;
    const y = box.y + box.height / 2;
    expect(x).toBeLessThanOrEqual(20);
    await page.touchscreen.tap(x, y);
    await expect(card).toHaveClass(/is-selected/);
    await expect(page.locator('#moves-display')).toHaveText('0');
    await page.touchscreen.tap(x, y);
    await expect(page.locator('#moves-display')).toHaveText('1');
    await expect(page.locator('#foundation-1 .card-face-up')).toBeVisible();
  });

  test('native Chromium drag from the first column commits once and stays on the game page', async ({ page }) => {
    const gameUrl = page.url();
    await page.evaluate(() => window.__SOLITAIRE_APP__.newGame({ seed: 0, drawCount: 1 }));
    const source = await page.locator('#column-0 .card-face-up').boundingBox();
    const target = await page.locator('#foundation-1').boundingBox();
    const cdp = await page.context().newCDPSession(page);
    const touch = (x, y) => ({ x, y, id: 1 });
    const x = source.x + 2;
    const y = source.y + source.height / 2;
    expect(x).toBeLessThanOrEqual(20);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(x, y)] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touch(x + 12, y)] });
    await expect(page.locator('#drag-overlay')).toBeVisible();
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [touch(target.x + target.width / 2, target.y + target.height / 2)],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('#moves-display')).toHaveText('1');
    await expect(page.locator('#foundation-1 .card-face-up')).toBeVisible();
    await expect(page.locator('#drag-overlay')).toHaveCount(0);
    await expect(page).toHaveURL(gameUrl);
    await cdp.detach();
  });

  test('a first-column selection allows an immediate destination tap', async ({ page }) => {
    await page.evaluate(() => window.__SOLITAIRE_APP__.newGame({ seed: 0, drawCount: 1 }));
    const source = await page.locator('#column-0 .card-face-up').boundingBox();
    const target = await page.locator('#foundation-1').boundingBox();
    await page.touchscreen.tap(source.x + 2, source.y + source.height / 2);
    await page.touchscreen.tap(target.x + target.width / 2, target.y + target.height / 2);
    await expect(page.locator('#moves-display')).toHaveText('1');
    await expect(page.locator('#foundation-1 .card-face-up')).toBeVisible();
  });

  test('a second finger cancels a card gesture without making a move', async ({ page }) => {
    await page.evaluate(() => window.__SOLITAIRE_APP__.newGame({ seed: 0, drawCount: 1 }));
    const source = await page.locator('#column-0 .card-face-up').boundingBox();
    const target = await page.locator('#foundation-1').boundingBox();
    const cdp = await page.context().newCDPSession(page);
    const first = { x: source.x + 2, y: source.y + source.height / 2, id: 1 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart', touchPoints: [first, { x: 160, y: first.y, id: 2 }],
    });
    await expect.poll(() => page.evaluate(() => window.__SOLITAIRE_INPUT__.getActiveGesture())).toBeNull();
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: target.x + target.width / 2, y: target.y + target.height / 2, id: 1 }],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('#moves-display')).toHaveText('0');
    await expect(page.locator('#drag-overlay')).toHaveCount(0);
    await cdp.detach();
  });
});
