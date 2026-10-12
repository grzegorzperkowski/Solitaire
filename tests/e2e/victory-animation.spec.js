import { test, expect } from '@playwright/test';

const effects = ['classic-cascade', 'magic-fan', 'suit-fireworks', 'card-tornado'];

for (const viewport of [{ width: 1280, height: 720 }, { width: 320, height: 568 }]) {
  test.describe(`victory previews at ${viewport.width}px`, () => {
    test.use({ viewport });
    test('each effect starts, skips, and cleans its overlay', async ({ page }) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('http://localhost:5186/tests/harness/victory.html');
      for (const effect of effects) {
        await page.getByRole('button', { name: effect === 'classic-cascade' ? 'Kaskada' : effect === 'magic-fan' ? 'Wachlarz' : effect === 'suit-fireworks' ? 'Fajerwerki' : 'Tornado' }).click();
        const overlay = page.locator(`.victory-animation[data-animation="${effect}"]`);
        await expect(overlay).toBeVisible();
        await expect(overlay.getByRole('button', { name: 'Pomiń' })).toBeFocused();
        await page.waitForTimeout(120);
        const activePixels = effect === 'magic-fan'
          ? await overlay.locator('.victory-fan-card').count() === 4 &&
            await overlay.locator('.victory-fan-card').first().evaluate((card) => card.style.transform.includes('rotateY'))
          : await overlay.locator('canvas').evaluate((canvas) => {
            const ctx = canvas.getContext('2d');
            return ctx.getImageData(0, 0, canvas.width, canvas.height).data.some((value) => value !== 0);
          });
        expect(activePixels).toBe(true);
        await page.keyboard.press('Escape');
        await expect(overlay).toHaveCount(0);
        await expect(page.getByText('Zwycięstwo!', { exact: true })).toBeVisible();
      }
      expect(errors).toEqual([]);
    });

    test('reduced motion bypasses the effect; replay cancels the previous overlay', async ({ page }) => {
      await page.goto('http://localhost:5186/tests/harness/victory.html');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.getByRole('button', { name: 'Kaskada' }).click();
      await expect(page.locator('.victory-animation')).toHaveCount(0);
      await expect(page.getByText('Zwycięstwo!', { exact: true })).toBeVisible();
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.getByRole('button', { name: 'Wachlarz' }).click();
      await expect(page.locator('.victory-animation[data-animation="magic-fan"]')).toBeVisible();
      await page.getByRole('button', { name: 'Tornado' }).click();
      await expect(page.locator('.victory-animation')).toHaveCount(1);
      await expect(page.locator('.victory-animation')).toHaveAttribute('data-animation', 'card-tornado');
      await page.keyboard.press('Escape');
      await expect(page.locator('.victory-animation')).toHaveCount(0);
    });
  });
}
