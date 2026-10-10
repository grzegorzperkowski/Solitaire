import { test, expect } from '@playwright/test';

test.describe('T009 Responsive board and SVG cards layout', () => {
  const viewports = [
    { name: 'narrow-portrait-320', width: 320, height: 568 },
    { name: 'android-small-360', width: 360, height: 640 },
    { name: 'iphone-se-375', width: 375, height: 667 },
    { name: 'iphone-standard-390', width: 390, height: 844 },
    { name: 'iphone-pro-max-430', width: 430, height: 932 },
    { name: 'desktop-1440', width: 1440, height: 900 },
    { name: 'landscape-568x320', width: 568, height: 320 },
    { name: 'landscape-844x390', width: 844, height: 390 },
  ];

  for (const vp of viewports) {
    test(`fits 7 columns without horizontal scroll at ${vp.width}x${vp.height} (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForFunction(() => typeof window.__SOLITAIRE_APP__ !== 'undefined');

      // 1. Verify no horizontal overflow (scrollWidth <= clientWidth + 1px)
      const hasHorizontalScroll = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth > root.clientWidth + 1;
      });
      expect(hasHorizontalScroll).toBe(false);

      // 2. Verify all 7 columns are present and visible within viewport
      const columns = await page.locator('.tableau-column').all();
      expect(columns.length).toBe(7);

      for (let i = 0; i < 7; i++) {
        const col = columns[i];
        const box = await col.boundingBox();
        expect(box).toBeTruthy();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
      }

      // 3. Verify stock, waste, and 4 foundations are rendered
      await expect(page.locator('#stock-container')).toBeVisible();
      await expect(page.locator('#waste-container')).toBeVisible();
      await expect(page.locator('#foundations-container')).toBeVisible();
      const foundations = await page.locator('.foundation-pile').all();
      expect(foundations.length).toBe(4);

      // 4. Verify primary bottom controls meet minimum 44x44 CSS px
      const controlButtons = ['#btn-undo', '#btn-redo', '#btn-hint', '#btn-menu'];
      for (const selector of controlButtons) {
        const btn = page.locator(selector);
        await expect(btn).toBeVisible();
        const box = await btn.boundingBox();
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }

      // Capture screenshots for visual inspection at key viewports
      if ([320, 375, 390, 1440].includes(vp.width)) {
        await page.screenshot({ path: `test-results/screenshots/layout-${vp.width}.png` });
      }
    });
  }

  test('typography and card band constraints meet REQUIREMENTS U03', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__SOLITAIRE_APP__ !== 'undefined');

    // Corner ranks must have computed font-size >= 14px
    const rankFontSize = await page.evaluate(() => {
      const rankEl = document.querySelector('.card-rank');
      if (!rankEl) return 0;
      return parseFloat(window.getComputedStyle(rankEl).fontSize);
    });
    expect(rankFontSize).toBeGreaterThanOrEqual(14);

    // Exposed card band must be at least 24 CSS px
    const faceUpOverlap = await page.evaluate(() => {
      const container = document.querySelector('#game-container');
      const val = window.getComputedStyle(container).getPropertyValue('--face-up-overlap');
      return parseFloat(val);
    });
    expect(faceUpOverlap).toBeGreaterThanOrEqual(24);
  });

  test('waste fan never covers foundation piles in Draw 3 mode', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__SOLITAIRE_APP__ !== 'undefined');

    // Switch to Draw 3 and draw several cards to fan
    await page.evaluate(() => {
      const app = window.__SOLITAIRE_APP__;
      app.setDrawPreference(3);
      app.newGame({ seed: 42, drawCount: 3 });
      app.executeCommand({ type: 'draw' });
      app.executeCommand({ type: 'draw' });
    });

    const wasteBox = await page.locator('#waste-pile').boundingBox();
    const foundation0Box = await page.locator('#foundation-0').boundingBox();

    expect(wasteBox).toBeTruthy();
    expect(foundation0Box).toBeTruthy();
    // Waste area right bound must strictly precede foundation 0 left bound
    expect(wasteBox.x + wasteBox.width).toBeLessThanOrEqual(foundation0Box.x + 1);
  });

  test('hidden face-down cards strictly conceal card identity (N02)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__SOLITAIRE_APP__ !== 'undefined');

    // Inspect all face-down card nodes
    const backCards = await page.locator('.card-node.card-back').all();
    expect(backCards.length).toBeGreaterThan(0);

    for (const card of backCards) {
      const html = await card.innerHTML();
      const label = await card.getAttribute('aria-label');
      const dataset = await card.evaluate((el) => ({ ...el.dataset }));

      expect(label).toBe('Karta zakryta');
      expect(dataset.cardId).toBeUndefined();
      expect(dataset.rank).toBeUndefined();
      expect(dataset.suit).toBeUndefined();

      // No suit names or rank labels in HTML markup
      expect(html).not.toMatch(/suit-(kier|karo|pik|trefl)/);
      expect(html).not.toMatch(/card-rank/);
    }
  });

  test('long tableau column is reachable and triggers scroll controls', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__SOLITAIRE_APP__ !== 'undefined');

    // Inject long column fixture into column 0 (6 hidden + 13 visible cards = 19 cards)
    await page.evaluate(() => {
      const app = window.__SOLITAIRE_APP__;
      const baseState = app.getState();
      const longCards = [
        0, 1, 2, 3, 4, 5, // 6 hidden
        6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, // 13 visible
      ];
      const newTableau = baseState.state.tableau.map((col, idx) =>
        idx === 0 ? { cards: longCards, faceUpStart: 6 } : col
      );
      const modifiedState = {
        ...baseState,
        state: {
          ...baseState.state,
          tableau: newTableau,
        },
      };
      window.__SOLITAIRE_RENDER__(document.getElementById('game-app'), modifiedState);
    });

    // Check that scroll controls appear when overflowing
    const scrollControls = page.locator('#tableau-scroll-controls');
    await expect(scrollControls).toHaveClass(/is-overflowing/);

    // Scroll to bottom and ensure the bottom card is visible and reachable
    const scroller = page.locator('#tableau-scroller');
    await scroller.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });

    const col0Cards = await page.locator('#column-0 .card-node').all();
    expect(col0Cards.length).toBe(19);
    const bottomCard = col0Cards[18];
    const isBottomVisible = await bottomCard.isVisible();
    expect(isBottomVisible).toBe(true);
  });
});
