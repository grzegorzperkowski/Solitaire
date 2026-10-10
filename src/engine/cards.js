const SUIT_NAMES = ['trefl', 'karo', 'kier', 'pik'];
const MAX_SEED = 4294967295;

export function suitIndex(id) {
  return Math.floor(id / 13);
}

export function rank(id) {
  return (id % 13) + 1;
}

export function color(id) {
  const suit = suitIndex(id);
  return suit === 1 || suit === 2 ? 'red' : 'black';
}

export function suitName(id) {
  return SUIT_NAMES[suitIndex(id)];
}

function reject(reason) {
  const error = new Error(reason);
  error.reason = reason;
  throw error;
}

function readOptions(options) {
  if (options === null || typeof options !== 'object') {
    reject('invalid-options');
  }
  const { seed, drawCount } = options;
  if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0 || seed > MAX_SEED) {
    reject('invalid-seed');
  }
  if (drawCount !== 1 && drawCount !== 3) {
    reject('invalid-draw-count');
  }
  const rulesVersion = options.rulesVersion === undefined ? 1 : options.rulesVersion;
  const shuffleVersion = options.shuffleVersion === undefined ? 1 : options.shuffleVersion;
  if (rulesVersion !== 1) {
    reject('unsupported-rules-version');
  }
  if (shuffleVersion !== 1) {
    reject('unsupported-shuffle-version');
  }
  return { seed: seed >>> 0, drawCount, rulesVersion, shuffleVersion };
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function sample() {
    state = (state + 0x6D2B79F5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(seed) {
  const cards = Array.from({ length: 52 }, (_, id) => id);
  const sample = mulberry32(seed);
  for (let index = cards.length - 1; index >= 1; index -= 1) {
    const swapIndex = Math.floor(sample() * (index + 1));
    const current = cards[index];
    cards[index] = cards[swapIndex];
    cards[swapIndex] = current;
  }
  return cards;
}

export function createGame(options) {
  const gameOptions = readOptions(options);
  const cards = shuffle(gameOptions.seed);
  const columns = Array.from({ length: 7 }, () => []);
  for (let row = 0; row < 7; row += 1) {
    for (let column = row; column < 7; column += 1) {
      columns[column].push(cards.pop());
    }
  }
  return Object.freeze({
    rulesVersion: gameOptions.rulesVersion,
    shuffleVersion: gameOptions.shuffleVersion,
    seed: gameOptions.seed,
    drawCount: gameOptions.drawCount,
    stock: Object.freeze(cards),
    waste: Object.freeze([]),
    tableau: Object.freeze(columns.map((column) => Object.freeze({
      cards: Object.freeze(column),
      faceUpStart: column.length - 1,
    }))),
    foundations: Object.freeze([
      Object.freeze([]),
      Object.freeze([]),
      Object.freeze([]),
      Object.freeze([]),
    ]),
  });
}
