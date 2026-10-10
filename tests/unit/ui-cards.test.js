import { afterEach, expect, test, vi } from 'vitest';

import { createCardElement, renderCardBackSvg } from '../../src/ui/cards.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderCard(cardId) {
  const node = {
    dataset: {},
    setAttribute: vi.fn(),
  };
  vi.stubGlobal('document', { createElement: () => node });
  createCardElement(cardId);
  return node.innerHTML;
}

test('number cards render one suit pip for each rank', () => {
  for (let rank = 2; rank <= 10; rank += 1) {
    for (let suit = 0; suit < 4; suit += 1) {
      const svg = renderCard(suit * 13 + rank - 1);
      expect(svg.match(/class="card-pip"/g)).toHaveLength(rank);
    }
  }
});

test('court cards use twelve distinct local vector portraits', () => {
  const portraits = [];
  for (let suit = 0; suit < 4; suit += 1) {
    for (let rank = 11; rank <= 13; rank += 1) {
      portraits.push(renderCard(suit * 13 + rank - 1).match(/href="([^"]+)"/)?.[1]);
    }
  }
  expect(new Set(portraits).size).toBe(12);
  expect(portraits.every((href) => href?.includes('#court-'))).toBe(true);
});

test('card back has a decorative vector pattern without card identity', () => {
  const svg = renderCardBackSvg();
  expect(svg).toContain('card-back-pattern');
  expect(svg).not.toMatch(/data-card-id|aria-label|rank|suit/i);
});
