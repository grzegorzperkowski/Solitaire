import { test, expect } from '@playwright/test';
import { nearWin } from '../fixtures/wins.js';

async function enableCompanion(page) {
  await page.getByRole('button', { name: 'Otwórz menu gry' }).click();
  const toggle = page.getByRole('checkbox', { name: 'Tańczący ludzik' });
  await toggle.check();
  await expect(toggle).toBeFocused();
  await page.getByRole('button', { name: 'Wróć do gry' }).click();
}

test('T035 native touch can scroll short landscape to the bottom controls', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 568, height: 320 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await page.goto('http://localhost:5173/');
    await enableCompanion(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    const cdp = await context.newCDPSession(page);
    const point = y => ({ x: 10, y, id: 1 });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(280)] });
    for (let y = 260; y >= 100; y -= 20) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(y)] });
      await page.evaluate(() => new Promise(requestAnimationFrame));
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Otwórz menu gry' }).tap();
    await expect(page.getByRole('checkbox', { name: 'Tańczący ludzik' })).toBeVisible();
    await cdp.detach();
  } finally { await context.close(); }
});

test('T035 dancing allows a legal drag; switching the mode cancels an active gesture', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await enableCompanion(page);
  await page.evaluate(() => window.__SOLITAIRE_APP__.newGame({ seed: 42, drawCount: 1 }));
  const source = await page.locator('#column-3 .card-face-up').boundingBox();
  const target = await page.locator('#foundation-0').boundingBox();
  const beginDrag = async () => {
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(source.x + source.width / 2 + 12, source.y + source.height / 2 + 12);
    await expect(page.locator('#drag-overlay')).toBeVisible();
  };
  await beginDrag();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
  await page.mouse.up();
  await expect(page.locator('#moves-display')).toHaveText('1');
  await expect(page.locator('#dancing-companion')).toHaveAttribute('data-running', 'true');
  await page.evaluate(() => window.__SOLITAIRE_APP__.undo());
  await beginDrag();
  await page.evaluate(() => window.__SOLITAIRE_APP__.setDancingCompanion(false));
  await expect(page.locator('#drag-overlay')).toHaveCount(0);
  await page.mouse.up();
  await expect(page.locator('#moves-display')).toHaveText('0');
});

test('T035 a read-only tab cannot change the setting or animate the companion', async ({ context }) => {
  const writer = await context.newPage();
  await writer.goto('/');
  await enableCompanion(writer);
  const reader = await context.newPage();
  await reader.goto('/');
  await expect(reader.locator('#dancing-companion')).toHaveAttribute('data-running', 'false');
  await reader.getByRole('button', { name: 'Otwórz menu gry' }).click();
  await expect(reader.getByRole('checkbox', { name: 'Tańczący ludzik' })).toBeDisabled();
  await expect(reader.getByRole('checkbox', { name: 'Tańczący ludzik' })).toBeChecked();
  const before = await reader.evaluate(() => localStorage.getItem('pl.solitaire.save'));
  await reader.evaluate(() => window.__SOLITAIRE_APP__.setDancingCompanion(false));
  expect(await reader.evaluate(() => localStorage.getItem('pl.solitaire.save'))).toBe(before);
});

test('T035 opt-in survives reload, preserves the board, and respects pause/media/teardown', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const host = page.locator('#dancing-companion');
  await expect(host).toBeHidden();
  const before = await page.evaluate(() => {
    const s = window.__SOLITAIRE_APP__.getState();
    window.companionCard = document.querySelector('#column-0 .card-node');
    return { state: s.state, commands: s.session.commands, statistics: s.session.statistics };
  });
  await enableCompanion(page);
  await expect(host).toHaveAttribute('data-running', 'true');
  expect(await page.evaluate(() => {
    const s = window.__SOLITAIRE_APP__.getState();
    return { state: s.state, commands: s.session.commands, statistics: s.session.statistics };
  })).toEqual(before);
  const back = host.locator('[data-part="back"]');
  const first = await back.getAttribute('d');
  await expect.poll(() => back.getAttribute('d')).not.toBe(first);
  expect(await page.evaluate(() => document.querySelector('#column-0 .card-node') === window.companionCard)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(host).toHaveAttribute('data-running', 'false');
  const staticPath = await back.getAttribute('d');
  await page.waitForTimeout(120);
  await expect(back).toHaveAttribute('d', staticPath);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(host).toHaveAttribute('data-running', 'true');
  await page.evaluate(() => window.__SOLITAIRE_APP__.pause());
  await expect(host).toHaveAttribute('data-running', 'false');
  await page.getByRole('button', { name: 'Wznów grę', exact: true }).click();
  await expect(host).toHaveAttribute('data-running', 'true');
  await page.reload();
  await expect(host).toHaveAttribute('data-running', 'true');
  await page.getByRole('button', { name: 'Otwórz menu gry' }).click();
  const toggle = page.getByRole('checkbox', { name: 'Tańczący ludzik' });
  await expect(toggle).toBeChecked();
  await toggle.focus();
  await page.keyboard.press('Space');
  await expect(toggle).not.toBeChecked();
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Wróć do gry' }).click();
  await page.evaluate(() => window.__SOLITAIRE_APP__.destroy());
  await expect(host.locator('svg')).toHaveCount(0);
  await expect(host).toHaveAttribute('data-running', 'false');
  expect(errors).toEqual([]);
});

for (const viewport of [
  { width: 320, height: 568 }, { width: 360, height: 640 }, { width: 390, height: 844 },
  { width: 430, height: 932 }, { width: 568, height: 320 }, { width: 844, height: 390 },
  { width: 1280, height: 720 },
]) {
  test(`T035 companion and long columns remain reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await enableCompanion(page);
    const layout = await page.evaluate(() => {
      const box = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
      const grid = document.querySelector('#tableau-grid');
      grid.style.minHeight = '1200px';
      return { stage: box('#dancing-companion'), scroller: box('#tableau-scroller'), footer: box('.bottom-bar'),
        columns: [...document.querySelectorAll('.tableau-column')].map(el => el.getBoundingClientRect().toJSON()),
        overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    expect(layout.overflow).toBe(false);
    expect(layout.stage.y).toBeGreaterThanOrEqual(layout.scroller.bottom - 1);
    expect(layout.footer.y).toBeGreaterThanOrEqual(layout.stage.bottom);
    expect(layout.stage.height).toBe(viewport.height <= 500 && viewport.width > viewport.height ? 56 : 88);
    for (const col of layout.columns) {
      expect(col.x).toBeGreaterThanOrEqual(0);
      expect(col.right).toBeLessThanOrEqual(viewport.width + 1);
    }
    await expect(page.locator('#tableau-scroll-controls')).toHaveClass(/is-overflowing/);
    const oldScroll = await page.locator('#tableau-scroller').evaluate(el => el.scrollTop);
    await page.getByRole('button', { name: 'Przewiń w dół kolumny' }).click();
    await expect.poll(() => page.locator('#tableau-scroller').evaluate(el => el.scrollTop)).toBeGreaterThan(oldScroll);
    await page.getByRole('button', { name: 'Otwórz menu gry' }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Otwórz menu gry' }).click();
    await expect(page.getByRole('checkbox', { name: 'Tańczący ludzik' })).toBeVisible();
    await page.getByRole('button', { name: 'Wróć do gry' }).click();
    if (viewport.width === 320 || viewport.width === 1280) {
      await page.screenshot({ path: `test-results/screenshots/companion-${viewport.width}.png`, fullPage: true });
    }
  });
}

test('T035 reduced motion starts static, pagehide/show resumes, wrapped messages and text zoom stay reachable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await enableCompanion(page);
  const host = page.locator('#dancing-companion');
  await expect(host.locator('svg')).toBeVisible();
  await expect(host).toHaveAttribute('data-running', 'false');
  await page.getByRole('button', { name: 'Otwórz menu gry' }).click();
  await expect(page.getByText('Animacja wyłączona przez ustawienia ograniczenia ruchu.')).toBeVisible();
  await page.getByRole('button', { name: 'Wróć do gry' }).click();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(host).toHaveAttribute('data-running', 'true');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await expect(host).toHaveAttribute('data-running', 'false');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect(host).toHaveAttribute('data-running', 'true');
  await page.evaluate(() => {
    const notice = document.querySelector('#hint-notice');
    notice.classList.remove('hidden');
    notice.textContent = 'Przenieś odkrytą kartę na kolumnę roboczą. '.repeat(6);
    document.documentElement.style.fontSize = '200%';
  });
  await page.getByRole('button', { name: 'Otwórz menu gry' }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Otwórz menu gry' }).click();
  await expect(page.getByRole('checkbox', { name: 'Tańczący ludzik' })).toBeVisible();
});

test('T035 winning stops the companion and Undo resumes without a second award', async ({ page }) => {
  const fixture = nearWin(1);
  const save = JSON.parse(fixture.save);
  save.preferences.dancingCompanion = true;
  await page.addInitScript(raw => localStorage.setItem('pl.solitaire.save', raw), JSON.stringify(save));
  await page.goto('/');
  await page.getByRole('button', { name: 'Wznów grę', exact: true }).click();
  await expect(page.locator('#dancing-companion')).toHaveAttribute('data-running', 'true');
  await page.evaluate(command => window.__SOLITAIRE_APP__.executeCommand(command), fixture.command);
  await expect(page.locator('#dancing-companion')).toHaveAttribute('data-running', 'false');
  await page.evaluate(() => {
    const app = window.__SOLITAIRE_APP__;
    app.finishVictoryAnimation();
    app.closeDialog();
    app.undo();
  });
  await expect(page.locator('#dancing-companion')).toHaveAttribute('data-running', 'true');
  expect(await page.evaluate(() => window.__SOLITAIRE_APP__.getState().session.statistics.draw1.wins)).toBe(1);
});
