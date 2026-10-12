export const VICTORY_ANIMATIONS = Object.freeze([
  'classic-cascade', 'magic-fan', 'suit-fireworks', 'card-tornado',
]);

const STORAGE_KEY = 'pl.solitaire.victory-bag.v1';
let memoryState = { version: 1, bag: [], last: null };

function copyState(state) {
  return { ...state, bag: [...state.bag] };
}

function shuffled(random) {
  const bag = [...VICTORY_ANIMATIONS];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function readState(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(STORAGE_KEY));
    if (parsed?.version === 1 && Array.isArray(parsed.bag) &&
        parsed.bag.every((item) => VICTORY_ANIMATIONS.includes(item)) &&
        new Set(parsed.bag).size === parsed.bag.length &&
        (parsed.last === null || VICTORY_ANIMATIONS.includes(parsed.last)) &&
        parsed.bag.every((item) => item !== parsed.last)) return copyState(parsed);
  } catch { /* unavailable or malformed storage: start a fresh in-memory bag */ }
  return copyState(memoryState);
}

export function getNextVictoryAnimation(storage, random = Math.random) {
  const state = readState(storage);
  if (!state.bag.length) {
    state.bag = shuffled(random);
    if (state.bag[0] === state.last) [state.bag[0], state.bag[1]] = [state.bag[1], state.bag[0]];
  }
  state.last = state.bag.shift();
  memoryState = copyState(state);
  try { storage?.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* in-memory fallback */ }
  return state.last;
}
