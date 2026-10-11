import { card, makeState, pile, completedFoundations } from './boards.js';
import { assertInvariants, applyMove } from '../../src/engine/game.js';
import { createSession, restoreSessionState } from '../../src/session.js';

// Rank first, then clubs/diamonds/hearts/spades, as specified in T027.
export function progressFixture(id, drawCount = 1) {
  if (id === 8) id = 2;
  if (id === 9) id = 3;
  if (id === 10) return makeState({ foundations: completedFoundations(), stock: [], drawCount });
  if (id === 4) {
    const state = structuredClone(progressFixture(1, drawCount));
    for (const column of state.tableau) {
      const index = column.cards.indexOf(card(3, 7));
      if (index !== -1) column.cards[index] = card(3, 8);
    }
    state.tableau[0].cards[0] = card(3, 7);
    assertInvariants(state);
    return makeState(state);
  }
  const foundations = completedFoundations().map((f, suit) => f.slice(0, id === 3 && suit === 0 ? 9 : 6));
  let hidden = [0, 1, 2, 3, 4, 5, 6];
  let visible = [[card(3, 8)], [card(2, 8)], [card(1, 8)], [card(0, 8)], [card(3, 11)], [card(2, 11)], [card(0, 11)]];
  const stock = [], waste = [];
  if (id === 2) {
    hidden = [0, 0, 2, 3, 4, 5, 6];
    visible = [[card(3, 13)], [], [card(3, 8)], [card(2, 8)], [card(1, 8)], [card(3, 11)], [card(0, 12), card(2, 11), card(0, 10)]];
  }
  if (id === 3) {
    hidden = [0, 1, 2, 3, 4, 4, 4];
    visible = [[card(2, 13)], [card(2, 8)], [card(2, 10)], [card(1, 8)], [card(2, 11)], [card(3, 8)], [card(2, 12)]];
  }
  if (id === 5) {
    visible[0] = [card(2, 10)]; hidden[6] = 4;
    waste.push(card(0, 7), card(0, 9));
  }
  if (id === 6 || id === 7) { stock.push(card(1, 12)); hidden[6] -= 1; }
  const used = new Set([...foundations.flat(), ...visible.flat(), ...stock, ...waste]);
  const remaining = Array.from({ length: 52 }, (_, i) => card(i % 4, Math.floor(i / 4) + 1)).filter((c) => !used.has(c));
  let offset = 0;
  const tableau = visible.map((cards, i) => {
    const buried = remaining.slice(offset, offset += hidden[i]);
    return pile([...buried, ...cards], hidden[i]);
  });
  const state = makeState({ tableau, foundations, stock, waste, drawCount });
  assertInvariants(state);
  return state;
}

export function fixtureSession(state, knownCards) {
  const session = createSession({ seed: 0, drawCount: state.drawCount }, 'progress-fixture');
  return restoreSessionState({ ...session, snapshots: [state], knownCards });
}

export const foundationPreparation = { type: 'move', from: { pile: 'foundation', index: 0 }, to: { pile: 'tableau', index: 2 } };
export const revealAfterPreparation = { type: 'move', from: { pile: 'tableau', index: 1, cardIndex: 1 }, to: { pile: 'tableau', index: 2 } };
export function step(state, move) {
  const result = applyMove(state, move);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}
