import { test, expect } from '@playwright/test';

test.describe('T012 Pointer drag and drop, cancellation and gesture handling (T16)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__SOLITAIRE_APP__ !== 'undefined');
  });

  test('blocks pull-to-refresh at the top without stopping inner scrolling', async ({ page }) => {
    const result = await page.evaluate(() => {
      const rootBehavior = getComputedStyle(document.documentElement).overscrollBehaviorY;
      const scroller = document.createElement('div');
      scroller.style.cssText = 'position:fixed;top:0;left:0;width:20px;height:20px;overflow-y:auto';
      scroller.innerHTML = '<div style="height:100px"></div>';
      document.body.append(scroller);

      const makeTouches = (y, count) => Array.from({ length: count }, (_, i) => ({ clientY: y + i }));
      const dispatchTouchMove = (startY, endY, touchCount = 1) => {
        const event = new Event('touchmove', { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'touches', { value: makeTouches(endY, touchCount) });
        const start = new Event('touchstart', { bubbles: true, cancelable: true });
        Object.defineProperty(start, 'touches', { value: makeTouches(startY, touchCount) });
        scroller.dispatchEvent(start);
        scroller.dispatchEvent(event);
        return event.defaultPrevented;
      };

      const blockedAtTop = dispatchTouchMove(100, 140);
      scroller.scrollTop = 10;
      const allowedWhileScrollable = !dispatchTouchMove(100, 140);
      const pinchAllowed = !dispatchTouchMove(100, 140, 2);
      const innerScrollWorks = scroller.scrollTop === 10 && scroller.scrollHeight > scroller.clientHeight;
      scroller.remove();
      return { rootBehavior, blockedAtTop, allowedWhileScrollable, pinchAllowed, innerScrollWorks };
    });

    expect(result.rootBehavior).toBe('none');
    expect(result.blockedAtTop).toBe(true);
    expect(result).toMatchObject({ allowedWhileScrollable: true, pinchAllowed: true, innerScrollWorks: true });
  });

  test('mouse drag moves a single card to a legal foundation (seed 42)', async ({ page }) => {
    await page.evaluate(() => {
      window.__SOLITAIRE_APP__.newGame({ seed: 42, drawCount: 1 });
    });

    // In seed 42, column 3 has Ace of Clubs at faceUpStart 3
    const sourceCard = page.locator('#column-3 .card-node.card-face-up');
    await expect(sourceCard).toBeVisible();
    const sourceBox = await sourceCard.boundingBox();
    expect(sourceBox).toBeTruthy();

    const foundation = page.locator('#foundation-0');
    await expect(foundation).toBeVisible();
    const foundBox = await foundation.boundingBox();
    expect(foundBox).toBeTruthy();

    // Mouse drag from column 3 to foundation 0
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    // Move past 6px threshold
    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 10, sourceBox.y + sourceBox.height / 2 + 10);

    // Verify drag overlay is active
    await expect(page.locator('#drag-overlay')).toBeVisible();

    // Move to foundation 0
    await page.mouse.move(foundBox.x + foundBox.width / 2, foundBox.y + foundBox.height / 2);
    await page.mouse.up();

    // Overlay removed and move executed
    await expect(page.locator('#drag-overlay')).not.toBeVisible();
    await expect(page.locator('#moves-display')).toHaveText('1');

    // Foundation 0 now holds the Ace of Clubs
    const foundationCard = page.locator('#foundation-0 .card-node.card-face-up');
    await expect(foundationCard).toBeVisible();
  });

  test('mouse drag moves a multi-card sequence to another tableau column (seed 9)', async ({ page }) => {
    await page.evaluate(() => {
      window.__SOLITAIRE_APP__.newGame({ seed: 9, drawCount: 1 });
    });

    // Seed 9 deal: move col 5 top card to col 2 first
    const col5Card = page.locator('#column-5 .card-node.card-face-up');
    const col2 = page.locator('#column-2');
    const box5 = await col5Card.boundingBox();
    const box2 = await col2.boundingBox();
    expect(box5).toBeTruthy();
    expect(box2).toBeTruthy();

    await page.mouse.move(box5.x + box5.width / 2, box5.y + box5.height / 2);
    await page.mouse.down();
    await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
    await page.mouse.up();

    await expect(page.locator('#moves-display')).toHaveText('1');

    // Now column 2 has 2 face-up cards forming a sequence
    const col2FaceUpCards = page.locator('#column-2 .card-node.card-face-up');
    await expect(col2FaceUpCards).toHaveCount(2);

    // Drag the entire sequence by grabbing the upper face-up card in col 2 and dropping onto col 5
    const seqRootCard = col2FaceUpCards.first();
    const seqBox = await seqRootCard.boundingBox();
    const col5Box = await page.locator('#column-5').boundingBox();
    expect(seqBox).toBeTruthy();
    expect(col5Box).toBeTruthy();

    await page.mouse.move(seqBox.x + seqBox.width / 2, seqBox.y + 10);
    await page.mouse.down();
    await page.mouse.move(seqBox.x + seqBox.width / 2 + 15, seqBox.y + 25);

    // Overlay contains 2 cards in sequence
    const overlayCards = page.locator('#drag-overlay .card-node');
    await expect(overlayCards).toHaveCount(2);

    // Drop onto column 5
    await page.mouse.move(col5Box.x + col5Box.width / 2, col5Box.y + col5Box.height / 2);
    await page.mouse.up();

    await expect(page.locator('#drag-overlay')).not.toBeVisible();
    await expect(page.locator('#moves-display')).toHaveText('2');
  });

  test('invalid mouse drop leaves board and move count unchanged', async ({ page }) => {
    await page.evaluate(() => {
      window.__SOLITAIRE_APP__.newGame({ seed: 42, drawCount: 1 });
    });

    const sourceCard = page.locator('#column-3 .card-node.card-face-up');
    const targetCol = page.locator('#column-1');
    const sourceBox = await sourceCard.boundingBox();
    const targetBox = await targetCol.boundingBox();

    // Drag to illegal column 1
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
    await page.mouse.up();

    // Overlay gone, 0 commands executed, card remains in col 3
    await expect(page.locator('#drag-overlay')).not.toBeVisible();
    await expect(page.locator('#moves-display')).toHaveText('0');
    await expect(page.locator('#column-3 .card-node.card-face-up')).toBeVisible();
  });

  test('outside mouse drop leaves board and move count unchanged', async ({ page }) => {
    await page.evaluate(() => {
      window.__SOLITAIRE_APP__.newGame({ seed: 42, drawCount: 1 });
    });

    const sourceCard = page.locator('#column-3 .card-node.card-face-up');
    const sourceBox = await sourceCard.boundingBox();

    // Drag to page header outside board
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(20, 20); // Top-left header area
    await page.mouse.up();

    await expect(page.locator('#drag-overlay')).not.toBeVisible();
    await expect(page.locator('#moves-display')).toHaveText('0');
    await expect(page.locator('#column-3 .card-node.card-face-up')).toBeVisible();
  });

  test('Escape key cancels active drag gesture without changing state', async ({ page }) => {
    await page.evaluate(() => {
      window.__SOLITAIRE_APP__.newGame({ seed: 42, drawCount: 1 });
    });

    const sourceCard = page.locator('#column-3 .card-node.card-face-up');
    const sourceBox = await sourceCard.boundingBox();

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 40, sourceBox.y + sourceBox.height / 2 + 40);

    await expect(page.locator('#drag-overlay')).toBeVisible();

    // Press Escape during drag
    await page.keyboard.press('Escape');

    // Drag cancelled immediately
    await expect(page.locator('#drag-overlay')).not.toBeVisible();

    await page.mouse.up();
    await expect(page.locator('#moves-display')).toHaveText('0');
  });

  test('pointercancel event cancels drag safely', async ({ page }) => {
    await page.evaluate(() => {
      window.__SOLITAIRE_APP__.newGame({ seed: 42, drawCount: 1 });
    });

    const sourceCard = page.locator('#column-3 .card-node.card-face-up');
    const sourceBox = await sourceCard.boundingBox();

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 30, sourceBox.y + sourceBox.height / 2 + 30);
    await expect(page.locator('#drag-overlay')).toBeVisible();

    // Trigger synthetic pointercancel on window
    await page.evaluate(() => {
      window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }));
    });

    await expect(page.locator('#drag-overlay')).not.toBeVisible();
    await page.mouse.up();
    await expect(page.locator('#moves-display')).toHaveText('0');
  });

  test('ignores cancellation events from another pointer during a drag', async ({ page }) => {
    await page.evaluate(() => {
      window.__SOLITAIRE_APP__.newGame({ seed: 42, drawCount: 1 });
    });
    await page.locator('#column-3 .card-node.card-face-up').click();
    await page.evaluate(() => {
      const card = document.querySelector('#column-3 .card-node.card-face-up');
      const box = card.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      card.dispatchEvent(new PointerEvent('pointerdown', {
        pointerId: 11, pointerType: 'touch', clientX: x, clientY: y, bubbles: true,
      }));
      window.dispatchEvent(new PointerEvent('pointermove', {
        pointerId: 11, pointerType: 'touch', clientX: x + 20, clientY: y + 20, bubbles: true,
      }));
    });

    await expect(page.locator('#drag-overlay')).toBeVisible();
    await page.evaluate(() => {
      window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 12 }));
      window.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: 12 }));
    });
    await expect(page.locator('#drag-overlay')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__SOLITAIRE_INPUT__.getActiveGesture()?.pointerId)).toBe(11);

    await page.evaluate(() => {
      const gesture = window.__SOLITAIRE_INPUT__.getActiveGesture();
      window.dispatchEvent(new PointerEvent('pointerup', {
        pointerId: gesture.pointerId,
        pointerType: gesture.pointerType,
        clientX: gesture.startX,
        clientY: gesture.startY,
        bubbles: true,
      }));
    });
    await expect(page.locator('#drag-overlay')).not.toBeVisible();
    await expect(page.locator('#moves-display')).toHaveText('0');
  });

  test('movement below 6px threshold acts as tap selection without dragging', async ({ page }) => {
    await page.evaluate(() => {
      window.__SOLITAIRE_APP__.newGame({ seed: 42, drawCount: 1 });
    });

    const sourceCard = page.locator('#column-3 .card-node.card-face-up');
    const sourceBox = await sourceCard.boundingBox();

    // Mouse down, move only 3px, mouse up
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 3, sourceBox.y + sourceBox.height / 2 + 3);
    await page.mouse.up();

    // Overlay was never created
    await expect(page.locator('#drag-overlay')).not.toBeVisible();
    // Card is selected via normal tap path
    await expect(sourceCard).toHaveClass(/is-selected/);
  });

  test('touch lifecycle: unselected touch move does not drag; selected touch move drags', async ({ page }) => {
    await page.evaluate(() => {
      window.__SOLITAIRE_APP__.newGame({ seed: 42, drawCount: 1 });
    });

    const card = page.locator('#column-3 .card-node.card-face-up');
    const box = await card.boundingBox();
    expect(box).toBeTruthy();

    // 1. Unselected touch pointermove > 6px does NOT initiate drag (preserves native scroll)
    await page.evaluate((b) => {
      const el = document.querySelector('#column-3 .card-node.card-face-up');
      el.dispatchEvent(new PointerEvent('pointerdown', {
        pointerId: 2,
        pointerType: 'touch',
        clientX: b.x + 10,
        clientY: b.y + 10,
        bubbles: true,
      }));
      window.dispatchEvent(new PointerEvent('pointermove', {
        pointerId: 2,
        pointerType: 'touch',
        clientX: b.x + 30,
        clientY: b.y + 30,
        bubbles: true,
      }));
    }, box);

    // No overlay
    await expect(page.locator('#drag-overlay')).not.toBeVisible();

    // End touch gesture
    await page.evaluate(() => {
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2, pointerType: 'touch', bubbles: true }));
    });

    // 2. Tap to select the card (touch-action becomes pinch-zoom)
    await card.click();
    await expect(card).toHaveClass(/is-selected/);

    // 3. Now touch on the selected card and move > 6px: drag DOES start!
    const foundBox = await page.locator('#foundation-0').boundingBox();

    await page.evaluate((b) => {
      const el = document.querySelector('#column-3 .card-node.card-face-up');
      el.dispatchEvent(new PointerEvent('pointerdown', {
        pointerId: 3,
        pointerType: 'touch',
        clientX: b.x + 10,
        clientY: b.y + 10,
        bubbles: true,
      }));
      window.dispatchEvent(new PointerEvent('pointermove', {
        pointerId: 3,
        pointerType: 'touch',
        clientX: b.x + 25,
        clientY: b.y + 25,
        bubbles: true,
      }));
    }, box);

    await expect(page.locator('#drag-overlay')).toBeVisible();

    // Complete drop onto foundation 0
    await page.evaluate((fb) => {
      window.dispatchEvent(new PointerEvent('pointermove', {
        pointerId: 3,
        pointerType: 'touch',
        clientX: fb.x + fb.width / 2,
        clientY: fb.y + fb.height / 2,
        bubbles: true,
      }));
      window.dispatchEvent(new PointerEvent('pointerup', {
        pointerId: 3,
        pointerType: 'touch',
        clientX: fb.x + fb.width / 2,
        clientY: fb.y + fb.height / 2,
        bubbles: true,
      }));
    }, foundBox);

    await expect(page.locator('#drag-overlay')).not.toBeVisible();
    await expect(page.locator('#moves-display')).toHaveText('1');
    await expect(page.locator('#foundation-0 .card-node.card-face-up')).toBeVisible();
  });

  test('Undo after drag restores exact board and move count', async ({ page }) => {
    await page.evaluate(() => {
      window.__SOLITAIRE_APP__.newGame({ seed: 42, drawCount: 1 });
    });

    const sourceCard = page.locator('#column-3 .card-node.card-face-up');
    const foundation = page.locator('#foundation-0');
    const sourceBox = await sourceCard.boundingBox();
    const foundBox = await foundation.boundingBox();

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(foundBox.x + foundBox.width / 2, foundBox.y + foundBox.height / 2);
    await page.mouse.up();

    await expect(page.locator('#moves-display')).toHaveText('1');

    // Click Undo button
    await page.locator('#btn-undo').click();

    await expect(page.locator('#moves-display')).toHaveText('0');
    await expect(page.locator('#column-3 .card-node.card-face-up')).toBeVisible();
    await expect(page.locator('#foundation-0 .card-node')).toHaveCount(0);
  });

  test('rapid tap after drag does not trigger duplicate command', async ({ page }) => {
    await page.evaluate(() => {
      window.__SOLITAIRE_APP__.newGame({ seed: 42, drawCount: 1 });
    });

    const sourceCard = page.locator('#column-3 .card-node.card-face-up');
    const foundation = page.locator('#foundation-0');
    const sourceBox = await sourceCard.boundingBox();
    const foundBox = await foundation.boundingBox();

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(foundBox.x + foundBox.width / 2, foundBox.y + foundBox.height / 2);
    await page.mouse.up();

    // Immediately click board
    await page.mouse.click(foundBox.x + foundBox.width / 2, foundBox.y + foundBox.height / 2);

    await expect(page.locator('#moves-display')).toHaveText('1');
  });

  test('drag and drop works on 320px narrow portrait viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(() => {
      window.__SOLITAIRE_APP__.newGame({ seed: 42, drawCount: 1 });
    });

    const sourceCard = page.locator('#column-3 .card-node.card-face-up');
    const foundation = page.locator('#foundation-0');
    const sourceBox = await sourceCard.boundingBox();
    const foundBox = await foundation.boundingBox();

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(foundBox.x + foundBox.width / 2, foundBox.y + foundBox.height / 2);
    await page.mouse.up();

    await expect(page.locator('#moves-display')).toHaveText('1');
    await expect(page.locator('#foundation-0 .card-node.card-face-up')).toBeVisible();
  });

  test('drag and drop works on 390px standard portrait viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      window.__SOLITAIRE_APP__.newGame({ seed: 42, drawCount: 1 });
    });

    const sourceCard = page.locator('#column-3 .card-node.card-face-up');
    const foundation = page.locator('#foundation-0');
    const sourceBox = await sourceCard.boundingBox();
    const foundBox = await foundation.boundingBox();

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(foundBox.x + foundBox.width / 2, foundBox.y + foundBox.height / 2);
    await page.mouse.up();

    await expect(page.locator('#moves-display')).toHaveText('1');
    await expect(page.locator('#foundation-0 .card-node.card-face-up')).toBeVisible();
  });

  test('text selection is completely blocked even with userscript forcing user-select: text !important', async ({ page }) => {
    // Inject hostile userscript that forces * { user-select: text !important }
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = `
        * {
          user-select: text !important;
          -webkit-user-select: text !important;
        }
      `;
      document.documentElement.appendChild(style);
    });

    // 1. Try dragging across title
    const title = page.locator('#page-title');
    const titleBox = await title.boundingBox();
    expect(titleBox).toBeTruthy();

    await page.mouse.move(titleBox.x, titleBox.y + titleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(titleBox.x + titleBox.width, titleBox.y + titleBox.height / 2);
    await page.mouse.up();

    let selectedText = await page.evaluate(() => window.getSelection().toString());
    expect(selectedText).toBe('');

    // 2. Try double-clicking title
    await title.dblclick();
    selectedText = await page.evaluate(() => window.getSelection().toString());
    expect(selectedText).toBe('');

    // 3. Try Ctrl+A
    await page.keyboard.press('Control+a');
    selectedText = await page.evaluate(() => window.getSelection().toString());
    expect(selectedText).toBe('');

    // 4. Try dragging across button
    const btnMenu = page.locator('#btn-menu');
    const menuBox = await btnMenu.boundingBox();
    expect(menuBox).toBeTruthy();

    await page.mouse.move(menuBox.x, menuBox.y + menuBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(menuBox.x + menuBox.width, menuBox.y + menuBox.height / 2);
    await page.mouse.up();

    selectedText = await page.evaluate(() => window.getSelection().toString());
    expect(selectedText).toBe('');
  });

  test('right-click context menu is completely blocked across the board', async ({ page }) => {
    const wasDefaultPrevented = await page.evaluate(() => {
      return new Promise((resolve) => {
        window.addEventListener(
          'contextmenu',
          (e) => {
            resolve(e.defaultPrevented);
          },
          { once: true }
        );
        const card = document.querySelector('.card-node') || document.body;
        card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
      });
    });

    expect(wasDefaultPrevented).toBe(true);

    const title = page.locator('#page-title');
    await title.click({ button: 'right' });
    await expect(page.locator('#game-container')).toBeVisible();
  });
});
