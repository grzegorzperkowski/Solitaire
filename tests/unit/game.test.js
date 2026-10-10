import { expect, test } from 'vitest';
import { createGame } from '../../src/engine/cards.js';
import { applyMove, assertInvariants, isWon, validateMove } from '../../src/engine/game.js';
import {
  CLUBS,
  DIAMONDS,
  HEARTS,
  SPADES,
  card,
  completedFoundations,
  makeState,
  pile,
} from '../fixtures/boards.js';

function ids(state) {
  return [
    ...state.stock,
    ...state.waste,
    ...state.tableau.flatMap((column) => column.cards),
    ...state.foundations.flat(),
  ];
}

function expectRejected(state, command, reason) {
  const before = JSON.stringify(state);
  const validated = validateMove(state, command);
  const applied = applyMove(state, command);
  expect(validated).toEqual({ ok: false, reason });
  expect(applied).toEqual({ ok: false, reason });
  expect(JSON.stringify(state)).toBe(before);
  expect(Object.isFrozen(state)).toBe(true);
  expect(Object.isFrozen(state.stock)).toBe(true);
  expect(Object.isFrozen(state.waste)).toBe(true);
  expect(Object.isFrozen(state.tableau)).toBe(true);
  expect(Object.isFrozen(state.tableau[0])).toBe(true);
  expect(Object.isFrozen(state.tableau[0].cards)).toBe(true);
  expect(Object.isFrozen(state.foundations)).toBe(true);
  expect(Object.isFrozen(state.foundations[0])).toBe(true);
  expect(() => {
    state.stock.push(0);
  }).toThrow(TypeError);
}

function expectAccepted(state, command, revealed) {
  const before = JSON.stringify(state);
  const stock = state.stock;
  expect(validateMove(state, command)).toEqual({ ok: true });
  const applied = applyMove(state, command);
  expect(applied.ok).toBe(true);
  expect(applied.revealed).toBe(revealed);
  expect(Object.isFrozen(applied.state)).toBe(true);
  expect(Object.isFrozen(applied.state.tableau[0].cards)).toBe(true);
  expect(JSON.stringify(state)).toBe(before);
  expect(state.stock).toBe(stock);
  expect(applied.state).not.toBe(state);
  expect(applied.state.seed).toBe(state.seed);
  expect(applied.state.drawCount).toBe(state.drawCount);
  expect(applied.state.rulesVersion).toBe(state.rulesVersion);
  expect(applied.state.shuffleVersion).toBe(state.shuffleVersion);
  assertInvariants(applied.state);
  expect([...ids(applied.state)].sort((left, right) => left - right)).toEqual(
    Array.from({ length: 52 }, (_, id) => id),
  );
  return applied.state;
}

test('accepts dealt boards and does not call them won', () => {
  for (const seed of [0, 1, 42, 4294967295]) {
    const state = createGame({ seed, drawCount: seed === 42 ? 3 : 1 });
    assertInvariants(state);
    expect(isWon(state)).toBe(false);
  }
});

test('places a red 6 on a black 7 and the inverse', () => {
  const redOnBlack = makeState({
    tableau: [pile([card(HEARTS, 6)]), pile([card(CLUBS, 7)])],
  });
  const moved = expectAccepted(redOnBlack, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'tableau', index: 1 },
  }, null);
  expect(moved.tableau[0]).toEqual({ cards: [], faceUpStart: 0 });
  expect(moved.tableau[1].cards).toEqual([card(CLUBS, 7), card(HEARTS, 6)]);

  const blackOnRed = makeState({
    tableau: [pile([card(CLUBS, 6)]), pile([card(DIAMONDS, 7)])],
  });
  const inverse = expectAccepted(blackOnRed, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'tableau', index: 1 },
  }, null);
  expect(inverse.tableau[1].cards).toEqual([card(DIAMONDS, 7), card(CLUBS, 6)]);
});

test('rejects same color, rank gaps, ace wrap, self-moves, hidden cards and bad indexes', () => {
  const base = () => makeState({
    tableau: [pile([card(HEARTS, 6)]), pile([card(DIAMONDS, 7)])],
  });
  expectRejected(base(), {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'tableau', index: 1 },
  }, 'illegal-destination');

  const gap = makeState({
    tableau: [pile([card(HEARTS, 5)]), pile([card(CLUBS, 7)])],
  });
  expectRejected(gap, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'tableau', index: 1 },
  }, 'illegal-destination');

  const kingOnAce = makeState({
    tableau: [pile([card(SPADES, 13)]), pile([card(HEARTS, 1)])],
  });
  expectRejected(kingOnAce, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'tableau', index: 1 },
  }, 'illegal-destination');

  const aceOnKing = makeState({
    tableau: [pile([card(HEARTS, 1)]), pile([card(CLUBS, 13)])],
  });
  expectRejected(aceOnKing, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'tableau', index: 1 },
  }, 'illegal-destination');

  const alone = makeState({ tableau: [pile([card(CLUBS, 13)])] });
  expectRejected(alone, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'tableau', index: 0 },
  }, 'illegal-destination');

  const hidden = makeState({
    tableau: [
      pile([card(CLUBS, 9), card(HEARTS, 6)], 1),
      pile([card(SPADES, 7)]),
    ],
  });
  expectRejected(hidden, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'tableau', index: 1 },
  }, 'illegal-source');

  const indexed = makeState({ tableau: [pile([card(HEARTS, 6)]), pile([card(CLUBS, 7)])] });
  for (const from of [
    { pile: 'tableau', index: -1, cardIndex: 0 },
    { pile: 'tableau', index: 7, cardIndex: 0 },
    { pile: 'tableau', index: 1.5, cardIndex: 0 },
    { pile: 'tableau', index: 0, cardIndex: -1 },
    { pile: 'tableau', index: 0, cardIndex: 1 },
    { pile: 'tableau', index: 0, cardIndex: 0.5 },
  ]) {
    expectRejected(indexed, {
      type: 'move',
      from,
      to: { pile: 'tableau', index: 1 },
    }, 'invalid-command');
  }
  expectRejected(indexed, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'tableau', index: 8 },
  }, 'invalid-command');
  expectRejected(indexed, {
    type: 'move',
    from: { pile: 'foundation', index: -1 },
    to: { pile: 'tableau', index: 1 },
  }, 'invalid-command');
});

test('empty tableau accepts only a king or a king-headed sequence', () => {
  const king = makeState({ tableau: [pile([card(SPADES, 13)])] });
  const parked = expectAccepted(king, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'tableau', index: 3 },
  }, null);
  expect(parked.tableau[3].cards).toEqual([card(SPADES, 13)]);
  expect(parked.tableau[3].faceUpStart).toBe(0);

  const sequence = makeState({
    tableau: [pile([card(SPADES, 13), card(HEARTS, 12), card(CLUBS, 11)])],
  });
  const moved = expectAccepted(sequence, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'tableau', index: 4 },
  }, null);
  expect(moved.tableau[4].cards).toEqual([
    card(SPADES, 13),
    card(HEARTS, 12),
    card(CLUBS, 11),
  ]);

  const queen = makeState({ tableau: [pile([card(HEARTS, 12)])] });
  expectRejected(queen, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'tableau', index: 2 },
  }, 'illegal-destination');
});

test('moves a legal face-up suffix as a unit and keeps its order', () => {
  const run = [
    card(CLUBS, 7),
    card(HEARTS, 6),
    card(SPADES, 5),
  ];
  const state = makeState({
    tableau: [pile(run), pile([card(DIAMONDS, 8)]), pile([card(SPADES, 7)])],
  });
  const moved = expectAccepted(state, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'tableau', index: 1 },
  }, null);
  expect(moved.tableau[1].cards).toEqual([card(DIAMONDS, 8), ...run]);
  expect(moved.tableau[0]).toEqual({ cards: [], faceUpStart: 0 });

  const upper = expectAccepted(state, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 1 },
    to: { pile: 'tableau', index: 2 },
  }, null);
  expect(upper.tableau[0].cards).toEqual([card(CLUBS, 7)]);
  expect(upper.tableau[0].faceUpStart).toBe(0);
  expect(upper.tableau[2].cards).toEqual([
    card(SPADES, 7),
    card(HEARTS, 6),
    card(SPADES, 5),
  ]);
});

test('rejects a broken suffix, a requested partial move and a multi-card foundation drop', () => {
  const broken = makeState({
    tableau: [pile([card(CLUBS, 7), card(HEARTS, 6), card(HEARTS, 5)]), pile([card(DIAMONDS, 8)])],
  });
  expect(() => assertInvariants(broken)).toThrow(/invalid-state/);
  expectRejected(broken, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'tableau', index: 1 },
  }, 'illegal-sequence');
  expectRejected(broken, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 1 },
    to: { pile: 'tableau', index: 1 },
  }, 'illegal-sequence');

  const run = makeState({
    tableau: [pile([card(CLUBS, 7), card(HEARTS, 6), card(SPADES, 5)])],
  });
  expectRejected(run, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'tableau', index: 1 },
    count: 1,
  }, 'invalid-command');
  expectRejected(run, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'foundation', index: CLUBS },
  }, 'illegal-sequence');
});

test('reveals exactly one uncovered card and can empty an all-visible column', () => {
  const buried = makeState({
    tableau: [
      pile([card(CLUBS, 9), card(SPADES, 8), card(HEARTS, 6)], 2),
      pile([card(CLUBS, 7)]),
    ],
  });
  const revealed = expectAccepted(buried, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 2 },
    to: { pile: 'tableau', index: 1 },
  }, card(SPADES, 8));
  expect(revealed.tableau[0]).toEqual({
    cards: [card(CLUBS, 9), card(SPADES, 8)],
    faceUpStart: 1,
  });
  expect(revealed.tableau[1].cards).toEqual([card(CLUBS, 7), card(HEARTS, 6)]);

  const visible = makeState({
    tableau: [pile([card(HEARTS, 6)]), pile([card(CLUBS, 7)])],
  });
  const emptied = expectAccepted(visible, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'tableau', index: 1 },
  }, null);
  expect(emptied.tableau[0]).toEqual({ cards: [], faceUpStart: 0 });
});

test('builds each foundation from its ace through the next rank only', () => {
  const ace = makeState({ tableau: [pile([card(HEARTS, 1)])] });
  const withAce = expectAccepted(ace, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'foundation', index: HEARTS },
  }, null);
  expect(withAce.foundations[HEARTS]).toEqual([card(HEARTS, 1)]);

  expectRejected(ace, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'foundation', index: CLUBS },
  }, 'illegal-destination');

  const two = makeState({ tableau: [pile([card(HEARTS, 2)])] });
  expectRejected(two, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'foundation', index: HEARTS },
  }, 'illegal-destination');

  const next = makeState({
    tableau: [pile([card(HEARTS, 2)])],
    foundations: [[], [], [card(HEARTS, 1)], []],
  });
  const built = expectAccepted(next, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'foundation', index: HEARTS },
  }, null);
  expect(built.foundations[HEARTS]).toEqual([card(HEARTS, 1), card(HEARTS, 2)]);

  const gap = makeState({
    tableau: [pile([card(HEARTS, 3)])],
    foundations: [[], [], [card(HEARTS, 1)], []],
  });
  expectRejected(gap, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'foundation', index: HEARTS },
  }, 'illegal-destination');

  const wrongSuit = makeState({
    tableau: [pile([card(DIAMONDS, 2)])],
    foundations: [[], [], [card(HEARTS, 1)], []],
  });
  expectRejected(wrongSuit, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'foundation', index: HEARTS },
  }, 'illegal-destination');
});

test('returns one foundation card to tableau and rejects foundation-to-foundation', () => {
  const state = makeState({
    tableau: [pile([card(HEARTS, 3)])],
    foundations: [[card(CLUBS, 1), card(CLUBS, 2)], [], [], []],
  });
  const returned = expectAccepted(state, {
    type: 'move',
    from: { pile: 'foundation', index: CLUBS },
    to: { pile: 'tableau', index: 0 },
  }, null);
  expect(returned.foundations[CLUBS]).toEqual([card(CLUBS, 1)]);
  expect(returned.tableau[0].cards).toEqual([card(HEARTS, 3), card(CLUBS, 2)]);

  expectRejected(state, {
    type: 'move',
    from: { pile: 'foundation', index: CLUBS },
    to: { pile: 'foundation', index: DIAMONDS },
  }, 'illegal-destination');
  expectRejected(state, {
    type: 'move',
    from: { pile: 'foundation', index: CLUBS },
    to: { pile: 'foundation', index: CLUBS },
  }, 'illegal-destination');
  expectRejected(makeState({ foundations: [[], [], [], []] }), {
    type: 'move',
    from: { pile: 'foundation', index: CLUBS },
    to: { pile: 'tableau', index: 0 },
  }, 'illegal-source');
});

test('completes a foundation king and wins only with 52 legal foundation cards', () => {
  const foundations = completedFoundations();
  const king = foundations[SPADES].pop();
  const near = makeState({
    tableau: [pile([king])],
    foundations,
    stock: [],
  });
  expect(isWon(near)).toBe(false);
  assertInvariants(near);
  const won = expectAccepted(near, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'foundation', index: SPADES },
  }, null);
  expect(won.foundations[SPADES]).toHaveLength(13);
  expect(won.foundations[SPADES][12]).toBe(king);
  expect(won.stock).toEqual([]);
  expect(won.waste).toEqual([]);
  expect(won.tableau.every((column) => column.cards.length === 0)).toBe(true);
  expect(isWon(won)).toBe(true);

  const dealt = completedFoundations();
  expect(isWon(makeState({ foundations: dealt, stock: [] }))).toBe(true);
});

test('rejects illegal foundation contents without throwing from move validation', () => {
  const wrongSuit = makeState({
    foundations: [[card(HEARTS, 1)], [], [], []],
  });
  expect(() => assertInvariants(wrongSuit)).toThrow(/invalid-state/);
  const before = JSON.stringify(wrongSuit);
  expect(applyMove(wrongSuit, {
    type: 'move',
    from: { pile: 'waste' },
    to: { pile: 'tableau', index: 0 },
  }).ok).toBe(false);
  expect(JSON.stringify(wrongSuit)).toBe(before);

  const gap = makeState({
    foundations: [[card(CLUBS, 1), card(CLUBS, 3)], [], [], []],
  });
  expect(() => assertInvariants(gap)).toThrow(/invalid-state/);
});

test('moves only the waste top and rejects stock or waste targets', () => {
  const state = makeState({
    tableau: [pile([card(CLUBS, 7)])],
    waste: [card(CLUBS, 1), card(HEARTS, 6)],
  });
  const moved = expectAccepted(state, {
    type: 'move',
    from: { pile: 'waste' },
    to: { pile: 'tableau', index: 0 },
  }, null);
  expect(moved.waste).toEqual([card(CLUBS, 1)]);
  expect(moved.tableau[0].cards).toEqual([card(CLUBS, 7), card(HEARTS, 6)]);

  const toFoundation = makeState({
    waste: [card(HEARTS, 2), card(HEARTS, 1)],
  });
  const built = expectAccepted(toFoundation, {
    type: 'move',
    from: { pile: 'waste' },
    to: { pile: 'foundation', index: HEARTS },
  }, null);
  expect(built.waste).toEqual([card(HEARTS, 2)]);
  expect(built.foundations[HEARTS]).toEqual([card(HEARTS, 1)]);

  expectRejected(state, {
    type: 'move',
    from: { pile: 'waste', cardIndex: 0 },
    to: { pile: 'tableau', index: 0 },
  }, 'invalid-command');
  expectRejected(makeState(), {
    type: 'move',
    from: { pile: 'waste' },
    to: { pile: 'tableau', index: 0 },
  }, 'illegal-source');
  expectRejected(state, {
    type: 'move',
    from: { pile: 'stock' },
    to: { pile: 'tableau', index: 0 },
  }, 'invalid-command');
  expectRejected(state, {
    type: 'move',
    from: { pile: 'waste' },
    to: { pile: 'stock', index: 0 },
  }, 'invalid-command');
  expectRejected(state, {
    type: 'move',
    from: { pile: 'waste' },
    to: { pile: 'waste' },
  }, 'invalid-command');
});

test('rejects malformed commands and defers draw or recycle', () => {
  const state = makeState({ tableau: [pile([card(CLUBS, 13)])] });
  const stock = state.stock;
  const samples = [null, undefined, 'move', [], 4, { type: 'hint' }, { type: 'reveal' }, { type: 'move' }];
  for (const command of samples) {
    expectRejected(state, command, 'invalid-command');
  }
  expectRejected(state, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'ladder', index: 1 },
  }, 'invalid-command');
  expectRejected(state, {
    type: 'move',
    from: { pile: 'nope', index: 0 },
    to: { pile: 'tableau', index: 1 },
  }, 'invalid-command');
  expectRejected(state, { type: 'draw' }, 'unsupported-command');
  expectRejected(state, { type: 'recycle' }, 'unsupported-command');
  expect(state.stock).toBe(stock);
  expect(isWon(state)).toBe(false);
});

test('reveals a hidden card when moving from tableau to foundation', () => {
  const state = makeState({
    tableau: [pile([card(CLUBS, 9), card(HEARTS, 1)], 1)],
    foundations: [[], [], [], []],
  });
  const moved = expectAccepted(state, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 1 },
    to: { pile: 'foundation', index: HEARTS },
  }, card(CLUBS, 9));
  expect(moved.tableau[0]).toEqual({
    cards: [card(CLUBS, 9)],
    faceUpStart: 0,
  });
  expect(moved.foundations[HEARTS]).toEqual([card(HEARTS, 1)]);
});

test('moves a king from waste or foundation to an empty tableau column and rejects non-kings', () => {
  // Waste King to empty tableau
  const wasteKingState = makeState({
    waste: [card(SPADES, 13)],
  });
  const movedFromWaste = expectAccepted(wasteKingState, {
    type: 'move',
    from: { pile: 'waste' },
    to: { pile: 'tableau', index: 3 },
  }, null);
  expect(movedFromWaste.waste).toEqual([]);
  expect(movedFromWaste.tableau[3]).toEqual({
    cards: [card(SPADES, 13)],
    faceUpStart: 0,
  });

  // Foundation King to empty tableau
  const foundations = completedFoundations();
  const foundationKingState = makeState({
    foundations,
    stock: [],
  });
  const movedFromFoundation = expectAccepted(foundationKingState, {
    type: 'move',
    from: { pile: 'foundation', index: SPADES },
    to: { pile: 'tableau', index: 4 },
  }, null);
  expect(movedFromFoundation.foundations[SPADES]).toHaveLength(12);
  expect(movedFromFoundation.tableau[4]).toEqual({
    cards: [card(SPADES, 13)],
    faceUpStart: 0,
  });

  // Rejection of non-King from waste to empty tableau
  const wasteQueenState = makeState({
    waste: [card(HEARTS, 12)],
  });
  expectRejected(wasteQueenState, {
    type: 'move',
    from: { pile: 'waste' },
    to: { pile: 'tableau', index: 0 },
  }, 'illegal-destination');

  // Rejection of non-King from foundation to empty tableau
  const foundationAceState = makeState({
    foundations: [[card(CLUBS, 1)], [], [], []],
  });
  expectRejected(foundationAceState, {
    type: 'move',
    from: { pile: 'foundation', index: CLUBS },
    to: { pile: 'tableau', index: 0 },
  }, 'illegal-destination');
});

test('rejects invalid foundation destination indices for moves from tableau and foundation', () => {
  const state = makeState({
    tableau: [pile([card(HEARTS, 1)])],
    foundations: [[card(CLUBS, 1)], [], [], []],
  });
  for (const badIndex of [-1, 4, 1.5, '0', null, undefined]) {
    expectRejected(state, {
      type: 'move',
      from: { pile: 'tableau', index: 0, cardIndex: 0 },
      to: { pile: 'foundation', index: badIndex },
    }, 'invalid-command');

    expectRejected(state, {
      type: 'move',
      from: { pile: 'foundation', index: CLUBS },
      to: { pile: 'foundation', index: badIndex },
    }, 'invalid-command');
  }
});

test('rejects move from an empty tableau column', () => {
  const state = makeState({
    tableau: [],
  });
  expectRejected(state, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'tableau', index: 1 },
  }, 'invalid-command');
});

test('rejects corrupted board structures and malformed commands', () => {
  const validState = makeState({ tableau: [pile([card(CLUBS, 13)])] });

  // Malformed commands
  expectRejected(validState, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0, extra: true },
    to: { pile: 'tableau', index: 1 },
  }, 'invalid-command');

  expectRejected(validState, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'tableau', index: 1, extra: true },
  }, 'invalid-command');

  expectRejected(validState, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 99 },
    to: { pile: 'tableau', index: 1 },
  }, 'invalid-command');

  // Corrupted state passed to validateMove / applyMove
  const notAnObject = null;
  expect(validateMove(notAnObject, { type: 'move', from: { pile: 'waste' }, to: { pile: 'tableau', index: 0 } }))
    .toEqual({ ok: false, reason: 'invalid-state' });
  expect(applyMove(notAnObject, { type: 'move', from: { pile: 'waste' }, to: { pile: 'tableau', index: 0 } }))
    .toEqual({ ok: false, reason: 'invalid-state' });

  const wrongColumns = { ...validState, tableau: validState.tableau.slice(0, 6) };
  expect(validateMove(wrongColumns, { type: 'move', from: { pile: 'waste' }, to: { pile: 'tableau', index: 0 } }))
    .toEqual({ ok: false, reason: 'invalid-state' });

  const nullColumnSource = {
    ...validState,
    tableau: [null, ...validState.tableau.slice(1)],
  };
  expect(validateMove(nullColumnSource, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'tableau', index: 1 },
  })).toEqual({ ok: false, reason: 'invalid-state' });

  const nullColumnDest = {
    ...validState,
    tableau: [validState.tableau[0], null, ...validState.tableau.slice(2)],
  };
  expect(validateMove(nullColumnDest, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'tableau', index: 1 },
  })).toEqual({ ok: false, reason: 'invalid-state' });

  const nullFoundationDest = {
    ...validState,
    foundations: [null, [], [], []],
  };
  expect(validateMove(nullFoundationDest, {
    type: 'move',
    from: { pile: 'tableau', index: 0, cardIndex: 0 },
    to: { pile: 'foundation', index: 0 },
  })).toEqual({ ok: false, reason: 'invalid-state' });

  const nullFoundationSource = {
    ...validState,
    foundations: [null, [], [], []],
  };
  expect(validateMove(nullFoundationSource, {
    type: 'move',
    from: { pile: 'foundation', index: 0 },
    to: { pile: 'tableau', index: 1 },
  })).toEqual({ ok: false, reason: 'invalid-state' });
});

test('assertInvariants rejects invalid versions, shapes, piles, and card distributions', () => {
  const validState = makeState();

  expect(() => assertInvariants(null)).toThrow(/invalid-state: shape/);
  expect(() => assertInvariants({ ...validState, rulesVersion: 2 })).toThrow(/invalid-state: version/);
  expect(() => assertInvariants({ ...validState, shuffleVersion: 2 })).toThrow(/invalid-state: version/);
  expect(() => assertInvariants({ ...validState, seed: -1 })).toThrow(/invalid-state: seed/);
  expect(() => assertInvariants({ ...validState, seed: 1.5 })).toThrow(/invalid-state: seed/);
  expect(() => assertInvariants({ ...validState, drawCount: 2 })).toThrow(/invalid-state: draw/);
  expect(() => assertInvariants({ ...validState, stock: null })).toThrow(/invalid-state: piles/);
  expect(() => assertInvariants({ ...validState, waste: 'bad' })).toThrow(/invalid-state: piles/);
  expect(() => assertInvariants({ ...validState, tableau: [] })).toThrow(/invalid-state: tableau/);
  expect(() => assertInvariants({ ...validState, foundations: [] })).toThrow(/invalid-state: foundations/);

  // Column shape errors
  expect(() => assertInvariants({ ...validState, tableau: [null, ...validState.tableau.slice(1)] }))
    .toThrow(/invalid-state: column/);
  expect(() => assertInvariants({
    ...validState,
    tableau: [{ cards: [0], faceUpStart: 1.5 }, ...validState.tableau.slice(1)],
  })).toThrow(/invalid-state: column/);

  // Empty column faceUpStart !== 0
  expect(() => assertInvariants({
    ...validState,
    tableau: [{ cards: [], faceUpStart: 1 }, ...validState.tableau.slice(1)],
  })).toThrow(/invalid-state: empty-column/);

  // Non-empty column faceUpStart out of bounds
  expect(() => assertInvariants({
    ...validState,
    tableau: [{ cards: [card(CLUBS, 13)], faceUpStart: -1 }, ...validState.tableau.slice(1)],
  })).toThrow(/invalid-state: face/);
  expect(() => assertInvariants({
    ...validState,
    tableau: [{ cards: [card(CLUBS, 13)], faceUpStart: 1 }, ...validState.tableau.slice(1)],
  })).toThrow(/invalid-state: face/);

  // Invalid card ID or duplicate
  expect(() => assertInvariants({
    ...validState,
    stock: [...validState.stock.slice(0, -1), 999],
  })).toThrow(/invalid-state: card/);
  expect(() => assertInvariants({
    ...validState,
    stock: [...validState.stock.slice(0, -1), validState.stock[0]],
  })).toThrow(/invalid-state: card/);

  // Foundation errors: wrong size or order
  expect(() => assertInvariants({
    ...validState,
    foundations: [Array.from({ length: 14 }, (_, i) => i), [], [], []],
  })).toThrow(/invalid-state: foundation/);

  // Total count !== 52
  expect(() => assertInvariants({
    ...validState,
    stock: validState.stock.slice(1),
  })).toThrow(/invalid-state: count/);
});

test('isWon handles null, partial or malformed structures defensively', () => {
  expect(isWon(null)).toBe(false);
  expect(isWon(undefined)).toBe(false);
  expect(isWon('string')).toBe(false);
  expect(isWon({})).toBe(false);
  expect(isWon({ stock: [0], waste: [], tableau: [], foundations: [] })).toBe(false);
  expect(isWon({ stock: [], waste: [0], tableau: [], foundations: [] })).toBe(false);
  expect(isWon({ stock: [], waste: [], tableau: [null], foundations: [] })).toBe(false);
  expect(isWon({
    stock: [],
    waste: [],
    tableau: Array.from({ length: 7 }, () => ({ cards: [] })),
    foundations: [[], [], [], []],
  })).toBe(false);
  expect(isWon({
    stock: [],
    waste: [],
    tableau: Array.from({ length: 7 }, () => ({ cards: [] })),
    foundations: [null, [], [], []],
  })).toBe(false);
});
