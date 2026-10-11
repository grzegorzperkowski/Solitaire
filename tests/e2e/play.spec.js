import { test, expect } from '@playwright/test';
import { rankHints } from '../../src/engine/hints.js';
import { nearWin } from '../fixtures/wins.js';
import { CLUBS, DIAMONDS, HEARTS, SPADES, card, makeState, pile } from '../fixtures/boards.js';

function blockedBoard() {
  const foundations = Array.from({ length: 4 }, (_, suit) => Array.from({ length: 9 }, (__, rank) => card(suit, rank + 1)));
  return makeState({
    tableau: [
      pile([card(HEARTS, 10), card(HEARTS, 12), card(CLUBS, 13)], 2),
      pile([card(CLUBS, 10), card(CLUBS, 12), card(DIAMONDS, 13)], 2),
      pile([card(DIAMONDS, 10), card(DIAMONDS, 12), card(SPADES, 13)], 2),
      pile([card(SPADES, 10), card(SPADES, 12), card(HEARTS, 13)], 2),
      pile([card(CLUBS, 11), card(DIAMONDS, 11)], 1),
      pile([card(HEARTS, 11)]),
      pile([card(SPADES, 11)]),
    ],
    foundations,
    stock: [],
  });
}

test.describe('T014 deterministic legal hints (T20)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__SOLITAIRE_APP__ !== 'undefined');
  });

  test('cycles legal hints, resets after a board change and does not change game state', async ({ page }) => {
    await page.evaluate(() => window.__SOLITAIRE_APP__.newGame({ seed: 42, drawCount: 1 }));
    const before = await page.evaluate(() => window.__SOLITAIRE_APP__.getState().state);
    const expected = rankHints(before);
    const moveCountBefore = await page.locator('#moves-display').textContent();

    await page.locator('#btn-hint').click();
    await expect(page.locator('#live-announcer')).toContainText('Podpowiedź:');
    const first = await page.evaluate(() => window.__SOLITAIRE_INPUT__.getHint());
    await expect(page.locator('.is-hint')).toHaveCount(2);
    await page.locator('#btn-hint').click();
    const second = await page.evaluate(() => window.__SOLITAIRE_INPUT__.getHint());

    expect(first).toEqual(expected[0]);
    expect(second).toEqual(expected[1]);
    for (let i = 2; i < expected.length; i++) await page.locator('#btn-hint').click();
    await page.locator('#btn-hint').click();
    expect(await page.evaluate(() => window.__SOLITAIRE_INPUT__.getHint())).toEqual(expected[0]);
    expect(await page.locator('#moves-display').textContent()).toBe(moveCountBefore);
    expect(await page.evaluate(() => window.__SOLITAIRE_APP__.getState().state)).toEqual(before);

    await page.evaluate(() => window.__SOLITAIRE_APP__.executeCommand({ type: 'draw' }));
    const afterDraw = await page.evaluate(() => window.__SOLITAIRE_APP__.getState().state);
    await page.locator('#btn-hint').click();
    expect(await page.evaluate(() => window.__SOLITAIRE_INPUT__.getHint())).toEqual(rankHints(afterDraw)[0]);
  });

  test('announces the exact empty-action message without a loss claim', async ({ page }) => {
    const message = await page.evaluate(async (state) => {
      const app = window.__SOLITAIRE_APP__;
      const getState = app.getState;
      app.getState = () => ({ ...getState(), state });
      try {
        document.querySelector('#btn-hint').click();
        await new Promise((resolve) => setTimeout(resolve, 60));
        return document.querySelector('#live-announcer').textContent;
      } finally {
        app.getState = getState;
      }
    }, blockedBoard());

    expect(message).toBe('Brak dostępnych ruchów. Możesz rozpocząć nową grę.');
    expect(message).not.toMatch(/przegran|niewygrywaln/i);
  });
});

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
    await expect(page.locator(illegalTargetSelector)).toHaveClass(/shake-animation/);
    await expect(page.locator(illegalTargetSelector)).toHaveCSS('animation-duration', '0.15s');

    // State and moveCount must be unchanged
    const movesAfter = await page.evaluate(() => window.__SOLITAIRE_APP__.getState().moveCount);
    expect(movesAfter).toBe(movesBefore);

    // Announcement indicates rejection
    const announcer = page.locator('#live-announcer');
    await expect(announcer).toContainText('Niedozwolony ruch');
  });

  test('committed draws animate the changed pile, and reduced motion removes card motion', async ({ page }) => {
    await page.waitForFunction(() => typeof window.__SOLITAIRE_APP__ !== 'undefined');
    await page.evaluate(() => {
      window.__SOLITAIRE_APP__.newGame({ seed: 42, drawCount: 1 });
      window.__SOLITAIRE_APP__.executeCommand({ type: 'draw' });
    });
    const movedCard = page.locator('#waste-pile .move-feedback');
    await expect(movedCard).toHaveCount(1);
    await expect(movedCard).toHaveCSS('animation-name', 'pile-arrival');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(movedCard).toHaveCSS('animation-name', 'none');
    await page.locator('#waste-pile .card-node').click();
    await expect(page.locator('#waste-pile .is-selected')).toHaveCSS('transition-duration', '0s');
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

  test('double tap moves to the first legal destination and repeats from the updated pile', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__SOLITAIRE_APP__ !== 'undefined');
    await page.evaluate(() => window.__SOLITAIRE_APP__.newGame({ seed: 2, drawCount: 1 }));

    const firstCard = page.locator('#column-1 .card-node.card-face-up');
    const firstId = await firstCard.getAttribute('data-card-id');
    await firstCard.tap();
    await expect.poll(() => page.evaluate(() => window.__SOLITAIRE_INPUT__.getLegalDestinations()))
      .toEqual([{ pile: 'tableau', index: 0 }, { pile: 'tableau', index: 5 }]);
    await firstCard.tap();
    await expect(page.locator('#moves-display')).toHaveText('1');
    expect(await page.locator(`#column-0 [data-card-id="${firstId}"]`).count()).toBe(1);

    const movedCard = page.locator(`#column-0 [data-card-id="${firstId}"]`);
    await movedCard.tap();
    await expect.poll(() => page.evaluate(() => window.__SOLITAIRE_INPUT__.getLegalDestinations()))
      .toEqual([{ pile: 'tableau', index: 5 }]);
    await movedCard.tap();
    await expect(page.locator('#moves-display')).toHaveText('2');
    expect(await page.locator(`#column-5 [data-card-id="${firstId}"]`).count()).toBe(1);

    await context.close();
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
    // Pause through the app API; the menu no longer exposes a pause button.
    await page.locator('#btn-menu').click();
    await expect(page.getByRole('button', { name: 'Wstrzymaj grę' })).toHaveCount(0);
    await page.evaluate(() => {
      window.__SOLITAIRE_APP__.closeDialog();
      window.__SOLITAIRE_APP__.pause();
    });

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
    await page.getByRole('button', { name: 'Rozpocznij', exact: true }).click();
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
    await page.getByRole('button', { name: 'Rozpocznij', exact: true }).click();
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

  test('statistics mode buttons filter results without changing the game mode', async ({ page }) => {
    const before = await page.evaluate(() => window.__SOLITAIRE_APP__.getState());
    await page.locator('#btn-menu').click();
    await page.locator('#btn-menu-statistics').click();
    await expect(page.getByRole('region', { name: 'Dobieraj 1' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Dobieraj 3' })).toBeHidden();
    await page.locator('#btn-mode-draw-3').click();
    await expect(page.getByRole('region', { name: 'Dobieraj 1' })).toBeHidden();
    await expect(page.getByRole('region', { name: 'Dobieraj 3' })).toBeVisible();
    await expect(page.locator('#btn-mode-draw-3')).toHaveAttribute('aria-checked', 'true');
    const after = await page.evaluate(() => window.__SOLITAIRE_APP__.getState());
    expect(after.preferences.drawCount).toBe(before.preferences.drawCount);
    expect(after.session).toEqual(before.session);
    await page.locator('#btn-dialog-close').click();
    await page.locator('#stock-container').click();
    await expect(page.locator('#moves-display')).toHaveText('1');
    await expect(page.locator('#waste-pile .card-node.card-face-up')).toHaveCount(1);
  });
});

test.describe('T015 seed, statistics and results', () => {
  async function openNewGame(page) {
    await page.getByRole('button', { name: 'Otwórz menu gry' }).click();
    await page.getByRole('button', { name: 'Nowa gra', exact: true }).click();
  }

  test('decimal seed validation, input retention and exact deal reproduction', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await openNewGame(page);
    const seed = page.getByLabel('Seed (opcjonalnie)');
    const start = page.getByRole('button', { name: 'Rozpocznij', exact: true });
    await expect(seed).toBeHidden();
    await page.getByText('Ustaw własny seed').click();
    await expect(seed).toBeVisible();
    for (const value of ['-1', '1.5', '1e3', '0x10', '+1', '4294967296', 'abc', ' 42 ']) {
      await seed.fill(value);
      await start.click();
      await expect(page.getByRole('alert')).toContainText('0–4294967295');
      await expect(page.getByRole('dialog', { name: 'Nowa gra', exact: true })).toBeVisible();
    }
    await seed.fill('4294967295');
    await page.clock.runFor(2100);
    await expect(seed).toHaveValue('4294967295');
    await expect(seed).toBeFocused();
    await page.keyboard.press('Control+z');
    expect(await page.evaluate(() => window.__SOLITAIRE_APP__.getState().moveCount)).toBe(0);
    await seed.fill('4294967295');
    await page.getByLabel('Tryb nowej gry').selectOption('3');
    await start.click();
    const first = await page.evaluate(() => window.__SOLITAIRE_APP__.getState().state);
    expect(first.seed).toBe(4294967295);
    expect(first.drawCount).toBe(3);
    await openNewGame(page);
    await expect(page.getByLabel('Tryb nowej gry')).toHaveValue('3');
    await page.getByText('Ustaw własny seed').click();
    await seed.fill('4294967295');
    await start.click();
    expect(await page.evaluate(() => window.__SOLITAIRE_APP__.getState().state)).toEqual(first);
    await openNewGame(page);
    await page.getByText('Ustaw własny seed').click();
    await seed.fill('0');
    await start.click();
    expect(await page.evaluate(() => window.__SOLITAIRE_APP__.getState().state.seed)).toBe(0);
  });

  test('replacement cancel preserves history/time; accept retains entered seed and mode', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await page.locator('#stock-container').click();
    await page.clock.runFor(2000);
    await openNewGame(page);
    const before = await page.evaluate(() => window.__SOLITAIRE_APP__.getState().session);
    await expect(page.getByLabel('Seed (opcjonalnie)')).toBeHidden();
    await page.getByText('Ustaw własny seed').click();
    await page.getByLabel('Seed (opcjonalnie)').fill('123');
    await page.getByLabel('Tryb nowej gry').selectOption('3');
    await page.getByRole('button', { name: 'Rozpocznij', exact: true }).click();
    await page.clock.runFor(5000);
    await page.getByRole('button', { name: 'Anuluj', exact: true }).click();
    const after = await page.evaluate(() => window.__SOLITAIRE_APP__.getState().session);
    expect(after).toEqual(before);
    await openNewGame(page);
    await page.getByText('Ustaw własny seed').click();
    await page.getByLabel('Seed (opcjonalnie)').fill('123');
    await page.getByLabel('Tryb nowej gry').selectOption('3');
    await page.getByRole('button', { name: 'Rozpocznij', exact: true }).click();
    await page.getByRole('button', { name: 'Rozpocznij', exact: true }).click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pl.solitaire.save')));
    expect(saved.session.options).toMatchObject({ seed: 123, drawCount: 3 });
    expect(saved.preferences.drawCount).toBe(3);
    expect(saved.session.cursor).toBe(0);
    expect(saved.statistics.draw1.attempts).toBe(1);
    expect(saved.statistics.draw3.attempts).toBe(0);
  });

  test('seed details and copy action are hidden from the game menu', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Otwórz menu gry' }).click();
    await expect(page.getByText('Seed rozdania')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Kopiuj seed' })).toHaveCount(0);
  });

  for (const drawCount of [1, 3]) {
    test(`first win, saved result, Undo and practice in Draw ${drawCount}`, async ({ page }) => {
      const fixture = nearWin(drawCount);
      await page.addInitScript((save) => {
        if (!localStorage.getItem('pl.solitaire.save')) localStorage.setItem('pl.solitaire.save', save);
      }, fixture.save);
      await page.clock.install();
      await page.goto('/');
      await page.getByRole('button', { name: 'Wznów grę' }).click();
      const move = fixture.command;
      const source = move.from.pile === 'waste' ? '#waste-pile .is-playable' : `#column-${move.from.index} .card-node:last-child`;
      await page.locator(source).click();
      await page.locator(`#foundation-${move.to.index}`).click();
      await expect(page.getByRole('dialog', { name: 'Wygrana!' })).toBeVisible();
      await expect(page.locator('#win-dialog')).toHaveCSS('animation-name', 'win-arrival');
      await expect(page.locator('#win-dialog')).toContainText(`Liczba ruchów: ${fixture.session.cursor + 1}`);
      const stats = await page.evaluate(() => window.__SOLITAIRE_APP__.getState().session.statistics);
      expect(stats[`draw${drawCount}`].wins).toBe(1);
      const time = await page.locator('#timer-display').textContent();
      await page.clock.runFor(3000);
      await expect(page.locator('#timer-display')).toHaveText(time);
      await page.reload();
      await expect(page.getByRole('dialog', { name: 'Wygrana!' })).toBeVisible();
      await page.getByRole('button', { name: 'Oglądaj planszę' }).click();
      await page.getByRole('button', { name: 'Cofnij ostatni ruch' }).click();
      await page.clock.runFor(2000);
      await page.reload();
      await page.getByRole('button', { name: 'Wznów grę' }).click();
      await page.locator(source).click();
      await page.locator(`#foundation-${move.to.index}`).click();
      await expect(page.getByRole('dialog')).toBeHidden();
      await expect(page.locator('#practice-status')).toContainText('ćwiczeniowy');
      expect(await page.evaluate(() => window.__SOLITAIRE_APP__.getState().session.statistics)).toEqual(stats);
      await page.getByRole('button', { name: 'Otwórz menu gry' }).click();
      await page.getByRole('button', { name: 'Statystyki', exact: true }).click();
      const mode = page.getByRole('region', { name: `Dobieraj ${drawCount}`, exact: true });
      await expect(mode).toContainText('Wygrane1');
      await expect(mode).toContainText('Wygrane procentowo100%');
      const otherMode = drawCount === 1 ? 3 : 1;
      const otherStats = page.getByRole('region', { name: `Dobieraj ${otherMode}`, exact: true });
      await expect(otherStats).toBeHidden();
      await page.locator(`#btn-mode-draw-${otherMode}`).click();
      await expect(otherStats).toContainText('Wygrane procentowo0%');
    });
  }
});

test('T015 seed form keeps keyboard focus and blocks game shortcuts while open', async ({ page }) => {
  await page.goto('/');
  await page.locator('#stock-container').click();
  await page.locator('#btn-menu').click();
  await page.getByRole('button', { name: 'Nowa gra', exact: true }).click();
  const seed = page.getByLabel('Seed (opcjonalnie)');
  await expect(seed).toBeHidden();
  await page.getByText('Ustaw własny seed').click();
  await expect(page.getByText('Ustaw własny seed')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByLabel('Tryb nowej gry')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByText('Ustaw własny seed')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(seed).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Anuluj', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Rozpocznij', exact: true })).toBeFocused();
  await page.keyboard.press('Control+z');
  await expect(page.locator('#moves-display')).toHaveText('1');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('#btn-menu')).toBeFocused();
});

for (const viewport of [{ width: 320, height: 640 }, { width: 568, height: 320 }]) {
  test(`T015 new dialogs fit ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.goto('/');
    for (const name of ['Nowa gra', 'Statystyki']) {
      await page.locator('#btn-menu').click();
      await page.getByRole('button', { name, exact: true }).click();
      const dialog = page.getByRole('dialog');
      if (name === 'Nowa gra') {
        await expect(page.getByLabel('Seed (opcjonalnie)')).toBeHidden();
        await page.getByText('Ustaw własny seed').click();
        await expect(page.getByLabel('Seed (opcjonalnie)')).toBeVisible();
        await page.getByText('Ustaw własny seed').click();
      }
      const box = await dialog.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${name === 'Nowa gra' ? 'seed' : 'stats'}.png`) });
      await page.getByRole('button', { name: name === 'Nowa gra' ? 'Anuluj' : 'Zamknij', exact: true }).click();
    }
    expect(errors).toEqual([]);
  });
}
