import { afterEach, expect, test, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

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

test('number cards retain the previous centered suit badge', () => {
  for (let rank = 2; rank <= 10; rank += 1) {
    for (let suit = 0; suit < 4; suit += 1) {
      const svg = renderCard(suit * 13 + rank - 1);
      expect(svg).toContain('circle cx="18" cy="18" r="16"');
      expect(svg).not.toContain('card-pip');
    }
  }
});

test('court cards retain the twelve original court illustrations', () => {
  const portraits = [];
  for (let suit = 0; suit < 4; suit += 1) {
    for (let rank = 11; rank <= 13; rank += 1) {
      portraits.push(renderCard(suit * 13 + rank - 1).match(/href="([^"]+)"/)?.[1]);
    }
  }
  expect(new Set(portraits).size).toBe(12);
  expect(portraits.every((href) => href?.includes('/assets/'))).toBe(true);
});

test('court illustrations fit the first-load compressed asset budget', () => {
  const assetsDir = fileURLToPath(new URL('../../src/assets/courts/', import.meta.url));
  const sizes = readdirSync(assetsDir)
    .filter((name) => name.endsWith('.svg'))
    .map((name) => gzipSync(readFileSync(`${assetsDir}/${name}`)).byteLength);

  expect(sizes).toHaveLength(12);
  expect(Math.max(...sizes)).toBeLessThanOrEqual(60 * 1024);
  expect(sizes.reduce((sum, size) => sum + size, 0)).toBeLessThanOrEqual(400 * 1024);
});

test('card back has a decorative vector pattern without card identity', () => {
  const svg = renderCardBackSvg();
  expect(svg).toContain('card-back-lattice');
  expect(svg).not.toMatch(/data-card-id|aria-label|rank|suit/i);
});
