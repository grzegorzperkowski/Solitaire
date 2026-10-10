/**
 * Input management (touch/tap, mouse and keyboard) for Klondike Solitaire.
 * Follows ARCHITECTURE §9, REQUIREMENTS F01/F03/F06/N01/N02 and TEST_PLAN T15/T18.
 */

import { validateMove } from '../engine/game.js';
import { rankHints } from '../engine/hints.js';
import { getCardDetails, SUIT_NAMES, createCardElement } from './cards.js';
import { calculateBoardDimensions } from './layout.js';

export function createInputController(app, rootElement) {
  let selection = null; // { pile: 'waste' | 'tableau' | 'foundation', index?, cardIndex? }
  let legalDestinations = []; // array of { pile: 'tableau' | 'foundation', index }
  let onStateChangeCallback = null;
  let activeGesture = null;
  let suppressNextClick = false;
  let rafId = null;
  let lastTimestamp = 0;
  let lastTouchY = null;
  let hintMoves = null;
  let hintIndex = 0;
  let currentHint = null;
  let hintBoard = app.getState().state;
  const unsubscribeFromApp = app.subscribe(({ state }) => {
    if (state !== hintBoard) {
      hintBoard = state;
      hintMoves = null;
      hintIndex = 0;
      currentHint = null;
    }
  });
  const debugDrag = new URLSearchParams(window.location.search).has('debug-drag');

  function logDrag(event, detail = {}) {
    if (!debugDrag) return;
    console.info('[Solitaire drag]', event, {
      ...detail,
      activePointerId: activeGesture?.pointerId ?? null,
      activePointerType: activeGesture?.pointerType ?? null,
      dragging: Boolean(activeGesture?.isDragging),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      visibility: document.visibilityState,
    });
  }

  function announce(message) {
    const announcer = rootElement.querySelector('#live-announcer');
    if (announcer) {
      announcer.textContent = '';
      setTimeout(() => {
        announcer.textContent = message;
      }, 50);
    }
  }

  function handleHint() {
    if (!hintMoves) hintMoves = rankHints(app.getState().state);
    if (!hintMoves.length) {
      currentHint = null;
      announce('Brak dostępnego ruchu');
    } else {
      currentHint = hintMoves[hintIndex];
      hintIndex = (hintIndex + 1) % hintMoves.length;
      const move = currentHint;
      if (move.type === 'draw') announce('Podpowiedź: dobierz kartę ze stosu.');
      else if (move.type === 'recycle') announce('Podpowiedź: przetasuj skrawek.');
      else {
        const from = move.from.pile === 'tableau' ? `kolumny ${move.from.index + 1}`
          : move.from.pile === 'waste' ? 'skrawka' : `bazy ${SUIT_NAMES[move.from.index]}`;
        const to = move.to.pile === 'tableau' ? `kolumny ${move.to.index + 1}` : `bazy ${SUIT_NAMES[move.to.index]}`;
        announce(`Podpowiedź: przenieś kartę z ${from} na ${to}.`);
      }
    }
    onStateChangeCallback?.();
  }

  function triggerShake(element) {
    if (!element) return;
    element.classList.remove('shake-animation');
    void element.offsetWidth; // trigger reflow
    element.classList.add('shake-animation');
    setTimeout(() => {
      element.classList.remove('shake-animation');
    }, 400);
  }

  function computeLegalDestinations(state, from) {
    if (!state || !from) return [];
    const destinations = [];

    // Check 7 tableau columns
    for (let i = 0; i < 7; i++) {
      const to = { pile: 'tableau', index: i };
      if (validateMove(state, { type: 'move', from, to }).ok) {
        destinations.push(to);
      }
    }

    // Check 4 foundations
    for (let i = 0; i < 4; i++) {
      const to = { pile: 'foundation', index: i };
      if (validateMove(state, { type: 'move', from, to }).ok) {
        destinations.push(to);
      }
    }

    return destinations;
  }

  function setSelection(newSelection) {
    const appState = app.getState();
    const gameState = appState.state;

    if (!newSelection) {
      selection = null;
      legalDestinations = [];
      if (onStateChangeCallback) onStateChangeCallback();
      return;
    }

    selection = newSelection;
    legalDestinations = computeLegalDestinations(gameState, selection);

    // Polish screen reader announcements (N02)
    if (selection.pile === 'waste') {
      const topWasteId = gameState.waste[gameState.waste.length - 1];
      const details = getCardDetails(topWasteId);
      announce(`Zaznaczono kartę ze skrawka: ${details.fullName}. Wybierz miejsce docelowe.`);
    } else if (selection.pile === 'tableau') {
      const col = gameState.tableau[selection.index];
      const cardId = col.cards[selection.cardIndex];
      const details = getCardDetails(cardId);
      announce(`Zaznaczono: ${details.fullName} w kolumnie ${selection.index + 1}. Wybierz miejsce docelowe.`);
    } else if (selection.pile === 'foundation') {
      const pile = gameState.foundations[selection.index];
      const topCardId = pile[pile.length - 1];
      const details = getCardDetails(topCardId);
      announce(`Zaznaczono: ${details.fullName} z bazy. Wybierz miejsce docelowe.`);
    }

    if (onStateChangeCallback) onStateChangeCallback();
  }

  function isSameSource(a, b) {
    if (!a || !b) return false;
    if (a.pile !== b.pile) return false;
    if (a.pile === 'waste') return true;
    if (a.pile === 'foundation') return a.index === b.index;
    if (a.pile === 'tableau') return a.index === b.index && a.cardIndex === b.cardIndex;
    return false;
  }

  function getDraggableSource(targetEl) {
    if (!targetEl) return null;
    const appState = app.getState();
    if (appState.activeDialog || appState.isPaused) return null;
    const gameState = appState.state;
    if (!gameState) return null;

    // A. Tableau
    const colEl = targetEl.closest('.tableau-column');
    const cardEl = targetEl.closest('.card-node');
    if (colEl && cardEl && colEl.contains(cardEl)) {
      const colIdx = parseInt(colEl.dataset.column, 10);
      const column = gameState.tableau[colIdx];
      if (!column) return null;
      const cards = Array.from(colEl.querySelectorAll('.card-node'));
      const cardIndex = cards.indexOf(cardEl);
      if (cardIndex < 0) return null;
      if (cardIndex < column.faceUpStart) return null;
      return {
        source: { pile: 'tableau', index: colIdx, cardIndex },
        element: cardEl,
        columnElement: colEl,
      };
    }

    // B. Waste
    const wasteContainer = targetEl.closest('#waste-container');
    if (wasteContainer && gameState.waste.length > 0) {
      const playableCard = rootElement.querySelector('#waste-pile .card-node.is-playable')
        || rootElement.querySelector('#waste-pile .card-node:last-child');
      if (playableCard && (playableCard === cardEl || playableCard.contains(targetEl))) {
        return {
          source: { pile: 'waste' },
          element: playableCard,
        };
      }
    }

    // C. Foundation
    const foundEl = targetEl.closest('.foundation-pile');
    if (foundEl) {
      const foundIdx = parseInt(foundEl.dataset.foundationIndex, 10);
      const foundPile = gameState.foundations[foundIdx];
      if (foundPile && foundPile.length > 0) {
        const topCardEl = foundEl.querySelector('.card-node:last-child');
        if (topCardEl && (topCardEl === cardEl || topCardEl.contains(targetEl))) {
          return {
            source: { pile: 'foundation', index: foundIdx },
            element: topCardEl,
            foundationElement: foundEl,
          };
        }
      }
    }

    return null;
  }

  function createDragOverlayDOM(source, gameState) {
    const existing = rootElement.querySelector('#drag-overlay');
    if (existing) existing.remove();

    const dims = calculateBoardDimensions(rootElement.clientWidth || window.innerWidth);
    const overlay = document.createElement('div');
    overlay.id = 'drag-overlay';
    overlay.className = 'drag-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    let cardIds = [];
    if (source.pile === 'tableau') {
      const col = gameState.tableau[source.index];
      if (col) {
        cardIds = col.cards.slice(source.cardIndex);
      }
    } else if (source.pile === 'waste') {
      if (gameState.waste.length > 0) {
        cardIds = [gameState.waste[gameState.waste.length - 1]];
      }
    } else if (source.pile === 'foundation') {
      const f = gameState.foundations[source.index];
      if (f && f.length > 0) {
        cardIds = [f[f.length - 1]];
      }
    }

    overlay.style.width = `${dims.cardWidth}px`;
    let currentTop = 0;
    cardIds.forEach((cardId, i) => {
      const cardEl = createCardElement(cardId, true);
      cardEl.style.width = `${dims.cardWidth}px`;
      cardEl.style.height = `${dims.cardHeight}px`;
      cardEl.style.position = 'absolute';
      cardEl.style.left = '0';
      cardEl.style.top = `${currentTop}px`;
      cardEl.style.zIndex = String(i + 1);
      cardEl.style.pointerEvents = 'none';
      overlay.appendChild(cardEl);
      currentTop += dims.faceUpOverlap;
    });

    const totalHeight = currentTop - (cardIds.length > 1 ? dims.faceUpOverlap : 0) + dims.cardHeight;
    overlay.style.height = `${totalHeight}px`;

    const posX = Math.round(activeGesture.currentX - activeGesture.grabOffsetX);
    const posY = Math.round(activeGesture.currentY - activeGesture.grabOffsetY);
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    overlay.style.transform = isReducedMotion
      ? `translate3d(${posX}px, ${posY}px, 0)`
      : `translate3d(${posX}px, ${posY}px, 0) scale(1.03)`;

    const gameContainer = rootElement.querySelector('#game-container') || rootElement;
    gameContainer.appendChild(overlay);
  }

  function cleanupDragVisuals() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    const overlay = rootElement.querySelector('#drag-overlay');
    if (overlay) overlay.remove();

    rootElement.querySelectorAll('.is-drop-hover').forEach((el) => el.classList.remove('is-drop-hover'));
    rootElement.querySelectorAll('.is-dragging-source').forEach((el) => el.classList.remove('is-dragging-source'));
  }

  function cancelDrag(e) {
    logDrag('cancel-event', {
      type: e?.type ?? 'manual',
      eventPointerId: e?.pointerId ?? null,
      eventTarget: e?.target?.id || e?.target?.className || null,
      rootHasCapture: e?.pointerId !== undefined && rootElement.hasPointerCapture(e.pointerId),
      matchesActivePointer: e?.pointerId === undefined || e.pointerId === activeGesture?.pointerId,
    });
    if (e?.type === 'lostpointercapture' && e.target !== rootElement && rootElement.hasPointerCapture(e.pointerId)) return;
    if (!activeGesture || (e?.pointerId !== undefined && e.pointerId !== activeGesture.pointerId)) return;

    if (activeGesture.isDragging) {
      logDrag('gesture-cancelled', { reason: e?.type ?? 'manual' });
      suppressNextClick = true;
      setTimeout(() => { suppressNextClick = false; }, 200);
      try {
        rootElement.releasePointerCapture(activeGesture.pointerId);
      } catch (error) {
        logDrag('pointer-capture-release-failed', { pointerId: activeGesture.pointerId, message: error.message });
      }
      cleanupDragVisuals();
      if (onStateChangeCallback) onStateChangeCallback();
    }
    activeGesture = null;
  }

  function performAutoscroll(dt) {
    if (!activeGesture || !activeGesture.isDragging) return;
    const scroller = rootElement.querySelector('#tableau-scroller');
    if (!scroller) return;

    const rect = scroller.getBoundingClientRect();
    const y = activeGesture.currentY;
    const maxSpeed = (240 * dt) / 1000;

    if (y >= rect.top - 12 && y <= rect.top + 32) {
      const proximity = Math.max(0, Math.min(1, (rect.top + 32 - y) / 32));
      scroller.scrollTop -= Math.round(proximity * maxSpeed);
    } else if (y >= rect.bottom - 32 && y <= rect.bottom + 12) {
      const proximity = Math.max(0, Math.min(1, (y - (rect.bottom - 32)) / 32));
      scroller.scrollTop += Math.round(proximity * maxSpeed);
    }
  }

  function performHitTesting() {
    if (!activeGesture || !activeGesture.isDragging) return;
    const x = activeGesture.currentX;
    const y = activeGesture.currentY;
    let hoveredDest = null;

    // 1. Check foundations 0..3
    for (let i = 0; i < 4; i++) {
      const fEl = rootElement.querySelector(`#foundation-${i}`);
      if (fEl) {
        const rect = fEl.getBoundingClientRect();
        if (x >= rect.left - 4 && x <= rect.right + 4 && y >= rect.top - 10 && y <= rect.bottom + 10) {
          hoveredDest = { pile: 'foundation', index: i };
          break;
        }
      }
    }

    // 2. Check tableau columns 0..6
    if (!hoveredDest) {
      for (let i = 0; i < 7; i++) {
        const colEl = rootElement.querySelector(`#column-${i}`);
        if (colEl) {
          const rect = colEl.getBoundingClientRect();
          if (
            x >= rect.left - 4 &&
            x <= rect.right + 4 &&
            y >= rect.top - 20 &&
            y <= Math.max(rect.bottom + 60, window.innerHeight - 50)
          ) {
            hoveredDest = { pile: 'tableau', index: i };
            break;
          }
        }
      }
    }

    activeGesture.hoveredDest = hoveredDest;

    // Update .is-drop-hover highlight for legal target
    rootElement.querySelectorAll('.is-drop-hover').forEach((el) => el.classList.remove('is-drop-hover'));
    if (hoveredDest) {
      const isLegal = legalDestinations.some(
        (d) => d.pile === hoveredDest.pile && d.index === hoveredDest.index
      );
      if (isLegal) {
        let targetEl = null;
        if (hoveredDest.pile === 'foundation') {
          targetEl = rootElement.querySelector(`#foundation-${hoveredDest.index}`);
        } else {
          targetEl = rootElement.querySelector(`#column-${hoveredDest.index}`);
        }
        targetEl?.classList.add('is-drop-hover');
      }
    }
  }

  function startDragLoop() {
    if (rafId) cancelAnimationFrame(rafId);

    const updateFrame = (now) => {
      if (!activeGesture || !activeGesture.isDragging) {
        rafId = null;
        return;
      }

      const dt = Math.min(50, now - lastTimestamp);
      lastTimestamp = now;

      const overlay = rootElement.querySelector('#drag-overlay');
      if (overlay) {
        const posX = Math.round(activeGesture.currentX - activeGesture.grabOffsetX);
        const posY = Math.round(activeGesture.currentY - activeGesture.grabOffsetY);
        const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        overlay.style.transform = isReducedMotion
          ? `translate3d(${posX}px, ${posY}px, 0)`
          : `translate3d(${posX}px, ${posY}px, 0) scale(1.03)`;
      }

      performAutoscroll(dt);
      performHitTesting();

      rafId = requestAnimationFrame(updateFrame);
    };

    rafId = requestAnimationFrame(updateFrame);
  }

  function restoreFocusAfterAction(actionInfo) {
    if (!actionInfo) return;
    requestAnimationFrame(() => {
      if (actionInfo.type === 'move' && actionInfo.to) {
        if (actionInfo.to.pile === 'tableau') {
          const colEl = rootElement.querySelector(`#column-${actionInfo.to.index}`);
          if (colEl) {
            const cards = colEl.querySelectorAll('.card-node.card-face-up');
            const target = cards.length > 0 ? cards[cards.length - 1] : colEl.querySelector('.pile-slot');
            target?.focus();
          }
        } else if (actionInfo.to.pile === 'foundation') {
          const foundEl = rootElement.querySelector(`#foundation-${actionInfo.to.index}`);
          if (foundEl) {
            const target = foundEl.querySelector('.card-node') || foundEl.querySelector('.pile-slot');
            target?.focus();
          }
        }
      } else if (actionInfo.type === 'draw') {
        rootElement.querySelector('#stock-container')?.focus();
      } else if (actionInfo.type === 'recycle') {
        rootElement.querySelector('#stock-container')?.focus();
      } else if (actionInfo.type === 'undo') {
        const btnUndo = rootElement.querySelector('#btn-undo');
        if (btnUndo && !btnUndo.disabled) {
          btnUndo.focus();
        } else {
          const btnRedo = rootElement.querySelector('#btn-redo');
          btnRedo?.focus();
        }
      } else if (actionInfo.type === 'redo') {
        const btnRedo = rootElement.querySelector('#btn-redo');
        if (btnRedo && !btnRedo.disabled) {
          btnRedo.focus();
        } else {
          const btnUndo = rootElement.querySelector('#btn-undo');
          btnUndo?.focus();
        }
      }
    });
  }

  function executeMove(from, to) {
    const res = app.executeCommand({ type: 'move', from, to });
    if (res.ok) {
      let destName = '';
      if (to.pile === 'foundation') {
        destName = `bazy ${SUIT_NAMES[to.index]}`;
      } else {
        destName = `kolumny ${to.index + 1}`;
      }

      let revealNotice = '';
      if (res.revealed !== null && res.revealed !== undefined) {
        const rev = getCardDetails(res.revealed);
        revealNotice = ` Odkryto nową kartę: ${rev.fullName}.`;
      }

      announce(`Wykonano ruch do ${destName}.${revealNotice}`);
      setSelection(null);
      restoreFocusAfterAction({ type: 'move', to });
      return true;
    }
    return false;
  }

  function handleStockAction() {
    const state = app.getState().state;
    if (!state) return;

    if (state.stock.length > 0) {
      const res = app.executeCommand({ type: 'draw' });
      if (res.ok) {
        setSelection(null);
        announce('Dobrano kartę ze stosu.');
        restoreFocusAfterAction({ type: 'draw' });
      }
    } else if (state.waste.length > 0) {
      const res = app.executeCommand({ type: 'recycle' });
      if (res.ok) {
        setSelection(null);
        announce('Przetasowano skrawek z powrotem do stosu.');
        restoreFocusAfterAction({ type: 'recycle' });
      }
    } else {
      announce('Stos i skrawek są puste.');
    }
  }

  function handleTableauClick(colIndex, cardIndex = null, cardEl = null) {
    const appState = app.getState();
    const gameState = appState.state;
    if (!gameState) return;

    const column = gameState.tableau[colIndex];
    if (!column) return;

    const dest = { pile: 'tableau', index: colIndex };

    // Case 1: Column is empty
    if (column.cards.length === 0) {
      if (selection) {
        if (validateMove(gameState, { type: 'move', from: selection, to: dest }).ok) {
          executeMove(selection, dest);
        } else {
          announce('Niedozwolony ruch: tylko Król może zająć pustą kolumnę.');
          if (cardEl) triggerShake(cardEl);
        }
      }
      return;
    }

    // Case 2: Clicked on a card in the column
    const effectiveCardIndex = cardIndex !== null && cardIndex !== undefined ? cardIndex : (column.cards.length - 1);
    const isFaceUp = effectiveCardIndex >= column.faceUpStart;

    if (!isFaceUp) {
      announce('Karta zakryta.');
      return;
    }

    const clickedSource = { pile: 'tableau', index: colIndex, cardIndex: effectiveCardIndex };

    // Subcase 2A: Already selected
    if (selection) {
      // Retap same source deselects
      if (isSameSource(selection, clickedSource)) {
        setSelection(null);
        announce('Odznaczono.');
        return;
      }

      // Try destination interpretation first (F01: "destination interpretation takes priority when legal")
      if (validateMove(gameState, { type: 'move', from: selection, to: dest }).ok) {
        executeMove(selection, dest);
        return;
      }

      // If move illegal, check if clicked card is another movable source (F01)
      const moveCandidates = computeLegalDestinations(gameState, clickedSource);
      if (moveCandidates.length > 0 || column.cards.length > 0) {
        setSelection(clickedSource);
        return;
      }

      // Illegal destination feedback
      announce('Niedozwolony ruch.');
      if (cardEl) triggerShake(cardEl);
      return;
    }

    // Subcase 2B: No active selection
    setSelection(clickedSource);
  }

  function handleWasteClick() {
    const appState = app.getState();
    const gameState = appState.state;
    if (!gameState || gameState.waste.length === 0) return;

    const wasteSource = { pile: 'waste' };

    if (selection) {
      if (isSameSource(selection, wasteSource)) {
        setSelection(null);
        announce('Odznaczono.');
        return;
      }
      // Waste cannot be a destination, so clicking waste reselects it
      setSelection(wasteSource);
      return;
    }

    setSelection(wasteSource);
  }

  function handleFoundationClick(foundationIndex, pileEl = null) {
    const appState = app.getState();
    const gameState = appState.state;
    if (!gameState) return;

    const dest = { pile: 'foundation', index: foundationIndex };

    if (selection) {
      if (isSameSource(selection, dest)) {
        setSelection(null);
        announce('Odznaczono.');
        return;
      }

      if (validateMove(gameState, { type: 'move', from: selection, to: dest }).ok) {
        executeMove(selection, dest);
        return;
      }

      // If move is illegal, can foundation top card be a source to return to tableau?
      const foundPile = gameState.foundations[foundationIndex];
      if (foundPile && foundPile.length > 0) {
        setSelection({ pile: 'foundation', index: foundationIndex });
        return;
      }

      announce('Niedozwolony ruch na fundament.');
      if (pileEl) triggerShake(pileEl);
      return;
    }

    // No selection: if foundation has cards, select top card
    const foundPile = gameState.foundations[foundationIndex];
    if (foundPile && foundPile.length > 0) {
      setSelection({ pile: 'foundation', index: foundationIndex });
    }
  }

  function getUpperPiles() {
    return [
      { col: 0, el: rootElement.querySelector('#stock-container') },
      { col: 1, el: rootElement.querySelector('#waste-pile .card-node.is-playable') || rootElement.querySelector('#waste-pile .pile-slot') },
      { col: 3, el: rootElement.querySelector('#foundation-0 .card-node') || rootElement.querySelector('#foundation-0 .pile-slot') },
      { col: 4, el: rootElement.querySelector('#foundation-1 .card-node') || rootElement.querySelector('#foundation-1 .pile-slot') },
      { col: 5, el: rootElement.querySelector('#foundation-2 .card-node') || rootElement.querySelector('#foundation-2 .pile-slot') },
      { col: 6, el: rootElement.querySelector('#foundation-3 .card-node') || rootElement.querySelector('#foundation-3 .pile-slot') },
    ].filter(item => Boolean(item.el));
  }

  function getTableauColumnCards(colIdx) {
    const colEl = rootElement.querySelector(`#column-${colIdx}`);
    if (!colEl) return [];
    const emptySlot = colEl.querySelector('.pile-slot');
    if (emptySlot) return [emptySlot];
    return Array.from(colEl.querySelectorAll('.card-node.card-face-up'));
  }

  function handleArrowNavigation(e) {
    const active = document.activeElement;
    const upperPiles = getUpperPiles();

    // 1. Check if active in upper piles
    const upperIdx = upperPiles.findIndex(p => p.el === active || p.el?.contains(active));
    if (upperIdx !== -1) {
      if (e.key === 'ArrowLeft' && upperIdx > 0) {
        e.preventDefault();
        upperPiles[upperIdx - 1].el?.focus();
        upperPiles[upperIdx - 1].el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        return;
      }
      if (e.key === 'ArrowRight' && upperIdx < upperPiles.length - 1) {
        e.preventDefault();
        upperPiles[upperIdx + 1].el?.focus();
        upperPiles[upperIdx + 1].el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const targetCol = upperPiles[upperIdx].col;
        const colCards = getTableauColumnCards(targetCol);
        if (colCards.length > 0) {
          colCards[0].focus();
          colCards[0].scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
        return;
      }
      return;
    }

    // 2. Check if active in tableau column
    const colEl = active?.closest?.('.tableau-column');
    if (colEl) {
      const colIdx = parseInt(colEl.dataset.column, 10);
      const colCards = getTableauColumnCards(colIdx);
      const cardIdx = colCards.indexOf(active);

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (cardIdx > 0) {
          colCards[cardIdx - 1].focus();
          colCards[cardIdx - 1].scrollIntoView({ block: 'nearest', inline: 'nearest' });
        } else {
          // Up from first exposed card enters nearest upper pile
          const nearest = upperPiles.reduce((best, p) => Math.abs(p.col - colIdx) < Math.abs(best.col - colIdx) ? p : best, upperPiles[0]);
          nearest?.el?.focus();
          nearest?.el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (cardIdx >= 0 && cardIdx < colCards.length - 1) {
          colCards[cardIdx + 1].focus();
          colCards[cardIdx + 1].scrollIntoView({ block: 'nearest', inline: 'nearest' });
        } else {
          // Down at bottom of column moves to bottom controls
          const btnUndo = rootElement.querySelector('#btn-undo');
          btnUndo?.focus();
        }
        return;
      }

      if (e.key === 'ArrowLeft' && colIdx > 0) {
        e.preventDefault();
        const targetCards = getTableauColumnCards(colIdx - 1);
        if (targetCards.length > 0) {
          const targetIdx = Math.min(Math.max(0, cardIdx), targetCards.length - 1);
          targetCards[targetIdx].focus();
          targetCards[targetIdx].scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
        return;
      }

      if (e.key === 'ArrowRight' && colIdx < 6) {
        e.preventDefault();
        const targetCards = getTableauColumnCards(colIdx + 1);
        if (targetCards.length > 0) {
          const targetIdx = Math.min(Math.max(0, cardIdx), targetCards.length - 1);
          targetCards[targetIdx].focus();
          targetCards[targetIdx].scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
        return;
      }
      return;
    }

    // 3. Check if active in bottom bar controls
    const bottomBar = active?.closest?.('.bottom-bar');
    if (bottomBar) {
      const buttons = Array.from(bottomBar.querySelectorAll('.control-btn'));
      const btnIdx = buttons.indexOf(active);
      if (e.key === 'ArrowLeft' && btnIdx > 0) {
        e.preventDefault();
        buttons[btnIdx - 1].focus();
        return;
      }
      if (e.key === 'ArrowRight' && btnIdx < buttons.length - 1) {
        e.preventDefault();
        buttons[btnIdx + 1].focus();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const middleColCards = getTableauColumnCards(3);
        if (middleColCards.length > 0) {
          middleColCards[middleColCards.length - 1].focus();
          middleColCards[middleColCards.length - 1].scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
        return;
      }
      return;
    }

    // 4. Default: focus stock or first tableau card
    if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) {
      e.preventDefault();
      const stock = rootElement.querySelector('#stock-container');
      if (stock) {
        stock.focus();
        stock.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
  }

  function handleSelectStart(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
      return;
    }
    e.preventDefault();
  }

  function handleSelectionChange() {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
      return;
    }
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      sel.removeAllRanges();
    }
  }

  function handleDragStart(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
      return;
    }
    e.preventDefault();
  }

  function handleContextMenu(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
      return;
    }
    e.preventDefault();
  }

  function handleGlobalKeydown(e) {
    if (e.key !== 'Escape' && e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
      return;
    }

    const appState = app.getState();
    if (e.key !== 'Escape' && (appState.activeDialog || appState.isPaused)) return;

    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    // Prevent Select All (Ctrl/Cmd+A) across the board
    if (isCtrlOrCmd && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      return;
    }

    // Undo: Ctrl/Cmd+Z (without shift)
    if (isCtrlOrCmd && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
      e.preventDefault();
      setSelection(null);
      app.undo();
      announce('Cofnięto ruch.');
      restoreFocusAfterAction({ type: 'undo' });
      return;
    }

    // Redo: Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z
    if ((isCtrlOrCmd && (e.key === 'y' || e.key === 'Y')) || (isCtrlOrCmd && e.shiftKey && (e.key === 'z' || e.key === 'Z'))) {
      e.preventDefault();
      setSelection(null);
      app.redo();
      announce('Ponowiono ruch.');
      restoreFocusAfterAction({ type: 'redo' });
      return;
    }

    // Escape: cancel drag, close active dialog, resume paused game, or clear selection
    if (e.key === 'Escape') {
      if (activeGesture && activeGesture.isDragging) {
        e.preventDefault();
        cancelDrag();
        announce('Anulowano przeciąganie.');
        return;
      }
      const state = app.getState();
      if (state.activeDialog) {
        e.preventDefault();
        app.closeDialog();
        announce('Zamknięto okno dialogowe.');
        return;
      }
      if (state.isPaused) {
        e.preventDefault();
        app.resume();
        announce('Wznowiono grę.');
        return;
      }
      if (selection) {
        e.preventDefault();
        setSelection(null);
        announce('Odznaczono.');
      }
      return;
    }

    // If dialog or pause is active, block board shortcuts and navigation
    if (appState.activeDialog || appState.isPaused) {
      return;
    }

    // Arrow keys
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      handleArrowNavigation(e);
      return;
    }

    // Space on stock when focused
    if (e.key === ' ' && document.activeElement && document.activeElement.id === 'stock-container') {
      e.preventDefault();
      handleStockAction();
      return;
    }

    // Enter or Space on board elements
    if (e.key === 'Enter' || e.key === ' ') {
      const activeEl = document.activeElement;
      if (!activeEl) return;

      if (activeEl.classList.contains('control-btn')) return; // native button click

      const colEl = activeEl.closest('.tableau-column');
      if (colEl) {
        e.preventDefault();
        const colIdx = parseInt(colEl.dataset.column, 10);
        if (activeEl.classList.contains('card-node')) {
          const cards = Array.from(colEl.querySelectorAll('.card-node'));
          const cardIndex = cards.indexOf(activeEl);
          handleTableauClick(colIdx, cardIndex, activeEl);
        } else {
          handleTableauClick(colIdx, null, colEl);
        }
        return;
      }

      if (activeEl.closest('#stock-container')) {
        e.preventDefault();
        handleStockAction();
        return;
      }

      if (activeEl.closest('#waste-container')) {
        e.preventDefault();
        handleWasteClick();
        return;
      }

      const foundEl = activeEl.closest('.foundation-pile');
      if (foundEl) {
        e.preventDefault();
        const foundIdx = parseInt(foundEl.dataset.foundationIndex, 10);
        handleFoundationClick(foundIdx, foundEl);
        return;
      }
    }
  }

  function handlePointerDown(e) {
    logDrag('pointerdown', {
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      x: e.clientX,
      y: e.clientY,
      target: e.target?.closest?.('.card-node')?.className ?? e.target?.tagName,
    });
    if (activeGesture) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const draggable = getDraggableSource(e.target);
    if (!draggable) return;

    const cardRect = draggable.element.getBoundingClientRect();
    activeGesture = {
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      grabOffsetX: e.clientX - cardRect.left,
      grabOffsetY: e.clientY - cardRect.top,
      source: draggable.source,
      sourceElement: draggable.element,
      isDragging: false,
      hoveredDest: null,
      draggedCardsElements: [],
    };
    logDrag('gesture-start', { source: activeGesture.source, x: e.clientX, y: e.clientY });
  }

  function handlePointerMove(e) {
    if (activeGesture) {
      logDrag('pointermove', {
        pointerId: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        dx: e.clientX - activeGesture.startX,
        dy: e.clientY - activeGesture.startY,
      });
    }
    if (!activeGesture || e.pointerId !== activeGesture.pointerId) return;

    activeGesture.currentX = e.clientX;
    activeGesture.currentY = e.clientY;

    if (!activeGesture.isDragging) {
      const dist = Math.hypot(e.clientX - activeGesture.startX, e.clientY - activeGesture.startY);
      if (dist < 6) return;

      activeGesture.isDragging = true;
      try {
        rootElement.setPointerCapture(activeGesture.pointerId);
        logDrag('pointer-capture-set', { pointerId: activeGesture.pointerId });
      } catch (error) {
        logDrag('pointer-capture-failed', { pointerId: activeGesture.pointerId, message: error.message });
      }
      logDrag('drag-started', { distance: dist });

      const appState = app.getState();
      const gameState = appState.state;

      if (!isSameSource(selection, activeGesture.source)) {
        selection = activeGesture.source;
        legalDestinations = computeLegalDestinations(gameState, selection);
        if (onStateChangeCallback) onStateChangeCallback();
      } else if (legalDestinations.length === 0) {
        legalDestinations = computeLegalDestinations(gameState, selection);
      }

      const draggedElements = [];
      if (activeGesture.source.pile === 'tableau') {
        const colEl = rootElement.querySelector(`#column-${activeGesture.source.index}`);
        if (colEl) {
          const cards = Array.from(colEl.querySelectorAll('.card-node'));
          for (let i = activeGesture.source.cardIndex; i < cards.length; i++) {
            cards[i].classList.add('is-dragging-source');
            draggedElements.push(cards[i]);
          }
        }
      } else {
        activeGesture.sourceElement.classList.add('is-dragging-source');
        draggedElements.push(activeGesture.sourceElement);
      }
      activeGesture.draggedCardsElements = draggedElements;

      createDragOverlayDOM(activeGesture.source, gameState);
      lastTimestamp = performance.now();
      startDragLoop();
    }
  }

  function handlePointerUp(e) {
    logDrag('pointerup', { pointerId: e.pointerId, x: e.clientX, y: e.clientY });
    if (!activeGesture || e.pointerId !== activeGesture.pointerId) return;

    if (activeGesture.isDragging) {
      activeGesture.currentX = e.clientX;
      activeGesture.currentY = e.clientY;
      performHitTesting();

      suppressNextClick = true;
      setTimeout(() => { suppressNextClick = false; }, 200);
      try {
        rootElement.releasePointerCapture(activeGesture.pointerId);
      } catch (error) {
        logDrag('pointer-capture-release-failed', { pointerId: activeGesture.pointerId, message: error.message });
      }

      cleanupDragVisuals();

      const hovered = activeGesture.hoveredDest;
      const src = activeGesture.source;
      logDrag('drop-target', { source: src, target: hovered });
      activeGesture = null;

      if (hovered) {
        const gameState = app.getState().state;
        const valid = validateMove(gameState, { type: 'move', from: src, to: hovered });
        if (valid.ok) {
          executeMove(src, hovered);
          return;
        } else {
          let targetEl = null;
          if (hovered.pile === 'foundation') {
            targetEl = rootElement.querySelector(`#foundation-${hovered.index}`);
          } else {
            targetEl = rootElement.querySelector(`#column-${hovered.index}`);
          }
          if (targetEl) triggerShake(targetEl);
          announce('Niedozwolony ruch.');
        }
      }

      if (onStateChangeCallback) onStateChangeCallback();
      return;
    }

    activeGesture = null;
  }

  function handleTouchStart(e) {
    lastTouchY = e.touches.length === 1 ? e.touches[0].clientY : null;
  }

  function handleTouchMove(e) {
    if (e.touches.length !== 1 || lastTouchY === null) {
      lastTouchY = null;
      return;
    }

    const touchY = e.touches[0].clientY;
    const pullingDown = touchY > lastTouchY;
    lastTouchY = touchY;
    if (!pullingDown) return;

    for (let element = e.target instanceof Element ? e.target : null;
      element && element !== document.body && element !== document.documentElement;
      element = element.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(element).overflowY) && element.scrollTop > 0) return;
    }

    if (window.scrollY <= 0 && e.cancelable) e.preventDefault();
  }

  function handleTouchEnd(e) {
    lastTouchY = e.touches.length === 1 ? e.touches[0].clientY : null;
  }

  function bindEvents() {
    rootElement.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', cancelDrag);
    window.addEventListener('lostpointercapture', cancelDrag);
    rootElement.addEventListener('dragstart', (e) => e.preventDefault());
    window.addEventListener('blur', cancelDrag);
    window.addEventListener('pagehide', cancelDrag);
    window.addEventListener('resize', cancelDrag);
    window.addEventListener('orientationchange', cancelDrag);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    rootElement.addEventListener('click', (e) => {
      if (suppressNextClick && !e.target.closest('.control-btn')) {
        suppressNextClick = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      suppressNextClick = false;

      // Menu button click
      const btnMenu = e.target.closest('#btn-menu');
      if (btnMenu) {
        setSelection(null);
        app.openDialog('menu');
        announce('Otwarto menu gry.');
        return;
      }

      // If dialog or pause is active, ignore clicks on board
      const appState = app.getState();
      if (appState.activeDialog || appState.isPaused) {
        return;
      }

      if (e.target.closest('#btn-hint')) {
        handleHint();
        return;
      }

      // 1. Stock pile click
      const stockEl = e.target.closest('#stock-container');
      if (stockEl) {
        handleStockAction();
        return;
      }

      // 2. Waste pile click
      const wasteEl = e.target.closest('#waste-container');
      if (wasteEl) {
        handleWasteClick();
        return;
      }

      // 3. Foundations click
      const foundEl = e.target.closest('.foundation-pile');
      if (foundEl) {
        const foundIdx = parseInt(foundEl.dataset.foundationIndex, 10);
        handleFoundationClick(foundIdx, foundEl);
        return;
      }

      // 4. Tableau columns click
      const colEl = e.target.closest('.tableau-column');
      if (colEl) {
        const colIdx = parseInt(colEl.dataset.column, 10);
        const cardNode = e.target.closest('.card-node');
        if (cardNode && colEl.contains(cardNode)) {
          const cards = Array.from(colEl.querySelectorAll('.card-node'));
          const cardIndex = cards.indexOf(cardNode);
          handleTableauClick(colIdx, cardIndex, cardNode);
        } else {
          handleTableauClick(colIdx, null, colEl);
        }
        return;
      }

      // 5. Undo button click
      const btnUndo = e.target.closest('#btn-undo');
      if (btnUndo) {
        if (!btnUndo.disabled) {
          setSelection(null);
          app.undo();
          announce('Cofnięto ruch.');
          restoreFocusAfterAction({ type: 'undo' });
        }
        return;
      }

      // 6. Redo button click
      const btnRedo = e.target.closest('#btn-redo');
      if (btnRedo) {
        if (!btnRedo.disabled) {
          setSelection(null);
          app.redo();
          announce('Ponowiono ruch.');
          restoreFocusAfterAction({ type: 'redo' });
        }
        return;
      }

      // 7. Blank background click -> deselect (F01)
      if (selection && !e.target.closest('.card-node') && !e.target.closest('.pile-slot') && !e.target.closest('.control-btn')) {
        setSelection(null);
        announce('Odznaczono.');
      }
    });

    window.addEventListener('keydown', handleGlobalKeydown);
    document.addEventListener('selectstart', handleSelectStart, { capture: true });
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('dragstart', handleDragStart, { capture: true });
    document.addEventListener('contextmenu', handleContextMenu, { capture: true });
  }

  bindEvents();

  return {
    app,
    getSelection: () => selection,
    getLegalDestinations: () => legalDestinations,
    getHint: () => currentHint,
    getActiveGesture: () => activeGesture,
    clearSelection: () => setSelection(null),
    cancelDrag,
    announce,
    onStateChange: (fn) => {
      onStateChangeCallback = fn;
    },
    destroy: () => {
      unsubscribeFromApp();
      window.removeEventListener('keydown', handleGlobalKeydown);
      document.removeEventListener('selectstart', handleSelectStart, { capture: true });
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('dragstart', handleDragStart, { capture: true });
      document.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      rootElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', cancelDrag);
      window.removeEventListener('lostpointercapture', cancelDrag);
      window.removeEventListener('blur', cancelDrag);
      window.removeEventListener('pagehide', cancelDrag);
      window.removeEventListener('resize', cancelDrag);
      window.removeEventListener('orientationchange', cancelDrag);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
      if (rafId) cancelAnimationFrame(rafId);
    },
  };
}
