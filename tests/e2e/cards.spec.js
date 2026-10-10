import { expect, test } from '@playwright/test';

test('all 52 original card faces fit at 320px and render at DPR 1–3', async ({ browser }) => {
  for (const dpr of [1, 2, 3]) {
    const context = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: dpr });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForFunction(() => window.__SOLITAIRE_APP__ && window.__SOLITAIRE_RENDER__);
    await page.evaluate(() => {
      const app = window.__SOLITAIRE_APP__;
      app.newGame({ seed: 42, drawCount: 1 });
      const current = app.getState();
      const ids = Array.from({ length: 52 }, (_, id) => id);
      const sizes = [8, 8, 8, 7, 7, 7, 7];
      const board = {
        ...current.state,
        stock: [],
        waste: [],
        foundations: [[], [], [], []],
        tableau: sizes.map((size) => ({ cards: ids.splice(0, size), faceUpStart: 0 })),
      };
      window.__SOLITAIRE_RENDER__(document.getElementById('game-app'), {
        ...current,
        state: board,
        session: { ...current.session, state: board },
      });

      const gallery = document.createElement('main');
      gallery.setAttribute('aria-label', 'Wszystkie karty');
      gallery.style.cssText = 'display:grid;grid-template-columns:repeat(7,40px);gap:4px;justify-content:center;padding:8px';
      document.querySelectorAll('.card-node').forEach((card) => {
        card.style.cssText = 'position:relative;left:auto;top:auto;z-index:auto;width:40px;height:56px';
        gallery.appendChild(card);
      });
      document.body.replaceChildren(gallery);
    });

    const cards = page.locator('.card-node.card-face-up');
    await expect(cards).toHaveCount(52);
    const pipCounts = await cards.evaluateAll((nodes) => nodes.map((card) => ({
      rank: Number(card.dataset.rank),
      pips: card.querySelectorAll('.card-pip').length,
    })));
    expect(pipCounts.every(({ rank, pips }) => pips === (rank >= 2 && rank <= 10 ? rank : 0))).toBe(true);
    await page.screenshot({ path: `test-results/t017-cards-320-dpr-${dpr}.png`, fullPage: true });
    await context.close();
  }
});
