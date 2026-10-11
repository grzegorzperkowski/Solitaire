import { applyMove, getLegalMoves, isWon } from './game.js';
import { rememberVisible } from './knowledge.js';

export function progressStateKey(state, knownCards) {
  // Hidden tableau identities cannot matter before a P1 boundary. Stock/waste
  // IDs are opaque tokens here: keep their order, never inspect hidden ranks.
  return JSON.stringify([
    state.rulesVersion, state.drawCount,
    state.tableau.map((c) => [c.faceUpStart, c.cards.map((id, i) => i < c.faceUpStart ? null : id)]),
    state.foundations, state.stock, state.waste, [...knownCards].sort((a, b) => a - b),
  ]);
}

function isProgress(state, move, initialFoundations, known) {
  if (move.type === 'draw') {
    return state.stock.slice(-state.drawCount).some((id) => !known.has(id));
  }
  if (move.type !== 'move') return false;
  if (move.from.pile === 'waste') return true;
  if (move.from.pile === 'tableau') {
    const column = state.tableau[move.from.index];
    if (column.faceUpStart > 0 && move.from.cardIndex === column.faceUpStart) return true;
    if (move.to.pile === 'foundation') return !initialFoundations.has(column.cards[move.from.cardIndex]);
  }
  return false;
}

// One yield per expanded state lets the controller limit active time and cancel.
// No depth bound: NO_PROGRESS requires exhaustion of the entire neutral graph.
export function* searchProgress(initial, knownCards = [], { maxStates = 10000 } = {}) {
  if (isWon(initial)) return { status: 'WON', visitedStates: 0, noLegalMoves: false };
  const knowledge = rememberVisible(initial, knownCards);
  const known = new Set(knowledge);
  const foundations = new Set(initial.foundations.flat());
  const queue = [initial];
  const visited = new Set([progressStateKey(initial, knowledge)]);
  let cursor = 0;
  let noLegalMoves = false;
  const result = (status) => ({ status, visitedStates: cursor, noLegalMoves });
  while (cursor < queue.length) {
    if (cursor >= maxStates) return result('UNKNOWN');
    const state = queue[cursor];
    queue[cursor++] = null;
    const moves = getLegalMoves(state);
    if (cursor === 1) noLegalMoves = moves.length === 0;
    // Check every immediate boundary before spending resources on successors.
    if (moves.some((move) => isProgress(state, move, foundations, known))) return result('PROGRESS_FOUND');
    for (const move of moves) {
      const next = applyMove(state, move).state;
      const key = progressStateKey(next, knowledge);
      if (visited.has(key)) continue;
      if (visited.size >= maxStates) return result('UNKNOWN');
      visited.add(key);
      queue.push(next);
    }
    if (cursor < queue.length) yield;
  }
  return result('NO_PROGRESS');
}
