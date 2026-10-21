import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const save = readFileSync(new URL('../fixtures/completion-save.json', import.meta.url), 'utf8');

async function loadPosition(page) {
  await page.addInitScript(bytes => localStorage.setItem('pl.solitaire.save', bytes), save);
  await page.goto('/');
  await page.waitForFunction(() => window.__SOLITAIRE_APP__?.getState().isWriter);
  await page.evaluate(() => window.__SOLITAIRE_APP__.resume());
}

for (const reducedMotion of ['no-preference', 'reduce']) {
  test(`T016 real save completes with ${reducedMotion}`, async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.emulateMedia({ reducedMotion });
    await page.setViewportSize({ width: 320, height: 740 });
    await loadPosition(page);
    await expect(page.locator('#completion-message')).toContainText('15');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.cache/T016-offer-320-${reducedMotion}.png` });
    await page.locator('#btn-complete').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#btn-hint')).toBeDisabled();
    await expect(page.locator('#btn-redo')).toBeDisabled();
    await expect.poll(() => page.evaluate(() => window.__SOLITAIRE_APP__.getState().isWon)).toBe(true);
    await expect(page.locator('#moves-display')).toHaveText('141');
    const state = await page.evaluate(() => {
      const app = window.__SOLITAIRE_APP__; app.finishVictoryAnimation();
      return app.getState();
    });
    expect(state.session.statistics.draw1.wins).toBe(2);
    expect(state.activeDialog).toBe('win');
    expect(state.state.foundations.map(p => p.length)).toEqual([13,13,13,13]);
    await page.evaluate(() => { const app = window.__SOLITAIRE_APP__; app.closeDialog(); app.undo(); });
    await expect(page.locator('#completion-message')).toContainText('1');
    expect(errors).toEqual([]);
  });
}

test('T016 travel uses fast animation and Undo stops remaining commands', async ({ page }) => {
  await loadPosition(page);
  await page.evaluate(() => {
    window.__completionAnimations = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function(frames, options) {
      if (options.duration === 140) window.__completionAnimations.push({ frames, options });
      return animate.call(this, frames, options);
    };
  });
  await page.locator('#btn-complete').click();
  await expect.poll(() => page.evaluate(() => window.__completionAnimations.length)).toBeGreaterThan(0);
  await page.screenshot({ path: '.cache/T016-travel.png' });
  await page.keyboard.press('Control+z');
  const cursor = await page.evaluate(() => window.__SOLITAIRE_APP__.getState().session.cursor);
  expect(cursor).toBeLessThan(141);
  await expect.poll(() => page.evaluate(() => window.__SOLITAIRE_APP__.getState().isCompleting)).toBe(false);
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.__SOLITAIRE_APP__.getState().session.cursor)).toBe(cursor);
});

test('T016 reduced motion omits travel; pause stops and resume only offers', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await loadPosition(page);
  await page.evaluate(() => {
    window.__travelCount = 0;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function(frames, options) {
      if (options.duration === 140) window.__travelCount++;
      return animate.call(this, frames, options);
    };
    window.__SOLITAIRE_APP__.startCompletion();
  });
  await expect.poll(() => page.evaluate(() => window.__SOLITAIRE_APP__.getState().session.cursor)).toBeGreaterThan(126);
  await page.evaluate(() => window.__SOLITAIRE_APP__.pause());
  const cursor = await page.evaluate(() => window.__SOLITAIRE_APP__.getState().session.cursor);
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.__SOLITAIRE_APP__.getState().session.cursor)).toBe(cursor);
  expect(await page.evaluate(() => window.__travelCount)).toBe(0);
  await page.evaluate(() => window.__SOLITAIRE_APP__.resume());
  await expect(page.locator('#btn-complete')).toBeEnabled();
});

test('T016 no offer for an ordinary deal', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#btn-complete')).toBeHidden();
});
