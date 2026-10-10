/**
 * DOM Renderer for Klondike Solitaire.
 * Follows ARCHITECTURE §8 and REQUIREMENTS U01–U06/N02.
 */

import { createCardElement, createEmptySlotElement } from './cards.js';
import { calculateBoardDimensions, applyLayoutVariables } from './layout.js';

export function formatTime(ms) {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

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

      <div class="board-area" id="board-area">
        <!-- Top row: Stock (col 0), Waste (cols 1-2), Foundations (cols 3-6) -->
        <section class="top-row" aria-label="Górne stosy">
          <div class="stock-container" id="stock-container">
            <div class="stock-pile-wrapper" id="stock-pile"></div>
            <span class="stock-count-badge" id="stock-count-badge" aria-label="Liczba kart w stosie">0</span>
          </div>

          <div class="waste-container" id="waste-container" aria-label="Skrawek">
            <div class="waste-pile" id="waste-pile"></div>
          </div>

          <div class="foundations-container" id="foundations-container" aria-label="Fundamenty">
            <div class="foundation-pile" id="foundation-0" data-foundation-index="0"></div>
            <div class="foundation-pile" id="foundation-1" data-foundation-index="1"></div>
            <div class="foundation-pile" id="foundation-2" data-foundation-index="2"></div>
            <div class="foundation-pile" id="foundation-3" data-foundation-index="3"></div>
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
              <div class="tableau-column" id="column-0" data-column="0"></div>
              <div class="tableau-column" id="column-1" data-column="1"></div>
              <div class="tableau-column" id="column-2" data-column="2"></div>
              <div class="tableau-column" id="column-3" data-column="3"></div>
              <div class="tableau-column" id="column-4" data-column="4"></div>
              <div class="tableau-column" id="column-5" data-column="5"></div>
              <div class="tableau-column" id="column-6" data-column="6"></div>
            </div>
          </div>
        </section>
      </div>

      <!-- Bottom controls bar (U06: 44x44 targets) -->
      <footer class="bottom-bar" aria-label="Główne przyciski">
        <button id="btn-undo" class="control-btn" disabled aria-label="Cofnij ostatni ruch">Cofnij</button>
        <button id="btn-redo" class="control-btn" disabled aria-label="Ponów cofnięty ruch">Ponów</button>
        <button id="btn-hint" class="control-btn" aria-label="Pokaż podpowiedź">Podpowiedź</button>
        <button id="btn-menu" class="control-btn" aria-label="Otwórz menu gry">Menu</button>
      </footer>
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
export function renderGame(rootElement, state, layoutDims = null) {
  if (!rootElement) return;

  let container = rootElement.querySelector('#game-container');
  if (!container) {
    createBoardStructure(rootElement);
    container = rootElement.querySelector('#game-container');
  }

  // Calculate layout if not provided
  const dims = layoutDims || calculateBoardDimensions(container.clientWidth || window.innerWidth);
  applyLayoutVariables(container, dims);

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
    if (state.lockNotice) {
      noticeBanner.textContent = state.lockNotice;
      noticeBanner.classList.remove('hidden');
    } else {
      noticeBanner.textContent = '';
      noticeBanner.classList.add('hidden');
    }
  }

  const gameState = state.state;
  if (!gameState) return;

  // Render Stock
  renderStock(rootElement, gameState);

  // Render Waste
  const drawCount = state.preferences?.drawCount ?? 1;
  renderWaste(rootElement, gameState.waste, drawCount, dims);

  // Render Foundations
  renderFoundations(rootElement, gameState.foundations);

  // Render Tableau
  renderTableau(rootElement, gameState.tableau, dims);

  // Check overflow on tableau scroller and toggle scroll handle & buttons
  checkScrollerOverflow(rootElement);
}

function renderStock(rootElement, gameState) {
  const stockPile = rootElement.querySelector('#stock-pile');
  const countBadge = rootElement.querySelector('#stock-count-badge');
  if (!stockPile) return;

  const count = gameState.stock.length;
  if (countBadge) {
    countBadge.textContent = String(count);
    countBadge.style.display = count > 0 ? 'block' : 'none';
  }

  stockPile.innerHTML = '';
  if (count > 0) {
    stockPile.appendChild(createCardElement(null, false));
  } else {
    const canRecycle = gameState.waste.length > 0;
    stockPile.appendChild(createEmptySlotElement('stock', null, { canRecycle }));
  }
}

function renderWaste(rootElement, wasteCards, drawCount, dims) {
  const wastePile = rootElement.querySelector('#waste-pile');
  if (!wastePile) return;

  wastePile.innerHTML = '';
  if (!wasteCards || wasteCards.length === 0) {
    wastePile.appendChild(createEmptySlotElement('waste'));
    return;
  }

  // Draw 1: show top card only
  if (drawCount === 1) {
    const topCardId = wasteCards[wasteCards.length - 1];
    const cardEl = createCardElement(topCardId, true);
    cardEl.classList.add('is-playable');
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
    if (isTop) cardEl.classList.add('is-playable');

    cardEl.style.position = 'absolute';
    cardEl.style.left = `${i * dims.fanOffset}px`;
    cardEl.style.top = '0';
    cardEl.style.zIndex = String(i + 1);
    wastePile.appendChild(cardEl);
  });
}

function renderFoundations(rootElement, foundations) {
  for (let i = 0; i < 4; i++) {
    const foundPile = rootElement.querySelector(`#foundation-${i}`);
    if (!foundPile) continue;

    foundPile.innerHTML = '';
    const pileCards = foundations[i] || [];
    if (pileCards.length === 0) {
      foundPile.appendChild(createEmptySlotElement('foundation', i));
    } else {
      const topCardId = pileCards[pileCards.length - 1];
      const cardEl = createCardElement(topCardId, true);
      cardEl.classList.add('is-playable');
      foundPile.appendChild(cardEl);
    }
  }
}

function renderTableau(rootElement, tableauColumns, dims) {
  for (let colIdx = 0; colIdx < 7; colIdx++) {
    const colEl = rootElement.querySelector(`#column-${colIdx}`);
    if (!colEl) continue;

    colEl.innerHTML = '';
    const colData = tableauColumns[colIdx];
    if (!colData || colData.cards.length === 0) {
      colEl.appendChild(createEmptySlotElement('tableau', colIdx));
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
