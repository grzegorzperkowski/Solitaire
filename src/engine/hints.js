import { applyMove, isWon, getLegalMoves } from './game.js';

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

// Monotone foundation transfers cannot block another foundation transfer.
export function getCompletionPlan(state) {
  if (!state || isWon(state) || state.stock.length || state.tableau.some(c => c.faceUpStart > 0)) return null;
  const plan = [];
  let board = state;
  while (plan.length < 52) {
    const command = getLegalMoves(board).find(move => move.type === 'move' && move.to.pile === 'foundation');
    if (!command) return null;
    const result = applyMove(board, command);
    if (!result.ok) return null;
    plan.push(command);
    board = result.state;
    if (isWon(board)) return Object.freeze(plan.map(command => Object.freeze({
      ...command, from: Object.freeze(command.from), to: Object.freeze(command.to),
    })));
  }
  return null;
}
