import { color, rank, suitIndex } from './cards.js';

const MAX_SEED = 4294967295;

function invalidState(detail) {
  const error = new Error(`invalid-state: ${detail}`);
  error.reason = 'invalid-state';
  throw error;
}

function failure(reason) {
  return { ok: false, reason };
}

function isWhole(value) {
  return typeof value === 'number' && Number.isInteger(value);
}

function isIndex(value, length) {
  return isWhole(value) && value >= 0 && value < length;
}

function exactKeys(value, keys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const present = Object.keys(value);
  return present.length === keys.length && keys.every((key) => present.includes(key));
}

function descendingAlternating(cards) {
  for (let index = 0; index < cards.length - 1; index += 1) {
    const next = cards[index + 1];
    if (rank(next) !== rank(cards[index]) - 1 || color(next) === color(cards[index])) return false;
  }
  return true;
}

function fitsTableau(cardId, destination) {
  if (destination.length === 0) return rank(cardId) === 13;
  const top = destination[destination.length - 1];
  return rank(cardId) === rank(top) - 1 && color(cardId) !== color(top);
}

function freezeState(state) {
  return Object.freeze({
    rulesVersion: state.rulesVersion,
    shuffleVersion: state.shuffleVersion,
    seed: state.seed,
    drawCount: state.drawCount,
    stock: Object.freeze([...state.stock]),
    waste: Object.freeze([...state.waste]),
    tableau: Object.freeze(state.tableau.map((column) => Object.freeze({
      cards: Object.freeze([...column.cards]),
      faceUpStart: column.faceUpStart,
    }))),
    foundations: Object.freeze(state.foundations.map((foundation) => Object.freeze([...foundation]))),
  });
}

export function isWon(state) {
  if (state === null || typeof state !== 'object') return false;
  if (!Array.isArray(state.stock) || state.stock.length !== 0) return false;
  if (!Array.isArray(state.waste) || state.waste.length !== 0) return false;
  if (!Array.isArray(state.tableau) || state.tableau.length !== 7) return false;
  if (state.tableau.some((column) => !column || !Array.isArray(column.cards) || column.cards.length !== 0)) {
    return false;
  }
  if (!Array.isArray(state.foundations) || state.foundations.length !== 4) return false;
  for (let suit = 0; suit < 4; suit += 1) {
    const foundation = state.foundations[suit];
    if (!Array.isArray(foundation) || foundation.length !== 13) return false;
    for (let offset = 0; offset < 13; offset += 1) {
      if (foundation[offset] !== suit * 13 + offset) return false;
    }
  }
  return true;
}

export function assertInvariants(state) {
  if (state === null || typeof state !== 'object') invalidState('shape');
  if (state.rulesVersion !== 1 || state.shuffleVersion !== 1) invalidState('version');
  if (!isWhole(state.seed) || state.seed < 0 || state.seed > MAX_SEED) invalidState('seed');
  if (state.drawCount !== 1 && state.drawCount !== 3) invalidState('draw');
  if (!Array.isArray(state.stock) || !Array.isArray(state.waste)) invalidState('piles');
  if (!Array.isArray(state.tableau) || state.tableau.length !== 7) invalidState('tableau');
  if (!Array.isArray(state.foundations) || state.foundations.length !== 4) invalidState('foundations');

  const seen = new Set();
  const collect = (id) => {
    if (!isWhole(id) || id < 0 || id > 51 || seen.has(id)) invalidState('card');
    seen.add(id);
  };

  for (const column of state.tableau) {
    if (column === null || typeof column !== 'object' || !Array.isArray(column.cards) || !isWhole(column.faceUpStart)) {
      invalidState('column');
    }
    for (const id of column.cards) collect(id);
    if (column.cards.length === 0) {
      if (column.faceUpStart !== 0) invalidState('empty-column');
      continue;
    }
    if (column.faceUpStart < 0 || column.faceUpStart >= column.cards.length) invalidState('face');
    for (let index = column.faceUpStart; index < column.cards.length - 1; index += 1) {
      const next = column.cards[index + 1];
      if (rank(next) !== rank(column.cards[index]) - 1 || color(next) === color(column.cards[index])) {
        invalidState('tableau-order');
      }
    }
  }

  state.foundations.forEach((foundation, suit) => {
    if (!Array.isArray(foundation) || foundation.length > 13) invalidState('foundation');
    foundation.forEach((id, index) => {
      collect(id);
      if (suitIndex(id) !== suit || rank(id) !== index + 1) invalidState('foundation-order');
    });
  });
  for (const id of state.waste) collect(id);
  for (const id of state.stock) collect(id);
  if (seen.size !== 52) invalidState('count');
}

function readSource(state, from) {
  if (from === null || typeof from !== 'object' || Array.isArray(from)) return failure('invalid-command');
  if (from.pile === 'tableau') {
    if (!exactKeys(from, ['pile', 'index', 'cardIndex']) || !isIndex(from.index, 7)) {
      return failure('invalid-command');
    }
    const column = state.tableau[from.index];
    if (!column || !Array.isArray(column.cards) || !isWhole(column.faceUpStart)) {
      return failure('invalid-state');
    }
    if (!isIndex(from.cardIndex, column.cards.length)) return failure('invalid-command');
    if (from.cardIndex < column.faceUpStart) return failure('illegal-source');
    const suffix = column.cards.slice(from.cardIndex);
    if (!descendingAlternating(suffix)) return failure('illegal-sequence');
    const hiddenTop = from.cardIndex > 0 && column.faceUpStart >= from.cardIndex
      ? column.cards[from.cardIndex - 1]
      : null;
    return {
      ok: true,
      pile: 'tableau',
      index: from.index,
      cardIndex: from.cardIndex,
      suffix,
      revealed: hiddenTop,
    };
  }
  if (from.pile === 'waste') {
    if (!exactKeys(from, ['pile'])) return failure('invalid-command');
    if (state.waste.length === 0) return failure('illegal-source');
    return { ok: true, pile: 'waste', suffix: [state.waste.at(-1)], revealed: null };
  }
  if (from.pile === 'foundation') {
    if (!exactKeys(from, ['pile', 'index']) || !isIndex(from.index, 4)) return failure('invalid-command');
    const foundation = state.foundations[from.index];
    if (!Array.isArray(foundation)) return failure('invalid-state');
    if (foundation.length === 0) return failure('illegal-source');
    return { ok: true, pile: 'foundation', index: from.index, suffix: [foundation.at(-1)], revealed: null };
  }
  return failure('invalid-command');
}

function readDestination(state, source, to) {
  if (!exactKeys(to, ['pile', 'index'])) return failure('invalid-command');
  if (to.pile === 'tableau') {
    if (!isIndex(to.index, 7)) return failure('invalid-command');
    const destination = state.tableau[to.index];
    if (!destination || !Array.isArray(destination.cards)) return failure('invalid-state');
    if (source.pile === 'tableau' && source.index === to.index) return failure('illegal-destination');
    if (!fitsTableau(source.suffix[0], destination.cards)) return failure('illegal-destination');
    return { ok: true, pile: 'tableau', index: to.index };
  }
  if (to.pile === 'foundation') {
    if (!isIndex(to.index, 4)) return failure('invalid-command');
    if (!Array.isArray(state.foundations[to.index])) return failure('invalid-state');
    if (source.pile === 'foundation') return failure('illegal-destination');
    if (source.suffix.length !== 1) return failure('illegal-sequence');
    const cardId = source.suffix[0];
    if (suitIndex(cardId) !== to.index || rank(cardId) !== state.foundations[to.index].length + 1) {
      return failure('illegal-destination');
    }
    return { ok: true, pile: 'foundation', index: to.index };
  }
  return failure('invalid-command');
}

function transfer(state, source, destination) {
  const tableau = state.tableau.map((column) => ({
    cards: [...column.cards],
    faceUpStart: column.faceUpStart,
  }));
  const foundations = state.foundations.map((foundation) => [...foundation]);
  let waste = [...state.waste];

  if (source.pile === 'tableau') {
    const column = tableau[source.index];
    column.cards = column.cards.slice(0, source.cardIndex);
    column.faceUpStart = column.cards.length === 0 ? 0 : Math.min(column.faceUpStart, column.cards.length - 1);
  } else if (source.pile === 'waste') {
    waste = waste.slice(0, -1);
  } else {
    foundations[source.index].pop();
  }

  if (destination.pile === 'tableau') {
    const column = tableau[destination.index];
    if (column.cards.length === 0) column.faceUpStart = 0;
    column.cards.push(...source.suffix);
  } else {
    foundations[destination.index].push(source.suffix[0]);
  }

  return freezeState({
    rulesVersion: state.rulesVersion,
    shuffleVersion: state.shuffleVersion,
    seed: state.seed,
    drawCount: state.drawCount,
    stock: state.stock,
    waste,
    tableau,
    foundations,
  });
}

function canReadBoard(state) {
  return state !== null
    && typeof state === 'object'
    && Array.isArray(state.stock)
    && Array.isArray(state.waste)
    && Array.isArray(state.tableau)
    && state.tableau.length === 7
    && Array.isArray(state.foundations)
    && state.foundations.length === 4;
}

// Stock and waste keep the bottom card at index 0. Draw pops the last stock
// id onto the waste, repeating up to drawCount. Recycle reverses the waste
// into the stock and does not draw. [D,C,B,A] drawn by 3 becomes waste
// [A,B,C] and stock [D]. Recycling [A,B,C] becomes stock [C,B,A].
function stockAction(state, command) {
  if (!exactKeys(command, ['type'])) return failure('invalid-command');
  if (state.drawCount !== 1 && state.drawCount !== 3) return failure('invalid-state');
  if (command.type === 'draw') {
    if (state.stock.length === 0) return failure('illegal-source');
    const count = Math.min(state.drawCount, state.stock.length);
    const drawn = state.stock.slice(-count).reverse();
    return {
      ok: true,
      revealed: null,
      state: freezeState({
        ...state,
        stock: state.stock.slice(0, -count),
        waste: state.waste.concat(drawn),
      }),
    };
  }
  if (state.stock.length !== 0 || state.waste.length === 0) return failure('illegal-source');
  return {
    ok: true,
    revealed: null,
    state: freezeState({
      ...state,
      stock: state.waste.slice().reverse(),
      waste: [],
    }),
  };
}

function evaluate(state, command) {
  if (!canReadBoard(state)) return failure('invalid-state');
  if (command === null || typeof command !== 'object' || Array.isArray(command)) return failure('invalid-command');
  if (command.type === 'draw' || command.type === 'recycle') return stockAction(state, command);
  if (!exactKeys(command, ['type', 'from', 'to']) || command.type !== 'move') return failure('invalid-command');

  const source = readSource(state, command.from);
  if (!source.ok) return source;
  const destination = readDestination(state, source, command.to);
  if (!destination.ok) return destination;
  return {
    ok: true,
    state: transfer(state, source, destination),
    revealed: source.revealed,
  };
}

export function validateMove(state, command) {
  const result = evaluate(state, command);
  return result.ok ? { ok: true } : failure(result.reason);
}

export function applyMove(state, command) {
  const result = evaluate(state, command);
  if (!result.ok) return failure(result.reason);
  return { ok: true, state: result.state, revealed: result.revealed };
}

function addDestinations(state, from, moves) {
  // Enumeration needs validation only; materialize a successor when applying the command.
  const source = readSource(state, from);
  if (!source.ok) return;
  for (let index = 0; index < 7; index += 1) {
    const command = { type: 'move', from, to: { pile: 'tableau', index } };
    if (readDestination(state, source, command.to).ok) moves.push(command);
  }
  for (let index = 0; index < 4; index += 1) {
    const command = { type: 'move', from, to: { pile: 'foundation', index } };
    if (readDestination(state, source, command.to).ok) moves.push(command);
  }
}

// Stable scan, not hint rank: draw, recycle, tableau columns and face-up
// cardIndex ascending, waste, then foundations. Each source tries tableau
// destinations 0..6 before foundation destinations 0..3.
export function getLegalMoves(state) {
  if (!canReadBoard(state)) return [];
  const moves = [];
  if (validateMove(state, { type: 'draw' }).ok) moves.push({ type: 'draw' });
  if (validateMove(state, { type: 'recycle' }).ok) moves.push({ type: 'recycle' });
  for (let index = 0; index < 7; index += 1) {
    const column = state.tableau[index];
    for (let cardIndex = column.faceUpStart; cardIndex < column.cards.length; cardIndex += 1) {
      addDestinations(state, { pile: 'tableau', index, cardIndex }, moves);
    }
  }
  if (state.waste.length > 0) addDestinations(state, { pile: 'waste' }, moves);
  for (let index = 0; index < 4; index += 1) {
    if (state.foundations[index].length === 0) continue;
    addDestinations(state, { pile: 'foundation', index }, moves);
  }
  return moves;
}
