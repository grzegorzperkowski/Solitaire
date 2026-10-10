import { getLegalMoves } from './game.js';

function rankMove(state, move) {
  if (move.type !== 'move') return 3;

  if (move.from.pile === 'tableau') {
    const column = state.tableau[move.from.index];
    if (column.faceUpStart > 0 && move.from.cardIndex === column.faceUpStart) return 0;
  }

  return move.to.pile === 'foundation' ? 1 : 2;
}

export function rankHints(state) {
  return getLegalMoves(state)
    .map((move, index) => ({ move, index, rank: rankMove(state, move) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ move }) => move);
}
