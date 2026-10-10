/**
 * Modal dialogs, confirmation flows, and pause overlay for Klondike Solitaire.
 * Follows REQUIREMENTS F05/F07/U06/N01/N02, ARCHITECTURE §§6,9 and TEST_PLAN T13/T15/T18/T19.
 */

import { formatTime } from './render.js';
import { getWinPercentage } from '../session.js';

let lastFocusedElement = null;

export function renderDialogs(rootElement, state, app) {
  const startNewGame = (options) => {
    rootElement.dataset.animateDeal = 'true';
    app.newGame(options);
  };
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
      dialogHtml = renderMenuHtml();
    } else if (dialogKey === 'new-game') {
      dialogHtml = renderNewGameHtml(currentDrawCount, state.persistenceBlocked);
    } else if (dialogKey === 'statistics') {
      dialogHtml = renderStatisticsHtml(state.session.statistics, currentDrawCount);
    } else if (dialogKey === 'win') {
      dialogHtml = renderWinHtml(elapsedMs, moveCount);
    } else if (dialogKey === 'recovery') {
      dialogHtml = renderRecoveryHtml();
    } else if (dialogKey === 'help') {
      dialogHtml = renderHelpHtml();
    } else if (dialogKey.startsWith('confirm-') || dialogKey === 'confirm') {
      dialogHtml = renderConfirmHtml(dialogKey, activeDialog);
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
      modalContainer._dialogHtml = null;
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
  // Clock and layout notifications must not erase form values, focus or feedback.
  if (modalContainer._dialogHtml === dialogHtml) return;
  modalContainer._dialogHtml = dialogHtml;
  modalContainer.innerHTML = dialogHtml;

  attachDialogEvents(modalContainer, dialogType, state, app, startNewGame);

  // Focus trap initialization: focus first interactive element
  requestAnimationFrame(() => {
    const dialogEl = modalContainer.querySelector('[role="dialog"]');
    if (dialogEl && !dialogEl.contains(document.activeElement)) {
      const firstFocusable = dialogEl.querySelector('input, select, button, [tabindex="0"]');
      if (firstFocusable) {
        firstFocusable.focus();
      }
    }
  });
}

function renderMenuHtml() {
  return `
    <div class="dialog-card" id="menu-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title-menu">
      <header class="dialog-header">
        <h2 id="dialog-title-menu" class="dialog-title">Menu gry</h2>
        <button id="btn-dialog-close" class="dialog-close-btn" aria-label="Zamknij menu">✕</button>
      </header>
      <div class="dialog-body">
        <button id="btn-menu-new-game" class="menu-action-btn">Nowa gra</button>
        <button id="btn-menu-restart" class="menu-action-btn">Rozdaj ponownie</button>
        <button id="btn-menu-statistics" class="menu-action-btn">Statystyki</button>
        <button id="btn-menu-help" class="menu-action-btn">Zasady i pomoc</button>
      </div>
      <footer class="dialog-footer">
        <button id="btn-menu-resume" class="btn-primary w-full">Wróć do gry</button>
      </footer>
    </div>
  `;
}

function renderNewGameHtml(drawCount, replacesSave) {
  return `
    <form class="dialog-card" id="new-game-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title-new-game" novalidate>
      <header class="dialog-header"><h2 id="dialog-title-new-game" class="dialog-title">Nowa gra</h2></header>
      <div class="dialog-body">
        <label for="new-game-mode">Tryb nowej gry</label>
        <select id="new-game-mode" class="dialog-input">
          <option value="1" ${drawCount === 1 ? 'selected' : ''}>Dobieraj 1</option>
          <option value="3" ${drawCount === 3 ? 'selected' : ''}>Dobieraj 3</option>
        </select>
        <details class="seed-disclosure">
          <summary>Ustaw własny seed <span class="seed-chevron" aria-hidden="true"></span></summary>
          <label for="new-game-seed">Seed (opcjonalnie)</label>
          <input id="new-game-seed" class="dialog-input" type="text" inputmode="numeric" autocomplete="off" aria-describedby="seed-help seed-error">
          <small id="seed-help">Cyfry dziesiętne, od 0 do 4294967295. Puste pole losuje nowe rozdanie.</small>
          <p id="seed-error" role="alert"></p>
        </details>
        ${replacesSave ? '<p>Rozpoczęcie nowej gry zastąpi poprzedni, nieczytelny zapis.</p>' : ''}
      </div>
      <footer class="dialog-footer">
        <button type="button" id="btn-dialog-close" class="btn-secondary">Anuluj</button>
        <button type="submit" class="btn-primary">Rozpocznij</button>
      </footer>
    </form>`;
}

function renderStatisticsHtml(statistics, currentDrawCount) {
  return `
    <div class="dialog-card" id="statistics-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title-statistics">
      <header class="dialog-header"><h2 id="dialog-title-statistics" class="dialog-title">Statystyki</h2></header>
      <div class="dialog-body">
        <div class="draw-mode-options" role="radiogroup" aria-label="Wybierz statystyki dla trybu">
          <button id="btn-mode-draw-1" class="mode-btn ${currentDrawCount === 1 ? 'is-active' : ''}" role="radio" aria-checked="${currentDrawCount === 1}">Dobieraj 1</button>
          <button id="btn-mode-draw-3" class="mode-btn ${currentDrawCount === 3 ? 'is-active' : ''}" role="radio" aria-checked="${currentDrawCount === 3}">Dobieraj 3</button>
        </div>
        ${[1, 3].map((mode) => {
          const stats = statistics[`draw${mode}`];
          return `<section role="region" aria-label="Dobieraj ${mode}" data-statistics-mode="${mode}" ${currentDrawCount === mode ? '' : 'hidden'}>
            <h3>Dobieraj ${mode}</h3>
            <dl class="statistics-list">
              <dt>Rozpoczęte partie</dt><dd>${stats.attempts}</dd>
              <dt>Wygrane</dt><dd>${stats.wins}</dd>
              <dt>Wygrane procentowo</dt><dd>${getWinPercentage(statistics, mode).toLocaleString('pl-PL', { maximumFractionDigits: 1 })}%</dd>
              <dt>Najlepszy czas</dt><dd>${stats.bestTimeMs === null ? '—' : formatTime(stats.bestTimeMs)}</dd>
              <dt>Najmniej ruchów</dt><dd>${stats.fewestMoves ?? '—'}</dd>
            </dl>
          </section>`;
        }).join('')}
        <p>Statystyki są lokalne. Partia liczy się od pierwszego ruchu; także trwająca i porzucona. Każda partia może zdobyć tylko jedną wygraną.</p>
      </div>
      <footer class="dialog-footer"><button id="btn-dialog-close" class="btn-primary">Zamknij</button></footer>
    </div>`;
}

function selectStatisticsMode(dialogEl, mode) {
  for (const button of dialogEl.querySelectorAll('[role="radio"]')) {
    const selected = button.id === `btn-mode-draw-${mode}`;
    button.setAttribute('aria-checked', String(selected));
    button.classList.toggle('is-active', selected);
  }
  for (const section of dialogEl.querySelectorAll('[data-statistics-mode]')) {
    section.hidden = Number(section.dataset.statisticsMode) !== mode;
  }
}

function renderWinHtml(elapsedMs, moveCount) {
  return `
    <div class="dialog-card" id="win-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title-win">
      <header class="dialog-header"><h2 id="dialog-title-win" class="dialog-title">Wygrana!</h2></header>
      <div class="dialog-body">
        <p>Wszystkie karty są na bazach. Gratulacje!</p>
        <p>Czas gry: <strong>${formatTime(elapsedMs)}</strong></p>
        <p>Liczba ruchów: <strong>${moveCount}</strong></p>
        <p>Po zamknięciu możesz cofnąć ruch i ćwiczyć dalej. Wynik tej partii jest już zaliczony.</p>
      </div>
      <footer class="dialog-footer flex-col">
        <button id="btn-dialog-close" class="btn-secondary">Oglądaj planszę</button>
        <button id="btn-menu-new-game" class="btn-primary">Nowa gra</button>
      </footer>
    </div>`;
}

function renderRecoveryHtml() {
  return `
    <div class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title-recovery">
      <header class="dialog-header"><h2 id="dialog-title-recovery" class="dialog-title">Nie można wczytać gry</h2></header>
      <div class="dialog-body"><p>Poprzedni zapis pozostaje bez zmian. Możesz grać tymczasowo bez zapisywania albo świadomie zastąpić go nową grą.</p></div>
      <footer class="dialog-footer flex-col">
        <button id="btn-dialog-close" class="btn-secondary">Graj tymczasowo</button>
        <button id="btn-menu-new-game" class="btn-danger">Nowa gra i zastąp zapis</button>
      </footer>
    </div>`;
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

function renderConfirmHtml(dialogKey, activeDialog) {
  let title = 'Rozpocząć nową grę?';
  let message = 'Bieżąca partia zostanie przerwana. Czy na pewno chcesz rozpocząć od nowa?';
  let confirmLabel = 'Rozpocznij';

  if (dialogKey === 'confirm-restart' || activeDialog?.action === 'restart') {
    title = 'Rozdać ponownie?';
    message = 'Bieżąca partia zostanie zresetowana do układu początkowego. Czy na pewno chcesz zacząć od nowa?';
    confirmLabel = 'Rozdaj ponownie';
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
          <p>Przeciągnij odkrytą kartę palcem, aby od razu ją przenieść. Krótkie dotknięcie zaznacza kartę; wtedy dotknij dozwolonego celu. Przewijaj kolumny, przesuwając palcem po wolnym miejscu lub zakrytej karcie albo użyj przycisków przewijania.</p>
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

function attachDialogEvents(modalContainer, dialogType, state, app, startNewGame) {
  const dialogEl = modalContainer.querySelector('[role="dialog"]');
  if (!dialogEl) return;

  const isStartedAndUnwon = state.started && !state.isWon;
  const currentDrawCount = state.preferences?.drawCount ?? 1;

  // 1. Focus trap on Tab
  dialogEl.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      const focusables = Array.from(dialogEl.querySelectorAll('input:not(:disabled), select:not(:disabled), summary, button:not(:disabled), [tabindex="0"]:not(:disabled)'));
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

  if (dialogType === 'new-game') {
    dialogEl.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = dialogEl.querySelector('#new-game-seed');
      const value = input.value;
      if (value !== '' && (!/^[0-9]+$/.test(value) || Number(value) > 4294967295)) {
        input.setAttribute('aria-invalid', 'true');
        dialogEl.querySelector('#seed-error').textContent = 'Wpisz seed jako liczbę całkowitą 0–4294967295 (same cyfry) lub pozostaw puste pole.';
        input.focus();
        return;
      }
      const options = {
        drawCount: Number(dialogEl.querySelector('#new-game-mode').value),
        ...(value === '' ? {} : { seed: Number(value) }),
        replaceSave: state.persistenceBlocked,
      };
      if (isStartedAndUnwon) app.openDialog({ name: 'confirm-new-game', options });
      else startNewGame(options);
    });
  }

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
    if (e.target.closest('#btn-menu-help')) {
      app.openDialog('help');
      return;
    }

    if (e.target.closest('#btn-menu-statistics')) {
      app.openDialog('statistics');
      return;
    }

    if (e.target.closest('#btn-menu-new-game')) {
      app.openDialog('new-game');
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
      selectStatisticsMode(dialogEl, 1);
      return;
    }

    if (e.target.closest('#btn-mode-draw-3')) {
      selectStatisticsMode(dialogEl, 3);
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
      } else if (dialogKey === 'confirm-new-game' && state.activeDialog?.options) {
        startNewGame(state.activeDialog.options);
      } else {
        startNewGame({ drawCount: currentDrawCount });
      }
      app.closeDialog();
      return;
    }
  });

  // Clicking backdrop outside menu or help closes dialog
  modalContainer.onclick = (e) => {
    if (e.target === modalContainer) {
      if (dialogType === 'menu' || dialogType === 'help') {
        app.closeDialog();
      }
    }
  };
}
