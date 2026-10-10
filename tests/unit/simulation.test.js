import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';
import { createGame } from '../../src/engine/cards.js';
import { assertInvariants, getLegalMoves, isWon } from '../../src/engine/game.js';
import {
  canRedo,
  canUndo,
  createSession,
  execute,
  redo,
  restartSession,
  undo,
} from '../../src/session.js';
import {
  restoreSession,
  serializeSession,
} from '../../src/persistence.js';
import {
  PROFILES,
  parseProfile,
  selectorSeed,
  simulateDeal,
  simulateProfile,
  simulationFailure,
} from '../../scripts/run-simulation.mjs';

const MAX_SEED = 4294967295;
const selectedProfile = process.env.SOLITAIRE_SIMULATION_PROFILE;

function categoryTotal(categories) {
  return Object.values(categories).reduce((sum, count) => sum + count, 0);
}

test('profiles name the documented deal counts and step bounds', () => {
  expect(PROFILES.ci).toEqual({ seedCount: 1000, maxSteps: 300 });
  expect(PROFILES.release).toEqual({ seedCount: 10000, maxSteps: 1000 });
  expect(Object.keys(PROFILES).sort()).toEqual(['ci', 'release']);
});

test('profile parser accepts only ci and release', () => {
  expect(parseProfile(['node', 'run-simulation.mjs', '--profile=ci'])).toEqual({ ok: true, profile: 'ci' });
  expect(parseProfile(['node', 'run-simulation.mjs', '--profile', 'release'])).toEqual({
    ok: true,
    profile: 'release',
  });
  expect(parseProfile(['node', 'run-simulation.mjs'])).toEqual({ ok: false, profile: null });
  expect(parseProfile(['node', 'run-simulation.mjs', '--profile='])).toEqual({ ok: false, profile: '' });
  expect(parseProfile(['node', 'run-simulation.mjs', '--profile'])).toEqual({ ok: false, profile: null });
  expect(parseProfile(['node', 'run-simulation.mjs', '--profile=nope'])).toEqual({
    ok: false,
    profile: 'nope',
  });
});

test('unknown profile exits nonzero before a game runs', () => {
  const result = spawnSync(process.execPath, ['scripts/run-simulation.mjs', '--profile=nope'], {
    encoding: 'utf8',
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('nope');
});

test('action selector is not the engine mulberry32', () => {
  const source = readFileSync(new URL('../../scripts/run-simulation.mjs', import.meta.url), 'utf8');
  expect(source.includes('0x6D2B79F5')).toBe(false);
  expect(selectorSeed(0, 1)).not.toBe(selectorSeed(0, 3));
  expect(Number.isInteger(selectorSeed(MAX_SEED, 3))).toBe(true);
});

test('failure trace names the deal, selector and assertion', () => {
  const error = simulationFailure({
    seed: 7,
    drawCount: 3,
    rulesVersion: 1,
    shuffleVersion: 1,
    selectorSeed: 99,
    step: 4,
    actionHistory: [{ type: 'draw' }],
    assertion: 'invariant',
  });
  expect(error.trace).toEqual({
    seed: 7,
    drawCount: 3,
    rulesVersion: 1,
    shuffleVersion: 1,
    selectorSeed: 99,
    step: 4,
    actionHistory: [{ type: 'draw' }],
    assertion: 'invariant',
  });
  expect(error.message).toContain('invariant');
});

test('the same deal replays the same actions', () => {
  const first = simulateDeal({ seed: 42, drawCount: 1, maxSteps: 30 });
  const second = simulateDeal({ seed: 42, drawCount: 1, maxSteps: 30 });
  expect(second.history).toEqual(first.history);
  expect(first.steps).toBe(categoryTotal(first.categories));
  expect(first.steps).toBeGreaterThan(0);
  expect(first.steps).toBeLessThanOrEqual(30);
  assertInvariants(first.state);
  expect(first.state).toEqual(second.state);
  expect(isWon(first.state)).toBe(false);
});

test('draw 3 stock-biased play recycles and keeps the previous board', () => {
  const opening = createGame({ seed: 1, drawCount: 3 });
  const result = simulateDeal({ seed: 1, drawCount: 3, maxSteps: 40 });
  expect((1 + 3) % 3).toBe(1);
  expect(result.categories.draw).toBeGreaterThan(0);
  expect(result.categories.recycle).toBeGreaterThan(0);
  expect(result.categories.invalid).toBeGreaterThan(0);
  expect(result.categories.tableau).toBe(0);
  expect(result.steps).toBe(categoryTotal(result.categories));
  assertInvariants(result.state);
  assertInvariants(opening);
  expect(opening.stock).toHaveLength(24);
  expect(opening.waste).toEqual([]);
});

test('a long draw 3 run stays inside the step bound', () => {
  const result = simulateDeal({ seed: 1, drawCount: 3, maxSteps: 300 });
  expect(result.steps).toBe(300);
  expect(result.stopped).toBe('bound');
  expect(result.categories.recycle).toBeGreaterThan(1);
  assertInvariants(result.state);
  expect(isWon(result.state)).toBe(false);
});

test('progress-biased play uses a transfer when one exists', () => {
  const result = simulateDeal({ seed: 0, drawCount: 3, maxSteps: 80 });
  expect((0 + 3) % 3).toBe(0);
  const transfers = result.categories.tableau + result.categories.waste + result.categories.foundation;
  expect(transfers).toBeGreaterThan(0);
  assertInvariants(result.state);
});

test('max seed draw 1 survives a short run', () => {
  const result = simulateDeal({ seed: MAX_SEED, drawCount: 1, maxSteps: 20 });
  expect(result.state.seed).toBe(MAX_SEED);
  expect(result.state.drawCount).toBe(1);
  expect(result.steps).toBeGreaterThan(0);
  assertInvariants(result.state);
});

function simulateSessionPlay({ seed, drawCount, maxSteps = 100 }) {
  let session = createSession({ seed, drawCount });
  const selSeed = selectorSeed(seed, drawCount);
  let selState = selSeed >>> 0;
  const nextRand = () => {
    selState = (selState + 0x9E3779B9) >>> 0;
    let mixed = selState;
    mixed = Math.imul(mixed ^ (mixed >>> 16), 0x21F0AAAD);
    mixed = Math.imul(mixed ^ (mixed >>> 15), 0x735A2D97);
    return (mixed ^ (mixed >>> 15)) >>> 0;
  };

  const bias = (seed + drawCount) % 3;
  let undos = 0;
  let redos = 0;
  let executions = 0;
  let rejections = 0;

  for (let step = 0; step < maxSteps; step += 1) {
    if (isWon(session.state)) break;
    assertInvariants(session.state);
    expect(session.cursor).toBe(session.moveCount);
    expect(session.snapshots).toHaveLength(session.commands.length + 1);
    expect(session.state).toBe(session.snapshots[session.cursor]);

    const roll = nextRand() % 100;
    // 10% chance to undo if canUndo
    if (roll < 10 && canUndo(session)) {
      const prevCursor = session.cursor;
      session = undo(session);
      expect(session.cursor).toBe(prevCursor - 1);
      expect(session.started).toBe(true);
      undos += 1;
      continue;
    }
    // 10% chance to redo if canRedo
    if (roll < 20 && canRedo(session)) {
      const prevCursor = session.cursor;
      session = redo(session);
      expect(session.cursor).toBe(prevCursor + 1);
      redos += 1;
      continue;
    }
    // 10% chance to test invalid move
    if (roll < 30) {
      const prevCanRedo = canRedo(session);
      const prevCursor = session.cursor;
      const prevCommandsLen = session.commands.length;
      const invalidCmd = {
        type: 'move',
        from: { pile: 'tableau', index: 0, cardIndex: 99 },
        to: { pile: 'foundation', index: 0 },
      };
      const res = execute(session, invalidCmd);
      expect(res.ok).toBe(false);
      // Redo branch and history preserved
      expect(canRedo(session)).toBe(prevCanRedo);
      expect(session.cursor).toBe(prevCursor);
      expect(session.commands).toHaveLength(prevCommandsLen);
      rejections += 1;
      continue;
    }

    // Otherwise legal move
    const legal = getLegalMoves(session.state);
    if (legal.length === 0) break;
    const pref = legal.filter((cmd) => {
      if (bias === 1) return cmd.type === 'draw' || cmd.type === 'recycle';
      if (bias === 2) return cmd.type === 'move' && cmd.from.pile === 'foundation';
      if (cmd.type !== 'move') return false;
      if (cmd.to.pile === 'foundation') return true;
      if (cmd.from.pile !== 'tableau') return false;
      const col = session.state.tableau[cmd.from.index];
      return cmd.from.cardIndex === col.faceUpStart && col.faceUpStart > 0;
    });
    const pool = pref.length > 0 ? pref : legal;
    const chosen = pool[nextRand() % pool.length];

    const hadRedo = canRedo(session);
    const res = execute(session, chosen);
    expect(res.ok).toBe(true);
    session = res.session;
    executions += 1;

    // If had redo branch, it is now truncated!
    if (hadRedo) {
      expect(canRedo(session)).toBe(false);
      expect(session.commands).toHaveLength(session.cursor);
    }
    expect(session.started).toBe(true);
  }

  // Full round trip check at end of simulation run:
  const finalState = session.state;
  const targetCursor = session.cursor;

  // Persistence round-trip validation:
  const serialized = serializeSession(session);
  const restoreRes = restoreSession(serialized);
  expect(restoreRes.ok).toBe(true);
  const restoredSession = restoreRes.session;
  expect(restoredSession.cursor).toBe(session.cursor);
  expect(restoredSession.commands).toHaveLength(session.commands.length);
  expect(restoredSession.snapshots).toHaveLength(session.snapshots.length);
  expect(restoredSession.state).toEqual(finalState);
  expect(restoredSession.started).toBe(session.started);
  expect(restoredSession.winRecorded).toBe(session.winRecorded);
  expect(restoredSession.statistics).toEqual(session.statistics);

  // Repeated undo all the way to 0 reaches exact deal
  while (canUndo(session)) {
    session = undo(session);
  }
  expect(session.cursor).toBe(0);
  expect(session.state).toEqual(createGame(session.options));
  expect(canUndo(session)).toBe(false);

  // Repeated redo back to targetCursor reaches exact finalState
  while (session.cursor < targetCursor) {
    session = redo(session);
  }
  expect(session.cursor).toBe(targetCursor);
  expect(session.state).toEqual(finalState);

  return { session, undos, redos, executions, rejections };
}

test('session simulation with undo, redo and branching satisfies all invariants and round-trips', () => {
  // Test multiple deals and modes
  for (const drawCount of [1, 3]) {
    for (const seed of [0, 42, 999, MAX_SEED]) {
      const result = simulateSessionPlay({ seed, drawCount, maxSteps: 80 });
      expect(result.executions).toBeGreaterThan(0);
      assertInvariants(result.session.state);
    }
  }
});

test('session simulation on deterministically won deal verifies exactly-once win accounting', () => {
  // Won seed from T005: Seed 888, Draw 3 won in 166 steps
  const dealResult = simulateDeal({ seed: 888, drawCount: 3, maxSteps: 200 });
  expect(dealResult.stopped).toBe('win');

  let session = createSession({ seed: 888, drawCount: 3 });
  for (const cmd of dealResult.history) {
    const res = execute(session, cmd);
    if (res.ok) {
      session = res.session;
    }
  }
  expect(isWon(session.state)).toBe(true);
  expect(session.winRecorded).toBe(true);
  expect(session.statistics.draw3.wins).toBe(1);
  expect(session.statistics.draw3.attempts).toBe(1);

  // Undo 1 step from win
  session = undo(session);
  expect(isWon(session.state)).toBe(false);
  expect(session.winRecorded).toBe(true);
  expect(session.statistics.draw3.wins).toBe(1);

  // Redo back to win
  session = redo(session);
  expect(isWon(session.state)).toBe(true);
  expect(session.statistics.draw3.wins).toBe(1);

  // Undo 50 steps from win
  for (let i = 0; i < 50; i += 1) session = undo(session);
  expect(isWon(session.state)).toBe(false);
  expect(session.winRecorded).toBe(true);
  expect(session.statistics.draw3.wins).toBe(1);

  // Redo 50 steps back to win
  for (let i = 0; i < 50; i += 1) session = redo(session);
  expect(isWon(session.state)).toBe(true);
  expect(session.statistics.draw3.wins).toBe(1);

  // Undo all the way to deal
  while (canUndo(session)) session = undo(session);
  expect(session.cursor).toBe(0);
  expect(session.state).toEqual(createGame({ seed: 888, drawCount: 3 }));
  expect(session.started).toBe(true);
  expect(session.winRecorded).toBe(true);
  expect(session.statistics.draw3.wins).toBe(1);
  expect(session.statistics.draw3.attempts).toBe(1);

  // Restart session resets attempt state, keeps statistics
  const restarted = restartSession(session);
  expect(restarted.started).toBe(false);
  expect(restarted.winRecorded).toBe(false);
  expect(restarted.cursor).toBe(0);
  expect(restarted.statistics.draw3.wins).toBe(1);
  expect(restarted.statistics.draw3.attempts).toBe(1);
});

if (selectedProfile) {
  test(`simulation profile ${selectedProfile}`, () => {
    const profile = PROFILES[selectedProfile];
    expect(profile).toBeTruthy();
    const report = simulateProfile(selectedProfile);
    console.log(`simulation ${JSON.stringify(report)}`);
    expect(report.profile).toBe(selectedProfile);
    expect(report.deals).toBe((profile.seedCount + 1) * 2);
    expect(report.maxSteps).toBe(profile.maxSteps);
    expect(report.steps).toBeGreaterThan(0);
    expect(report.wins + report.stuck + report.bound).toBe(report.deals);
    expect(report.won).toHaveLength(report.wins);
    for (const category of ['draw', 'recycle', 'tableau', 'waste', 'foundation', 'invalid']) {
      expect(report.categories[category]).toBeGreaterThan(0);
    }
  }, 600_000);
}
