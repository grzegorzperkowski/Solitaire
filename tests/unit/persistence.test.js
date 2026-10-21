import { describe, expect, test } from 'vitest';
import { createGame } from '../../src/engine/cards.js';
import { getLegalMoves, isWon } from '../../src/engine/game.js';
import {
  MAX_COMMANDS,
  MAX_SERIALIZED_BYTES,
  SCHEMA_VERSION,
  STORAGE_KEY,
  clearSession,
  getPolishErrorMessage,
  loadSession,
  restoreSession,
  saveSession,
  serializeSession,
} from '../../src/persistence.js';
import {
  canRedo,
  canUndo,
  createSession,
  execute,
  redo,
  undo,
} from '../../src/session.js';
import { simulateDeal } from '../../scripts/run-simulation.mjs';
import {
  CORRUPT_JSON,
  UNSUPPORTED_VERSION_SAVE,
  createTestEnvelope,
} from '../fixtures/saves.js';

function createMockStorage(initialData = {}) {
  const store = new Map(Object.entries(initialData));
  return {
    store,
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

describe('T007 persistence: serialization, restore and storage handling', () => {
  test('constants and Polish error messages are defined correctly', () => {
    expect(STORAGE_KEY).toBe('pl.solitaire.save');
    expect(SCHEMA_VERSION).toBe(2);
    expect(MAX_SERIALIZED_BYTES).toBe(1024 * 1024);
    expect(MAX_COMMANDS).toBe(10000);

    expect(getPolishErrorMessage('oversized-save')).toContain('1 MB');
    expect(getPolishErrorMessage('too-many-commands')).toContain('10 000');
    expect(getPolishErrorMessage('unsupported-schema-version')).toContain('Nieobsługiwana');
    expect(getPolishErrorMessage('malformed-json')).toContain('uszkodzony');
    expect(getPolishErrorMessage('invalid-replay')).toContain('odtworzyć');
    expect(getPolishErrorMessage('quota-exceeded')).toContain('brak miejsca');
    expect(getPolishErrorMessage('write-error')).toBe('Nie udało się zapisać gry.');
  });

  test('round-trip serialization and restore on new session', () => {
    const session = createSession({ seed: 42, drawCount: 1 });
    const metadata = {
      revision: 3,
      savedAt: '2026-10-10T12:30:00.000Z',
      preferences: { drawCount: 1, touchHelpSeen: true },
    };

    const text = serializeSession(session, metadata);
    expect(typeof text).toBe('string');

    const result = restoreSession(text);
    expect(result.ok).toBe(true);

    const { session: restored, metadata: restoredMeta } = result;
    expect(restored.attemptId).toBe(session.attemptId);
    expect(restored.options).toEqual(session.options);
    expect(restored.commands).toEqual([]);
    expect(restored.cursor).toBe(0);
    expect(restored.moveCount).toBe(0);
    expect(restored.state).toEqual(session.state);
    expect(restored.elapsedMs).toBe(0);
    expect(restored.started).toBe(false);
    expect(restored.winRecorded).toBe(false);
    expect(restored.statistics).toEqual(session.statistics);
    expect(canUndo(restored)).toBe(false);
    expect(canRedo(restored)).toBe(false);

    expect(restoredMeta.schemaVersion).toBe(2);
    expect(restoredMeta.revision).toBe(3);
    expect(restoredMeta.savedAt).toBe('2026-10-10T12:30:00.000Z');
    expect(restoredMeta.preferences).toEqual({ drawCount: 1, touchHelpSeen: true });
  });

  test.each([false, true])('restored transfer commands resist mutation, including redo tail: %s', (undone) => {
    let session = createSession({ seed: 42, drawCount: 1 });
    const command = getLegalMoves(session.state).find(move => move.type === 'move');
    session = execute(session, command).session;
    const afterMove = session.state;
    if (undone) session = undo(session);

    const result = restoreSession(serializeSession(session));
    expect(result.ok).toBe(true);
    const restored = result.session;
    for (const field of ['from', 'to']) {
      expect(Object.isFrozen(restored.commands[0][field])).toBe(true);
      expect(() => { restored.commands[0][field].index = 99; }).toThrow(TypeError);
    }
    const roundTrip = restoreSession(serializeSession(restored));
    expect(roundTrip.ok).toBe(true);
    expect(roundTrip.session.commands).toEqual(session.commands);
    expect(roundTrip.session.state).toEqual(session.state);
    expect(roundTrip.session.statistics).toEqual(session.statistics);
    expect(redo(roundTrip.session).state).toEqual(afterMove);
  });

  test('round-trip preserves history, cursor, and complete redo tail', () => {
    let session = createSession({ seed: 42, drawCount: 1 });

    // Execute 4 draws
    for (let i = 0; i < 4; i += 1) {
      const res = execute(session, { type: 'draw' });
      expect(res.ok).toBe(true);
      session = res.session;
    }
    expect(session.cursor).toBe(4);
    expect(session.commands).toHaveLength(4);
    expect(session.snapshots).toHaveLength(5);

    // Undo 2 draws -> cursor becomes 2, redo tail has 2 commands
    session = undo(session);
    session = undo(session);
    expect(session.cursor).toBe(2);
    expect(canUndo(session)).toBe(true);
    expect(canRedo(session)).toBe(true);

    const serialized = serializeSession(session);
    const result = restoreSession(serialized);
    expect(result.ok).toBe(true);

    let restored = result.session;
    expect(restored.cursor).toBe(2);
    expect(restored.moveCount).toBe(2);
    expect(restored.commands).toHaveLength(4);
    expect(restored.snapshots).toHaveLength(5);
    expect(restored.state).toEqual(session.state);
    expect(canUndo(restored)).toBe(true);
    expect(canRedo(restored)).toBe(true);

    // Redo 1 step
    restored = redo(restored);
    expect(restored.cursor).toBe(3);
    expect(restored.state).toEqual(session.snapshots[3]);

    // Redo 2nd step
    restored = redo(restored);
    expect(restored.cursor).toBe(4);
    expect(restored.state).toEqual(session.snapshots[4]);
    expect(canRedo(restored)).toBe(false);

    // Undo all the way back to deal
    while (canUndo(restored)) {
      restored = undo(restored);
    }
    expect(restored.cursor).toBe(0);
    expect(restored.state).toEqual(createGame(session.options));

    // Redo back to 2, then branch with a new move
    restored = redo(restored);
    restored = redo(restored);
    expect(restored.cursor).toBe(2);

    const branched = execute(restored, { type: 'draw' });
    expect(branched.ok).toBe(true);
    expect(branched.session.cursor).toBe(3);
    // Redo tail was truncated and new move appended
    expect(branched.session.commands).toHaveLength(3);
    expect(canRedo(branched.session)).toBe(false);
  });

  test('restoring a won game does not re-award statistics or win count', () => {
    // Seed 888 Draw 3 is deterministically won
    const dealResult = simulateDeal({ seed: 888, drawCount: 3, maxSteps: 200 });
    expect(dealResult.stopped).toBe('win');

    let session = createSession({ seed: 888, drawCount: 3 });
    for (const cmd of dealResult.history) {
      const res = execute(session, cmd);
      if (res.ok) session = res.session;
    }
    expect(isWon(session.state)).toBe(true);
    expect(session.winRecorded).toBe(true);
    expect(session.statistics.draw3.wins).toBe(1);
    expect(session.statistics.draw3.attempts).toBe(1);

    const serialized = serializeSession(session);
    const restoreResult = restoreSession(serialized);
    expect(restoreResult.ok).toBe(true);

    let restored = restoreResult.session;
    expect(isWon(restored.state)).toBe(true);
    expect(restored.winRecorded).toBe(true);
    // Stats are preserved exactly as saved, NOT double-counted
    expect(restored.statistics.draw3.wins).toBe(1);
    expect(restored.statistics.draw3.attempts).toBe(1);

    // Undo 1 step and redo back to win: wins must NOT increment again
    restored = undo(restored);
    expect(isWon(restored.state)).toBe(false);
    expect(restored.statistics.draw3.wins).toBe(1);

    restored = redo(restored);
    expect(isWon(restored.state)).toBe(true);
    expect(restored.statistics.draw3.wins).toBe(1);
    expect(restored.statistics.draw3.attempts).toBe(1);
  });

  test('replay rejects an invalid command anywhere in the history, even beyond cursor', () => {
    let session = createSession({ seed: 42, drawCount: 1 });
    session = execute(session, { type: 'draw' }).session;
    session = execute(session, { type: 'draw' }).session;

    // Serialize valid 2-draw session
    const envelope = JSON.parse(serializeSession(session));
    // Cursor is 1, but command 1 (index 1) in the redo tail is tampered to an invalid move
    envelope.session.cursor = 1;
    envelope.session.commands[1] = {
      type: 'move',
      from: { pile: 'tableau', index: 0, cardIndex: 0 },
      to: { pile: 'foundation', index: 0 },
    };

    const result = restoreSession(JSON.stringify(envelope));
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid-replay');
  });

  test('restore rejects malformed, corrupt, or non-string input safely', () => {
    expect(restoreSession(null)).toEqual({ ok: false, reason: 'invalid-input' });
    expect(restoreSession(undefined)).toEqual({ ok: false, reason: 'invalid-input' });
    expect(restoreSession(123)).toEqual({ ok: false, reason: 'invalid-input' });

    expect(restoreSession(CORRUPT_JSON)).toEqual({
      ok: false,
      reason: 'malformed-json',
      detail: expect.any(String),
    });

    expect(restoreSession('[]')).toEqual({ ok: false, reason: 'invalid-shape' });
    expect(restoreSession('"just a string"')).toEqual({ ok: false, reason: 'invalid-shape' });
  });

  test('restore rejects unsupported schema version and bad revision/savedAt', () => {
    expect(restoreSession(UNSUPPORTED_VERSION_SAVE)).toEqual({
      ok: false,
      reason: 'unsupported-schema-version',
      detail: expect.stringContaining('Expected schema version 2'),
    });

    const envBadRev = createTestEnvelope({ revision: -1 });
    expect(restoreSession(JSON.stringify(envBadRev))).toEqual({
      ok: false,
      reason: 'invalid-revision',
    });

    const envBadSavedAt = createTestEnvelope({ savedAt: '' });
    expect(restoreSession(JSON.stringify(envBadSavedAt))).toEqual({
      ok: false,
      reason: 'invalid-saved-at',
    });
  });

  test('restore rejects invalid preferences and statistics', () => {
    // Bad drawCount in preferences
    const badPref = createTestEnvelope({ preferences: { drawCount: 2, touchHelpSeen: false } });
    expect(restoreSession(JSON.stringify(badPref))).toEqual({
      ok: false,
      reason: 'invalid-preferences',
    });

    // Wins > attempts
    const statsWinsExceedAttempts = createTestEnvelope({
      statistics: {
        draw1: { attempts: 1, wins: 2, bestTimeMs: 1000, fewestMoves: 10 },
        draw3: { attempts: 0, wins: 0, bestTimeMs: null, fewestMoves: null },
      },
    });
    expect(restoreSession(JSON.stringify(statsWinsExceedAttempts))).toEqual({
      ok: false,
      reason: 'invalid-statistics',
      detail: expect.stringContaining('cannot exceed attempts'),
    });

    // Wins === 0 but bestTimeMs is set
    const statsBestNotNull = createTestEnvelope({
      statistics: {
        draw1: { attempts: 1, wins: 0, bestTimeMs: 5000, fewestMoves: null },
        draw3: { attempts: 0, wins: 0, bestTimeMs: null, fewestMoves: null },
      },
    });
    expect(restoreSession(JSON.stringify(statsBestNotNull))).toEqual({
      ok: false,
      reason: 'invalid-statistics',
      detail: expect.stringContaining('Best fields must be null'),
    });

    // Wins > 0 but bestTimeMs is null
    const statsBestMissing = createTestEnvelope({
      statistics: {
        draw1: { attempts: 2, wins: 1, bestTimeMs: null, fewestMoves: 50 },
        draw3: { attempts: 0, wins: 0, bestTimeMs: null, fewestMoves: null },
      },
    });
    expect(restoreSession(JSON.stringify(statsBestMissing))).toEqual({
      ok: false,
      reason: 'invalid-statistics',
      detail: expect.stringContaining('Best fields cannot be null'),
    });
  });

  test('restore rejects invalid cursor and inconsistent flags', () => {
    // Cursor > commands.length
    const badCursor = createTestEnvelope({
      session: {
        attemptId: 'test',
        options: { seed: 42, drawCount: 1, rulesVersion: 1, shuffleVersion: 1 },
        commands: [],
        cursor: 5,
        elapsedMs: 0,
        started: false,
        winRecorded: false,
      },
    });
    expect(restoreSession(JSON.stringify(badCursor))).toEqual({
      ok: false,
      reason: 'invalid-cursor',
      detail: expect.stringContaining('out of bounds'),
    });

    // winRecorded: true but started: false
    const badFlags = createTestEnvelope({
      session: {
        attemptId: 'test',
        options: { seed: 42, drawCount: 1, rulesVersion: 1, shuffleVersion: 1 },
        commands: [],
        cursor: 0,
        elapsedMs: 0,
        started: false,
        winRecorded: true,
      },
    });
    expect(restoreSession(JSON.stringify(badFlags))).toEqual({
      ok: false,
      reason: 'invalid-flag-relationship',
      detail: expect.stringContaining('winRecorded cannot be true when started is false'),
    });
  });

  test('enforces boundaries: 10,000 commands and 1 MiB UTF-8 limits', () => {
    const session = createSession({ seed: 42, drawCount: 1 });
    // Exactly 10,000 commands boundary
    const exactly10kCommands = Array.from({ length: 10000 }, () => ({ type: 'draw' }));
    const session10k = {
      ...session,
      commands: exactly10kCommands,
    };
    // Serialization allowed at 10,000 commands
    expect(() => serializeSession(session10k)).not.toThrow();

    // 10,001 commands exceeds limit
    const tooMany = Array.from({ length: 10001 }, () => ({ type: 'draw' }));
    const session10001 = {
      ...session,
      commands: tooMany,
    };
    expect(() => serializeSession(session10001)).toThrowError();

    const envTooMany = createTestEnvelope({
      session: {
        attemptId: 'test',
        options: { seed: 42, drawCount: 1, rulesVersion: 1, shuffleVersion: 1 },
        commands: tooMany,
        cursor: 0,
        elapsedMs: 0,
        started: true,
        winRecorded: false,
      },
    });
    const resultTooMany = restoreSession(JSON.stringify(envTooMany));
    expect(resultTooMany.ok).toBe(false);
    expect(resultTooMany.reason).toBe('too-many-commands');

    // Oversized > 1 MiB text before JSON parsing
    const padding = 'x'.repeat(MAX_SERIALIZED_BYTES + 10);
    const resultOversized = restoreSession(padding);
    expect(resultOversized.ok).toBe(false);
    expect(resultOversized.reason).toBe('oversized-save');
  });

  test('loadSession, saveSession and clearSession handle storage operations correctly', () => {
    const mockStorage = createMockStorage();

    // Initially empty
    const emptyLoad = loadSession(mockStorage);
    expect(emptyLoad).toEqual({
      ok: true,
      empty: true,
      session: null,
      metadata: null,
    });

    // Save session
    const session = createSession({ seed: 42, drawCount: 1 });
    const saveRes = saveSession(session, { revision: 1 }, mockStorage);
    expect(saveRes.ok).toBe(true);
    expect(mockStorage.getItem(STORAGE_KEY)).toBeTruthy();

    // Load saved session
    const loadRes = loadSession(mockStorage);
    expect(loadRes.ok).toBe(true);
    expect(loadRes.empty).toBe(false);
    expect(loadRes.session.options.seed).toBe(42);

    // Clear session
    const clearRes = clearSession(mockStorage);
    expect(clearRes.ok).toBe(true);
    expect(mockStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  test('save failure leaves existing storage intact and returns Polish message', () => {
    const mockStorage = createMockStorage();

    // First save valid session
    const session1 = createSession({ seed: 42, drawCount: 1 });
    saveSession(session1, { revision: 1 }, mockStorage);
    const originalStored = mockStorage.getItem(STORAGE_KEY);
    expect(originalStored).toBeTruthy();

    // Inject QuotaExceededError on next write
    mockStorage.setItem = () => {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    };

    const session2 = createSession({ seed: 99, drawCount: 3 });
    const failedSave = saveSession(session2, { revision: 2 }, mockStorage);

    expect(failedSave.ok).toBe(false);
    expect(failedSave.reason).toBe('quota-exceeded');
    expect(failedSave.message).toBe('Nie udało się zapisać gry');

    // Original stored bytes remain unchanged!
    expect(mockStorage.store.get(STORAGE_KEY)).toBe(originalStored);
  });

  test('corrupt or inaccessible storage does not crash and leaves bytes intact', () => {
    const mockStorage = createMockStorage({
      [STORAGE_KEY]: CORRUPT_JSON,
    });

    const loadRes = loadSession(mockStorage);
    expect(loadRes.ok).toBe(false);
    expect(loadRes.reason).toBe('malformed-json');
    expect(loadRes.message).toContain('uszkodzony');

    // Corrupt bytes remain byte-for-byte in storage!
    expect(mockStorage.getItem(STORAGE_KEY)).toBe(CORRUPT_JSON);

    // Storage inaccessible (SecurityError)
    const brokenStorage = {
      getItem() {
        const err = new Error('SecurityError: storage disabled');
        err.name = 'SecurityError';
        throw err;
      },
    };
    const deniedLoad = loadSession(brokenStorage);
    expect(deniedLoad.ok).toBe(false);
    expect(deniedLoad.reason).toBe('storage-inaccessible');
  });

  test('defensive validation rejects forbidden keys, malformed options, and unknown commands', () => {
    // serializeSession errors
    expect(() => serializeSession(null)).toThrowError('invalid-session');
    expect(() => serializeSession({ commands: 'not an array' })).toThrowError('invalid-commands');

    // Forbidden keys in envelope, prefs, stats, session, command
    const envProto = createTestEnvelope();
    envProto.__proto__ = { malicious: true };
    // JSON stringify/parse with forbidden key
    const jsonWithProto = '{"schemaVersion": 1, "__proto__": {"admin": true}}';
    expect(restoreSession(jsonWithProto)).toEqual({ ok: false, reason: 'invalid-shape' });

    // sess.attemptId empty
    const envEmptyId = createTestEnvelope({ session: { ...createTestEnvelope().session, attemptId: '' } });
    expect(restoreSession(JSON.stringify(envEmptyId))).toEqual({ ok: false, reason: 'invalid-session' });

    // sess.options missing / bad seed / bad drawCount / bad version
    const envNoOpts = createTestEnvelope({ session: { ...createTestEnvelope().session, options: null } });
    expect(restoreSession(JSON.stringify(envNoOpts))).toEqual({ ok: false, reason: 'invalid-session' });

    const envBadSeed = createTestEnvelope({ session: { ...createTestEnvelope().session, options: { seed: -1, drawCount: 1, rulesVersion: 1, shuffleVersion: 1 } } });
    expect(restoreSession(JSON.stringify(envBadSeed))).toEqual({ ok: false, reason: 'invalid-session' });

    const envBadDraw = createTestEnvelope({ session: { ...createTestEnvelope().session, options: { seed: 42, drawCount: 2, rulesVersion: 1, shuffleVersion: 1 } } });
    expect(restoreSession(JSON.stringify(envBadDraw))).toEqual({ ok: false, reason: 'invalid-session' });

    const envBadRules = createTestEnvelope({ session: { ...createTestEnvelope().session, options: { seed: 42, drawCount: 1, rulesVersion: 2, shuffleVersion: 1 } } });
    expect(restoreSession(JSON.stringify(envBadRules))).toEqual({ ok: false, reason: 'unsupported-schema-version' });

    // sess.elapsedMs bad
    const envBadElapsed = createTestEnvelope({ session: { ...createTestEnvelope().session, elapsedMs: -5 } });
    expect(restoreSession(JSON.stringify(envBadElapsed))).toEqual({ ok: false, reason: 'invalid-session' });

    // sess.started / winRecorded bad type
    const envBadStartedType = createTestEnvelope({ session: { ...createTestEnvelope().session, started: 'yes' } });
    expect(restoreSession(JSON.stringify(envBadStartedType))).toEqual({ ok: false, reason: 'invalid-session' });

    // sess.commands not array
    const envBadCmds = createTestEnvelope({ session: { ...createTestEnvelope().session, commands: 'none' } });
    expect(restoreSession(JSON.stringify(envBadCmds))).toEqual({ ok: false, reason: 'invalid-session' });

    // sess.commands has non-object or unknown command
    const envBadCmdItem = createTestEnvelope({
      session: {
        ...createTestEnvelope().session,
        commands: [null],
        cursor: 0,
        started: true,
      },
    });
    expect(restoreSession(JSON.stringify(envBadCmdItem))).toEqual({
      ok: false,
      reason: 'invalid-replay',
      detail: expect.stringContaining('Malformed command'),
    });

    const envUnknownCmd = createTestEnvelope({
      session: {
        ...createTestEnvelope().session,
        commands: [{ type: 'unknown-action' }],
        cursor: 0,
        started: true,
      },
    });
    expect(restoreSession(JSON.stringify(envUnknownCmd))).toEqual({
      ok: false,
      reason: 'invalid-replay',
      detail: expect.stringContaining('Unknown command type'),
    });
  });

  test('storage error branches for unavailable or failing storage', () => {
    // saveSession with no storage or invalid storage
    expect(saveSession(createSession({ seed: 42, drawCount: 1 }), {}, null)).toEqual({
      ok: false,
      reason: 'storage-unavailable',
      message: 'Nie udało się zapisać gry',
    });

    // saveSession with failing serialization
    const mockStorage = createMockStorage();
    const badSave = saveSession(null, {}, mockStorage);
    expect(badSave.ok).toBe(false);
    expect(badSave.reason).toBe('invalid-session');
    expect(badSave.message).toBe('Nie udało się zapisać gry');

    // loadSession with no storage
    expect(loadSession(null)).toEqual({
      ok: false,
      reason: 'storage-unavailable',
      message: expect.any(String),
    });

    // clearSession with no storage
    expect(clearSession(null)).toEqual({
      ok: false,
      reason: 'storage-unavailable',
      message: expect.any(String),
    });

    // clearSession with failing removeItem
    const failingStorage = {
      removeItem() {
        throw new Error('remove failed');
      },
    };
    expect(clearSession(failingStorage)).toEqual({
      ok: false,
      reason: 'storage-error',
      detail: 'remove failed',
    });
  });

  test('all Polish error message branches return defined strings', () => {
    const reasons = [
      'oversized-save',
      'too-large',
      'too-many-commands',
      'unsupported-schema-version',
      'unsupported-version',
      'malformed-json',
      'corrupt-json',
      'invalid-shape',
      'invalid-session',
      'invalid-statistics',
      'invalid-preferences',
      'invalid-cursor',
      'invalid-flag-relationship',
      'corrupt-data',
      'invalid-replay',
      'storage-unavailable',
      'storage-inaccessible',
      'quota-exceeded',
      'write-error',
      'something-unexpected',
    ];
    for (const r of reasons) {
      const msg = getPolishErrorMessage(r);
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    }
  });

  test('covers all remaining serialization, cleanCommand and restore validation branches', () => {
    // serializeSession oversized save
    const hugeSession = {
      ...createSession({ seed: 42, drawCount: 1 }),
      attemptId: 'x'.repeat(MAX_SERIALIZED_BYTES + 50),
    };
    expect(() => serializeSession(hugeSession)).toThrowError('oversized-save');

    // cleanCommandForSerialization branches
    const mixedSession = {
      ...createSession({ seed: 42, drawCount: 1 }),
      commands: [
        { type: 'recycle' },
        { type: 'move', from: { pile: 'foundation', index: 0 }, to: { pile: 'tableau', index: 1 } },
        { type: 'move', from: { pile: 'tableau', index: 0, cardIndex: 0 }, to: { pile: 'tableau', index: 2 } },
      ],
    };
    expect(() => serializeSession(mixedSession)).not.toThrow();

    // prefs null
    expect(restoreSession(JSON.stringify(createTestEnvelope({ preferences: null })))).toEqual({
      ok: false,
      reason: 'invalid-preferences',
    });

    // prefs.touchHelpSeen not boolean
    expect(restoreSession(JSON.stringify(createTestEnvelope({ preferences: { drawCount: 1, touchHelpSeen: 'yes' } })))).toEqual({
      ok: false,
      reason: 'invalid-preferences',
    });

    // statistics null
    expect(restoreSession(JSON.stringify(createTestEnvelope({ statistics: null })))).toEqual({
      ok: false,
      reason: 'invalid-statistics',
    });

    // statistics.draw1 null
    const badStatsNullMode = createTestEnvelope();
    badStatsNullMode.statistics.draw1 = null;
    expect(restoreSession(JSON.stringify(badStatsNullMode))).toEqual({
      ok: false,
      reason: 'invalid-statistics',
    });

    // statistics negative attempts / wins
    const badStatsNegAttempts = createTestEnvelope();
    badStatsNegAttempts.statistics.draw1.attempts = -2;
    expect(restoreSession(JSON.stringify(badStatsNegAttempts))).toEqual({
      ok: false,
      reason: 'invalid-statistics',
    });

    const badStatsNegWins = createTestEnvelope();
    badStatsNegWins.statistics.draw1.wins = -2;
    expect(restoreSession(JSON.stringify(badStatsNegWins))).toEqual({
      ok: false,
      reason: 'invalid-statistics',
    });

    // statistics bad bestTimeMs or fewestMoves
    const badStatsBestTime = createTestEnvelope();
    badStatsBestTime.statistics.draw1 = { attempts: 2, wins: 1, bestTimeMs: -50, fewestMoves: 10 };
    expect(restoreSession(JSON.stringify(badStatsBestTime))).toEqual({
      ok: false,
      reason: 'invalid-statistics',
    });

    const badStatsFewest = createTestEnvelope();
    badStatsFewest.statistics.draw1 = { attempts: 2, wins: 1, bestTimeMs: 50, fewestMoves: -10 };
    expect(restoreSession(JSON.stringify(badStatsFewest))).toEqual({
      ok: false,
      reason: 'invalid-statistics',
    });

    // session null
    expect(restoreSession(JSON.stringify(createTestEnvelope({ session: null })))).toEqual({
      ok: false,
      reason: 'invalid-session',
    });

    // commands exist but started: false
    const envCmdsNotStarted = createTestEnvelope({
      session: {
        ...createTestEnvelope().session,
        commands: [{ type: 'draw' }],
        started: false,
      },
    });
    expect(restoreSession(JSON.stringify(envCmdsNotStarted))).toEqual({
      ok: false,
      reason: 'invalid-flag-relationship',
      detail: expect.stringContaining('started must be true when commands exist'),
    });

    // Won board reached at cursor but winRecorded is false
    const wonDeal = simulateDeal({ seed: 888, drawCount: 3, maxSteps: 200 });
    let wonSession = createSession({ seed: 888, drawCount: 3 });
    for (const cmd of wonDeal.history) {
      const res = execute(wonSession, cmd);
      if (res.ok) wonSession = res.session;
    }
    const wonEnvelope = JSON.parse(serializeSession(wonSession));
    wonEnvelope.session.winRecorded = false;
    expect(restoreSession(JSON.stringify(wonEnvelope))).toEqual({
      ok: false,
      reason: 'invalid-flag-relationship',
      detail: expect.stringContaining('winRecorded is false'),
    });
  });
});
