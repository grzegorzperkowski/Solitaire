import { test, expect } from '@playwright/test';
import { nearWin } from '../fixtures/wins.js';

async function enableCompanion(page) {
  await page.getByRole('button', { name: 'Otwórz menu gry' }).click();
  const toggle = page.getByRole('checkbox', { name: 'Tańczący ludzik' });
  await toggle.check();
  await expect(toggle).toBeFocused();
  await page.getByRole('button', { name: 'Wróć do gry' }).click();
}

for (const viewport of [{ width: 568, height: 320 }, { width: 844, height: 390 }, { width: 390, height: 400 }]) {
  test(`T035 Menu stays onscreen without auto-scroll at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    try {
      await page.goto('http://localhost:5173/');
      await page.evaluate(() => window.__SOLITAIRE_APP__.setDancingCompanion(true));
      const menu = await page.locator('#btn-menu').boundingBox();
      expect(menu.y).toBeGreaterThanOrEqual(0);
      expect(menu.y + menu.height).toBeLessThanOrEqual(viewport.height);
      await page.touchscreen.tap(menu.x + menu.width / 2, menu.y + menu.height / 2);
      await expect(page.getByRole('dialog', { name: 'Menu gry' })).toBeVisible();
    } finally { await context.close(); }
  });
}

test('T035 knee slide travels through a viewport-wide scene and adapts on resize', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => { Math.random = () => 0.99; });
  await page.goto('/');
  await enableCompanion(page);
  const host = page.locator('#dancing-companion');
  await expect(host).toHaveAttribute('data-action', 'slide');
  const leg = host.locator('[data-part="leftLeg"]');
  await expect.poll(async () => {
    const numbers = (await leg.getAttribute('d')).match(/-?\d+(?:\.\d+)?/g).map(Number);
    return numbers[1] > 107 && numbers[3] > 124 && numbers[4] < numbers[2] - 15;
  }).toBe(true);
  const firstX = await leg.evaluate(el => Number(el.getAttribute('d').match(/-?\d+(?:\.\d+)?/g)[0]));
  await expect.poll(async () => {
    const nextX = await leg.evaluate(el => Number(el.getAttribute('d').match(/-?\d+(?:\.\d+)?/g)[0]));
    return nextX - firstX;
  }).toBeGreaterThan(300);
  await page.screenshot({ path: 'test-results/screenshots/companion-slide-1280.png' });
  for (const width of [320, 1920]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(() => host.locator('svg').evaluate(svg => svg.viewBox.baseVal.width)).toBeCloseTo(width * 140 / 88, 1);
    const bounds = await host.boundingBox();
    expect(bounds.x).toBeCloseTo(0, 0);
    expect(bounds.width).toBe(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});

test('T035 native touch scrolls the compact board while bottom controls stay onscreen', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 568, height: 320 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await page.goto('http://localhost:5173/');
    await enableCompanion(page);
    await page.evaluate(() => { document.querySelector('#board-area').scrollTop = 0; });
    const cdp = await context.newCDPSession(page);
    const board = await page.locator('#board-area').boundingBox();
    const startY = board.y + board.height - 8;
    const point = y => ({ x: board.x + 2, y, id: 1 });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(startY)] });
    for (let delta = 20; delta <= 100; delta += 20) {
      const y = startY - delta;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(y)] });
      await page.evaluate(() => new Promise(requestAnimationFrame));
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => page.locator('#board-area').evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    const menu = await page.locator('#btn-menu').boundingBox();
    expect(menu.y + menu.height).toBeLessThanOrEqual(320);
    await page.touchscreen.tap(menu.x + menu.width / 2, menu.y + menu.height / 2);
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
  await expect(reader.getByRole('dialog', { name: 'Menu gry' })).toContainText('Tryb tylko do odczytu.');
  await expect(reader.getByRole('checkbox', { name: 'Tańczący ludzik' })).toBeDisabled();
  await expect(reader.getByRole('checkbox', { name: 'Tańczący ludzik' })).toBeChecked();
  const before = await reader.evaluate(() => localStorage.getItem('pl.solitaire.save'));
  await reader.evaluate(() => window.__SOLITAIRE_APP__.setDancingCompanion(false));
  expect(await reader.evaluate(() => localStorage.getItem('pl.solitaire.save'))).toBe(before);
  await writer.close();
  await reader.reload();
  await reader.getByRole('button', { name: 'Otwórz menu gry' }).click();
  await expect(reader.getByRole('checkbox', { name: 'Tańczący ludzik' })).toBeEnabled();
  await reader.getByRole('checkbox', { name: 'Tańczący ludzik' }).uncheck();
  await expect(reader.getByRole('checkbox', { name: 'Tańczący ludzik' })).not.toBeChecked();
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
      return { stage: box('#dancing-companion'), board: box('#board-area'), footer: box('.bottom-bar'),
        boardOverflow: getComputedStyle(document.querySelector('#board-area')).overflowY,
        columns: [...document.querySelectorAll('.tableau-column')].map(el => el.getBoundingClientRect().toJSON()),
        overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    expect(layout.overflow).toBe(false);
    expect(layout.stage.y).toBeGreaterThanOrEqual(layout.board.bottom - 1);
    expect(layout.boardOverflow).toBe('auto');
    expect(layout.footer.bottom).toBeLessThanOrEqual(viewport.height);
    expect(layout.footer.y).toBeCloseTo(layout.stage.bottom, 1);
    const button = await page.locator('#btn-menu').boundingBox();
    expect(button.y).toBeCloseTo(layout.stage.bottom, 1);
    const compact = viewport.width <= 599 && viewport.height <= 740 && viewport.height > viewport.width;
    expect(layout.stage.height).toBe(compact ? 72 : viewport.height <= 500 && viewport.width > viewport.height ? 56 : 88);
    expect(layout.stage.width).toBeCloseTo(compact ? 72 : viewport.width, 0);
    if (!compact) expect(layout.stage.x).toBeCloseTo(0, 0);
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


test('T035 compact bubble shares space and returns to roomy layout with more height', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 670 });
  await page.goto('/');
  const stamp = page.locator('#build-stamp');
  await expect(stamp).toBeVisible();
  expect((await stamp.boundingBox()).y).toBeGreaterThan(630);
  expect(await stamp.evaluate(el => Number(getComputedStyle(el).opacity))).toBeLessThanOrEqual(0.45);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enableCompanion(page);
  await page.evaluate(() => {
    const notice = document.querySelector('#hint-notice');
    notice.classList.remove('hidden');
    notice.textContent = 'Dobierz kartę ze stosu. To pierwszy z jedenastu ruchów, które pozwolą odsłonić kartę.';
  });
  const boxes = () => page.evaluate(() => {
    const box = s => document.querySelector(s).getBoundingClientRect().toJSON();
    return { notice: box('#hint-notice'), figure: box('#dancing-companion'), menu: box('#btn-menu'), board: box('#board-area'), build: box('#build-stamp') };
  });
  const compact = await boxes();
  expect(compact.notice.right).toBeLessThan(compact.figure.x);
  expect(compact.notice.bottom).toBeGreaterThan(compact.figure.y);
  expect(compact.menu.bottom).toBeLessThanOrEqual(670);
  expect(compact.build.y).toBeGreaterThanOrEqual(compact.menu.bottom);
  expect(compact.build.bottom).toBeLessThanOrEqual(670);
  expect(compact.build.right).toBeCloseTo(compact.menu.right, 0);
  expect(await page.locator('#build-stamp').evaluate(el => getComputedStyle(el).textAlign)).toBe('right');
  await expect(page.locator('#build-stamp')).toBeVisible();
  await page.screenshot({ path: 'test-results/screenshots/companion-bubble-compact.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#build-stamp')).toBeVisible();
  const roomy = await boxes();
  expect(roomy.figure.width).toBe(390);
  expect(roomy.figure.y).toBeGreaterThanOrEqual(roomy.notice.bottom);
  expect(roomy.board.height).toBeGreaterThan(compact.board.height);
  await page.screenshot({ path: 'test-results/screenshots/companion-bubble-roomy.png' });
  await page.setViewportSize({ width: 390, height: 670 });
  await expect(page.locator('#build-stamp')).toBeVisible();
  await page.getByRole('button', { name: 'Otwórz menu gry' }).click();
  await expect(page.locator('.menu-build-stamp')).toHaveCount(0);
});


for (const height of [670, 844]) {
  test(`T035 native touch enables companion from Menu at 390x${height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    try {
      await page.goto('/');
      await page.getByRole('button', { name: 'Otwórz menu gry' }).tap();
      const toggle = page.getByRole('checkbox', { name: 'Tańczący ludzik' });
      await expect(toggle).toBeEnabled();
      await toggle.tap();
      await expect(toggle).toBeChecked();
      await page.getByRole('button', { name: 'Wróć do gry' }).tap();
      await expect(page.locator('#dancing-companion')).toBeVisible();
      await expect(page.locator('#dancing-companion')).toHaveAttribute('data-running', 'true');
      await page.reload();
      await expect(page.locator('#dancing-companion')).toBeVisible();
      await page.getByRole('button', { name: 'Otwórz menu gry' }).tap();
      await page.locator('.companion-option').tap();
      await expect(toggle).not.toBeChecked();
    } finally { await context.close(); }
  });
}

for (const reducedMotion of ['no-preference', 'reduce']) {
  test(`T035 click freezes, drag lifts and parachute lands (${reducedMotion})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion });
    await page.goto('/');
    await enableCompanion(page);
    const host = page.locator('#dancing-companion');
    const hit = host.locator('[data-hit]');
    await hit.focus();
    await page.keyboard.press('Enter');
    await expect(host).toHaveAttribute('data-interaction', 'stopped');
    const before = await host.locator('[data-part="back"]').getAttribute('d');
    await page.waitForTimeout(120);
    expect(await host.locator('[data-part="back"]').getAttribute('d')).toBe(before);
    const box = await hit.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(host).toHaveAttribute('data-interaction', 'dancing');
    await hit.focus();
    await page.keyboard.press('Enter');
    const start = await hit.boundingBox();
    const x = start.x + start.width / 2;
    const y = start.y + start.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 55, y - 160, { steps: 8 });
    await expect(host).toHaveAttribute('data-interaction', 'held');
    expect((await hit.boundingBox()).y).toBeLessThan(start.y - 130);
    await page.mouse.up();
    if (reducedMotion === 'no-preference') {
      await expect(host).toHaveAttribute('data-interaction', 'falling');
      await expect(host.locator('[data-parachute]')).toBeVisible();
      await page.screenshot({ path: 'test-results/screenshots/companion-parachute.png' });
      const lifted = await hit.boundingBox();
      await expect.poll(async () => (await hit.boundingBox()).y).toBeGreaterThan(lifted.y + 15);
    }
    await expect(host).toHaveAttribute('data-interaction', 'stopped', { timeout: 8000 });
    await expect(host.locator('[data-parachute]')).toBeHidden();
    await expect(page.locator('#moves-display')).toHaveText('0');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}

test('T035 native touch lifts from compact strip; Menu and resize cancel the gesture', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 670 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await page.goto('http://localhost:5173/');
    await enableCompanion(page);
    const host = page.locator('#dancing-companion');
    const hit = host.locator('[data-hit]');
    await hit.focus();
    await page.keyboard.press('Enter');
    const box = await hit.boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 10, y: y - 130, id: 1 }] });
    await expect(host).toHaveAttribute('data-interaction', 'held');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(host).toHaveAttribute('data-interaction', 'falling');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.getByRole('button', { name: 'Otwórz menu gry' }).click();
    await expect(host).toHaveAttribute('data-interaction', 'stopped');
    await expect(host.locator('[data-parachute]')).toBeHidden();
    await expect(hit).toBeHidden();
    await page.getByRole('button', { name: 'Wróć do gry' }).click();
    await expect(hit).toBeVisible();
    await page.setViewportSize({ width: 320, height: 568 });
    await expect(host).toHaveAttribute('data-running', 'false');
    await expect(host.locator('[data-figure]')).toHaveAttribute('transform', 'translate(0,0)');
    await cdp.detach();
  } finally { await context.close(); }
});

test('T035 compact touch target accepts a finger near the figure after holding', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 670 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await page.addInitScript(() => { Math.random = () => 0; });
    await page.goto('http://localhost:5173/');
    await enableCompanion(page);
    const host = page.locator('#dancing-companion');
    const hit = host.locator('[data-hit]');
    // A finger can land 26 CSS px from the body, inside the 64px finger target.
    const box = await hit.boundingBox();
    const x = box.x + box.width / 2 - 26;
    const y = box.y + box.height / 2;
    expect(await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('[data-hit]')), { x, y })).toBe(true);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await expect(host).toHaveAttribute('data-interaction', 'held');
    await page.waitForTimeout(650);
    await expect(host).toHaveAttribute('data-interaction', 'held');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 70, y: y - 100, id: 1 }] });
    expect((await hit.boundingBox()).y).toBeLessThan(box.y - 80);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(host).toHaveAttribute('data-interaction', 'falling');
    await cdp.detach();
  } finally { await context.close(); }
});
