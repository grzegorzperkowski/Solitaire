import { test, expect } from '@playwright/test';

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
