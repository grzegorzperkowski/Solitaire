import { test, expect } from '@playwright/test';
import { foundationPreparation, revealAfterPreparation } from '../fixtures/progress.js';

async function load(page, id, suffix = '') {
  await page.goto(`http://localhost:5186/tests/harness/progress.html?fx=${id}${suffix}`);
  await page.waitForFunction(() => window.fixtureApp);
}
const notice = (page) => page.locator('#progress-notice');

test('E2E01 no legal actions has a specific accessible notice', async ({ page }) => {
  await load(page, 1);
  await expect(notice(page)).toHaveText('Brak dostępnych ruchów.');
  await expect(notice(page)).toHaveAttribute('role', 'status');
});
test('E2E02 neutral king transfer keeps the no-progress notice and remains playable at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await load(page, 2);
  await expect(notice(page)).toHaveText('Brak ruchów prowadzących do dalszego postępu.');
  await page.locator('#column-0 .card-face-up').click();
  await page.locator('#column-1').click();
  await expect(page.locator('#moves-display')).toHaveText('1');
  await expect(notice(page)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('E2E03 foundation preparation has reachable progress', async ({ page }) => {
  await load(page, 3);
  await page.waitForFunction(() => window.fixtureApp.getState().progress.status === 'PROGRESS_FOUND');
  await expect(notice(page)).toBeHidden();
  await page.evaluate((move) => window.fixtureApp.executeCommand(move), foundationPreparation);
  await page.evaluate((move) => window.fixtureApp.executeCommand(move), revealAfterPreparation);
  expect(await page.evaluate(() => window.fixtureApp.getState().state.tableau[1].faceUpStart)).toBe(0);
});
test('E2E04 direct foundation hint', async ({ page }) => {
  await load(page, 4);
  await page.locator('#btn-hint').click();
  expect(await page.evaluate(() => window.fixtureInput.getHint().to.pile)).toBe('foundation');
  await expect(notice(page)).toBeHidden();
});
test('E2E05 waste-to-tableau is progress', async ({ page }) => {
  await load(page, 5);
  await page.waitForFunction(() => window.fixtureApp.getState().progress.status === 'PROGRESS_FOUND');
  await page.locator('#waste-pile .card-face-up').click();
  await page.locator('#column-0 .card-face-up').click();
  await expect(page.locator('#moves-display')).toHaveText('1');
  await expect(notice(page)).toBeHidden();
});
test('E2E06 unknown draw is information; only after seeing it can the cycle be proved', async ({ page }) => {
  await load(page, 6);
  await page.waitForFunction(() => window.fixtureApp.getState().progress.status === 'PROGRESS_FOUND');
  await expect(notice(page)).toBeHidden();
  await page.locator('#stock-container').click();
  await expect(notice(page)).toBeVisible();
});
for (const draw of [1, 3]) {
  test(`E2E07/12 known draw/recycle cycles in Draw ${draw}`, async ({ page }) => {
    await load(page, 7, `&draw=${draw}`);
    await expect(notice(page)).toBeVisible();
    for (let i = 0; i < 6; i++) {
      await page.locator('#stock-container').click();
      await expect(notice(page)).toHaveText('Brak ruchów prowadzących do dalszego postępu.');
    }
  });
}
test('E2E08 UNKNOWN does not warn', async ({ page }) => {
  await load(page, 2, '&limit=1');
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.fixtureApp.getState().progress.status)).toBe('UNKNOWN');
  await expect(notice(page)).toBeHidden();
});
test('E2E09 Undo/Redo recomputes reveal position', async ({ page }) => {
  await load(page, 3);
  await page.evaluate((move) => window.fixtureApp.executeCommand(move), foundationPreparation);
  await page.evaluate((move) => window.fixtureApp.executeCommand(move), revealAfterPreparation);
  await page.locator('#btn-undo').click();
  await page.waitForFunction(() => window.fixtureApp.getState().progress.status === 'PROGRESS_FOUND');
  await expect(notice(page)).toBeHidden();
  await page.locator('#btn-redo').click();
  expect(await page.evaluate(() => window.fixtureApp.getState().state.tableau[1].faceUpStart)).toBe(0);
});
test('E2E10 replacing board during pending analysis discards old result', async ({ page }) => {
  await load(page, 2);
  await page.evaluate(() => {
    window.fixtureApp.executeCommand({ type: 'move', from: { pile: 'tableau', index: 0, cardIndex: 0 }, to: { pile: 'tableau', index: 1 } });
    window.fixtureApp.newGame({ seed: 42 });
  });
  await page.waitForFunction(() => window.fixtureApp.getState().progress.status === 'PROGRESS_FOUND');
  await expect(notice(page)).toBeHidden();
});
test('E2E11 production save restores known cards after Undo', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__SOLITAIRE_APP__?.getState().isWriter);
  const known = await page.evaluate(() => {
    const app = window.__SOLITAIRE_APP__;
    app.newGame({ seed: 42, drawCount: 3 });
    app.executeCommand({ type: 'draw' });
    app.undo();
    return app.getState().session.knownCards;
  });
  await page.reload();
  await page.waitForFunction(() => window.__SOLITAIRE_APP__);
  expect(await page.evaluate(() => window.__SOLITAIRE_APP__.getState().session.knownCards)).toEqual(known);
  await expect(notice(page)).toBeHidden();
});
test('E2E13 won takes precedence over missing progress', async ({ page }) => {
  await load(page, 10);
  expect(await page.evaluate(() => window.fixtureApp.getState().progress.status)).toBe('WON');
  await expect(notice(page)).toBeHidden();
});
