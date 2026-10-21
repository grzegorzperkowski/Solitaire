import { createGame } from './engine/cards.js';
import { applyMove, assertInvariants, isWon } from './engine/game.js';
import { restoreSessionState } from './session.js';
import { visibleCards } from './engine/knowledge.js';

export const STORAGE_KEY = 'pl.solitaire.save';
export const SCHEMA_VERSION = 2;
export const MAX_SERIALIZED_BYTES = 1024 * 1024; // 1 MiB
export const MAX_COMMANDS = 10000;

const TEXT_ENCODER = new TextEncoder();

export function getPolishErrorMessage(reason) {
  switch (reason) {
    case 'oversized-save':
    case 'too-large':
      return 'Zapis gry przekracza dopuszczalny rozmiar (1 MB).';
    case 'too-many-commands':
      return 'Zapis gry przekracza limit 10 000 ruchów.';
    case 'unsupported-schema-version':
    case 'unsupported-version':
      return 'Nieobsługiwana wersja zapisu gry.';
    case 'malformed-json':
    case 'corrupt-json':
    case 'invalid-shape':
    case 'invalid-session':
    case 'invalid-statistics':
    case 'invalid-preferences':
    case 'invalid-cursor':
    case 'invalid-flag-relationship':
    case 'corrupt-data':
      return 'Zapis gry jest uszkodzony lub niekompletny.';
    case 'invalid-replay':
      return 'Nie udało się odtworzyć historii ruchów z zapisu.';
    case 'storage-unavailable':
    case 'storage-inaccessible':
      return 'Pamięć przeglądarki jest niedostępna.';
    case 'quota-exceeded':
      return 'Nie udało się zapisać gry: brak miejsca w pamięci przeglądarki.';
    case 'write-error':
    default:
      return 'Nie udało się zapisać gry.';
  }
}

function cleanCommandForSerialization(cmd) {
  if (!cmd || typeof cmd !== 'object') return cmd;
  if (cmd.type === 'draw') return { type: 'draw' };
  if (cmd.type === 'recycle') return { type: 'recycle' };
  if (cmd.type === 'move') {
    const cleanFrom = { pile: cmd.from.pile };
    if (cmd.from.pile === 'tableau') {
      cleanFrom.index = cmd.from.index;
      cleanFrom.cardIndex = cmd.from.cardIndex;
    } else if (cmd.from.pile === 'foundation') {
      cleanFrom.index = cmd.from.index;
    }
    const cleanTo = { pile: cmd.to.pile, index: cmd.to.index };
    return {
      type: 'move',
      from: cleanFrom,
      to: cleanTo,
    };
  }
  return { ...cmd };
}

function hasForbiddenKeys(obj) {
  if (obj === null || typeof obj !== 'object') return false;
  return (
    Object.prototype.hasOwnProperty.call(obj, '__proto__') ||
    Object.prototype.hasOwnProperty.call(obj, 'constructor') ||
    Object.prototype.hasOwnProperty.call(obj, 'prototype')
  );
}

export function serializeSession(session, metadata = {}) {
  if (!session || typeof session !== 'object') {
    const error = new Error('invalid-session');
    error.reason = 'invalid-session';
    throw error;
  }
  if (!Array.isArray(session.commands)) {
    const error = new Error('invalid-commands');
    error.reason = 'invalid-commands';
    throw error;
  }
  if (session.commands.length > MAX_COMMANDS) {
    const error = new Error('too-many-commands');
    error.reason = 'too-many-commands';
    throw error;
  }

  const revision = Number.isInteger(metadata?.revision) && metadata.revision >= 0
    ? metadata.revision
    : 1;

  const savedAt = typeof metadata?.savedAt === 'string' && metadata.savedAt.length > 0
    ? metadata.savedAt
    : new Date().toISOString();

  const prefDrawCount = metadata?.preferences?.drawCount === 3
    ? 3
    : (metadata?.preferences?.drawCount === 1 ? 1 : session.options.drawCount);

  const preferences = {
    drawCount: prefDrawCount,
    touchHelpSeen: Boolean(metadata?.preferences?.touchHelpSeen),
  };

  const rawStats = metadata?.statistics ?? session.statistics;
  const statistics = {
    draw1: {
      attempts: rawStats?.draw1?.attempts ?? 0,
      wins: rawStats?.draw1?.wins ?? 0,
      bestTimeMs: rawStats?.draw1?.bestTimeMs ?? null,
      fewestMoves: rawStats?.draw1?.fewestMoves ?? null,
    },
    draw3: {
      attempts: rawStats?.draw3?.attempts ?? 0,
      wins: rawStats?.draw3?.wins ?? 0,
      bestTimeMs: rawStats?.draw3?.bestTimeMs ?? null,
      fewestMoves: rawStats?.draw3?.fewestMoves ?? null,
    },
  };

  const cleanCommands = session.commands.map(cleanCommandForSerialization);

  const envelope = {
    schemaVersion: SCHEMA_VERSION,
    revision,
    savedAt,
    preferences,
    statistics,
    session: {
      attemptId: session.attemptId,
      options: {
        seed: session.options.seed,
        drawCount: session.options.drawCount,
        rulesVersion: session.options.rulesVersion,
        shuffleVersion: session.options.shuffleVersion,
      },
      commands: cleanCommands,
      cursor: session.cursor,
      elapsedMs: session.elapsedMs,
      started: session.started,
      winRecorded: session.winRecorded,
      knownCards: [...session.knownCards],
    },
  };

  const text = JSON.stringify(envelope);
  const byteLength = TEXT_ENCODER.encode(text).length;
  if (byteLength > MAX_SERIALIZED_BYTES) {
    const error = new Error('oversized-save');
    error.reason = 'oversized-save';
    throw error;
  }

  return text;
}

function validateSaveEnvelope(envelope) {
  if (envelope === null || typeof envelope !== 'object' || Array.isArray(envelope) || hasForbiddenKeys(envelope)) {
    return { ok: false, reason: 'invalid-shape' };
  }

  if (envelope.schemaVersion !== 1 && envelope.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      reason: 'unsupported-schema-version',
      detail: `Expected schema version ${SCHEMA_VERSION}, got ${envelope.schemaVersion}`,
    };
  }

  if (!Number.isInteger(envelope.revision) || envelope.revision < 0) {
    return { ok: false, reason: 'invalid-revision' };
  }

  if (typeof envelope.savedAt !== 'string' || envelope.savedAt.length === 0) {
    return { ok: false, reason: 'invalid-saved-at' };
  }

  const prefs = envelope.preferences;
  if (prefs === null || typeof prefs !== 'object' || Array.isArray(prefs) || hasForbiddenKeys(prefs)) {
    return { ok: false, reason: 'invalid-preferences' };
  }
  if (prefs.drawCount !== 1 && prefs.drawCount !== 3) {
    return { ok: false, reason: 'invalid-preferences' };
  }
  if (typeof prefs.touchHelpSeen !== 'boolean') {
    return { ok: false, reason: 'invalid-preferences' };
  }

  const statisticsResult = validateStatistics(envelope.statistics);
  if (!statisticsResult.ok) return statisticsResult;

  const sess = envelope.session;
  if (sess === null || typeof sess !== 'object' || Array.isArray(sess) || hasForbiddenKeys(sess)) {
    return { ok: false, reason: 'invalid-session' };
  }
  if (typeof sess.attemptId !== 'string' || sess.attemptId.length === 0) {
    return { ok: false, reason: 'invalid-session' };
  }
  if (sess.options === null || typeof sess.options !== 'object' || Array.isArray(sess.options) || hasForbiddenKeys(sess.options)) {
    return { ok: false, reason: 'invalid-session' };
  }
  const { seed, drawCount, rulesVersion, shuffleVersion } = sess.options;
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) {
    return { ok: false, reason: 'invalid-session' };
  }
  if (drawCount !== 1 && drawCount !== 3) {
    return { ok: false, reason: 'invalid-session' };
  }
  if (rulesVersion !== 1 || shuffleVersion !== 1) {
    return { ok: false, reason: 'unsupported-schema-version' };
  }

  if (!Number.isInteger(sess.elapsedMs) || sess.elapsedMs < 0) {
    return { ok: false, reason: 'invalid-session' };
  }
  if (typeof sess.started !== 'boolean' || typeof sess.winRecorded !== 'boolean') {
    return { ok: false, reason: 'invalid-session' };
  }
  if (sess.winRecorded && !sess.started) {
    return {
      ok: false,
      reason: 'invalid-flag-relationship',
      detail: 'winRecorded cannot be true when started is false',
    };
  }

  if (!Array.isArray(sess.commands)) {
    return { ok: false, reason: 'invalid-session' };
  }
  if (sess.commands.length > MAX_COMMANDS) {
    return {
      ok: false,
      reason: 'too-many-commands',
      detail: `Command count ${sess.commands.length} exceeds limit of ${MAX_COMMANDS}`,
    };
  }

  if (!Number.isInteger(sess.cursor) || sess.cursor < 0 || sess.cursor > sess.commands.length) {
    return {
      ok: false,
      reason: 'invalid-cursor',
      detail: `Cursor ${sess.cursor} out of bounds [0, ${sess.commands.length}]`,
    };
  }

  if (sess.commands.length > 0 && !sess.started) {
    return {
      ok: false,
      reason: 'invalid-flag-relationship',
      detail: 'started must be true when commands exist',
    };
  }

  return { ok: true };
}

function validateStatistics(stats) {
  if (stats === null || typeof stats !== 'object' || Array.isArray(stats) || hasForbiddenKeys(stats)) {
    return { ok: false, reason: 'invalid-statistics' };
  }
  for (const mode of ['draw1', 'draw3']) {
    const m = stats[mode];
    if (m === null || typeof m !== 'object' || Array.isArray(m) || hasForbiddenKeys(m)) {
      return { ok: false, reason: 'invalid-statistics' };
    }
    if (!Number.isInteger(m.attempts) || m.attempts < 0) {
      return { ok: false, reason: 'invalid-statistics' };
    }
    if (!Number.isInteger(m.wins) || m.wins < 0) {
      return { ok: false, reason: 'invalid-statistics' };
    }
    if (m.wins > m.attempts) {
      return {
        ok: false,
        reason: 'invalid-statistics',
        detail: `Wins (${m.wins}) cannot exceed attempts (${m.attempts})`,
      };
    }
    if (m.bestTimeMs !== null && (typeof m.bestTimeMs !== 'number' || !Number.isFinite(m.bestTimeMs) || m.bestTimeMs < 0)) {
      return { ok: false, reason: 'invalid-statistics' };
    }
    if (m.fewestMoves !== null && (!Number.isInteger(m.fewestMoves) || m.fewestMoves < 0)) {
      return { ok: false, reason: 'invalid-statistics' };
    }
    if (m.wins === 0 && (m.bestTimeMs !== null || m.fewestMoves !== null)) {
      return { ok: false, reason: 'invalid-statistics', detail: 'Best fields must be null when wins is 0' };
    }
    if (m.wins > 0 && (m.bestTimeMs === null || m.fewestMoves === null)) {
      return { ok: false, reason: 'invalid-statistics', detail: 'Best fields cannot be null when wins > 0' };
    }
  }

  return { ok: true };
}

function replayCommands(sess) {
  const { seed, drawCount, rulesVersion, shuffleVersion } = sess.options;
  let dealBoard;
  try {
    dealBoard = createGame({ seed, drawCount, rulesVersion, shuffleVersion });
  } catch (err) {
    return { ok: false, reason: 'invalid-replay', detail: err.message };
  }

  const snapshots = [dealBoard];
  let currentBoard = dealBoard;
  const frozenCommands = [];

  for (let i = 0; i < sess.commands.length; i += 1) {
    const rawCmd = sess.commands[i];
    if (rawCmd === null || typeof rawCmd !== 'object' || Array.isArray(rawCmd) || hasForbiddenKeys(rawCmd)) {
      return { ok: false, reason: 'invalid-replay', detail: `Malformed command at index ${i}` };
    }
    if (rawCmd.type !== 'draw' && rawCmd.type !== 'recycle' && rawCmd.type !== 'move') {
      return { ok: false, reason: 'invalid-replay', detail: `Unknown command type at index ${i}` };
    }

    const result = applyMove(currentBoard, rawCmd);
    if (!result.ok) {
      return {
        ok: false,
        reason: 'invalid-replay',
        detail: `Command at index ${i} (${rawCmd.type}) rejected: ${result.reason}`,
      };
    }

    try {
      assertInvariants(result.state);
    } catch (err) {
      return {
        ok: false,
        reason: 'invalid-replay',
        detail: `Board invariant failed after command ${i}: ${err.message}`,
      };
    }

    snapshots.push(result.state);
    currentBoard = result.state;
    const command = cleanCommandForSerialization(rawCmd);
    if (command.type === 'move') {
      Object.freeze(command.from);
      Object.freeze(command.to);
    }
    frozenCommands.push(Object.freeze(command));
  }

  return { ok: true, snapshots, commands: frozenCommands };
}

export function restoreSession(text) {
  if (typeof text !== 'string') {
    return { ok: false, reason: 'invalid-input' };
  }

  const byteLength = TEXT_ENCODER.encode(text).length;
  if (byteLength > MAX_SERIALIZED_BYTES) {
    return {
      ok: false,
      reason: 'oversized-save',
      detail: `Save size ${byteLength} exceeds limit of ${MAX_SERIALIZED_BYTES} bytes`,
    };
  }

  let envelope;
  try {
    envelope = JSON.parse(text);
  } catch (err) {
    return { ok: false, reason: 'malformed-json', detail: err.message };
  }

  const validation = validateSaveEnvelope(envelope);
  if (!validation.ok) return validation;
  const { preferences: prefs, statistics: stats, session: sess } = envelope;
  const { seed, drawCount, rulesVersion, shuffleVersion } = sess.options;
  const replay = replayCommands(sess);
  if (!replay.ok) return replay;
  const { snapshots, commands: frozenCommands } = replay;

  const cursorHasWin = snapshots.slice(0, sess.cursor + 1).some((s) => isWon(s));
  if (cursorHasWin && !sess.winRecorded) {
    return {
      ok: false,
      reason: 'invalid-flag-relationship',
      detail: 'Board reached win state at or before cursor, but winRecorded is false',
    };
  }

  // V1 cannot document knowledge retained after Undo/abandoned branches.
  const knownCards = envelope.schemaVersion === 1 ? undefined : sess.knownCards;
  if (envelope.schemaVersion === 2 && (
    !Array.isArray(knownCards) || knownCards.length > 52
    || knownCards.some((id) => !Number.isInteger(id) || id < 0 || id > 51)
    || new Set(knownCards).size !== knownCards.length
    || visibleCards(snapshots[sess.cursor]).some((id) => !knownCards.includes(id))
  )) return { ok: false, reason: 'invalid-session' };

  const restoredSession = restoreSessionState({
    attemptId: sess.attemptId,
    options: {
      seed,
      drawCount,
      rulesVersion,
      shuffleVersion,
    },
    commands: frozenCommands,
    cursor: sess.cursor,
    snapshots,
    elapsedMs: sess.elapsedMs,
    started: sess.started,
    winRecorded: sess.winRecorded,
    statistics: stats,
    knownCards,
  });

  const metadata = Object.freeze({
    schemaVersion: envelope.schemaVersion,
    revision: envelope.revision,
    savedAt: envelope.savedAt,
    preferences: Object.freeze({
      drawCount: prefs.drawCount,
      touchHelpSeen: prefs.touchHelpSeen,
    }),
    statistics: Object.freeze({
      draw1: Object.freeze({ ...stats.draw1 }),
      draw3: Object.freeze({ ...stats.draw3 }),
    }),
  });

  return {
    ok: true,
    session: restoredSession,
    metadata,
  };
}

export function saveSession(session, metadata, storage = globalThis?.localStorage) {
  if (!storage || typeof storage.setItem !== 'function') {
    return {
      ok: false,
      reason: 'storage-unavailable',
      message: 'Nie udało się zapisać gry',
    };
  }

  let text;
  try {
    text = serializeSession(session, metadata);
  } catch (err) {
    return {
      ok: false,
      reason: err.reason || 'serialization-error',
      message: 'Nie udało się zapisać gry',
      detail: err.message,
    };
  }

  try {
    storage.setItem(STORAGE_KEY, text);
    return { ok: true, text };
  } catch (err) {
    return {
      ok: false,
      reason: 'quota-exceeded',
      message: 'Nie udało się zapisać gry',
      detail: err.message,
    };
  }
}

export function loadSession(storage = globalThis?.localStorage) {
  if (!storage || typeof storage.getItem !== 'function') {
    return {
      ok: false,
      reason: 'storage-unavailable',
      message: getPolishErrorMessage('storage-unavailable'),
    };
  }

  let item;
  try {
    item = storage.getItem(STORAGE_KEY);
  } catch (err) {
    return {
      ok: false,
      reason: 'storage-inaccessible',
      message: getPolishErrorMessage('storage-inaccessible'),
      detail: err.message,
    };
  }

  if (item === null || item === undefined) {
    return {
      ok: true,
      empty: true,
      session: null,
      metadata: null,
    };
  }

  const result = restoreSession(item);
  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      message: getPolishErrorMessage(result.reason),
      detail: result.detail,
      rawBytes: item,
    };
  }

  return {
    ok: true,
    empty: false,
    session: result.session,
    metadata: result.metadata,
  };
}

export function clearSession(storage = globalThis?.localStorage) {
  if (!storage || typeof storage.removeItem !== 'function') {
    return {
      ok: false,
      reason: 'storage-unavailable',
      message: getPolishErrorMessage('storage-unavailable'),
    };
  }
  try {
    storage.removeItem(STORAGE_KEY);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: 'storage-error',
      detail: err.message,
    };
  }
}
