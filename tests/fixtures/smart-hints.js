/**
 * SmartHint test fixtures — full-deck boards checked by assertInvariants.
 * IDs follow T028-spec §7 H01–H15.
 */
import { card, makeState, pile, completedFoundations, CLUBS, DIAMONDS, HEARTS, SPADES } from './boards.js';
import { progressFixture } from './progress.js';
import { assertInvariants } from '../../src/engine/game.js';

// H01: Direct reveal — moving 5♥ onto 6♠ directly reveals the hidden card in col 0.
export function h01() {
  const state = makeState({
    tableau: [
      pile([card(CLUBS, 13), card(HEARTS, 5)], 1),    // col0: K♣ hidden, 5♥ face-up
      pile([card(SPADES, 6)], 0),                       // col1: 6♠ face-up
      pile([card(HEARTS, 13)], 0),                      // col2: K♥
      pile([card(SPADES, 13)], 0),                      // col3: K♠
      pile([card(CLUBS, 12)], 0),                       // col4: Q♣
      pile([card(HEARTS, 12)], 0),                      // col5: Q♥
      pile([card(SPADES, 12)], 0),                      // col6: Q♠
    ],
    foundations: [
      [card(CLUBS, 1), card(CLUBS, 2), card(CLUBS, 3), card(CLUBS, 4)],
      [card(DIAMONDS, 1), card(DIAMONDS, 2), card(DIAMONDS, 3), card(DIAMONDS, 4), card(DIAMONDS, 5), card(DIAMONDS, 6), card(DIAMONDS, 7), card(DIAMONDS, 8), card(DIAMONDS, 9), card(DIAMONDS, 10), card(DIAMONDS, 11), card(DIAMONDS, 12), card(DIAMONDS, 13)],
      [card(HEARTS, 1), card(HEARTS, 2), card(HEARTS, 3)],
      [card(SPADES, 1), card(SPADES, 2), card(SPADES, 3), card(SPADES, 4)],
    ],
    drawCount: 1,
  });
  assertInvariants(state);
  return state;
}

// H02: Second move reveals — two-step sequence where move 1 is returning J♦ from foundation 1 onto Q♣ (col 1),
// and move 2 is moving 10♠ onto J♦ (col 1), which reveals col 0.
export function h02() {
  const state = makeState({
    tableau: [
      pile([card(CLUBS, 7), card(SPADES, 10)], 1),    // col0: 7♣ hidden, 10♠ face-up
      pile([card(CLUBS, 12)], 0),                      // col1: Q♣ face-up
      pile([card(SPADES, 13)], 0),                     // col2: K♠
      pile([card(HEARTS, 13)], 0),                     // col3: K♥
      pile([card(CLUBS, 13)], 0),                      // col4: K♣
      pile([card(DIAMONDS, 13)], 0),                   // col5: K♦
      pile([card(HEARTS, 12)], 0),                     // col6: Q♥
    ],
    foundations: [
      [card(CLUBS, 1), card(CLUBS, 2), card(CLUBS, 3), card(CLUBS, 4), card(CLUBS, 5), card(CLUBS, 6)],
      [card(DIAMONDS, 1), card(DIAMONDS, 2), card(DIAMONDS, 3), card(DIAMONDS, 4), card(DIAMONDS, 5), card(DIAMONDS, 6), card(DIAMONDS, 7), card(DIAMONDS, 8), card(DIAMONDS, 9), card(DIAMONDS, 10), card(DIAMONDS, 11)], // top J♦
      [card(HEARTS, 1), card(HEARTS, 2), card(HEARTS, 3), card(HEARTS, 4), card(HEARTS, 5), card(HEARTS, 6), card(HEARTS, 7), card(HEARTS, 8)],
      [card(SPADES, 1), card(SPADES, 2), card(SPADES, 3), card(SPADES, 4), card(SPADES, 5), card(SPADES, 6), card(SPADES, 7), card(SPADES, 8)],
    ],
    drawCount: 1,
  });
  assertInvariants(state);
  return state;
}

// H03: Foundation vs reveal comparison — both are possible, utility U chooses reveal
export function h03() {
  // col0: 10♦ hidden, 5♥ face up. Moving 5♥ to col1's 6♠ reveals col0 (H=1, score ~66).
  // col1: 6♠ can move to Spades foundation (foundations at 5♠), but forfeits the reveal (loss penalty B=1).
  // Reveal should win over foundation move.
  const state = makeState({
    tableau: [
      pile([card(DIAMONDS, 10), card(HEARTS, 5)], 1), // col0: 10♦ hidden, 5♥
      pile([card(SPADES, 6)], 0),                      // col1: 6♠
      pile([card(HEARTS, 13)], 0),
      pile([card(SPADES, 13)], 0),
      pile([card(CLUBS, 13)], 0),
      pile([card(DIAMONDS, 13)], 0),
      pile([card(HEARTS, 12)], 0),
    ],
    foundations: [
      [card(CLUBS, 1), card(CLUBS, 2), card(CLUBS, 3), card(CLUBS, 4)],
      [card(DIAMONDS, 1), card(DIAMONDS, 2), card(DIAMONDS, 3), card(DIAMONDS, 4)],
      [card(HEARTS, 1), card(HEARTS, 2), card(HEARTS, 3)],
      [card(SPADES, 1), card(SPADES, 2), card(SPADES, 3), card(SPADES, 4), card(SPADES, 5)],
    ],
    drawCount: 1,
  });
  assertInvariants(state);
  return state;
}

// H04: Foundation return enables reveal
export function h04() {
  // col0: 7♣ hidden, 8♠ face-up.
  // col1: 10♣ face-up.
  // Hearts foundation has 9♥ at top.
  // Move 1: return 9♥ from foundation to 10♣.
  // Move 2: move 8♠ onto 9♥, revealing col0.
  const state = makeState({
    tableau: [
      pile([card(CLUBS, 7), card(SPADES, 8)], 1),      // col0: 7♣ hidden, 8♠
      pile([card(CLUBS, 10)], 0),                        // col1: 10♣
      pile([card(HEARTS, 13)], 0),
      pile([card(SPADES, 13)], 0),
      pile([card(CLUBS, 13)], 0),
      pile([card(CLUBS, 12)], 0),
      pile([card(HEARTS, 12)], 0),
    ],
    foundations: [
      [card(CLUBS, 1), card(CLUBS, 2), card(CLUBS, 3), card(CLUBS, 4), card(CLUBS, 5), card(CLUBS, 6)],
      [card(DIAMONDS, 1), card(DIAMONDS, 2), card(DIAMONDS, 3), card(DIAMONDS, 4), card(DIAMONDS, 5), card(DIAMONDS, 6), card(DIAMONDS, 7), card(DIAMONDS, 8), card(DIAMONDS, 9), card(DIAMONDS, 10), card(DIAMONDS, 11), card(DIAMONDS, 12), card(DIAMONDS, 13)],
      [card(HEARTS, 1), card(HEARTS, 2), card(HEARTS, 3), card(HEARTS, 4), card(HEARTS, 5), card(HEARTS, 6), card(HEARTS, 7), card(HEARTS, 8), card(HEARTS, 9)],
      [card(SPADES, 1), card(SPADES, 2), card(SPADES, 3), card(SPADES, 4), card(SPADES, 5), card(SPADES, 6)],
    ],
    drawCount: 1,
  });
  assertInvariants(state);
  return state;
}

// H05: Waste→tableau is preparation; it requires a subsequent strategic goal.
export function h05() {
  // Waste has 7♥. col1 has 8♠ face-up.
  // Foundations capped so tableau cards cannot move to foundations.
  const state = makeState({
    tableau: [
      pile([card(HEARTS, 13)], 0),
      pile([card(SPADES, 8)], 0),
      pile([card(CLUBS, 13)], 0),
      pile([card(SPADES, 13)], 0),
      pile([card(CLUBS, 12)], 0),
      pile([card(HEARTS, 12)], 0),
      pile([card(SPADES, 12)], 0),
    ],
    waste: [card(HEARTS, 7)],
    foundations: [
      [card(CLUBS, 1), card(CLUBS, 2), card(CLUBS, 3), card(CLUBS, 4), card(CLUBS, 5), card(CLUBS, 6), card(CLUBS, 7), card(CLUBS, 8), card(CLUBS, 9), card(CLUBS, 10)],
      [card(DIAMONDS, 1), card(DIAMONDS, 2), card(DIAMONDS, 3), card(DIAMONDS, 4), card(DIAMONDS, 5), card(DIAMONDS, 6), card(DIAMONDS, 7), card(DIAMONDS, 8), card(DIAMONDS, 9), card(DIAMONDS, 10), card(DIAMONDS, 11), card(DIAMONDS, 12), card(DIAMONDS, 13)],
      [card(HEARTS, 1), card(HEARTS, 2), card(HEARTS, 3), card(HEARTS, 4), card(HEARTS, 5)], // 5♥, so 7♥ cannot go here
      [card(SPADES, 1), card(SPADES, 2), card(SPADES, 3), card(SPADES, 4), card(SPADES, 5), card(SPADES, 6)],
    ],
    drawCount: 1,
  });
  assertInvariants(state);
  return state;
}

// H06: Draw 3 with waste/recycle — exact stock/waste ordering preserved
export function h06() {
  const state = makeState({
    tableau: [
      pile([card(HEARTS, 13)], 0),
      pile([card(SPADES, 13)], 0),
      pile([card(CLUBS, 13)], 0),
      pile([card(DIAMONDS, 13)], 0),
      pile([card(HEARTS, 12)], 0),
      pile([card(SPADES, 12)], 0),
      pile([card(CLUBS, 12)], 0),
    ],
    waste: [card(DIAMONDS, 8), card(CLUBS, 8)],
    foundations: [
      [card(CLUBS, 1), card(CLUBS, 2), card(CLUBS, 3), card(CLUBS, 4), card(CLUBS, 5), card(CLUBS, 6), card(CLUBS, 7)],
      [card(DIAMONDS, 1), card(DIAMONDS, 2), card(DIAMONDS, 3), card(DIAMONDS, 4), card(DIAMONDS, 5), card(DIAMONDS, 6), card(DIAMONDS, 7)],
      [card(HEARTS, 1), card(HEARTS, 2), card(HEARTS, 3), card(HEARTS, 4), card(HEARTS, 5), card(HEARTS, 6), card(HEARTS, 7)],
      [card(SPADES, 1), card(SPADES, 2), card(SPADES, 3), card(SPADES, 4), card(SPADES, 5), card(SPADES, 6), card(SPADES, 7)],
    ],
    drawCount: 3,
  });
  assertInvariants(state);
  return state;
}

// H07: King between empty columns — no idle suggestion, no cycle points
// Uses canonical progressFixture(2) where only legal move is King between empty columns
export function h07() {
  const state = progressFixture(2);
  assertInvariants(state);
  return state;
}

// H08: Only option is unknown stock draw — returns EXPLORATION
// Uses canonical progressFixture(7) where only legal move is unknown stock draw
export function h08() {
  const state = progressFixture(7);
  assertInvariants(state);
  return state;
}

// H09: Two paths — utility U determines the choice
export function h09() {
  const state = makeState({
    tableau: [
      pile([card(CLUBS, 7), card(HEARTS, 5)], 1),      // col0: hidden + 5♥
      pile([card(SPADES, 6)], 0),                        // col1: 6♠ — 5♥ can go here (reveal)
      pile([card(CLUBS, 8), card(HEARTS, 6)], 1),       // col2: hidden + 6♥
      pile([card(SPADES, 7)], 0),                        // col3: 7♠ — 6♥ can go here (reveal)
      pile([card(DIAMONDS, 13)], 0),
      pile([card(CLUBS, 13)], 0),
      pile([card(HEARTS, 13)], 0),
    ],
    foundations: [
      [card(CLUBS, 1), card(CLUBS, 2), card(CLUBS, 3), card(CLUBS, 4), card(CLUBS, 5), card(CLUBS, 6)],
      [card(DIAMONDS, 1), card(DIAMONDS, 2), card(DIAMONDS, 3), card(DIAMONDS, 4), card(DIAMONDS, 5), card(DIAMONDS, 6), card(DIAMONDS, 7), card(DIAMONDS, 8), card(DIAMONDS, 9), card(DIAMONDS, 10), card(DIAMONDS, 11), card(DIAMONDS, 12)],
      [card(HEARTS, 1), card(HEARTS, 2), card(HEARTS, 3), card(HEARTS, 4)],
      [card(SPADES, 1), card(SPADES, 2), card(SPADES, 3), card(SPADES, 4), card(SPADES, 5)],
    ],
    drawCount: 1,
  });
  assertInvariants(state);
  return state;
}

// H10: Permutation invariance — same visible state with different hidden card IDs
export function h10(variant = 0) {
  const hidden0 = variant === 0 ? card(CLUBS, 9) : card(CLUBS, 10);
  const hidden1 = variant === 0 ? card(CLUBS, 10) : card(CLUBS, 9);
  const state = makeState({
    tableau: [
      pile([hidden0, card(HEARTS, 5)], 1),               // col0: hidden + 5♥
      pile([hidden1, card(SPADES, 6)], 1),               // col1: hidden + 6♠
      pile([card(HEARTS, 13)], 0),
      pile([card(SPADES, 13)], 0),
      pile([card(CLUBS, 12)], 0),
      pile([card(CLUBS, 13)], 0),
      pile([card(HEARTS, 12)], 0),
    ],
    foundations: [
      [card(CLUBS, 1), card(CLUBS, 2), card(CLUBS, 3), card(CLUBS, 4), card(CLUBS, 5), card(CLUBS, 6), card(CLUBS, 7), card(CLUBS, 8)],
      [card(DIAMONDS, 1), card(DIAMONDS, 2), card(DIAMONDS, 3), card(DIAMONDS, 4), card(DIAMONDS, 5), card(DIAMONDS, 6), card(DIAMONDS, 7), card(DIAMONDS, 8), card(DIAMONDS, 9), card(DIAMONDS, 10), card(DIAMONDS, 11), card(DIAMONDS, 12), card(DIAMONDS, 13)],
      [card(HEARTS, 1), card(HEARTS, 2), card(HEARTS, 3)],
      [card(SPADES, 1), card(SPADES, 2), card(SPADES, 3), card(SPADES, 4)],
    ],
    drawCount: 1,
  });
  assertInvariants(state);
  return state;
}

// H11: Budget limits (depth/states/time) — never says NO_PROGRESS
export function h11() {
  const state = makeState({
    tableau: [
      pile([card(CLUBS, 8), card(CLUBS, 10), card(HEARTS, 5)], 2),
      pile([card(DIAMONDS, 9), card(SPADES, 6)], 1),
      pile([card(HEARTS, 8), card(SPADES, 10), card(HEARTS, 9)], 1),
      pile([card(SPADES, 9), card(DIAMONDS, 8)], 1),
      pile([card(HEARTS, 13)], 0),
      pile([card(SPADES, 13)], 0),
      pile([card(CLUBS, 13)], 0),
    ],
    foundations: [
      [card(CLUBS, 1), card(CLUBS, 2), card(CLUBS, 3), card(CLUBS, 4), card(CLUBS, 5), card(CLUBS, 6), card(CLUBS, 7)],
      [card(DIAMONDS, 1), card(DIAMONDS, 2), card(DIAMONDS, 3), card(DIAMONDS, 4), card(DIAMONDS, 5), card(DIAMONDS, 6), card(DIAMONDS, 7)],
      [card(HEARTS, 1), card(HEARTS, 2), card(HEARTS, 3), card(HEARTS, 4)],
      [card(SPADES, 1), card(SPADES, 2), card(SPADES, 3), card(SPADES, 4), card(SPADES, 5)],
    ],
    drawCount: 1,
  });
  assertInvariants(state);
  return state;
}

// H15: Won board — WON status, empty plan, no suggestion
export function h15() {
  return makeState({
    foundations: completedFoundations(),
    stock: [],
    waste: [],
    drawCount: 1,
  });
}
