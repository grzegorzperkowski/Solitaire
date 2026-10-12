import { applyMove, getLegalMoves } from '../../src/engine/game.js';
import { visibleCards } from '../../src/engine/knowledge.js';

// Independent oracle: exact mechanics, FIFO, no SmartHint key, score or verification.
export function fullStateKey(state) {
  return JSON.stringify([state.rulesVersion, state.drawCount, state.tableau,
    state.foundations, state.stock, state.waste]);
}

export function hintBfs(root, knownCards = [], maxStates = 250000) {
  const known = new Set([...knownCards, ...visibleCards(root)]);
  const foundationCount = root.foundations.flat().length;
  const hiddenCount = root.tableau.reduce((sum, column) => sum + column.faceUpStart, 0);
  const visited = new Set([fullStateKey(root)]);
  const goals = new Map();
  const queue = [root];
  let expanded = 0;
  let truncated = false;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const state = queue[cursor];
    queue[cursor] = null;
    expanded++;
    for (const move of getLegalMoves(state)) {
      const next = applyMove(state, move);
      if (!next.ok) throw new Error('BFS received an illegal move');
      const end = next.state;
      const reveal = end.tableau.reduce((sum, column) => sum + column.faceUpStart, 0) < hiddenCount;
      const advance = end.foundations.flat().length > foundationCount;
      const information = visibleCards(end).some(id => !known.has(id));
      const key = fullStateKey(end);
      if (reveal || advance || information) goals.set(key, { H: reveal, F: advance, I: information });
      if (visited.has(key)) continue;
      if (visited.size >= maxStates) { truncated = true; continue; }
      visited.add(key);
      // Every tableau reveal is terminal, including remembered cards.
      if (!reveal && !information) queue.push(end);
    }
  }
  return { expanded, uniqueStates: visited.size, goalStates: goals.size, truncated,
    goals: { H: [...goals.values()].filter(goal => goal.H).length,
      F: [...goals.values()].filter(goal => goal.F).length,
      I: [...goals.values()].filter(goal => goal.I).length } };
}
