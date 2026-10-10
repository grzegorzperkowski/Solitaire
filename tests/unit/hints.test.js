import { expect, test } from 'vitest';
import { rankHints } from '../../src/engine/hints.js';
import { validateMove } from '../../src/engine/game.js';
import { CLUBS, DIAMONDS, HEARTS, SPADES, card, makeState, pile } from '../fixtures/boards.js';

function hintBoard(hiddenCards = [card(CLUBS, 4), card(DIAMONDS, 9)]) {
  return makeState({
    tableau: [
      pile([hiddenCards[0], hiddenCards[1], card(HEARTS, 6)], 2),
      pile([card(CLUBS, 7)]),
      pile([card(SPADES, 7)]),
      pile([card(HEARTS, 1)]),
      pile([card(DIAMONDS, 6)]),
      pile([card(CLUBS, 5)]),
    ],
  });
}

test('ranks reveals, foundations, transfers, then stock while keeping scan order for ties', () => {
  const state = hintBoard();
  const move = (fromIndex, cardIndex, toIndex) => ({
    type: 'move',
    from: { pile: 'tableau', index: fromIndex, cardIndex },
    to: { pile: 'tableau', index: toIndex },
  });

  expect(rankHints(state)).toEqual([
    move(0, 2, 1),
    move(0, 2, 2),
    { type: 'move', from: { pile: 'tableau', index: 3, cardIndex: 0 }, to: { pile: 'foundation', index: HEARTS } },
    move(4, 0, 1),
    move(4, 0, 2),
    move(5, 0, 0),
    move(5, 0, 4),
    { type: 'draw' },
  ]);
});

test('every returned hint is legal and a blocked board has no hint', () => {
  const foundations = Array.from({ length: 4 }, (_, suit) => Array.from({ length: 9 }, (__, rank) => card(suit, rank + 1)));
  const state = makeState({
    tableau: [
      pile([card(HEARTS, 10), card(HEARTS, 12), card(CLUBS, 13)], 2),
      pile([card(CLUBS, 10), card(CLUBS, 12), card(DIAMONDS, 13)], 2),
      pile([card(DIAMONDS, 10), card(DIAMONDS, 12), card(SPADES, 13)], 2),
      pile([card(SPADES, 10), card(SPADES, 12), card(HEARTS, 13)], 2),
      pile([card(CLUBS, 11), card(DIAMONDS, 11)], 1),
      pile([card(HEARTS, 11)]),
      pile([card(SPADES, 11)]),
    ],
    foundations,
    stock: [],
  });

  expect(rankHints(state)).toEqual([]);
  const playable = hintBoard();
  for (const hint of rankHints(playable)) expect(validateMove(playable, hint).ok).toBe(true);
});

test('swapping hidden-card identities does not change hint order', () => {
  expect(rankHints(hintBoard())).toEqual(rankHints(hintBoard([card(DIAMONDS, 9), card(CLUBS, 4)])));
});
