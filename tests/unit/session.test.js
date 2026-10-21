import { describe, expect, test } from 'vitest';
import { createGame } from '../../src/engine/cards.js';
import { isWon } from '../../src/engine/game.js';
import {
  addElapsedMs,
  canRedo,
  canUndo,
  createSession,
  execute,
  getWinPercentage,
  redo,
  restartSession,
  setElapsedMs,
  undo,
} from '../../src/session.js';
import {
  CLUBS,
  DIAMONDS,
  HEARTS,
  SPADES,
  card,
  makeState,
  pile,
} from '../fixtures/boards.js';

describe('T006 session history and accounting', () => {
  test('createSession initializes default session from valid options', () => {
    const session = createSession({ seed: 42, drawCount: 1 });
    expect(typeof session.attemptId).toBe('string');
    expect(session.attemptId.length).toBeGreaterThan(0);
    expect(session.options).toEqual({
      seed: 42,
      drawCount: 1,
      rulesVersion: 1,
      shuffleVersion: 1,
    });
    expect(session.commands).toEqual([]);
    expect(session.cursor).toBe(0);
    expect(session.snapshots).toHaveLength(1);
    expect(session.state).toEqual(createGame({ seed: 42, drawCount: 1 }));
    expect(session.snapshots[0]).toEqual(createGame({ seed: 42, drawCount: 1 }));
    expect(session.elapsedMs).toBe(0);
    expect(session.started).toBe(false);
    expect(session.winRecorded).toBe(false);
    expect(session.statistics).toEqual({
      draw1: { attempts: 0, wins: 0, bestTimeMs: null, fewestMoves: null },
      draw3: { attempts: 0, wins: 0, bestTimeMs: null, fewestMoves: null },
    });
    expect(canUndo(session)).toBe(false);
    expect(canRedo(session)).toBe(false);
    expect(Object.isFrozen(session)).toBe(true);
    expect(Object.isFrozen(session.commands)).toBe(true);
    expect(Object.isFrozen(session.snapshots)).toBe(true);
  });

  test('createSession accepts explicit attemptId and statistics', () => {
    const initialStats = {
      draw1: { attempts: 5, wins: 2, bestTimeMs: 60000, fewestMoves: 70 },
      draw3: { attempts: 1, wins: 0, bestTimeMs: null, fewestMoves: null },
    };
    const session = createSession({ seed: 10, drawCount: 3 }, 'custom-uuid-123', initialStats);
    expect(session.attemptId).toBe('custom-uuid-123');
    expect(session.statistics).toEqual(initialStats);
    expect(session.options.drawCount).toBe(3);
    // Deep clone check: mutating initialStats does not affect session
    initialStats.draw1.attempts = 99;
    expect(session.statistics.draw1.attempts).toBe(5);
  });

  test('createSession rejects invalid options', () => {
    expect(() => createSession(null)).toThrow('invalid-options');
    expect(() => createSession({ seed: -1, drawCount: 1 })).toThrow('invalid-seed');
    expect(() => createSession({ seed: 10, drawCount: 2 })).toThrow('invalid-draw-count');
    expect(() => createSession({ seed: 10, drawCount: 1, rulesVersion: 2 })).toThrow('unsupported-rules-version');
    expect(() => createSession({ seed: 10, drawCount: 1, shuffleVersion: 2 })).toThrow('unsupported-shuffle-version');
  });

  test('execute applies legal action, increments cursor, and sets started flag', () => {
    const session = createSession({ seed: 0, drawCount: 1 });
    const result = execute(session, { type: 'draw' });

    expect(result.ok).toBe(true);
    const next = result.session;
    expect(next.cursor).toBe(1);
    expect(next.commands).toHaveLength(1);
    expect(next.commands[0]).toEqual({ type: 'draw' });
    expect(next.snapshots).toHaveLength(2);
    expect(next.started).toBe(true);
    expect(next.statistics.draw1.attempts).toBe(1);
    expect(next.winRecorded).toBe(false);
    expect(canUndo(next)).toBe(true);
    expect(canRedo(next)).toBe(false);
    expect(Object.isFrozen(next)).toBe(true);

    // Original session is completely unmodified
    expect(session.cursor).toBe(0);
    expect(session.commands).toHaveLength(0);
    expect(session.started).toBe(false);
    expect(session.statistics.draw1.attempts).toBe(0);
  });

  test('subsequent legal action does not increment attempts again', () => {
    let session = createSession({ seed: 0, drawCount: 1 });
    session = execute(session, { type: 'draw' }).session;
    expect(session.statistics.draw1.attempts).toBe(1);

    session = execute(session, { type: 'draw' }).session;
    expect(session.cursor).toBe(2);
    expect(session.statistics.draw1.attempts).toBe(1);
  });

  test('rejected action preserves session, history and redo branch', () => {
    let session = createSession({ seed: 0, drawCount: 1 });
    session = execute(session, { type: 'draw' }).session;
    session = execute(session, { type: 'draw' }).session;
    // Undo once
    session = undo(session);
    expect(session.cursor).toBe(1);
    expect(canRedo(session)).toBe(true);

    // Attempt illegal move
    const result = execute(session, {
      type: 'move',
      from: { pile: 'tableau', index: 0, cardIndex: 0 },
      to: { pile: 'foundation', index: 0 },
    });
    expect(result.ok).toBe(false);
    expect(typeof result.reason).toBe('string');

    // Redo branch is preserved
    expect(session.cursor).toBe(1);
    expect(session.commands).toHaveLength(2);
    expect(session.snapshots).toHaveLength(3);
    expect(canRedo(session)).toBe(true);

    // Can still redo
    const redone = redo(session);
    expect(redone.cursor).toBe(2);
  });

  test('undo and redo at bounds are no-ops', () => {
    const session = createSession({ seed: 1, drawCount: 1 });
    expect(undo(session)).toBe(session);

    const afterDraw = execute(session, { type: 'draw' }).session;
    expect(redo(afterDraw)).toBe(afterDraw);
  });

  test('undo restores exact previous state and redo restores exact next state', () => {
    let session = createSession({ seed: 0, drawCount: 3 });
    const s0 = session;

    const r1 = execute(session, { type: 'draw' });
    const s1 = r1.session;

    const r2 = execute(s1, { type: 'draw' });
    const s2 = r2.session;

    // Undo s2 -> s1
    const undone1 = undo(s2);
    expect(undone1.cursor).toBe(1);
    expect(undone1.state).toEqual(s1.state);
    expect(undone1.state).toBe(s1.state); // exact object reference from snapshot

    // Undo undone1 -> s0
    const undone0 = undo(undone1);
    expect(undone0.cursor).toBe(0);
    expect(undone0.state).toEqual(s0.state);
    expect(undone0.state).toBe(s0.state);
    // started remains true after undo to deal
    expect(undone0.started).toBe(true);

    // Redo undone0 -> s1
    const redone1 = redo(undone0);
    expect(redone1.cursor).toBe(1);
    expect(redone1.state).toEqual(s1.state);
    expect(redone1.state).toBe(s1.state);

    // Redo redone1 -> s2
    const redone2 = redo(redone1);
    expect(redone2.cursor).toBe(2);
    expect(redone2.state).toEqual(s2.state);
    expect(redone2.state).toBe(s2.state);
  });

  test('new valid action after undo truncates redo branch', () => {
    let session = createSession({ seed: 0, drawCount: 1 });
    session = execute(session, { type: 'draw' }).session;
    session = execute(session, { type: 'draw' }).session;
    session = execute(session, { type: 'draw' }).session;
    expect(session.cursor).toBe(3);
    expect(session.commands).toHaveLength(3);

    // Undo twice to cursor 1
    session = undo(session);
    session = undo(session);
    expect(session.cursor).toBe(1);
    expect(canRedo(session)).toBe(true);

    // Execute another draw (valid action)
    const branched = execute(session, { type: 'draw' }).session;
    expect(branched.cursor).toBe(2);
    expect(branched.commands).toHaveLength(2);
    expect(branched.snapshots).toHaveLength(3);
    expect(canRedo(branched)).toBe(false);
  });

  test('action with automatic reveal round-trips atomically with undo and redo', () => {
    // Construct a board where column 0 has 1 hidden card and 1 face up card,
    // and moving the face up card to foundation exposes the hidden card.
    // Ace of clubs at [0][1], card 10 at [0][0] hidden.
    const aceClubs = card(CLUBS, 1);
    const hiddenCard = card(HEARTS, 10);
    const customBoard = makeState({
      tableau: [
        pile([hiddenCard, aceClubs], 1), // faceUpStart is 1, aceClubs exposed
        pile([]),
        pile([]),
        pile([]),
        pile([]),
        pile([]),
        pile([]),
      ],
      foundations: [[], [], [], []],
    });

    // Create session starting from this deal
    let session = createSession({ seed: 42, drawCount: 1 });
    // Replace snapshot 0 with customBoard for unit test
    const testSession = Object.freeze({
      ...session,
      snapshots: Object.freeze([customBoard]),
      state: customBoard,
    });

    const moveCommand = {
      type: 'move',
      from: { pile: 'tableau', index: 0, cardIndex: 1 },
      to: { pile: 'foundation', index: 0 },
    };

    const movedResult = execute(testSession, moveCommand);
    expect(movedResult.ok).toBe(true);
    expect(movedResult.revealed).toBe(hiddenCard);

    const movedSession = movedResult.session;
    expect(movedSession.state.tableau[0].faceUpStart).toBe(0);
    expect(movedSession.state.tableau[0].cards).toEqual([hiddenCard]);
    expect(movedSession.state.foundations[0]).toEqual([aceClubs]);

    // Undo restores face-down state atomically
    const undoneSession = undo(movedSession);
    expect(undoneSession.state.tableau[0].faceUpStart).toBe(1);
    expect(undoneSession.state.tableau[0].cards).toEqual([hiddenCard, aceClubs]);
    expect(undoneSession.state.foundations[0]).toEqual([]);

    // Redo restores reveal atomically
    const redoneSession = redo(undoneSession);
    expect(redoneSession.state.tableau[0].faceUpStart).toBe(0);
    expect(redoneSession.state.tableau[0].cards).toEqual([hiddenCard]);
    expect(redoneSession.state.foundations[0]).toEqual([aceClubs]);
  });

  test('draw and recycle operations round-trip exactly with undo and redo', () => {
    // 49 cards in foundations, 3 cards in waste, 0 cards in stock
    const foundations = [
      Array.from({ length: 13 }, (_, i) => card(CLUBS, i + 1)),
      Array.from({ length: 13 }, (_, i) => card(DIAMONDS, i + 1)),
      Array.from({ length: 13 }, (_, i) => card(HEARTS, i + 1)),
      Array.from({ length: 10 }, (_, i) => card(SPADES, i + 1)),
    ];
    const c1 = card(SPADES, 11);
    const c2 = card(SPADES, 12);
    const c3 = card(SPADES, 13);
    const board = makeState({
      stock: [],
      waste: [c1, c2, c3],
      foundations,
    });

    const session = Object.freeze({
      ...createSession({ seed: 42, drawCount: 1 }),
      snapshots: Object.freeze([board]),
      state: board,
    });

    const recycled = execute(session, { type: 'recycle' }).session;
    expect(recycled.state.waste).toEqual([]);
    expect(recycled.state.stock).toEqual([c3, c2, c1]);

    const undone = undo(recycled);
    expect(undone.state.stock).toEqual([]);
    expect(undone.state.waste).toEqual([c1, c2, c3]);

    const redone = redo(undone);
    expect(redone.state.waste).toEqual([]);
    expect(redone.state.stock).toEqual([c3, c2, c1]);
  });

  test('move count strictly equals cursor', () => {
    let session = createSession({ seed: 0, drawCount: 1 });
    expect(session.cursor).toBe(0);

    session = execute(session, { type: 'draw' }).session;
    expect(session.cursor).toBe(1);

    session = execute(session, { type: 'draw' }).session;
    expect(session.cursor).toBe(2);

    session = undo(session);
    expect(session.cursor).toBe(1);

    session = redo(session);
    expect(session.cursor).toBe(2);
  });

  test('elapsedMs is independent of undo and redo', () => {
    let session = createSession({ seed: 0, drawCount: 1 });
    session = execute(session, { type: 'draw' }).session;
    session = setElapsedMs(session, 15000);
    expect(session.elapsedMs).toBe(15000);

    session = addElapsedMs(session, 5000);
    expect(session.elapsedMs).toBe(20000);

    const undone = undo(session);
    expect(undone.elapsedMs).toBe(20000);

    const redone = redo(undone);
    expect(redone.elapsedMs).toBe(20000);

    expect(() => setElapsedMs(session, -1)).toThrow('invalid-elapsed-time');
    expect(() => addElapsedMs(session, -1)).toThrow('invalid-elapsed-time');
  });

  test('win awards statistics once and retains flags across undo, redo and branching', () => {
    // 51 cards on foundation, last king of spades on waste
    const wonCardsFoundations = [
      Array.from({ length: 13 }, (_, i) => card(CLUBS, i + 1)),
      Array.from({ length: 13 }, (_, i) => card(DIAMONDS, i + 1)),
      Array.from({ length: 13 }, (_, i) => card(HEARTS, i + 1)),
      Array.from({ length: 12 }, (_, i) => card(SPADES, i + 1)), // missing King
    ];
    const kingSpades = card(SPADES, 13);
    const nearWinBoard = makeState({
      stock: [],
      waste: [kingSpades],
      tableau: [pile([]), pile([]), pile([]), pile([]), pile([]), pile([]), pile([])],
      foundations: wonCardsFoundations,
    });

    let session = Object.freeze({
      ...createSession({ seed: 99, drawCount: 1 }),
      snapshots: Object.freeze([nearWinBoard]),
      state: nearWinBoard,
      elapsedMs: 45000,
    });

    const winningMove = {
      type: 'move',
      from: { pile: 'waste' },
      to: { pile: 'foundation', index: 3 },
    };

    const wonResult = execute(session, winningMove);
    expect(wonResult.ok).toBe(true);
    const wonSession = wonResult.session;

    expect(isWon(wonSession.state)).toBe(true);
    expect(wonSession.winRecorded).toBe(true);
    expect(wonSession.statistics.draw1.attempts).toBe(1);
    expect(wonSession.statistics.draw1.wins).toBe(1);
    expect(wonSession.statistics.draw1.bestTimeMs).toBe(45000);
    expect(wonSession.statistics.draw1.fewestMoves).toBe(1);

    // Undo from win
    const undoneWin = undo(wonSession);
    expect(isWon(undoneWin.state)).toBe(false);
    expect(undoneWin.winRecorded).toBe(true); // retains winRecorded!
    expect(undoneWin.statistics.draw1.wins).toBe(1); // not decreased

    // Redo back to win
    const redoneWin = redo(undoneWin);
    expect(isWon(redoneWin.state)).toBe(true);
    expect(redoneWin.statistics.draw1.wins).toBe(1); // not incremented again!
    expect(redoneWin.statistics.draw1.bestTimeMs).toBe(45000);

    // Branch away from win: moving king back to tableau
    // Tableau index 0 is empty, so King can go there
    const unwinMove = {
      type: 'move',
      from: { pile: 'foundation', index: 3 },
      to: { pile: 'tableau', index: 0 },
    };
    const branched = execute(wonSession, unwinMove).session;
    expect(isWon(branched.state)).toBe(false);
    expect(branched.winRecorded).toBe(true);
    expect(branched.statistics.draw1.wins).toBe(1);

    // Win again in same attempt: king back to foundation
    const rewinMove = {
      type: 'move',
      from: { pile: 'tableau', index: 0, cardIndex: 0 },
      to: { pile: 'foundation', index: 3 },
    };
    const rewon = execute(setElapsedMs(branched, 20000), rewinMove).session;
    expect(isWon(rewon.state)).toBe(true);
    expect(rewon.statistics.draw1.wins).toBe(1); // still 1!
    expect(rewon.statistics.draw1.bestTimeMs).toBe(45000); // not overwritten by 20000!
  });

  test('subsequent attempt updates bestTimeMs and fewestMoves when better, retains when worse', () => {
    // Mode 3 attempt 1: win with time 60000, moves 80
    const stats = {
      draw1: { attempts: 0, wins: 0, bestTimeMs: null, fewestMoves: null },
      draw3: { attempts: 1, wins: 1, bestTimeMs: 60000, fewestMoves: 80 },
    };
    const nearWinBoard = makeState({
      drawCount: 3,
      stock: [],
      waste: [card(SPADES, 13)],
      tableau: [pile([]), pile([]), pile([]), pile([]), pile([]), pile([]), pile([])],
      foundations: [
        Array.from({ length: 13 }, (_, i) => card(CLUBS, i + 1)),
        Array.from({ length: 13 }, (_, i) => card(DIAMONDS, i + 1)),
        Array.from({ length: 13 }, (_, i) => card(HEARTS, i + 1)),
        Array.from({ length: 12 }, (_, i) => card(SPADES, i + 1)),
      ],
    });

    // Attempt 2: wins with time 50000 (better), moves 90 (worse)
    const snapshots90 = Array.from({ length: 90 }, () => nearWinBoard);
    const session2 = Object.freeze({
      ...createSession({ seed: 77, drawCount: 3 }, 'att-2', stats),
      snapshots: Object.freeze(snapshots90),
      state: nearWinBoard,
      cursor: 89, // so winning move makes cursor 90
      elapsedMs: 50000,
    });

    const won2 = execute(session2, {
      type: 'move',
      from: { pile: 'waste' },
      to: { pile: 'foundation', index: 3 },
    }).session;

    expect(won2.statistics.draw3.attempts).toBe(2);
    expect(won2.statistics.draw3.wins).toBe(2);
    expect(won2.statistics.draw3.bestTimeMs).toBe(50000); // improved!
    expect(won2.statistics.draw3.fewestMoves).toBe(80); // preserved better earlier record!
  });

  test('restartSession clears attempt state, resets flags/time, and preserves statistics', () => {
    let session = createSession({ seed: 42, drawCount: 1 });
    session = execute(session, { type: 'draw' }).session;
    session = execute(session, { type: 'draw' }).session;
    session = setElapsedMs(session, 12345);
    expect(session.statistics.draw1.attempts).toBe(1);

    const restarted = restartSession(session, 'restarted-id-1');
    expect(restarted.attemptId).toBe('restarted-id-1');
    expect(restarted.options).toEqual(session.options);
    expect(restarted.cursor).toBe(0);
    expect(restarted.commands).toEqual([]);
    expect(restarted.snapshots).toHaveLength(1);
    expect(restarted.state).toEqual(createGame({ seed: 42, drawCount: 1 }));
    expect(restarted.elapsedMs).toBe(0);
    expect(restarted.started).toBe(false);
    expect(restarted.winRecorded).toBe(false);
    expect(restarted.statistics.draw1.attempts).toBe(1); // retained from earlier

    // First move in restarted session increments attempts to 2
    const afterFirstMove = execute(restarted, { type: 'draw' }).session;
    expect(afterFirstMove.started).toBe(true);
    expect(afterFirstMove.statistics.draw1.attempts).toBe(2);
  });

  test('restartSession generates distinct attemptId if not provided', () => {
    const session = createSession({ seed: 42, drawCount: 1 });
    const restarted = restartSession(session);
    expect(typeof restarted.attemptId).toBe('string');
    expect(restarted.attemptId).not.toBe(session.attemptId);
  });

  test('getWinPercentage computes correct percentages and handles unknown modes', () => {
    const stats = {
      draw1: { attempts: 0, wins: 0, bestTimeMs: null, fewestMoves: null },
      draw3: { attempts: 4, wins: 1, bestTimeMs: 1000, fewestMoves: 10 },
    };
    expect(getWinPercentage(stats, 'draw1')).toBe(0);
    expect(getWinPercentage(stats, 'draw3')).toBe(25);
    expect(getWinPercentage(stats, 1)).toBe(0);
    expect(getWinPercentage(stats, 3)).toBe(25);
    expect(getWinPercentage(null, 'draw1')).toBe(0);
    expect(getWinPercentage(stats, 'unknown')).toBe(0);
  });

  test('createSession handles partial or non-numeric statistics entries safely', () => {
    const weirdStats = {
      draw1: { attempts: -5, wins: 'none', bestTimeMs: -1, fewestMoves: 'many' },
      draw3: null,
    };
    const session = createSession({ seed: 1, drawCount: 1 }, 'id', weirdStats);
    expect(session.statistics.draw1).toEqual({
      attempts: 0,
      wins: 0,
      bestTimeMs: null,
      fewestMoves: null,
    });
    expect(session.statistics.draw3).toEqual({
      attempts: 0,
      wins: 0,
      bestTimeMs: null,
      fewestMoves: null,
    });
  });

  test('execute safely rejects non-object commands', () => {
    const session = createSession({ seed: 1, drawCount: 1 });
    expect(execute(session, null).ok).toBe(false);
    expect(execute(session, 'draw').ok).toBe(false);
  });
});
