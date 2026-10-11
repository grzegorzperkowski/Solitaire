import { createGame } from './engine/cards.js';
import { applyMove, isWon } from './engine/game.js';
import { rememberVisible } from './engine/knowledge.js';

function generateAttemptId() {
  return crypto.randomUUID();
}

function defaultStatistics() {
  return {
    draw1: { attempts: 0, wins: 0, bestTimeMs: null, fewestMoves: null },
    draw3: { attempts: 0, wins: 0, bestTimeMs: null, fewestMoves: null },
  };
}

function cloneStatistics(stats) {
  const base = defaultStatistics();
  if (!stats || typeof stats !== 'object') return base;
  for (const key of ['draw1', 'draw3']) {
    const entry = stats[key];
    if (entry && typeof entry === 'object') {
      if (Number.isInteger(entry.attempts) && entry.attempts >= 0) base[key].attempts = entry.attempts;
      if (Number.isInteger(entry.wins) && entry.wins >= 0) base[key].wins = entry.wins;
      if (typeof entry.bestTimeMs === 'number' && entry.bestTimeMs >= 0) base[key].bestTimeMs = entry.bestTimeMs;
      if (Number.isInteger(entry.fewestMoves) && entry.fewestMoves >= 0) base[key].fewestMoves = entry.fewestMoves;
    }
  }
  return base;
}

function freezeCommand(command) {
  if (command === null || typeof command !== 'object') return command;
  if (command.type === 'move') {
    return Object.freeze({
      type: 'move',
      from: Object.freeze({ ...command.from }),
      to: Object.freeze({ ...command.to }),
    });
  }
  return Object.freeze({ ...command });
}

function createSessionObject({
  attemptId,
  options,
  commands,
  cursor,
  snapshots,
  elapsedMs,
  started,
  winRecorded,
  statistics,
  knownCards,
}) {
  const currentBoard = snapshots[cursor];
  return Object.freeze({
    attemptId,
    options: Object.freeze({ ...options }),
    commands: Object.freeze([...commands]),
    cursor,
    snapshots: Object.freeze([...snapshots]),
    elapsedMs,
    knownCards: Object.freeze([...rememberVisible(currentBoard, knownCards)]),
    started,
    winRecorded,
    statistics: Object.freeze({
      draw1: Object.freeze({ ...statistics.draw1 }),
      draw3: Object.freeze({ ...statistics.draw3 }),
    }),
    get state() {
      return currentBoard;
    },
    get moveCount() {
      return cursor;
    },
  });
}

export function createSession(options, attemptId, statistics) {
  const deal = createGame(options);
  const validatedOptions = {
    seed: deal.seed,
    drawCount: deal.drawCount,
    rulesVersion: deal.rulesVersion,
    shuffleVersion: deal.shuffleVersion,
  };
  const id = typeof attemptId === 'string' && attemptId.length > 0 ? attemptId : generateAttemptId();
  const stats = cloneStatistics(statistics);

  return createSessionObject({
    attemptId: id,
    options: validatedOptions,
    commands: [],
    cursor: 0,
    snapshots: [deal],
    elapsedMs: 0,
    started: false,
    winRecorded: false,
    statistics: stats,
  });
}

export function restoreSessionState({
  attemptId,
  options,
  commands,
  cursor,
  snapshots,
  elapsedMs,
  started,
  winRecorded,
  statistics,
  knownCards,
}) {
  return createSessionObject({
    attemptId,
    options,
    commands,
    cursor,
    snapshots,
    elapsedMs,
    started,
    winRecorded,
    statistics: cloneStatistics(statistics),
    knownCards,
  });
}

export function canUndo(session) {
  return session.cursor > 0;
}

export function canRedo(session) {
  return session.cursor < session.commands.length;
}

export function undo(session) {
  if (!canUndo(session)) return session;
  return createSessionObject({
    attemptId: session.attemptId,
    options: session.options,
    commands: session.commands,
    cursor: session.cursor - 1,
    snapshots: session.snapshots,
    elapsedMs: session.elapsedMs,
    started: session.started,
    winRecorded: session.winRecorded,
    statistics: session.statistics,
    knownCards: session.knownCards,
  });
}

export function redo(session) {
  if (!canRedo(session)) return session;
  return createSessionObject({
    attemptId: session.attemptId,
    options: session.options,
    commands: session.commands,
    cursor: session.cursor + 1,
    snapshots: session.snapshots,
    elapsedMs: session.elapsedMs,
    started: session.started,
    winRecorded: session.winRecorded,
    statistics: session.statistics,
    knownCards: session.knownCards,
  });
}

export function execute(session, command) {
  const currentBoard = session.snapshots[session.cursor];
  const result = applyMove(currentBoard, command);
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }

  const nextCommands = session.commands.slice(0, session.cursor);
  nextCommands.push(freezeCommand(command));

  const nextSnapshots = session.snapshots.slice(0, session.cursor + 1);
  nextSnapshots.push(result.state);

  const nextCursor = session.cursor + 1;
  const stats = cloneStatistics(session.statistics);
  const modeKey = session.options.drawCount === 1 ? 'draw1' : 'draw3';

  let started = session.started;
  if (!started) {
    started = true;
    stats[modeKey].attempts += 1;
  }

  let winRecorded = session.winRecorded;
  if (!winRecorded && isWon(result.state)) {
    winRecorded = true;
    stats[modeKey].wins += 1;
    if (stats[modeKey].bestTimeMs === null || session.elapsedMs < stats[modeKey].bestTimeMs) {
      stats[modeKey].bestTimeMs = session.elapsedMs;
    }
    if (stats[modeKey].fewestMoves === null || nextCursor < stats[modeKey].fewestMoves) {
      stats[modeKey].fewestMoves = nextCursor;
    }
  }

  const newSession = createSessionObject({
    attemptId: session.attemptId,
    options: session.options,
    commands: nextCommands,
    cursor: nextCursor,
    snapshots: nextSnapshots,
    elapsedMs: session.elapsedMs,
    started,
    winRecorded,
    statistics: stats,
    knownCards: session.knownCards,
  });

  return { ok: true, session: newSession, revealed: result.revealed };
}

export function restartSession(session, newAttemptId) {
  const id = typeof newAttemptId === 'string' && newAttemptId.length > 0 ? newAttemptId : generateAttemptId();
  const deal = createGame(session.options);
  return createSessionObject({
    attemptId: id,
    options: session.options,
    commands: [],
    cursor: 0,
    snapshots: [deal],
    elapsedMs: 0,
    started: false,
    winRecorded: false,
    statistics: cloneStatistics(session.statistics),
  });
}

export function setElapsedMs(session, elapsedMs) {
  if (typeof elapsedMs !== 'number' || !Number.isInteger(elapsedMs) || elapsedMs < 0) {
    const error = new Error('invalid-elapsed-time');
    error.reason = 'invalid-elapsed-time';
    throw error;
  }
  return createSessionObject({
    attemptId: session.attemptId,
    options: session.options,
    commands: session.commands,
    cursor: session.cursor,
    snapshots: session.snapshots,
    elapsedMs,
    started: session.started,
    winRecorded: session.winRecorded,
    statistics: session.statistics,
    knownCards: session.knownCards,
  });
}

export function addElapsedMs(session, deltaMs) {
  if (typeof deltaMs !== 'number' || !Number.isInteger(deltaMs) || deltaMs < 0) {
    const error = new Error('invalid-elapsed-time');
    error.reason = 'invalid-elapsed-time';
    throw error;
  }
  return setElapsedMs(session, session.elapsedMs + deltaMs);
}

export function getWinPercentage(statistics, mode) {
  if (!statistics || typeof statistics !== 'object') return 0;
  const modeKey = mode === 1 || mode === 'draw1' ? 'draw1' : mode === 3 || mode === 'draw3' ? 'draw3' : null;
  if (!modeKey) return 0;
  const modeStats = statistics[modeKey];
  if (!modeStats || !modeStats.attempts) return 0;
  return (modeStats.wins / modeStats.attempts) * 100;
}
