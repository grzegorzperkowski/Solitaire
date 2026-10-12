import { expect, test, vi } from 'vitest';
import { getLegalMoves } from '../../src/engine/game.js';
import { h07 } from '../fixtures/smart-hints.js';

test('enumerating tableau destinations does not allocate and freeze successor boards', () => {
  const state = h07();
  const spy = vi.spyOn(Object, 'freeze');
  let freezes;
  let moves;
  try {
    moves = getLegalMoves(state);
    freezes = spy.mock.calls.length;
  } finally {
    spy.mockRestore();
  }
  expect(moves.length).toBeGreaterThan(0);
  expect(freezes).toBe(0);
});
