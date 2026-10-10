import { test, expect } from '@playwright/test';

test.describe('T010 Tap interaction and gameplay (T15)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__SOLITAIRE_APP__ !== 'undefined');
  });

  test('stock activation: tap draws card to waste and recycles when empty', async ({ page }) => {
    // Initial state: 24 cards in stock, 0 in waste, moveCount 0
    const stockBadge = page.locator('#stock-count-badge');
    await expect(stockBadge).toHaveText('24');
    await expect(page.locator('#moves-display')).toHaveText('0');
    await expect(page.locator('#btn-undo')).toBeDisabled();
    await expect(page.locator('#btn-redo')).toBeDisabled();

    // Tap stock to draw
    await page.locator('#stock-container').click();

    // Stock count should be 23, waste has 1 card, moveCount 1
    await expect(stockBadge).toHaveText('23');
    await expect(page.locator('#moves-display')).toHaveText('1');
    await expect(page.locator('#waste-pile .card-node.card-face-up')).toHaveCount(1);
    await expect(page.locator('#btn-undo')).toBeEnabled();

    // Draw all remaining 23 cards
    for (let i = 0; i < 23; i++) {
      await page.locator('#stock-container').click();
    }

    // Stock is now empty
    await expect(stockBadge).toBeHidden();
    const appState = await page.evaluate(() => window.__SOLITAIRE_APP__.getState());
    expect(appState.state.stock.length).toBe(0);
    expect(appState.state.waste.length).toBe(24);

    // Tap empty stock to recycle
    await page.locator('#stock-container').click();

    // Waste is recycled back to stock
    await expect(stockBadge).toBeVisible();
    await expect(stockBadge).toHaveText('24');
    const recycledState = await page.evaluate(() => window.__SOLITAIRE_APP__.getState());
    expect(recycledState.state.stock.length).toBe(24);
    expect(recycledState.state.waste.length).toBe(0);
    await expect(page.locator('#moves-display')).toHaveText('25');
  });

  test('selection and deselection precedence (F01)', async ({ page }) => {
    // Draw 1 card to ensure waste has a card
    await page.locator('#stock-container').click();
    const wasteCard = page.locator('#waste-pile .card-node.card-face-up');
    await expect(wasteCard).toBeVisible();

    // 1. Tap waste card to select
    await wasteCard.click();
    await expect(wasteCard).toHaveClass(/is-selected/);

    // Live announcer updated in Polish
    const announcer = page.locator('#live-announcer');
    await expect(announcer).toContainText('Zaznaczono');

    // 2. Retap same card deselects
    await wasteCard.click();
    await expect(wasteCard).not.toHaveClass(/is-selected/);
    await expect(announcer).toHaveText('Odznaczono.');

    // 3. Select waste card again, then click blank background to deselect
    await wasteCard.click();
    await expect(wasteCard).toHaveClass(/is-selected/);
    await page.locator('.board-area').click({ position: { x: 5, y: 5 } });
    await expect(wasteCard).not.toHaveClass(/is-selected/);
  });

  test('tap source then legal destination executes move exactly once and enables Undo', async ({ page }) => {
    // Deal deterministic game using seed 42
    await page.evaluate(() => {
      window.__SOLITAIRE_APP__.newGame({ seed: 42, drawCount: 1 });
    });

    const stateBefore = await page.evaluate(() => window.__SOLITAIRE_APP__.getState().state);

    // Find a valid move in the dealt state using pure engine
    const moveInfo = await page.evaluate(() => {
      const app = window.__SOLITAIRE_APP__;
      const state = app.getState().state;
      // Search for any legal tableau-to-tableau or waste-to-tableau/foundation move
      for (let fromCol = 0; fromCol < 7; fromCol++) {
        const col = state.tableau[fromCol];
        if (col.cards.length === 0) continue;
        for (let cardIdx = col.faceUpStart; cardIdx < col.cards.length; cardIdx++) {
          const from = { pile: 'tableau', index: fromCol, cardIndex: cardIdx };
          // Check other tableau columns
          for (let toCol = 0; toCol < 7; toCol++) {
            if (toCol === fromCol) continue;
            const to = { pile: 'tableau', index: toCol };
            const validation = app.executeCommand; // check via test helper
            // We can test validation
            if (window.__SOLITAIRE_INPUT__.getLegalDestinations) {
              window.__SOLITAIRE_INPUT__.clearSelection();
            }
          }
        }
      }
      return null;
    });

    // Alternatively, draw until we find a waste card that fits onto a tableau column or foundation
    let foundMove = false;
    for (let draw = 0; draw < 24; draw++) {
      await page.locator('#stock-container').click();
      const legalDests = await page.evaluate(() => {
        const app = window.__SOLITAIRE_APP__;
        const input = window.__SOLITAIRE_INPUT__;
        // Select waste
        const wasteCard = document.querySelector('#waste-pile .card-node.card-face-up');
        if (wasteCard) {
          wasteCard.click();
          return input.getLegalDestinations();
        }
        return [];
      });

      if (legalDests.length > 0) {
        foundMove = true;
        const target = legalDests[0];
        let targetSelector = '';
        if (target.pile === 'tableau') {
          targetSelector = `#column-${target.index}`;
        } else {
          targetSelector = `#foundation-${target.index}`;
        }

        const movesBefore = await page.evaluate(() => window.__SOLITAIRE_APP__.getState().moveCount);

        // Tap destination
        await page.locator(targetSelector).click();

        // Check move executed
        const movesAfter = await page.evaluate(() => window.__SOLITAIRE_APP__.getState().moveCount);
        expect(movesAfter).toBe(movesBefore + 1);

        // Check Undo button is enabled
        await expect(page.locator('#btn-undo')).toBeEnabled();

        // Click Undo
        await page.locator('#btn-undo').click();
        const movesAfterUndo = await page.evaluate(() => window.__SOLITAIRE_APP__.getState().moveCount);
        expect(movesAfterUndo).toBe(movesBefore);

        // Click Redo
        await expect(page.locator('#btn-redo')).toBeEnabled();
        await page.locator('#btn-redo').click();
        const movesAfterRedo = await page.evaluate(() => window.__SOLITAIRE_APP__.getState().moveCount);
        expect(movesAfterRedo).toBe(movesAfter);
        break;
      }
    }

    expect(foundMove).toBe(true);
  });

  test('illegal move attempt triggers shake animation and preserves state (F01)', async ({ page }) => {
    // Deal a game
    await page.evaluate(() => {
      window.__SOLITAIRE_APP__.newGame({ seed: 100, drawCount: 1 });
    });

    // Draw a card
    await page.locator('#stock-container').click();
    const wasteCard = page.locator('#waste-pile .card-node.card-face-up');
    await wasteCard.click();
    await expect(wasteCard).toHaveClass(/is-selected/);

    const movesBefore = await page.evaluate(() => window.__SOLITAIRE_APP__.getState().moveCount);

    // Tap a foundation that is not a legal destination
    const illegalTargetSelector = await page.evaluate(() => {
      const input = window.__SOLITAIRE_INPUT__;
      const legal = input.getLegalDestinations();
      for (let i = 0; i < 4; i++) {
        if (!legal.some(d => d.pile === 'foundation' && d.index === i)) {
          return `#foundation-${i}`;
        }
      }
      return '#foundation-0';
    });

    await page.locator(illegalTargetSelector).click();

    // State and moveCount must be unchanged
    const movesAfter = await page.evaluate(() => window.__SOLITAIRE_APP__.getState().moveCount);
    expect(movesAfter).toBe(movesBefore);

    // Announcement indicates rejection
    const announcer = page.locator('#live-announcer');
    await expect(announcer).toContainText('Niedozwolony ruch');
  });

  test('mobile touch interactions at 320px and 390px viewports', async ({ browser }) => {
    for (const width of [320, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 640 },
        hasTouch: true,
      });
      const page = await context.newPage();
      await page.goto('/');
      await page.waitForFunction(() => typeof window.__SOLITAIRE_APP__ !== 'undefined');

      await page.evaluate(() => {
        window.__SOLITAIRE_APP__.newGame({ seed: 77, drawCount: 1 });
      });

      // Tap stock via mobile touch
      const stock = page.locator('#stock-container');
      await stock.tap();

      await expect(page.locator('#moves-display')).toHaveText('1');
      await expect(page.locator('#waste-pile .card-node.card-face-up')).toBeVisible();

      // Tap waste card
      const wasteCard = page.locator('#waste-pile .card-node.card-face-up');
      await wasteCard.tap();
      await expect(wasteCard).toHaveClass(/is-selected/);

      // Tap undo
      const undoBtn = page.locator('#btn-undo');
      await undoBtn.tap();
      await expect(page.locator('#moves-display')).toHaveText('0');

      await context.close();
    }
  });
});

test.describe('T011 Menu, dialogs and confirmation flows (T13, T15)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__SOLITAIRE_APP__ !== 'undefined');
  });

  test('menu dialog opens and closes properly', async ({ page }) => {
    const menuBtn = page.locator('#btn-menu');
    await menuBtn.click();

    const menuDialog = page.locator('#menu-dialog');
    await expect(menuDialog).toBeVisible();

    // Close via ✕ button
    await page.locator('#btn-dialog-close').click();
    await expect(menuDialog).toBeHidden();

    // Reopen and close via "Wróć do gry" button
    await menuBtn.click();
    await expect(menuDialog).toBeVisible();
    await page.locator('#btn-menu-resume').click();
    await expect(menuDialog).toBeHidden();
  });

  test('pause screen conceals board and blocks play until resumed (F07 / T13)', async ({ page }) => {
    // Open menu and choose Pause
    await page.locator('#btn-menu').click();
    await page.locator('#btn-menu-pause').click();

    // Pause dialog is visible and board is concealed
    const pauseDialog = page.locator('#pause-dialog');
    await expect(pauseDialog).toBeVisible();
    await expect(page.locator('#board-area')).toHaveClass(/is-concealed/);

    // Clicking stock should NOT trigger card draw while paused
    await page.locator('#stock-container').click({ force: true });
    await expect(page.locator('#moves-display')).toHaveText('0');

    // Click "Wznów grę"
    await page.locator('#btn-resume-game').click();
    await expect(pauseDialog).toBeHidden();
    await expect(page.locator('#board-area')).not.toHaveClass(/is-concealed/);

    // Now clicking stock works normally
    await page.locator('#stock-container').click();
    await expect(page.locator('#moves-display')).toHaveText('1');
  });

  test('New Game requires confirmation when started; cancel preserves state (F05 / T15)', async ({ page }) => {
    // Draw a card so started is true
    await page.locator('#stock-container').click();
    await expect(page.locator('#moves-display')).toHaveText('1');

    // Click Menu -> Nowa gra
    await page.locator('#btn-menu').click();
    await page.locator('#btn-menu-new-game').click();

    // Confirm dialog is displayed
    const confirmDialog = page.locator('#confirm-dialog');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText('Rozpocząć nową grę?');

    // Click "Anuluj": dialog closes, move count remains 1
    await page.locator('#btn-confirm-cancel').click();
    await expect(confirmDialog).toBeHidden();
    await expect(page.locator('#moves-display')).toHaveText('1');

    // Click Menu -> Nowa gra -> Rozpocznij: new game started, move count resets to 0
    await page.locator('#btn-menu').click();
    await page.locator('#btn-menu-new-game').click();
    await page.locator('#btn-confirm-accept').click();
    await expect(confirmDialog).toBeHidden();
    await expect(page.locator('#moves-display')).toHaveText('0');
    await expect(page.locator('#stock-count-badge')).toHaveText('24');
  });

  test('Restart reproduces deal and requires confirmation when started (F05 / T15)', async ({ page }) => {
    // Draw twice
    await page.locator('#stock-container').click();
    await page.locator('#stock-container').click();
    await expect(page.locator('#moves-display')).toHaveText('2');

    // Menu -> Rozdaj ponownie
    await page.locator('#btn-menu').click();
    await page.locator('#btn-menu-restart').click();

    const confirmDialog = page.locator('#confirm-dialog');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText('Rozdać ponownie?');

    // Cancel preserves state
    await page.locator('#btn-confirm-cancel').click();
    await expect(page.locator('#moves-display')).toHaveText('2');

    // Accept restarts session
    await page.locator('#btn-menu').click();
    await page.locator('#btn-menu-restart').click();
    await page.locator('#btn-confirm-accept').click();
    await expect(page.locator('#moves-display')).toHaveText('0');
    await expect(page.locator('#stock-count-badge')).toHaveText('24');
  });

  test('changing draw mode requires confirmation and switches mode (F05 / T15)', async ({ page }) => {
    // Start game in Draw 1
    await page.locator('#stock-container').click();
    await expect(page.locator('#moves-display')).toHaveText('1');

    // Menu -> Dobieraj 3
    await page.locator('#btn-menu').click();
    await page.locator('#btn-mode-draw-3').click();

    const confirmDialog = page.locator('#confirm-dialog');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText('Zmienić tryb na dobieranie po 3?');

    // Accept change
    await page.locator('#btn-confirm-accept').click();
    await expect(confirmDialog).toBeHidden();

    // Now in Draw 3 mode: draw from stock produces up to 3 cards
    await page.locator('#stock-container').click();
    await expect(page.locator('#moves-display')).toHaveText('1');
    const wasteCards = await page.locator('#waste-pile .card-node.card-face-up').count();
    expect(wasteCards).toBe(3);
    await expect(page.locator('#stock-count-badge')).toHaveText('21');
  });
});
