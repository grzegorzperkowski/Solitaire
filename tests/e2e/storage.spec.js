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
