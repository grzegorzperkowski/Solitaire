import { expect, test } from 'vitest';
import { createSession, execute, undo, redo } from '../../src/session.js';
import { successFeedback } from '../../src/ui/success-feedback.js';
import { makeState, pile } from '../fixtures/boards.js';

function sessionFor(board) {
  return { ...createSession({ seed: 0, drawCount: 1 }), state: board, snapshots: [board] };
}
const move = (index, to, cardIndex = 0) => ({ type: 'move', from: { pile: 'tableau', index, cardIndex }, to });
const foundation = { pile: 'foundation', index: 0 };

test('reveal and emptied slot reflect the atomic move without changing board/history', () => {
  const before = sessionFor(makeState({ tableau: [pile([5, 0], 1)] }));
  const after = execute(before, move(0, foundation, 1)).session;
  expect(successFeedback(before, after)).toEqual([
    { target: '#column-0 .card-node:last-child', kind: 'reveal', level: 1 },
    { target: '#foundation-0 .card-node', kind: 'ace', level: 1 },
  ]);
  expect(after.state.tableau[0]).toEqual(pile([5]));
  expect(after.cursor).toBe(1);
  const emptyBefore = sessionFor(makeState({ tableau: [pile([0])] }));
  const emptyAfter = execute(emptyBefore, move(0, foundation)).session;
  expect(successFeedback(emptyBefore, emptyAfter)[0]).toEqual({ target: '#column-0 .pile-slot', kind: 'empty', level: 1 });
});

test('foundation streak grows, caps at four and a draw resets it', () => {
  const board = makeState({ waste: [4, 3, 2, 1, 0] });
  let before = sessionFor(makeState({ waste: board.waste, stock: [...board.stock.slice(1), 5] }));
  const command = { type: 'move', from: { pile: 'waste' }, to: foundation };
  for (const level of [1, 2, 3, 4, 4]) {
    const after = execute(before, command).session;
    expect(successFeedback(before, after)).toEqual([
      { target: '#foundation-0 .card-node', kind: level === 1 ? 'ace' : 'streak', level },
    ]);
    before = after;
  }
  const drawn = execute(before, { type: 'draw' }).session;
  expect(successFeedback(before, drawn)).toEqual([]);
  const after = execute(drawn, command).session;
  expect(after).toBeDefined();
  expect(successFeedback(drawn, after)).toEqual([]);
});

test('initial rendering, selection/timer, Undo, Redo and new attempts do not celebrate', () => {
  const before = sessionFor(makeState({ tableau: [pile([0])] }));
  const after = execute(before, move(0, foundation)).session;
  const undone = undo(after);
  expect(successFeedback(null, after)).toEqual([]);
  expect(successFeedback(after, after)).toEqual([]);
  expect(successFeedback(after, undone)).toEqual([]);
  expect(successFeedback(undone, redo(undone))).toEqual([]);
  expect(successFeedback(before, { ...after, attemptId: 'different' })).toEqual([]);
  const branch = execute(undone, move(0, foundation)).session;
  expect(successFeedback(undone, branch)).toHaveLength(2);
});
