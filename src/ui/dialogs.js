/**
 * Modal dialogs, confirmation flows, and pause overlay for Klondike Solitaire.
 * Follows REQUIREMENTS F05/F07/U06/N01/N02, ARCHITECTURE §§6,9 and TEST_PLAN T13/T15/T18/T19.
 */

import { formatTime } from './render.js';

let lastFocusedElement = null;

export function renderDialogs(rootElement, state, app) {
  let modalContainer = rootElement.querySelector('#modal-container');
  if (!modalContainer) {
    modalContainer = document.createElement('div');
    modalContainer.id = 'modal-container';
    rootElement.appendChild(modalContainer);
  }

  const { isPaused, activeDialog, preferences, elapsedMs, moveCount } = state;
  const currentDrawCount = preferences?.drawCount ?? 1;

  let dialogHtml = '';
  let dialogType = null;

  if (activeDialog) {
    const dialogKey = typeof activeDialog === 'string' ? activeDialog : activeDialog.name;
    dialogType = dialogKey;

    if (dialogKey === 'menu') {
      dialogHtml = renderMenuHtml(currentDrawCount);
    } else if (dialogKey === 'help') {
      dialogHtml = renderHelpHtml();
    } else if (dialogKey.startsWith('confirm-') || dialogKey === 'confirm') {
      dialogHtml = renderConfirmHtml(dialogKey, activeDialog, currentDrawCount);
    }
  } else if (isPaused) {
    dialogType = 'pause';
    dialogHtml = renderPauseHtml(elapsedMs, moveCount);
  }

  // Conceal board cards when paused or covered by dialog
  const boardArea = rootElement.querySelector('#board-area');
  if (boardArea) {
    if (isPaused) {
      boardArea.classList.add('is-concealed');
    } else {
      boardArea.classList.remove('is-concealed');
    }
  }

  // If no dialog/pause, close container and restore focus
  if (!dialogHtml) {
    if (modalContainer.innerHTML !== '') {
      modalContainer.innerHTML = '';
      modalContainer.className = 'modal-overlay';
      if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        try {
          lastFocusedElement.focus();
        } catch {
          // ignore
        }
        lastFocusedElement = null;
      }
    }
    return;
  }

  // Remember focus before opening new dialog
  if (!modalContainer.classList.contains('is-active')) {
    if (document.activeElement && rootElement.contains(document.activeElement)) {
      lastFocusedElement = document.activeElement;
    } else {
      lastFocusedElement = rootElement.querySelector('#btn-menu');
    }
  }

  modalContainer.className = 'modal-overlay is-active';
  modalContainer.innerHTML = dialogHtml;

  attachDialogEvents(modalContainer, dialogType, state, app);

  // Focus trap initialization: focus first interactive element
  requestAnimationFrame(() => {
    const dialogEl = modalContainer.querySelector('[role="dialog"]');
    if (dialogEl && !dialogEl.contains(document.activeElement)) {
      const firstFocusable = dialogEl.querySelector('button, [tabindex="0"]');
      if (firstFocusable) {
        firstFocusable.focus();
      }
    }
  });
}

function renderMenuHtml(currentDrawCount) {
  return `
    <div class="dialog-card" id="menu-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title-menu">
      <header class="dialog-header">
        <h2 id="dialog-title-menu" class="dialog-title">Menu gry</h2>
        <button id="btn-dialog-close" class="dialog-close-btn" aria-label="Zamknij menu">✕</button>
      </header>
      <div class="dialog-body">
        <button id="btn-menu-new-game" class="menu-action-btn">Nowa gra</button>
        <button id="btn-menu-restart" class="menu-action-btn">Rozdaj ponownie</button>
        <button id="btn-menu-pause" class="menu-action-btn">Wstrzymaj grę</button>

        <div class="menu-section">
          <label class="menu-section-label" id="draw-mode-label">Tryb dobierania kart:</label>
          <div class="draw-mode-options" role="radiogroup" aria-labelledby="draw-mode-label">
            <button id="btn-mode-draw-1" class="mode-btn ${currentDrawCount === 1 ? 'is-active' : ''}" role="radio" aria-checked="${currentDrawCount === 1}">Dobieraj 1</button>
            <button id="btn-mode-draw-3" class="mode-btn ${currentDrawCount === 3 ? 'is-active' : ''}" role="radio" aria-checked="${currentDrawCount === 3}">Dobieraj 3</button>
          </div>
        </div>

        <button id="btn-menu-help" class="menu-action-btn">Zasady i pomoc</button>
      </div>
      <footer class="dialog-footer">
        <button id="btn-menu-resume" class="btn-primary w-full">Wróć do gry</button>
      </footer>
    </div>
  `;
}

function renderPauseHtml(elapsedMs, moveCount) {
  return `
    <div class="dialog-card pause-dialog" id="pause-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title-pause">
      <header class="dialog-header">
        <h2 id="dialog-title-pause" class="dialog-title">Gra wstrzymana</h2>
      </header>
      <div class="dialog-body">
        <p class="pause-stat">Czas gry: <strong>${formatTime(elapsedMs)}</strong></p>
        <p class="pause-stat">Liczba ruchów: <strong>${moveCount}</strong></p>
      </div>
      <footer class="dialog-footer flex-col">
        <button id="btn-resume-game" class="btn-primary w-full">Wznów grę</button>
        <button id="btn-pause-menu" class="btn-secondary w-full">Menu gry</button>
      </footer>
    </div>
  `;
}

function renderConfirmHtml(dialogKey, activeDialog, currentDrawCount) {
  let title = 'Rozpocząć nową grę?';
  let message = 'Bieżąca partia zostanie przerwana. Czy na pewno chcesz rozpocząć od nowa?';
  let confirmLabel = 'Rozpocznij';

  if (dialogKey === 'confirm-restart' || activeDialog?.action === 'restart') {
    title = 'Rozdać ponownie?';
    message = 'Bieżąca partia zostanie zresetowana do układu początkowego. Czy na pewno chcesz zacząć od nowa?';
    confirmLabel = 'Rozdaj ponownie';
  } else if (dialogKey === 'confirm-mode-1' || (activeDialog?.action === 'changeMode' && activeDialog?.drawCount === 1)) {
    title = 'Zmienić tryb na dobieranie po 1?';
    message = 'Zmiana trybu dobierania przerwie obecną partię i rozpocznie nową grę.';
    confirmLabel = 'Zmień i rozpocznij';
  } else if (dialogKey === 'confirm-mode-3' || (activeDialog?.action === 'changeMode' && activeDialog?.drawCount === 3)) {
    title = 'Zmienić tryb na dobieranie po 3?';
    message = 'Zmiana trybu dobierania przerwie obecną partię i rozpocznie nową grę.';
    confirmLabel = 'Zmień i rozpocznij';
  }

  return `
    <div class="dialog-card confirm-dialog" id="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title-confirm">
      <header class="dialog-header">
        <h2 id="dialog-title-confirm" class="dialog-title">${title}</h2>
      </header>
      <div class="dialog-body">
        <p class="confirm-message">${message}</p>
      </div>
      <footer class="dialog-footer">
        <button id="btn-confirm-cancel" class="btn-secondary">Anuluj</button>
        <button id="btn-confirm-accept" class="btn-danger">${confirmLabel}</button>
      </footer>
    </div>
  `;
}

function renderHelpHtml() {
  return `
    <div class="dialog-card help-dialog" id="help-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title-help">
      <header class="dialog-header">
        <h2 id="dialog-title-help" class="dialog-title">Zasady gry i pomoc</h2>
        <button id="btn-dialog-close" class="dialog-close-btn" aria-label="Zamknij pomoc">✕</button>
      </header>
      <div class="dialog-body help-content">
        <section>
          <h3 class="help-section-title">Cel gry</h3>
          <p>Ułóż wszystkie 52 karty na czterech bazach (fundamentach) od Asa do Króla w odpowiednich kolorach (trefl, karo, kier, pik).</p>
        </section>
        <section>
          <h3 class="help-section-title">Kolumny robocze</h3>
          <p>Karty układa się malejąco według starszeństwa z naprzemiennymi kolorami (np. czerwona szóstka na czarną siódemkę). Na puste pole kolumny można położyć wyłącznie Króla lub poprawną sekwencję rozpoczynającą się od Króla.</p>
        </section>
        <section>
          <h3 class="help-section-title">Sekwencje</h3>
          <p>Przeniesienie karty z kolumny roboczej powoduje przeniesienie całej sekwencji kart leżących na niej. Po przeniesieniu karty w kolumnie nowo odsłonięta karta zakryta zostaje automatycznie odwrócona.</p>
        </section>
        <section>
          <h3 class="help-section-title">Stos i skrawek</h3>
          <p>Kliknięcie stosu dobierania odkrywa kartę na skrawku (1 lub 3 karty w zależności od trybu). Gdy stos jest pusty, kliknięcie pozwala przetasować skrawek z powrotem bez limitu powtórzeń.</p>
        </section>
        <section>
          <h3 class="help-section-title">Sterowanie dotykiem i myszą</h3>
          <p>Dotknij karty, aby ją zaznaczyć (zostanie podświetlona na złoto, a dozwolone cele na zielono). Następnie dotknij wybranego celu. Ponowne dotknięcie tej samej karty lub tła odznacza wybór.</p>
        </section>
        <section>
          <h3 class="help-section-title">Sterowanie klawiaturą</h3>
          <p>Klawisze strzałek przemieszczają kursor po planszy. Spacja na stosie dobiera kartę. Enter lub Spacja na karcie zaznacza ją i przenosi na cel. Klawisz Escape odznacza kartę i zamyka okna dialogowe. Skrót Ctrl+Z cofa ruch, a Ctrl+Y ponawia.</p>
        </section>
      </div>
      <footer class="dialog-footer">
        <button id="btn-help-close" class="btn-primary w-full">Zamknij</button>
      </footer>
    </div>
  `;
}

function attachDialogEvents(modalContainer, dialogType, state, app) {
  const dialogEl = modalContainer.querySelector('[role="dialog"]');
  if (!dialogEl) return;

  const isStartedAndUnwon = state.started && !state.isWon;
  const currentDrawCount = state.preferences?.drawCount ?? 1;

  // 1. Focus trap on Tab
  dialogEl.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      const focusables = Array.from(dialogEl.querySelectorAll('button:not(:disabled), [tabindex="0"]:not(:disabled)'));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // 2. Click actions
  dialogEl.addEventListener('click', (e) => {
    e.stopPropagation();

    // Close buttons
    if (e.target.closest('#btn-dialog-close') || e.target.closest('#btn-menu-resume') || e.target.closest('#btn-help-close')) {
      app.closeDialog();
      return;
    }

    // Pause screen actions
    if (e.target.closest('#btn-resume-game')) {
      app.resume();
      return;
    }
    if (e.target.closest('#btn-pause-menu')) {
      app.openDialog('menu');
      return;
    }

    // Menu actions
    if (e.target.closest('#btn-menu-pause')) {
      app.closeDialog();
      app.pause();
      return;
    }

    if (e.target.closest('#btn-menu-help')) {
      app.openDialog('help');
      return;
    }

    if (e.target.closest('#btn-menu-new-game')) {
      if (isStartedAndUnwon) {
        app.openDialog('confirm-new-game');
      } else {
        app.closeDialog();
        app.newGame({ drawCount: currentDrawCount });
      }
      return;
    }

    if (e.target.closest('#btn-menu-restart')) {
      if (isStartedAndUnwon) {
        app.openDialog('confirm-restart');
      } else {
        app.closeDialog();
        app.restart();
      }
      return;
    }

    if (e.target.closest('#btn-mode-draw-1')) {
      if (currentDrawCount !== 1) {
        if (isStartedAndUnwon) {
          app.openDialog('confirm-mode-1');
        } else {
          app.setDrawPreference(1);
          app.newGame({ drawCount: 1 });
        }
      }
      return;
    }

    if (e.target.closest('#btn-mode-draw-3')) {
      if (currentDrawCount !== 3) {
        if (isStartedAndUnwon) {
          app.openDialog('confirm-mode-3');
        } else {
          app.setDrawPreference(3);
          app.newGame({ drawCount: 3 });
        }
      }
      return;
    }

    // Confirm dialog actions
    if (e.target.closest('#btn-confirm-cancel')) {
      app.closeDialog();
      return;
    }

    if (e.target.closest('#btn-confirm-accept')) {
      const dialogKey = typeof state.activeDialog === 'string' ? state.activeDialog : state.activeDialog?.name;
      if (dialogKey === 'confirm-restart' || state.activeDialog?.action === 'restart') {
        app.restart();
      } else if (dialogKey === 'confirm-mode-1' || state.activeDialog?.drawCount === 1) {
        app.setDrawPreference(1);
        app.newGame({ drawCount: 1 });
      } else if (dialogKey === 'confirm-mode-3' || state.activeDialog?.drawCount === 3) {
        app.setDrawPreference(3);
        app.newGame({ drawCount: 3 });
      } else {
        app.newGame({ drawCount: currentDrawCount });
      }
      app.closeDialog();
      return;
    }
  });

  // Clicking backdrop outside menu or help closes dialog
  modalContainer.addEventListener('click', (e) => {
    if (e.target === modalContainer) {
      if (dialogType === 'menu' || dialogType === 'help') {
        app.closeDialog();
      }
    }
  });
}
