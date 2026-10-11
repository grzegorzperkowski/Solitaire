import { test, expect } from '@playwright/test';

test.describe('T008 storage and tab ownership E2E', () => {
  test('persists game to storage and restores in paused state upon reload', async ({ page }) => {
    await page.goto('/');

    // Wait for app mount
    await page.waitForFunction(() => typeof window.__SOLITAIRE_APP__ !== 'undefined');

    // Execute move via controller
    const result = await page.evaluate(() => {
      const app = window.__SOLITAIRE_APP__;
      return app.executeCommand({ type: 'draw' });
    });
    expect(result.ok).toBe(true);

    // Verify storage has envelope
    const rawStored = await page.evaluate(() => localStorage.getItem('pl.solitaire.save'));
    expect(rawStored).toBeTruthy();
    const stored = JSON.parse(rawStored);
    expect(stored.session.commands.length).toBe(1);

    // Reload the page
    await page.reload();
    await page.waitForFunction(() => typeof window.__SOLITAIRE_APP__ !== 'undefined');

    // Restored state must have moveCount: 1 and start paused (F07 / T13)
    const state = await page.evaluate(() => window.__SOLITAIRE_APP__.getState());
    expect(state.moveCount).toBe(1);
    expect(state.started).toBe(true);
    expect(state.isPaused).toBe(true);
  });

  test('two tabs enforce single-writer ownership through Web Locks', async ({ context }) => {
    const page1 = await context.newPage();
    await page1.goto('/');
    await page1.waitForFunction(() => typeof window.__SOLITAIRE_APP__ !== 'undefined');

    const state1 = await page1.evaluate(() => window.__SOLITAIRE_APP__.getState());
    expect(state1.isWriter).toBe(true);
    expect(state1.hasConflict).toBe(false);

    // Open second tab in the same context
    const page2 = await context.newPage();
    await page2.goto('/');
    await page2.waitForFunction(() => typeof window.__SOLITAIRE_APP__ !== 'undefined');

    const state2 = await page2.evaluate(() => window.__SOLITAIRE_APP__.getState());
    expect(state2.isWriter).toBe(false);
    expect(state2.hasConflict).toBe(true);
    expect(state2.lockNotice).toContain('tylko do odczytu');

    await page1.close();
    await page2.close();
  });
});

test.describe('T015 safe preferences and recovery', () => {
  test('quota failure on preference change retains the prior bytes and shows warning', async ({ page }) => {
    await page.goto('/');
    await page.locator('#stock-container').click();
    const original = await page.evaluate(() => localStorage.getItem('pl.solitaire.save'));
    await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Quota', 'QuotaExceededError'); }; });
    await page.locator('#btn-menu').click();
    await page.getByRole('button', { name: 'Nowa gra', exact: true }).click();
    await page.getByLabel('Tryb nowej gry').selectOption('3');
    await page.getByRole('button', { name: 'Rozpocznij', exact: true }).click();
    await page.getByRole('button', { name: 'Rozpocznij', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Nie udało się zapisać gry' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('pl.solitaire.save'))).toBe(original);
    await page.locator('#stock-container').click();
    await expect(page.locator('#stock-count-badge')).toHaveText('21');
  });

  for (const raw of ['{broken', '{"schemaVersion":999,"revision":99}']) {
    test(`unreadable save is retained until explicit replacement: ${raw}`, async ({ page }) => {
      await page.addInitScript((raw) => localStorage.setItem('pl.solitaire.save', raw), raw);
      await page.goto('/');
      await expect(page.getByRole('dialog', { name: 'Nie można wczytać gry' })).toBeVisible();
      await page.getByRole('button', { name: 'Graj tymczasowo' }).click();
      await page.locator('#stock-container').click();
      expect(await page.evaluate(() => localStorage.getItem('pl.solitaire.save'))).toBe(raw);
      await page.locator('#btn-menu').click();
      await page.getByRole('button', { name: 'Nowa gra', exact: true }).click();
      await expect(page.getByRole('dialog')).toContainText('zastąpi');
      await page.getByText('Ustaw własny seed').click();
      await page.getByLabel('Seed (opcjonalnie)').fill('0');
      await page.getByRole('button', { name: 'Rozpocznij', exact: true }).click();
      await page.getByRole('button', { name: 'Rozpocznij', exact: true }).click();
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pl.solitaire.save')));
      expect(saved.session.options.seed).toBe(0);
      expect(saved.schemaVersion).toBe(2);
    });
  }

  test('denied localStorage getter still allows temporary play', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Denied', 'SecurityError'); } });
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Graj tymczasowo' }).click();
    await page.locator('#stock-container').click();
    await expect(page.locator('#moves-display')).toHaveText('1');
    await expect(page.locator('#notice-banner')).toContainText('niedostępna');
  });
});
