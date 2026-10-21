/**
 * DOM Renderer for Klondike Solitaire.
 * Follows ARCHITECTURE §8-§9 and REQUIREMENTS U01–U06/N01/N02.
 */

import { createCardElement, createEmptySlotElement } from './cards.js';
import { calculateBoardDimensions, applyLayoutVariables } from './layout.js';
import { renderDialogs } from './dialogs.js';
import { noProgressMessage } from './progress.js';
import { formatSmartHintMessage } from './smart-hints.js';
import { syncVictoryAnimation } from './victory-animation.js';

export function formatTime(ms) {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export const BUILD_INFO = typeof __BUILD_INFO__ !== 'undefined' ? __BUILD_INFO__ : 'Build dev';

let dealVariantOrder = [];
let lastDealVariant = null;

export function createBoardStructure(rootElement) {
  rootElement.innerHTML = `
    <div class="game-container" id="game-container">
      <header class="game-header">
        <div class="header-stat header-timer" aria-label="Czas gry">
          <span class="stat-label">Czas:</span>
          <span id="timer-display" class="stat-value">00:00</span>
        </div>
        <h1 id="page-title" class="game-title">Pasjans Klondike</h1>
        <div class="header-stat header-moves" aria-label="Liczba ruchów">
          <span class="stat-label">Ruchy:</span>
          <span id="moves-display" class="stat-value">0</span>
        </div>
      </header>

      <div id="notice-banner" class="notice-banner hidden" role="status" aria-live="polite"></div>
      <div id="practice-status" class="notice-banner hidden">Tryb ćwiczeniowy — wygrana tej partii jest już zaliczona.</div>
      <div id="live-announcer" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>

      <div class="board-area" id="board-area">
        <!-- Top row: Stock (col 0), Waste (cols 1-2), Foundations (cols 3-6) -->
        <section class="top-row" aria-label="Górne stosy">
          <div class="stock-container" id="stock-container" role="button" tabindex="0" aria-label="Stos dobierania">
            <div class="stock-pile-wrapper" id="stock-pile"></div>
            <span class="stock-count-badge" id="stock-count-badge" aria-label="Liczba kart w stosie">0</span>
          </div>

          <div class="waste-container" id="waste-container" aria-label="Skrawek">
            <div class="waste-pile" id="waste-pile"></div>
          </div>

          <div class="foundations-container" id="foundations-container" aria-label="Fundamenty">
            <div class="foundation-pile" id="foundation-0" data-foundation-index="0" role="region" aria-label="Baza trefl"></div>
            <div class="foundation-pile" id="foundation-1" data-foundation-index="1" role="region" aria-label="Baza karo"></div>
            <div class="foundation-pile" id="foundation-2" data-foundation-index="2" role="region" aria-label="Baza kier"></div>
            <div class="foundation-pile" id="foundation-3" data-foundation-index="3" role="region" aria-label="Baza pik"></div>
          </div>
        </section>

        <!-- Tableau vertical scroller and controls -->
        <section class="tableau-section" aria-label="Kolumny robocze">
          <div class="tableau-scroll-controls" id="tableau-scroll-controls">
            <div class="tableau-scroll-handle" id="tableau-scroll-handle" role="scrollbar" aria-label="Uchwyt przewijania kolumn"></div>
            <div class="tableau-scroll-buttons">
              <button id="btn-scroll-up" class="scroll-btn" aria-label="Przewiń w górę kolumny">▲</button>
              <button id="btn-scroll-down" class="scroll-btn" aria-label="Przewiń w dół kolumny">▼</button>
            </div>
          </div>

          <div class="tableau-scroller" id="tableau-scroller">
            <div class="tableau-grid" id="tableau-grid">
              <div class="tableau-column" id="column-0" data-column="0" role="region" aria-label="Kolumna 1"></div>
              <div class="tableau-column" id="column-1" data-column="1" role="region" aria-label="Kolumna 2"></div>
              <div class="tableau-column" id="column-2" data-column="2" role="region" aria-label="Kolumna 3"></div>
              <div class="tableau-column" id="column-3" data-column="3" role="region" aria-label="Kolumna 4"></div>
              <div class="tableau-column" id="column-4" data-column="4" role="region" aria-label="Kolumna 5"></div>
              <div class="tableau-column" id="column-5" data-column="5" role="region" aria-label="Kolumna 6"></div>
              <div class="tableau-column" id="column-6" data-column="6" role="region" aria-label="Kolumna 7"></div>
            </div>
          </div>
        </section>
      </div>

      <!-- Bottom notices (Hint explanation & Progress guidance above controls) -->
      <div class="bottom-notice-container" id="bottom-notice-container">
        <div id="progress-notice" class="notice-banner bottom-notice hidden" role="status" aria-live="polite" aria-atomic="true"></div>
        <div id="hint-notice" class="notice-banner bottom-notice hidden" role="status" aria-live="polite" aria-atomic="true"></div>
      </div>

      <!-- Bottom controls bar (U06: 44x44 targets) -->
      <footer class="bottom-bar" aria-label="Główne przyciski">
        <button id="btn-undo" class="control-btn" disabled aria-label="Cofnij ostatni ruch">Cofnij</button>
        <button id="btn-redo" class="control-btn" disabled aria-label="Ponów cofnięty ruch">Ponów</button>
        <button id="btn-hint" class="control-btn" aria-label="Pokaż podpowiedź">Podpowiedź</button>
        <button id="btn-menu" class="control-btn" aria-label="Otwórz menu gry">Menu</button>
      </footer>

      <small id="build-stamp" class="build-stamp" aria-label="${BUILD_INFO}">${BUILD_INFO}</small>
    </div>
  `;

  // Attach accessible scroll button handlers
  const scroller = rootElement.querySelector('#tableau-scroller');
  const btnUp = rootElement.querySelector('#btn-scroll-up');
  const btnDown = rootElement.querySelector('#btn-scroll-down');

  if (btnUp && scroller) {
    btnUp.addEventListener('click', () => {
      scroller.scrollBy({ top: -Math.max(60, scroller.clientHeight * 0.6), behavior: 'smooth' });
    });
  }
  if (btnDown && scroller) {
    btnDown.addEventListener('click', () => {
      scroller.scrollBy({ top: Math.max(60, scroller.clientHeight * 0.6), behavior: 'smooth' });
    });
  }
}

/**
 * Main render function called whenever app state or viewport size changes.
 */
export function renderGame(rootElement, state, layoutDims = null, inputController = null, app = null) {
  if (!rootElement) return;
  const animateDeal = rootElement.dataset.animateDeal === 'true';
  delete rootElement.dataset.animateDeal;

  let container = rootElement.querySelector('#game-container');
  if (!container) {
    createBoardStructure(rootElement);
    container = rootElement.querySelector('#game-container');
  }
  container.inert = Boolean(state.victoryAnimation);

  // Calculate layout if not provided
  const dims = layoutDims || calculateBoardDimensions(container.clientWidth || window.innerWidth);
  applyLayoutVariables(container, dims);

  // Extract input selection and legal destinations
  const selection = inputController?.getSelection ? inputController.getSelection() : inputController?.selection || null;
  const legalDestinations = inputController?.getLegalDestinations ? inputController.getLegalDestinations() : inputController?.legalDestinations || [];

  // Update header stats
  const timerDisplay = rootElement.querySelector('#timer-display');
  if (timerDisplay) {
    timerDisplay.textContent = formatTime(state.elapsedMs || 0);
  }

  const movesDisplay = rootElement.querySelector('#moves-display');
  if (movesDisplay) {
    movesDisplay.textContent = String(state.moveCount || 0);
  }

  // Update controls states
  const btnUndo = rootElement.querySelector('#btn-undo');
  if (btnUndo) {
    const canUndo = Boolean(state.session && state.session.cursor > 0);
    btnUndo.disabled = !canUndo;
  }

  const btnRedo = rootElement.querySelector('#btn-redo');
  if (btnRedo) {
    const canRedo = Boolean(state.session && state.session.cursor < state.session.commands.length);
    btnRedo.disabled = !canRedo;
  }

  // Notice banner (locks / conflict)
  const noticeBanner = rootElement.querySelector('#notice-banner');
  if (noticeBanner) {
    if (state.lockNotice || state.saveError) {
      noticeBanner.textContent = [state.lockNotice, state.saveError,
        state.persistenceBlocked ? 'Gra tymczasowa — zapis wyłączony.' : null].filter(Boolean).join(' ');
      noticeBanner.classList.remove('hidden');
    } else {
      noticeBanner.textContent = '';
      noticeBanner.classList.add('hidden');
    }
  }

  rootElement.querySelector('#practice-status')?.classList.toggle('hidden', !state.winRecorded || state.activeDialog === 'win');

  renderProgressNotice(rootElement, state);
  renderHintNotice(rootElement, state);

  const gameState = state.state;
  if (!gameState) return;

  const layoutKey = JSON.stringify(dims);
  const previous = container._boardRender;
  // Preserve card nodes and focus when only time, notices or dialogs change.
  if (previous?.board !== gameState || previous.selection !== selection || previous.layoutKey !== layoutKey) {
    renderStock(rootElement, gameState);
    renderWaste(rootElement, gameState.waste, gameState.drawCount, dims, selection);
    renderFoundations(rootElement, gameState.foundations, selection, legalDestinations);
    renderTableau(rootElement, gameState.tableau, dims, selection, legalDestinations);
    applyMoveFeedback(rootElement, state);
    container._boardRender = { board: gameState, selection, layoutKey };
  }
  renderHint(rootElement, gameState, inputController?.getHint?.());

  // Check overflow on tableau scroller and toggle scroll handle & buttons
  checkScrollerOverflow(rootElement);

  // Render Dialogs and Pause screen (T011)
  const appInstance = app || inputController?.app || (typeof window !== 'undefined' ? window.__SOLITAIRE_APP__ : null);
  if (appInstance) {
    renderDialogs(rootElement, state, appInstance);
    try { syncVictoryAnimation(rootElement, state, appInstance); }
    catch { appInstance.finishVictoryAnimation(); }
  }
  if (animateDeal) renderDealAnimation(container);
}

export function renderProgressNotice(rootElement, state) {
  const progressNotice = rootElement.querySelector('#progress-notice');
  if (!progressNotice) return;
  const blocked = !state.isWon && !state.isPaused && !state.activeDialog && state.progress?.status === 'NO_PROGRESS';
  const progressText = blocked ? noProgressMessage(state.progress.noLegalMoves, state.session) : '';
  if (progressNotice.textContent !== progressText) progressNotice.textContent = progressText;
  progressNotice.classList.toggle('hidden', !blocked);
}

export function renderHintNotice(rootElement, state) {
  const hintNotice = rootElement.querySelector('#hint-notice');
  if (!hintNotice) return;
  // If progress notice is showing NO_PROGRESS, hint notice is hidden (§6)
  const isNoProgress = !state.isWon && !state.isPaused && !state.activeDialog && state.progress?.status === 'NO_PROGRESS';
  const showHint = !isNoProgress && !state.isWon && !state.isPaused && !state.activeDialog && state.hint && state.hint.status !== 'WON';
  const hintText = showHint ? formatSmartHintMessage(state.state, state.hint, state.session) : '';
  if (hintNotice.textContent !== hintText) hintNotice.textContent = hintText;
  hintNotice.classList.toggle('hidden', !showHint || !hintText);
}

function renderDealAnimation(container) {
  const panel = container.querySelector('#tableau-scroller');
  panel?.querySelector('.deal-animation-overlay')?.remove();
  if (!panel) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const overlay = document.createElement('div');
  overlay.className = 'deal-animation-overlay';
  const variant = nextDealVariant();
  overlay.dataset.variant = String(variant);
  overlay.setAttribute('aria-hidden', 'true');

  for (let order = 0; order < 5; order++) {
    const card = createCardElement(null, false);
    card.classList.add('deal-animation-card');
    card.style.zIndex = String(order);
    card.style.animationDelay = `${order * (variant === 3 ? 90 : 28)}ms`;
    overlay.append(card);
  }

  overlay.addEventListener('animationend', (event) => {
    if (event.target === overlay) overlay.remove();
  });
  panel.append(overlay);
}

function nextDealVariant() {
  if (dealVariantOrder.length === 0) {
    dealVariantOrder = [1, 2, 3];
    for (let i = dealVariantOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dealVariantOrder[i], dealVariantOrder[j]] = [dealVariantOrder[j], dealVariantOrder[i]];
    }
    if (dealVariantOrder[2] === lastDealVariant) {
      const swapIndex = Math.floor(Math.random() * 2);
      [dealVariantOrder[2], dealVariantOrder[swapIndex]] = [dealVariantOrder[swapIndex], dealVariantOrder[2]];
    }
  }
  lastDealVariant = dealVariantOrder.pop();
  return lastDealVariant;
}

function applyMoveFeedback(rootElement, state) {
  const cursor = state.session?.cursor ?? 0;
  const previousCursor = Number(rootElement.dataset.renderedCursor);
  rootElement.dataset.renderedCursor = String(cursor);
  if (!Number.isFinite(previousCursor) || cursor === previousCursor) return;

  const forward = cursor > previousCursor;
  const command = state.session.commands[forward ? cursor - 1 : cursor];
  if (!command) return;

  let target;
  if (command.type === 'move') {
    const position = forward ? command.to : command.from;
    target = position.pile === 'tableau' ? `#column-${position.index}`
      : position.pile === 'foundation' ? `#foundation-${position.index}` : '#waste-pile';
  } else if (command.type === 'draw' || command.type === 'recycle') {
    target = (command.type === 'draw') === forward ? '#waste-pile' : '#stock-pile';
  }
  if (!target) return;

  const pile = rootElement.querySelector(target);
  const card = pile?.querySelector('.card-node:last-child') || pile?.querySelector('.pile-slot');
  if (!card) return;
  card.classList.remove('move-feedback');
  void card.offsetWidth;
  card.classList.add('move-feedback');
}

function renderHint(rootElement, state, hint) {
  rootElement.querySelectorAll('.is-hint').forEach((element) => element.classList.remove('is-hint'));
  if (!hint) return;
  if (hint.type !== 'move') {
    rootElement.querySelector('#stock-container')?.classList.add('is-hint');
    return;
  }

  const source = hint.from;
  const sourcePile = source.pile === 'tableau' ? rootElement.querySelector(`#column-${source.index}`)
    : source.pile === 'waste' ? rootElement.querySelector('#waste-pile')
      : rootElement.querySelector(`#foundation-${source.index}`);
  const sourceCard = source.pile === 'tableau'
    ? sourcePile?.querySelectorAll('.card-node')[source.cardIndex]
    : sourcePile?.querySelector('.card-node:last-child');
  sourceCard?.classList.add('is-hint');

  const destination = hint.to.pile === 'tableau'
    ? rootElement.querySelector(`#column-${hint.to.index}`)
    : rootElement.querySelector(`#foundation-${hint.to.index}`);
  const destinationCard = destination?.querySelector('.card-node:last-child') || destination?.querySelector('.pile-slot');
  destinationCard?.classList.add('is-hint');
}

function renderStock(rootElement, gameState) {
  const stockContainer = rootElement.querySelector('#stock-container');
  const stockPile = rootElement.querySelector('#stock-pile');
  const countBadge = rootElement.querySelector('#stock-count-badge');
  if (!stockPile || !stockContainer) return;

  const count = gameState.stock.length;
  if (countBadge) {
    countBadge.textContent = String(count);
    countBadge.style.display = count > 0 ? 'block' : 'none';
  }

  if (count > 0) {
    stockContainer.setAttribute('aria-label', `Stos dobierania: ${count} ${count === 1 ? 'karta' : 'kart'}`);
  } else {
    const canRecycle = gameState.waste.length > 0;
    stockContainer.setAttribute('aria-label', canRecycle ? 'Stos pusty — kliknij, aby przetasować skrawek' : 'Stos pusty');
  }

  stockPile.innerHTML = '';
  if (count > 0) {
    stockPile.appendChild(createCardElement(null, false));
  } else {
    const canRecycle = gameState.waste.length > 0;
    stockPile.appendChild(createEmptySlotElement('stock', null, { canRecycle }));
  }
}

function renderWaste(rootElement, wasteCards, drawCount, dims, selection) {
  const wastePile = rootElement.querySelector('#waste-pile');
  if (!wastePile) return;

  wastePile.innerHTML = '';
  if (!wasteCards || wasteCards.length === 0) {
    const emptySlot = createEmptySlotElement('waste');
    emptySlot.setAttribute('tabindex', '0');
    emptySlot.setAttribute('role', 'region');
    wastePile.appendChild(emptySlot);
    return;
  }

  const isWasteSelected = selection?.pile === 'waste';

  // Draw 1: show top card only
  if (drawCount === 1) {
    const topCardId = wasteCards[wasteCards.length - 1];
    const cardEl = createCardElement(topCardId, true);
    cardEl.classList.add('is-playable');
    cardEl.setAttribute('tabindex', '0');
    cardEl.setAttribute('role', 'button');
    if (isWasteSelected) {
      cardEl.classList.add('is-selected');
    }
    wastePile.appendChild(cardEl);
    return;
  }

  // Draw 3: show up to the last 3 cards fanned horizontally
  const displayCount = Math.min(3, wasteCards.length);
  const startIndex = wasteCards.length - displayCount;
  const fannedCards = wasteCards.slice(startIndex);

  fannedCards.forEach((cardId, i) => {
    const cardEl = createCardElement(cardId, true);
    const isTop = i === fannedCards.length - 1;
    if (isTop) {
      cardEl.classList.add('is-playable');
      cardEl.setAttribute('tabindex', '0');
      cardEl.setAttribute('role', 'button');
      if (isWasteSelected) {
        cardEl.classList.add('is-selected');
      }
    } else {
      cardEl.setAttribute('tabindex', '-1');
    }

    cardEl.style.position = 'absolute';
    cardEl.style.left = `${i * dims.fanOffset}px`;
    cardEl.style.top = '0';
    cardEl.style.zIndex = String(i + 1);
    wastePile.appendChild(cardEl);
  });
}

function renderFoundations(rootElement, foundations, selection, legalDestinations) {
  for (let i = 0; i < 4; i++) {
    const foundPile = rootElement.querySelector(`#foundation-${i}`);
    if (!foundPile) continue;

    foundPile.innerHTML = '';
    const pileCards = foundations[i] || [];
    const isLegalDest = legalDestinations.some((d) => d.pile === 'foundation' && d.index === i);
    const isSelected = selection?.pile === 'foundation' && selection.index === i;

    if (pileCards.length === 0) {
      const slotEl = createEmptySlotElement('foundation', i);
      slotEl.setAttribute('tabindex', '0');
      slotEl.setAttribute('role', 'button');
      if (isLegalDest) {
        slotEl.classList.add('is-legal-destination');
      }
      foundPile.appendChild(slotEl);
    } else {
      const topCardId = pileCards[pileCards.length - 1];
      const cardEl = createCardElement(topCardId, true);
      cardEl.classList.add('is-playable');
      cardEl.setAttribute('tabindex', '0');
      cardEl.setAttribute('role', 'button');
      if (isSelected) {
        cardEl.classList.add('is-selected');
      }
      if (isLegalDest) {
        cardEl.classList.add('is-legal-destination');
      }
      foundPile.appendChild(cardEl);
    }
  }
}

function renderTableau(rootElement, tableauColumns, dims, selection, legalDestinations) {
  for (let colIdx = 0; colIdx < 7; colIdx++) {
    const colEl = rootElement.querySelector(`#column-${colIdx}`);
    if (!colEl) continue;

    colEl.innerHTML = '';
    const colData = tableauColumns[colIdx];
    const isColLegalDest = legalDestinations.some((d) => d.pile === 'tableau' && d.index === colIdx);

    if (!colData || colData.cards.length === 0) {
      const slotEl = createEmptySlotElement('tableau', colIdx);
      slotEl.setAttribute('tabindex', '0');
      slotEl.setAttribute('role', 'button');
      if (isColLegalDest) {
        slotEl.classList.add('is-legal-destination');
      }
      colEl.appendChild(slotEl);
      colEl.style.minHeight = `${dims.cardHeight}px`;
      continue;
    }

    const { cards, faceUpStart } = colData;
    let currentTop = 0;

    cards.forEach((cardId, i) => {
      const isFaceUp = i >= faceUpStart;
      const cardEl = createCardElement(cardId, isFaceUp);

      cardEl.style.position = 'absolute';
      cardEl.style.left = '0';
      cardEl.style.top = `${currentTop}px`;
      cardEl.style.zIndex = String(i + 1);

      if (isFaceUp) {
        cardEl.setAttribute('tabindex', '0');
        cardEl.setAttribute('role', 'button');
        // Selection highlight: all cards in sequence from selected cardIndex downward
        if (selection?.pile === 'tableau' && selection.index === colIdx && i >= selection.cardIndex) {
          cardEl.classList.add('is-selected');
        }
        // Top card of column destination highlight
        if (isColLegalDest && i === cards.length - 1) {
          cardEl.classList.add('is-legal-destination');
        }
      } else {
        cardEl.setAttribute('tabindex', '-1');
      }

      colEl.appendChild(cardEl);

      // Increment vertical offset for next card
      if (isFaceUp) {
        currentTop += dims.faceUpOverlap;
      } else {
        currentTop += dims.faceDownOverlap;
      }
    });

    const totalHeight = currentTop - (cards.length > faceUpStart ? dims.faceUpOverlap : dims.faceDownOverlap) + dims.cardHeight;
    colEl.style.minHeight = `${totalHeight}px`;
  }
}

function checkScrollerOverflow(rootElement) {
  const scroller = rootElement.querySelector('#tableau-scroller');
  const scrollControls = rootElement.querySelector('#tableau-scroll-controls');
  if (!scroller || !scrollControls) return;

  const hasOverflow = scroller.scrollHeight > scroller.clientHeight + 2;
  if (hasOverflow) {
    scrollControls.classList.add('is-overflowing');
  } else {
    scrollControls.classList.remove('is-overflowing');
  }
}
