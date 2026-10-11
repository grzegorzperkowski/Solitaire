import { test, expect } from '@playwright/test';

for (const touch of [false, true]) {
  test(`recommended destination wins over the default shortcut (${touch ? 'double tap' : 'double click'})`, async ({ browser }) => {
    const context = await browser.newContext({ hasTouch: touch, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    try {
      await page.goto('http://localhost:5186/');
      await page.waitForFunction(() => window.__SOLITAIRE_APP__);
      await page.evaluate(() => window.__SOLITAIRE_APP__.newGame({ seed: 22, drawCount: 1 }));
      await page.locator('#btn-hint').click();
      await expect(page.locator('#hint-notice')).toBeVisible();
      const move = await page.evaluate(() => window.__SOLITAIRE_INPUT__.getHint());
      expect(move).toEqual({ type: 'move', from: { pile: 'tableau', index: 3, cardIndex: 3 }, to: { pile: 'foundation', index: 2 } });
      const card = page.locator('#column-3 .card-node').nth(3);
      const cardId = await card.getAttribute('data-card-id');
      if (touch) {
        await card.tap();
        await card.tap();
      } else {
        await card.dblclick();
      }
      await expect(page.locator('#moves-display')).toHaveText('1');
      await expect(page.locator(`#foundation-2 [data-card-id="${cardId}"]`)).toHaveCount(1);
      await expect(page.locator('#hint-notice')).toBeHidden();
      await expect(page.locator('.is-hint')).toHaveCount(0);
      await page.locator('#btn-undo').click();
      await expect(page.locator('#moves-display')).toHaveText('0');
      await expect(page.locator(`#column-3 [data-card-id="${cardId}"]`)).toHaveCount(1);
      // Undo invalidates the recommendation: the ordinary shortcut applies again.
      if (touch) {
        await card.tap();
        await card.tap();
        await expect(page.locator('#moves-display')).toHaveText('1');
        await expect(page.locator(`#column-5 [data-card-id="${cardId}"]`)).toHaveCount(1);
      } else {
        await card.dblclick();
        await expect(page.locator('#moves-display')).toHaveText('0');
      }
    } finally {
      await context.close();
    }
  });
}

test.describe('SmartHint v1 — E2E Acceptance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5186/');
    await page.waitForFunction(() => window.__SOLITAIRE_APP__);
  });

  test('hint button highlights initial move cards and displays non-modal hint notice', async ({ page }) => {
    await page.evaluate(() => window.__SOLITAIRE_APP__.newGame({ seed: 42, drawCount: 1 }));

    // Click hint button
    await page.locator('#btn-hint').click();

    // Check hint highlights
    await expect(page.locator('.is-hint')).toHaveCount(2);

    // Check nonmodal hint notice banner
    const notice = page.locator('#hint-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('pozwala odsłonić kartę');

    // Check live announcer announcement
    const announcer = page.locator('#live-announcer');
    await expect(announcer).toContainText('odsłonić kartę');
  });

  test('hint notice and highlights are responsive at 320px viewport without horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.evaluate(() => window.__SOLITAIRE_APP__.newGame({ seed: 42, drawCount: 1 }));

    await page.locator('#btn-hint').click();
    await expect(page.locator('#hint-notice')).toBeVisible();

    // Check no horizontal scrollbar
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(hasHorizontalOverflow).toBe(false);
  });

  test('executing a move clears the hint notice and highlights', async ({ page }) => {
    await page.evaluate(() => window.__SOLITAIRE_APP__.newGame({ seed: 42, drawCount: 1 }));
    await page.locator('#btn-hint').click();
    await expect(page.locator('#hint-notice')).toBeVisible();
    await expect(page.locator('.is-hint')).toHaveCount(2);

    // Draw card
    await page.locator('#stock-container').click();

    // Notice and highlights must be cleared
    await expect(page.locator('#hint-notice')).toBeHidden();
    await expect(page.locator('.is-hint')).toHaveCount(0);
  });

  test('keyboard interaction: space/enter on #btn-hint triggers hint', async ({ page }) => {
    await page.evaluate(() => window.__SOLITAIRE_APP__.newGame({ seed: 42, drawCount: 1 }));
    const btnHint = page.locator('#btn-hint');
    await btnHint.focus();
    await page.keyboard.press('Enter');

    await expect(page.locator('#hint-notice')).toBeVisible();
    await expect(page.locator('.is-hint')).toHaveCount(2);
  });
});
