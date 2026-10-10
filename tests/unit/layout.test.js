import { describe, expect, test } from 'vitest';
import {
  calculateBoardDimensions,
  calculateColumnHeight,
  getGap,
  getSidePadding,
  CARD_ASPECT_RATIO,
  MIN_CARD_WIDTH,
  MAX_CARD_WIDTH,
  MIN_FACE_UP_OVERLAP,
} from '../../src/ui/layout.js';
import { getCardDetails, renderCardBackSvg } from '../../src/ui/cards.js';

describe('T009 layout and geometry calculations', () => {
  test('320 px narrow mobile layout satisfies contract', () => {
    const dims = calculateBoardDimensions(320);

    expect(dims.gap).toBe(3);
    expect(dims.padding).toBe(8);
    expect(dims.usableWidth).toBe(304);

    // Card width should be approximately 40.86 px
    expect(dims.cardWidth).toBeGreaterThan(40.8);
    expect(dims.cardWidth).toBeLessThan(40.9);

    // Aspect ratio 5:7 (1.4)
    expect(dims.cardHeight / dims.cardWidth).toBeCloseTo(CARD_ASPECT_RATIO, 2);

    // Board width must fit within 320 px without horizontal overflow
    expect(dims.boardWidth).toBeLessThanOrEqual(304);
    expect(dims.boardWidth + 2 * dims.padding).toBeLessThanOrEqual(320);

    // Face-up overlap must be at least 24 px (REQUIREMENTS U03)
    expect(dims.faceUpOverlap).toBeGreaterThanOrEqual(MIN_FACE_UP_OVERLAP);

    // Waste fan offset in Draw 3 must not exceed waste slot width
    const wasteAreaWidth = 2 * dims.cardWidth + dims.gap;
    const maxFanEnd = dims.cardWidth + 2 * dims.fanOffset;
    expect(maxFanEnd).toBeLessThanOrEqual(wasteAreaWidth);
  });

  test('360, 375, 390 and 430 px viewports fit 7 columns cleanly', () => {
    const viewports = [360, 375, 390, 430];

    for (const w of viewports) {
      const dims = calculateBoardDimensions(w);
      expect(dims.boardWidth + 2 * dims.padding).toBeLessThanOrEqual(w);
      expect(dims.cardWidth).toBeGreaterThanOrEqual(MIN_CARD_WIDTH);
      expect(dims.cardWidth).toBeLessThanOrEqual(MAX_CARD_WIDTH);
      expect(dims.faceUpOverlap).toBeGreaterThanOrEqual(24);
      expect(dims.cardHeight / dims.cardWidth).toBeCloseTo(CARD_ASPECT_RATIO, 2);
    }
  });

  test('desktop 1440 px caps card width at 104 px', () => {
    const dims = calculateBoardDimensions(1440);
    expect(dims.cardWidth).toBe(104);
    expect(dims.cardHeight).toBeCloseTo(104 * 1.4, 1);
    expect(dims.gap).toBe(10);
    // Board is centered
    expect(dims.boardWidth).toBeLessThan(1440);
  });

  test('long tableau column height matches formula', () => {
    const dims = calculateBoardDimensions(320);
    // Empty column
    expect(calculateColumnHeight(0, 0, dims)).toBe(dims.cardHeight);

    // Standard column: 1 hidden, 1 visible
    const h1 = calculateColumnHeight(1, 1, dims);
    expect(h1).toBe(dims.faceDownOverlap + dims.cardHeight);

    // Extreme long column: 6 hidden + 13 alternating visible cards (T17 requirement)
    const longHeight = calculateColumnHeight(6, 13, dims);
    const expected = 6 * dims.faceDownOverlap + 12 * dims.faceUpOverlap + dims.cardHeight;
    expect(longHeight).toBe(expected);
    expect(longHeight).toBeGreaterThan(dims.cardHeight * 4);
  });

  test('card details correctly map all 52 cards without error', () => {
    for (let id = 0; id < 52; id++) {
      const details = getCardDetails(id);
      expect(details.cardId).toBe(id);
      expect(details.rank).toBeGreaterThanOrEqual(1);
      expect(details.rank).toBeLessThanOrEqual(13);
      expect(['trefl', 'karo', 'kier', 'pik']).toContain(details.suit);
      expect(['red', 'black']).toContain(details.color);
      expect(details.fullName).toBeTruthy();
    }

    const aceHearts = getCardDetails(26); // rank 1, kier
    expect(aceHearts.rankName).toBe('As');
    expect(aceHearts.suitName).toBe('kier');
    expect(aceHearts.color).toBe('red');
  });

  test('face-down card SVG back strictly conceals card identity', () => {
    const backSvg = renderCardBackSvg();
    expect(backSvg).toContain('card-svg-back');
    // Must NOT contain rank or suit names
    expect(backSvg).not.toContain('pik');
    expect(backSvg).not.toContain('kier');
    expect(backSvg).not.toContain('karo');
    expect(backSvg).not.toContain('trefl');
    expect(backSvg).not.toContain('As');
    expect(backSvg).not.toContain('Król');
  });
});
