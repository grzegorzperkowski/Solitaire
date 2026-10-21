import { test, expect } from '@playwright/test';

test.describe('T010 Accessibility and keyboard navigation (T18)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__SOLITAIRE_APP__ !== 'undefined');
  });

  test('arrow keys navigate across piles and exposed cards', async ({ page }) => {
    // Focus stock container
    const stock = page.locator('#stock-container');
    await stock.focus();
    await expect(stock).toBeFocused();

    // ArrowDown moves from stock (col 0) down into Column 0
    await page.keyboard.press('ArrowDown');
    const col0Card = page.locator('#column-0 .card-node.card-face-up');
    await expect(col0Card).toBeFocused();

    // ArrowUp returns back to Stock
    await page.keyboard.press('ArrowUp');
    await expect(stock).toBeFocused();

    // ArrowRight from stock moves to Waste slot/card
    await page.keyboard.press('ArrowRight');
    const wasteSlot = page.locator('#waste-pile .pile-slot, #waste-pile .card-node').first();
    await expect(wasteSlot).toBeFocused();

    // ArrowDown into Column 1
    await page.keyboard.press('ArrowDown');
    const col1Card = page.locator('#column-1 .card-node.card-face-up');
    await expect(col1Card).toBeFocused();

    // ArrowRight into Column 2
    await page.keyboard.press('ArrowRight');
    const col2Card = page.locator('#column-2 .card-node.card-face-up');
    await expect(col2Card).toBeFocused();

    // ArrowLeft back to Column 1
    await page.keyboard.press('ArrowLeft');
    await expect(col1Card).toBeFocused();
  });

  test('Space draws card on stock, Enter selects card, Escape deselects', async ({ page }) => {
    const stock = page.locator('#stock-container');
    await stock.focus();

    // Space on stock draws
    await page.keyboard.press('Space');
    await expect(page.locator('#moves-display')).toHaveText('1');
    const announcer = page.locator('#live-announcer');
    await expect(announcer).toHaveText('Dobrano kartę ze stosu.');

    // ArrowRight to waste card
    await page.keyboard.press('ArrowRight');
    const wasteCard = page.locator('#waste-pile .card-node.card-face-up');
    await expect(wasteCard).toBeFocused();

    // Enter selects the waste card
    await page.keyboard.press('Enter');
    await expect(wasteCard).toHaveClass(/is-selected/);
    await expect(announcer).toContainText('Zaznaczono');

    // Escape clears selection
    await page.keyboard.press('Escape');
    await expect(wasteCard).not.toHaveClass(/is-selected/);
    await expect(announcer).toHaveText('Odznaczono.');
  });

  test('Ctrl+Z and Ctrl+Y shortcuts execute Undo and Redo', async ({ page }) => {
    const stock = page.locator('#stock-container');
    await stock.focus();

    // Draw twice via Space
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    await expect(page.locator('#moves-display')).toHaveText('2');

    // Ctrl+Z undoes move
    await page.keyboard.press('Control+z');
    await expect(page.locator('#moves-display')).toHaveText('1');
    await expect(page.locator('#live-announcer')).toHaveText('Cofnięto ruch.');

    // Ctrl+Y redoes move
    await page.keyboard.press('Control+y');
    await expect(page.locator('#moves-display')).toHaveText('2');
    await expect(page.locator('#live-announcer')).toHaveText('Ponowiono ruch.');
  });

  test('keyboard shortcuts ignore text input fields', async ({ page }) => {
    // Add a test text input to the DOM
    await page.evaluate(() => {
      const input = document.createElement('input');
      input.id = 'test-search-field';
      input.type = 'text';
      document.body.appendChild(input);
    });

    const inputField = page.locator('#test-search-field');
    await inputField.focus();

    // Draw first to have undoable history
    await page.evaluate(() => window.__SOLITAIRE_APP__.executeCommand({ type: 'draw' }));
    expect(await page.evaluate(() => window.__SOLITAIRE_APP__.getState().moveCount)).toBe(1);

    // Pressing Ctrl+Z inside text field must NOT trigger Solitaire Undo
    await page.keyboard.press('Control+z');
    expect(await page.evaluate(() => window.__SOLITAIRE_APP__.getState().moveCount)).toBe(1);

    // Clean up
    await page.evaluate(() => document.getElementById('test-search-field')?.remove());
  });

  test('Tab key is not trapped and leaves board naturally', async ({ page }) => {
    // Focus active button on bottom bar
    const hintBtn = page.locator('#btn-hint');
    await hintBtn.focus();
    await expect(hintBtn).toBeFocused();

    // Tab through to menu button
    await page.keyboard.press('Tab');
    await expect(page.locator('#btn-menu')).toBeFocused();

    // Next Tab leaves the game container controls
    await page.keyboard.press('Tab');
    const activeId = await page.evaluate(() => document.activeElement?.id);
    expect(activeId).not.toBe('btn-menu');
  });

  test('focus survives moves and Undo without resetting to body', async ({ page }) => {
    // Focus stock and draw via Space
    const stock = page.locator('#stock-container');
    await stock.focus();
    await page.keyboard.press('Space');

    // Focus must survive on waste card or stock, never reset to body
    const activeTagNameAfterDraw = await page.evaluate(() => document.activeElement?.tagName);
    expect(activeTagNameAfterDraw).not.toBe('BODY');

    // Click Undo
    const undoBtn = page.locator('#btn-undo');
    await undoBtn.click();

    // Focus must remain on an interactive element (e.g. #btn-undo or board)
    const activeTagNameAfterUndo = await page.evaluate(() => document.activeElement?.tagName);
    expect(activeTagNameAfterUndo).not.toBe('BODY');
  });

  test('screen reader accessibility and Polish labels comply with N01 and N02', async ({ page }) => {
    // Buttons have clear Polish labels
    await expect(page.locator('#btn-undo')).toHaveText('Cofnij');
    await expect(page.locator('#btn-redo')).toHaveText('Ponów');
    await expect(page.locator('#btn-hint')).toHaveText('Podpowiedź');
    await expect(page.locator('#btn-menu')).toHaveText('Menu');

    // Hidden cards are completely absent of card identity in DOM text / attributes
    const hiddenCards = await page.locator('.card-node.card-back').all();
    expect(hiddenCards.length).toBeGreaterThan(0);
    for (const hc of hiddenCards) {
      await expect(hc).toHaveAttribute('aria-label', 'Karta zakryta');
      const text = await hc.textContent();
      expect(text.trim()).toBe('');
      const dataset = await hc.evaluate(el => ({ ...el.dataset }));
      expect(dataset.cardId).toBeUndefined();
      expect(dataset.rank).toBeUndefined();
      expect(dataset.suit).toBeUndefined();
    }
  });

  test('focus is trapped within dialog and restored to trigger on close (N01 / T18)', async ({ page }) => {
    const menuBtn = page.locator('#btn-menu');
    await menuBtn.focus();
    await expect(menuBtn).toBeFocused();

    // Open menu with Enter
    await page.keyboard.press('Enter');
    const menuDialog = page.locator('#menu-dialog');
    await expect(menuDialog).toBeVisible();

    // Verify focus is inside menu dialog
    await expect(menuDialog.locator('button').first()).toBeFocused();

    // Escape closes dialog and restores focus to #btn-menu
    await page.keyboard.press('Escape');
    await expect(menuDialog).toBeHidden();
    await expect(menuBtn).toBeFocused();
  });

  test('Help dialog displays complete Polish rules and explanations (N02)', async ({ page }) => {
    // Open menu then Help
    await page.locator('#btn-menu').click();
    await page.locator('#btn-menu-help').click();

    const helpDialog = page.locator('#help-dialog');
    await expect(helpDialog).toBeVisible();
    await expect(helpDialog.locator('#dialog-title-help')).toHaveText('Zasady gry i pomoc');

    // Verify key sections are present
    await expect(helpDialog).toContainText('Cel gry');
    await expect(helpDialog).toContainText('Kolumny robocze');
    await expect(helpDialog).toContainText('Sekwencje');
    await expect(helpDialog).toContainText('Stos i skrawek');
    await expect(helpDialog).toContainText('Sterowanie dotykiem');
    await expect(helpDialog).toContainText('Sterowanie klawiaturą');

    // Close via Zamknij button
    await page.locator('#btn-help-close').click();
    await expect(helpDialog).toBeHidden();
  });

  test('buttons and playable cards suppress mobile double-tap zoom while allowing pinch zoom', async ({ browser }) => {
    const context = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.goto('/');
    for (const button of await page.locator('button').all()) {
      await expect(button).toHaveCSS('touch-action', 'manipulation');
    }
    await expect(page.locator('.card-node.card-face-up').first()).toHaveCSS('touch-action', 'manipulation');
    await page.locator('#btn-menu').click();

    await expect(page.locator('#btn-menu-help')).toHaveCSS('touch-action', 'manipulation');

    await context.close();
  });

  test('dialogs are usable at 320px width and landscape 568x320 without overflow (U06 / T19)', async ({ page }) => {
    // Test narrow portrait 320px
    await page.setViewportSize({ width: 320, height: 568 });
    await page.locator('#btn-menu').click();
    const menuDialog = page.locator('#menu-dialog');
    await expect(menuDialog).toBeVisible();

    const box = await menuDialog.boundingBox();
    expect(box.width).toBeLessThanOrEqual(320);
    expect(box.x).toBeGreaterThanOrEqual(0);

    // Verify buttons are at least 44px high
    const actionBtns = await menuDialog.locator('.menu-action-btn:visible, .mode-btn:visible, .btn-primary:visible').all();
    for (const btn of actionBtns) {
      const btnBox = await btn.boundingBox();
      expect(btnBox.height).toBeGreaterThanOrEqual(44);
    }
    await page.locator('#btn-dialog-close').click();

    // Test landscape 568x320
    await page.setViewportSize({ width: 568, height: 320 });
    await page.locator('#btn-menu').click();
    await expect(menuDialog).toBeVisible();

    const landscapeBox = await menuDialog.boundingBox();
    expect(landscapeBox.height).toBeLessThanOrEqual(320);
    await page.locator('#btn-dialog-close').click();
  });
});
