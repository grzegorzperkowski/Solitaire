import { createSession, execute, undo, redo, restartSession, addElapsedMs } from './session.js';
import { loadSession, saveSession, serializeSession, STORAGE_KEY, SCHEMA_VERSION } from './persistence.js';
import { isWon } from './engine/game.js';
import { searchProgress } from './engine/progress.js';
import { searchSmartHint } from './engine/smart-hints.js';

export const LOCK_NAME = 'pl.solitaire.writer';
const HINT_BATCH_MS = 4;
const HINT_ACTIVE_MS = 100;

export function createApp({
  storage,
  load = loadSession,
  progressMaxStates = 10000,
  hintMaxStates = 10000,
  hintMaxDepth = 12,
  lockManager = globalThis?.navigator?.locks,
  performance = globalThis?.performance,
  document = globalThis?.document,
  window = globalThis?.window,
  initialOptions = { seed: 42, drawCount: 1 },
} = {}) {
  let session = null;
  let preferences = { drawCount: initialOptions.drawCount ?? 1, touchHelpSeen: false };
  let metadata = { schemaVersion: SCHEMA_VERSION, revision: 1, savedAt: new Date().toISOString() };
  let isPaused = false;
  let activeDialog = null;
  let isWriter = false;
  let hasConflict = false;
  let lockNotice = null;
  let saveError = null;
  let persistenceBlocked = false;
  let unreadableSave = null;
  let lastTickTime = performance ? performance.now() : Date.now();
  let timerIntervalId = null;
  let checkpointIntervalId = null;
  let releaseLockFn = null;
  let isDestroyed = false;

  let progress = Object.freeze({ status: 'UNKNOWN', noLegalMoves: false });
  let analyzedBoard = null;
  let analyzedKnowledge = null;
  let analysisTimer = null;

  // SmartHint v1 state (T028-spec §2, §6)
  let hint = null;
  let hintRequestId = 0;
  let hintBoard = null;
  let hintKnowledge = null;
  let hintTimer = null;
  let isHintLoading = false;

  const listeners = new Set();

  function cancelHint() {
    clearTimeout(hintTimer);
    hintTimer = null;
    isHintLoading = false;
    hintRequestId++;
  }

  function invalidateHint() {
    cancelHint();
    hint = null;
    hintBoard = null;
    hintKnowledge = null;
  }

  function requestSmartHint() {
    if (!session || isDestroyed) return;
    const board = session.state;
    const knowledge = session.knownCards.join(',');

    // If game is won, no hint
    if (isWon(board)) {
      invalidateHint();
      hint = Object.freeze({ status: 'WON', plan: [], goal: null, score: null, visitedStates: 0, truncated: false });
      notifyListeners();
      return;
    }

    // Repeated click on same board/knowledge re-exposes current result if available (§6)
    if (hint && hintBoard === board && hintKnowledge === knowledge && !isHintLoading) {
      notifyListeners();
      return;
    }

    // Cancel existing search
    cancelHint();
    const reqId = ++hintRequestId;
    hintBoard = board;
    hintKnowledge = knowledge;
    isHintLoading = true;
    hint = null;

    const generator = searchSmartHint(board, session.knownCards, {
      maxStates: hintMaxStates,
      maxDepth: hintMaxDepth,
    });

    const now = () => performance ? performance.now() : Date.now();
    let activeMs = 0;
    let latestValue = null;

    function hintBatch() {
      if (isDestroyed || reqId !== hintRequestId || session?.state !== board || session?.knownCards.join(',') !== knowledge) {
        return;
      }
      // Cancel on pause, activeDialog, or hidden document (§6)
      if (isPaused || activeDialog || isDocumentHidden()) {
        isHintLoading = false;
        return;
      }

      const start = now();
      let next;
      do {
        next = generator.next();
        if (next.value) latestValue = next.value;
        if (next.done) break;
      } while (now() - start < HINT_BATCH_MS && activeMs + now() - start < HINT_ACTIVE_MS);

      activeMs += now() - start;

      if (next.done || activeMs >= HINT_ACTIVE_MS) {
        if (!next.done) {
          try { generator.return(); } catch {}
        }
        isHintLoading = false;
        const result = next.done ? next.value : (latestValue || {
          status: 'INCONCLUSIVE',
          plan: [],
          goal: null,
          score: null,
          visitedStates: 0,
          truncated: true,
        });
        hint = Object.freeze(next.done ? result : { ...result, truncated: true });
        notifyListeners();
      } else {
        hintTimer = setTimeout(hintBatch, 0);
      }
    }

    hintTimer = setTimeout(hintBatch, 0);
    notifyListeners();
  }

  function updateProgress() {
    if (!session) return;
    const board = session.state;
    const knowledge = session.knownCards.join(',');
    if (board === analyzedBoard && knowledge === analyzedKnowledge) return;
    clearTimeout(analysisTimer);
    analyzedBoard = board;
    analyzedKnowledge = knowledge;
    // Invalidate hint whenever board or knowledge changes (§6)
    invalidateHint();
    progress = Object.freeze({ status: isWon(board) ? 'WON' : 'UNKNOWN', noLegalMoves: false });
    if (progress.status === 'WON') return;
    const search = searchProgress(board, session.knownCards, { maxStates: progressMaxStates });
    const now = () => performance ? performance.now() : Date.now();
    let activeMs = 0;
    function batch() {
      if (isDestroyed || session.state !== board || session.knownCards.join(',') !== knowledge) return;
      const start = now();
      let next;
      do {
        next = search.next();
        if (next.done) break;
      } while (now() - start < 4 && activeMs + now() - start < 100);
      activeMs += now() - start;
      if (next.done || activeMs >= 100) {
        search.return();
        progress = Object.freeze(next.done ? next.value : { status: 'UNKNOWN', noLegalMoves: false });
        notifyListeners(true);
      } else {
        analysisTimer = setTimeout(batch, 0);
      }
    }
    analysisTimer = setTimeout(batch, 0);
  }

  function isDocumentHidden() {
    return document ? Boolean(document.hidden) : false;
  }

  function notifyListeners(progressOnly = false) {
    if (isDestroyed) return;
    updateProgress();
    const currentState = getState();
    for (const listener of listeners) {
      try {
        listener(currentState, progressOnly);
      } catch (err) {
        console.error('Error in app state listener:', err);
      }
    }
  }

  function settleElapsed(forceRun = false) {
    if (!session) return;
    const now = performance ? performance.now() : Date.now();
    const canRun =
      forceRun ||
      (session.started &&
        !isPaused &&
        !activeDialog &&
        !isDocumentHidden() &&
        !isWon(session.state));

    if (canRun) {
      const delta = Math.floor(now - lastTickTime);
      if (delta > 0) {
        session = addElapsedMs(session, delta);
        lastTickTime = now;
      } else {
        lastTickTime = now;
      }
    } else {
      lastTickTime = now;
    }
  }

  async function acquireLock() {
    if (lockManager && typeof lockManager.request === 'function') {
      try {
        lockManager.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
          if (!lock) {
            isWriter = false;
            hasConflict = true;
            lockNotice = 'Gra jest otwarta w innej karcie (tryb tylko do odczytu).';
            notifyListeners();
            return;
          }
          isWriter = true;
          hasConflict = false;
          lockNotice = null;
          notifyListeners();

          await new Promise((resolve) => {
            releaseLockFn = resolve;
          });
        });
      } catch (err) {
        // Fallback if request fails
        setupFallbackOwnership();
      }
    } else {
      setupFallbackOwnership();
    }
  }

  function setupFallbackOwnership() {
    isWriter = true;
    hasConflict = false;
    lockNotice = null;
  }

  function checkFallbackConflictBeforeWrite() {
    if (!storage || typeof storage.getItem !== 'function') return false;
    try {
      const item = storage.getItem(STORAGE_KEY);
      // Explicit recovery may replace only the unreadable bytes seen at startup.
      if (unreadableSave !== null && item === unreadableSave) return false;
      if (item || unreadableSave !== null) {
        const parsed = unreadableSave === null ? JSON.parse(item) : null;
        if (unreadableSave !== null || (Number.isInteger(parsed?.revision) && parsed.revision > metadata.revision)) {
          isWriter = false;
          hasConflict = true;
          lockNotice = 'Wykryto konflikt zapisu z innej karty. Przeładowano do trybu tylko do odczytu.';
          notifyListeners();
          return true;
        }
      }
    } catch {
      // ignore
    }
    return false;
  }

  function handleStorageEvent(event) {
    if (event.key === STORAGE_KEY) {
      try {
        if (event.newValue) {
          const parsed = JSON.parse(event.newValue);
          if (Number.isInteger(parsed.revision) && parsed.revision !== metadata.revision) {
            isWriter = false;
            hasConflict = true;
            lockNotice = 'Wykryto konflikt zapisu z innej karty. Przeładowano do trybu tylko do odczytu.';
            notifyListeners();
          }
        }
      } catch {
        // ignore
      }
    }
  }

  function handleVisibilityChange() {
    if (isDocumentHidden()) {
      if (session && session.started && !isPaused && !activeDialog && !isWon(session.state)) {
        settleElapsed(true);
      }
      if (session && session.started && isWriter && !hasConflict) {
        save();
      }
    } else {
      lastTickTime = performance ? performance.now() : Date.now();
    }
    notifyListeners();
  }

  function handlePageHide() {
    if (session && session.started && !isPaused && !activeDialog && !isWon(session.state)) {
      settleElapsed(true);
    }
    if (session && session.started && isWriter && !hasConflict) {
      save();
    }
  }

  function save() {
    if (!session) return { ok: false, reason: 'no-session' };
    if (persistenceBlocked) return { ok: false, reason: 'recovery-required', message: saveError };
    if (!isWriter || hasConflict) {
      return { ok: false, reason: 'read-only', message: lockNotice || 'Tryb tylko do odczytu' };
    }

    if (checkFallbackConflictBeforeWrite()) {
      return { ok: false, reason: 'conflict', message: lockNotice };
    }

    settleElapsed();

    const saveMeta = {
      revision: metadata.revision + 1,
      savedAt: new Date().toISOString(),
      preferences,
    };

    const res = saveSession(session, saveMeta, storage);
    if (res.ok) {
      metadata.revision = saveMeta.revision;
      metadata.savedAt = saveMeta.savedAt;
      saveError = null;
      unreadableSave = null;
    } else {
      saveError = res.message;
    }
    return res;
  }

  function init() {
    if (storage === undefined) {
      try { storage = globalThis.localStorage; } catch { storage = null; }
    }
    const loadResult = load(storage);
    if (loadResult.ok && !loadResult.empty) {
      session = loadResult.session;
      metadata = {
        schemaVersion: loadResult.metadata.schemaVersion,
        revision: loadResult.metadata.revision,
        savedAt: loadResult.metadata.savedAt,
      };
      preferences = { ...loadResult.metadata.preferences };
      // F07 / T13: Restore starts paused if already started
      isPaused = session.started && !isWon(session.state);
      if (isWon(session.state)) activeDialog = 'win';
    } else if (!loadResult.ok) {
      session = createSession(initialOptions);
      saveError = loadResult.message;
      persistenceBlocked = true;
      unreadableSave = loadResult.rawBytes ?? null;
      activeDialog = 'recovery';
      isPaused = false;
    } else {
      session = createSession(initialOptions);
      isPaused = false;
    }

    acquireLock();

    if (window && typeof window.addEventListener === 'function') {
      window.addEventListener('storage', handleStorageEvent);
      window.addEventListener('pagehide', handlePageHide);
    }
    if (document && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    lastTickTime = performance ? performance.now() : Date.now();

    // Regular tick (e.g., every 1000ms for UI timer updates)
    timerIntervalId = setInterval(() => {
      settleElapsed();
      notifyListeners();
    }, 1000);

    // 5-second persistence checkpoint
    checkpointIntervalId = setInterval(() => {
      settleElapsed();
      if (session && session.started && isWriter && !hasConflict) {
        save();
      }
    }, 5000);

    notifyListeners();
    return app;
  }

  function executeCommand(command) {
    if (!session) return { ok: false, reason: 'no-session' };
    settleElapsed();

    const wasStarted = session.started;
    const hadWin = session.winRecorded;
    const result = execute(session, command);

    if (result.ok) {
      session = result.session;
      if (!hadWin && session.winRecorded) activeDialog = 'win';
      if (!wasStarted && session.started) {
        lastTickTime = performance ? performance.now() : Date.now();
      }
      save();
      notifyListeners();
      return result;
    }

    notifyListeners();
    return result;
  }

  function handleUndo() {
    if (!session) return session;
    settleElapsed();
    const next = undo(session);
    if (next !== session) {
      session = next;
      save();
      notifyListeners();
    }
    return session;
  }

  function handleRedo() {
    if (!session) return session;
    settleElapsed();
    const next = redo(session);
    if (next !== session) {
      session = next;
      save();
      notifyListeners();
    }
    return session;
  }

  function newGame(options = {}) {
    settleElapsed();
    const drawCount = options.drawCount ?? preferences.drawCount ?? 1;
    const seed =
      typeof options.seed === 'number'
        ? options.seed
        : crypto.getRandomValues(new Uint32Array(1))[0];

    session = createSession({ seed, drawCount }, null, session ? session.statistics : null);
    preferences.drawCount = drawCount;
    if (options.replaceSave === true) persistenceBlocked = false;
    isPaused = false;
    activeDialog = null;
    save();
    notifyListeners();
    return session;
  }

  function restart() {
    if (!session) return null;
    settleElapsed();
    session = restartSession(session);
    isPaused = false;
    activeDialog = null;
    save();
    notifyListeners();
    return session;
  }

  function pause() {
    settleElapsed();
    isPaused = true;
    save();
    notifyListeners();
  }

  function resume() {
    lastTickTime = performance ? performance.now() : Date.now();
    isPaused = false;
    save();
    notifyListeners();
  }

  function openDialog(name) {
    settleElapsed();
    activeDialog = name;
    notifyListeners();
  }

  function closeDialog() {
    lastTickTime = performance ? performance.now() : Date.now();
    activeDialog = null;
    notifyListeners();
  }

  function setDrawPreference(drawCount) {
    if (drawCount === 1 || drawCount === 3) {
      preferences.drawCount = drawCount;
      save();
      notifyListeners();
    }
  }

  function markTouchHelpSeen() {
    preferences.touchHelpSeen = true;
    save();
    notifyListeners();
  }

  function exportDiagnostic(build) {
    try {
      const exportedAt = new Date().toISOString();
      const save = JSON.parse(serializeSession(session, { ...metadata, preferences, savedAt: exportedAt }));
      return {
        ok: true,
        filename: `solitaire-stan-${session.options.seed}-draw${session.options.drawCount}-${session.cursor}.json`,
        text: JSON.stringify({
          format: 'pl.solitaire.hint-diagnostic', formatVersion: 1, exportedAt, build,
          save, hint, progress, isHintLoading,
          budgets: { maxStates: hintMaxStates, maxDepth: hintMaxDepth, activeMs: HINT_ACTIVE_MS, batchMs: HINT_BATCH_MS },
        }, null, 2),
      };
    } catch {
      return { ok: false, message: 'Nie udało się przygotować stanu gry do analizy.' };
    }
  }

  function getState() {
    return Object.freeze({
      session,
      progress,
      hint,
      isHintLoading,
      state: session ? session.state : null,
      moveCount: session ? session.moveCount : 0,
      elapsedMs: session ? session.elapsedMs : 0,
      started: session ? session.started : false,
      winRecorded: session ? session.winRecorded : false,
      isWon: session ? isWon(session.state) : false,
      isPaused,
      activeDialog,
      isWriter,
      hasConflict,
      lockNotice,
      saveError,
      persistenceBlocked,
      preferences: Object.freeze({ ...preferences }),
      metadata: Object.freeze({ ...metadata }),
    });
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function destroy() {
    isDestroyed = true;
    clearTimeout(analysisTimer);
    clearTimeout(hintTimer);
    settleElapsed();
    if (timerIntervalId) clearInterval(timerIntervalId);
    if (checkpointIntervalId) clearInterval(checkpointIntervalId);
    if (releaseLockFn) {
      releaseLockFn();
      releaseLockFn = null;
    }
    if (window && typeof window.removeEventListener === 'function') {
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('pagehide', handlePageHide);
    }
    if (document && typeof document.removeEventListener === 'function') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    listeners.clear();
  }

  const app = {
    init,
    executeCommand,
    undo: handleUndo,
    redo: handleRedo,
    newGame,
    restart,
    pause,
    resume,
    openDialog,
    closeDialog,
    setDrawPreference,
    markTouchHelpSeen,
    requestSmartHint,
    exportDiagnostic,
    save,
    getState,
    subscribe,
    destroy,
    // exposed helpers for testing
    settleElapsed,
  };

  return app;
}
