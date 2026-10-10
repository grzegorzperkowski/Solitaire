import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { color, createGame, rank, suitIndex, suitName } from '../../src/engine/cards.js';

const fixtures = JSON.parse(readFileSync(new URL('../fixtures/deals.json', import.meta.url), 'utf8'));

const SUITS = [
  { name: 'trefl', color: 'black' },
  { name: 'karo', color: 'red' },
  { name: 'kier', color: 'red' },
  { name: 'pik', color: 'black' },
];

function rejectionReason(options) {
  try {
    createGame(options);
    return undefined;
  } catch (error) {
    return error.reason;
  }
}

function placedCards(state) {
  return [
    ...state.stock,
    ...state.waste,
    ...state.tableau.flatMap((column) => column.cards),
    ...state.foundations.flat(),
  ];
}

test('maps all 52 ids to suit, rank and color', () => {
  const seen = new Set();
  for (let id = 0; id < 52; id += 1) {
    const suit = suitIndex(id);
    expect(suit).toBe(Math.floor(id / 13));
    expect(rank(id)).toBe((id % 13) + 1);
    expect(suitName(id)).toBe(SUITS[suit].name);
    expect(color(id)).toBe(SUITS[suit].color);
    seen.add(`${suit}:${rank(id)}`);
  }
  expect(seen.size).toBe(52);
  expect(rank(0)).toBe(1);
  expect(rank(12)).toBe(13);
  expect(suitName(13)).toBe('karo');
  expect(color(26)).toBe('red');
  expect(color(39)).toBe('black');
});

test('rejects invalid seeds, draw modes and versions', () => {
  expect(rejectionReason(undefined)).toBe('invalid-options');
  expect(rejectionReason(null)).toBe('invalid-options');
  expect(rejectionReason({ drawCount: 1 })).toBe('invalid-seed');
  expect(rejectionReason({ seed: -1, drawCount: 1 })).toBe('invalid-seed');
  expect(rejectionReason({ seed: 1.5, drawCount: 1 })).toBe('invalid-seed');
  expect(rejectionReason({ seed: 4294967296, drawCount: 1 })).toBe('invalid-seed');
  expect(rejectionReason({ seed: Number.NaN, drawCount: 1 })).toBe('invalid-seed');
  expect(rejectionReason({ seed: Number.POSITIVE_INFINITY, drawCount: 1 })).toBe('invalid-seed');
  expect(rejectionReason({ seed: Number.NEGATIVE_INFINITY, drawCount: 1 })).toBe('invalid-seed');
  expect(rejectionReason({ seed: '1', drawCount: 1 })).toBe('invalid-seed');
  expect(rejectionReason({ seed: 1, drawCount: 2 })).toBe('invalid-draw-count');
  expect(rejectionReason({ seed: 1 })).toBe('invalid-draw-count');
  expect(rejectionReason({ seed: 1, drawCount: 1.5 })).toBe('invalid-draw-count');
  expect(rejectionReason({ seed: 1, drawCount: 1, rulesVersion: 2 })).toBe('unsupported-rules-version');
  expect(rejectionReason({ seed: 1, drawCount: 3, shuffleVersion: 0 })).toBe('unsupported-shuffle-version');
});

test('deals columns 1 through 7 with one face-up card and 24 stock', () => {
  const state = createGame({ seed: 0, drawCount: 1 });
  expect(state.rulesVersion).toBe(1);
  expect(state.shuffleVersion).toBe(1);
  expect(state.seed).toBe(0);
  expect(state.drawCount).toBe(1);
  expect(state.tableau).toHaveLength(7);
  expect(state.tableau.map((column) => column.cards.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(state.tableau.every((column) => column.faceUpStart === column.cards.length - 1)).toBe(true);
  expect(state.stock).toHaveLength(24);
  expect(state.waste).toEqual([]);
  expect(state.foundations).toHaveLength(4);
  expect(state.foundations.every((pile) => pile.length === 0)).toBe(true);
  expect(state.foundations[0]).not.toBe(state.foundations[1]);
  const cards = placedCards(state);
  expect(cards).toHaveLength(52);
  expect([...cards].sort((left, right) => left - right)).toEqual(Array.from({ length: 52 }, (_, id) => id));
});

test('matches independently generated deals for the four golden seeds', () => {
  expect(fixtures.deals.map((deal) => deal.seed)).toEqual([0, 1, 42, 4294967295]);
  for (const deal of fixtures.deals) {
    const drawThree = createGame({ seed: deal.seed, drawCount: 3 });
    const drawOne = createGame({
      seed: deal.seed,
      drawCount: 1,
      rulesVersion: 1,
      shuffleVersion: 1,
    });
    expect(drawThree.tableau.map((column) => column.cards)).toEqual(deal.tableau);
    expect(drawThree.stock).toEqual(deal.stock);
    expect(drawOne.tableau.map((column) => column.cards)).toEqual(deal.tableau);
    expect(drawOne.stock).toEqual(deal.stock);
    expect(drawOne).not.toBe(drawThree);
    expect(drawThree.drawCount).toBe(3);
    expect(drawOne.drawCount).toBe(1);
  }
});

test('golden stock and tableau follow row-wise consumption from the shuffled tail', () => {
  for (const deal of fixtures.deals) {
    const rest = [...deal.shuffled];
    const columns = Array.from({ length: 7 }, () => []);
    for (let row = 0; row < 7; row += 1) {
      for (let column = row; column < 7; column += 1) {
        columns[column].push(rest.pop());
      }
    }
    expect(columns).toEqual(deal.tableau);
    expect(rest).toEqual(deal.stock);
    expect(deal.shuffled).toHaveLength(52);
  }
});

test('returns a frozen game that a caller cannot mutate', () => {
  const state = createGame({ seed: 42, drawCount: 1 });
  const again = createGame({ seed: 42, drawCount: 1 });
  expect(() => {
    state.stock.push(0);
  }).toThrow(TypeError);
  expect(() => {
    state.tableau[3].cards.push(0);
  }).toThrow(TypeError);
  expect(() => {
    state.waste.push(0);
  }).toThrow(TypeError);
  expect(() => {
    state.foundations[0].push(0);
  }).toThrow(TypeError);
  expect(again.stock).toEqual(state.stock);
  expect(again.tableau.map((column) => column.cards)).toEqual(state.tableau.map((column) => column.cards));
});
