import { createSession, execute, undo, redo, restartSession, addElapsedMs } from './session.js';
import { loadSession, saveSession, STORAGE_KEY } from './persistence.js';
import { isWon } from './engine/game.js';

export const LOCK_NAME = 'pl.solitaire.writer';

export function createApp({
  storage = globalThis?.localStorage,
  lockManager = globalThis?.navigator?.locks,
  performance = globalThis?.performance,
  document = globalThis?.document,
  window = globalThis?.window,
  initialOptions = { seed: 42, drawCount: 1 },
} = {}) {
  let session = null;
  let preferences = { drawCount: initialOptions.drawCount ?? 1, touchHelpSeen: false };
  let metadata = { schemaVersion: 1, revision: 1, savedAt: new Date().toISOString() };
  let isPaused = false;
  let activeDialog = null;
  let isWriter = false;
  let hasConflict = false;
  let lockNotice = null;
  let saveError = null;
  let lastTickTime = performance ? performance.now() : Date.now();
  let timerIntervalId = null;
  let checkpointIntervalId = null;
  let releaseLockFn = null;
  let isDestroyed = false;

  const listeners = new Set();

  function isDocumentHidden() {
    return document ? Boolean(document.hidden) : false;
  }

  function notifyListeners() {
    if (isDestroyed) return;
    const currentState = getState();
    for (const listener of listeners) {
      try {
        listener(currentState);
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
      if (item) {
        const parsed = JSON.parse(item);
        if (Number.isInteger(parsed.revision) && parsed.revision > metadata.revision) {
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
    if (!isWriter || hasConflict) {
      return { ok: false, reason: 'read-only', message: lockNotice || 'Tryb tylko do odczytu' };
    }

    if (checkFallbackConflictBeforeWrite()) {
      return { ok: false, reason: 'conflict', message: lockNotice };
    }

    settleElapsed();

    const saveMeta = {
      revision: metadata.revision,
      savedAt: new Date().toISOString(),
      preferences,
    };

    const res = saveSession(session, saveMeta, storage);
    if (res.ok) {
      metadata.revision += 1;
      metadata.savedAt = saveMeta.savedAt;
      saveError = null;
    } else {
      saveError = res.message;
    }
    return res;
  }

  function init() {
    if (storage) {
      const loadResult = loadSession(storage);
      if (loadResult.ok && !loadResult.empty) {
        session = loadResult.session;
        metadata = {
          schemaVersion: loadResult.metadata.schemaVersion,
          revision: loadResult.metadata.revision,
          savedAt: loadResult.metadata.savedAt,
        };
        preferences = { ...loadResult.metadata.preferences };
        // F07 / T13: Restore starts paused if already started
        isPaused = session.started;
      } else if (!loadResult.ok) {
        session = createSession(initialOptions);
        saveError = loadResult.message;
        isPaused = false;
      } else {
        session = createSession(initialOptions);
        isPaused = false;
      }
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
    const result = execute(session, command);

    if (result.ok) {
      session = result.session;
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
        : Math.floor(Math.random() * 4294967296);

    session = createSession({ seed, drawCount }, null, session ? session.statistics : null);
    isPaused = false;
    activeDialog = null;
    metadata.revision += 1;
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
    metadata.revision += 1;
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

  function getState() {
    return Object.freeze({
      session,
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
    save,
    getState,
    subscribe,
    destroy,
    // exposed helpers for testing
    settleElapsed,
  };

  return app;
}
