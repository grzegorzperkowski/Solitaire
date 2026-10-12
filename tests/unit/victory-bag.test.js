import { describe, expect, test } from 'vitest';
import { getNextVictoryAnimation, VICTORY_ANIMATIONS } from '../../src/ui/victory-bag.js';

function memoryStorage(value = null) {
  return {
    value,
    getItem() { return this.value; },
    setItem(_key, value) { this.value = value; },
  };
}

describe('victory shuffle bag', () => {
  test('uses every effect once per bag and avoids repeats across cycles', () => {
    const storage = memoryStorage();
    const next = Array.from({ length: 8 }, () => getNextVictoryAnimation(storage, () => 0));
    expect(new Set(next.slice(0, 4))).toEqual(new Set(VICTORY_ANIMATIONS));
    expect(new Set(next.slice(4))).toEqual(new Set(VICTORY_ANIMATIONS));
    expect(next[3]).not.toBe(next[4]);
  });

  test('restores valid state and recovers from corrupt or unavailable storage', () => {
    const storage = memoryStorage(JSON.stringify({ version: 1, bag: [...VICTORY_ANIMATIONS].slice(1), last: VICTORY_ANIMATIONS[0] }));
    expect(getNextVictoryAnimation(storage, () => 0)).toBe(VICTORY_ANIMATIONS[1]);
    const corrupt = memoryStorage('{bad');
    expect(VICTORY_ANIMATIONS).toContain(getNextVictoryAnimation(corrupt, () => 0));
    expect(VICTORY_ANIMATIONS).toContain(getNextVictoryAnimation({ getItem: () => { throw Error(); }, setItem: () => { throw Error(); } }, () => 0));
  });

  test('keeps shuffle-bag progress in memory when storage cannot be used', () => {
    const unavailable = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
    const next = Array.from({ length: 4 }, () => getNextVictoryAnimation(unavailable, () => 0));
    expect(new Set(next)).toEqual(new Set(VICTORY_ANIMATIONS));
  });

  test('rejects duplicate and unknown persisted identifiers', () => {
    const storage = memoryStorage(JSON.stringify({ version: 1, bag: ['magic-fan', 'magic-fan'], last: null }));
    expect(VICTORY_ANIMATIONS).toContain(getNextVictoryAnimation(storage, () => 0));
  });
});
