export const CLUBS = 0;
export const DIAMONDS = 1;
export const HEARTS = 2;
export const SPADES = 3;

export function card(suit, rank) {
  return suit * 13 + (rank - 1);
}

export function pile(cards, faceUpStart = 0) {
  return { cards, faceUpStart };
}

function claim(used, id) {
  if (!Number.isInteger(id) || id < 0 || id > 51 || used.has(id)) {
    throw new Error(`bad fixture card ${id}`);
  }
  used.add(id);
}

function freeze(state) {
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

export function makeState({
  tableau = [],
  waste = [],
  foundations = [[], [], [], []],
  stock,
  drawCount = 1,
  seed = 0,
  rulesVersion = 1,
  shuffleVersion = 1,
} = {}) {
  const columns = Array.from({ length: 7 }, () => ({ cards: [], faceUpStart: 0 }));
  tableau.forEach((column, index) => {
    columns[index] = { cards: [...column.cards], faceUpStart: column.faceUpStart };
  });
  if (foundations.length !== 4) {
    throw new Error('bad fixture foundations');
  }
  const used = new Set();
  for (const column of columns) {
    for (const id of column.cards) claim(used, id);
  }
  for (const id of waste) claim(used, id);
  for (const foundation of foundations) {
    for (const id of foundation) claim(used, id);
  }
  const finalStock = stock === undefined ? [] : [...stock];
  if (stock === undefined) {
    for (let id = 0; id < 52; id += 1) {
      if (!used.has(id)) finalStock.push(id);
    }
  } else {
    for (const id of finalStock) claim(used, id);
    if (used.size !== 52) throw new Error(`fixture has ${used.size} cards`);
  }
  return freeze({
    rulesVersion,
    shuffleVersion,
    seed,
    drawCount,
    stock: finalStock,
    waste,
    tableau: columns,
    foundations,
  });
}

export function completedFoundations() {
  return [CLUBS, DIAMONDS, HEARTS, SPADES].map((suit) => (
    Array.from({ length: 13 }, (_, offset) => card(suit, offset + 1))
  ));
}
