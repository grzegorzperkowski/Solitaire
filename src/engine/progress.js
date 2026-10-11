import { applyMove, getLegalMoves, isWon } from './game.js';
import { rememberVisible, visibleCards } from './knowledge.js';

export function progressStateKey(state, knownCards) {
  // Hidden tableau identities cannot matter before a P1 boundary. Stock/waste
  // IDs are opaque tokens here: keep their order, never inspect hidden ranks.
  return JSON.stringify([
    state.rulesVersion, state.drawCount,
    state.tableau.map((c) => [c.faceUpStart, c.cards.map((id, i) => i < c.faceUpStart ? null : id)]),
    state.foundations, state.stock, state.waste, [...knownCards].sort((a, b) => a - b),
  ]);
}

function classifyProgress(applied, initialFoundationCount, known) {
  const after = applied.state;
  if (applied.revealed != null) return 'REVEAL';
  if (after.foundations.reduce((total, foundation) => total + foundation.length, 0) > initialFoundationCount) {
    return 'FOUNDATION_ADVANCE';
  }
  if (visibleCards(after).some((id) => !known.has(id))) return 'INFORMATION';
  return null;
}

// One yield per expanded state lets the controller limit active time and cancel.
// No depth bound: NO_PROGRESS requires exhaustion of the entire neutral graph.
export function* searchProgress(initial, knownCards = [], { maxStates = 10000 } = {}) {
  if (isWon(initial)) return { status: 'WON', visitedStates: 0, noLegalMoves: false };
  const knowledge = rememberVisible(initial, knownCards);
  const known = new Set(knowledge);
  const initialFoundationCount = initial.foundations.reduce((total, foundation) => total + foundation.length, 0);
  const queue = [initial];
  const visited = new Set([progressStateKey(initial, knowledge)]);
  let cursor = 0;
  let noLegalMoves = false;
  const result = (status, goal) => ({ status, visitedStates: cursor, noLegalMoves, ...(goal ? { goal } : {}) });
  while (cursor < queue.length) {
    if (cursor >= maxStates) return result('UNKNOWN');
    const state = queue[cursor];
    queue[cursor++] = null;
    const moves = getLegalMoves(state);
    if (cursor === 1) noLegalMoves = moves.length === 0;
    for (const move of moves) {
      const applied = applyMove(state, move);
      if (!applied.ok) continue;
      const goal = classifyProgress(applied, initialFoundationCount, known);
      if (goal) return result('PROGRESS_FOUND', goal);
      const key = progressStateKey(applied.state, knowledge);
      if (visited.has(key)) continue;
      if (visited.size >= maxStates) return result('UNKNOWN');
      visited.add(key);
      queue.push(applied.state);
    }
    if (cursor < queue.length) yield;
  }
  return result('NO_PROGRESS');
}
