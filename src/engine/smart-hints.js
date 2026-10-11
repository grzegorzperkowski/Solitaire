import { applyMove, getLegalMoves, isWon } from './game.js';
import { rank, suitIndex } from './cards.js';
import { visibleCards } from './knowledge.js';
import { progressStateKey } from './progress.js';

/**
 * SmartHint v1 — goal-directed hint planner (T028-spec §2–§5).
 *
 * DOM-free generator: searchSmartHint(state, knownCards, options).
 * Each yield exposes the best-so-far result for cancellation safety.
 * Uses only visible/known information; never inspects hidden card values.
 */

// ── Key for uniquely identifying a useful possibility ──

function possibilityKey(cardId, benefit) {
  return (cardId << 2) | benefit;
}

// Benefit type constants
const BENEFIT_REVEAL = 0;
const BENEFIT_FOUNDATION = 1;
const BENEFIT_WASTE = 2;

// ── Compute the set of useful possibilities for a state ──
// A useful possibility = an available legal transfer that directly:
//   - reveals a hidden tableau card (REVEAL)
//   - moves a waste card to tableau/foundation (WASTE)
//   - increases foundation count (FOUNDATION)
// Identified by (starting card of transferred run, benefit type).
// Equivalent destinations not multiplied.

function computePossibilities(state, rootFoundationSet) {
  const possibilities = new Set();
  const moves = getLegalMoves(state);

  for (const move of moves) {
    if (move.type !== 'move') continue;

    const from = move.from;
    const to = move.to;

    if (from.pile === 'tableau') {
      const column = state.tableau[from.index];
      const cardId = column.cards[from.cardIndex];

      // Reveal: moving the bottommost face-up card off a column with hidden cards
      if (from.cardIndex === column.faceUpStart && column.faceUpStart > 0) {
        possibilities.add(possibilityKey(cardId, BENEFIT_REVEAL));
      }

      // Foundation: card can go to foundation (and is not just returning to its S0 position)
      if (to.pile === 'foundation' && !rootFoundationSet.has(cardId)) {
        possibilities.add(possibilityKey(cardId, BENEFIT_FOUNDATION));
      }
    } else if (from.pile === 'waste') {
      const cardId = state.waste[state.waste.length - 1];
      possibilities.add(possibilityKey(cardId, BENEFIT_WASTE));
    }
    // Foundation returns are not "useful possibilities" themselves.
    // King-between-empty-columns yields no benefit.
  }

  return possibilities;
}

// ── Determine whether a lost possibility was actually realized ──

function isBenefitRealized(pKey, rootState, endState, rootFoundationSet) {
  const cardId = pKey >> 2;
  const benefit = pKey & 3;

  if (benefit === BENEFIT_REVEAL) {
    // Check: was the reveal actually performed on the root column that held this card?
    for (let col = 0; col < 7; col++) {
      const rootCol = rootState.tableau[col];
      const idx = rootCol.cards.indexOf(cardId);
      if (idx >= 0 && idx === rootCol.faceUpStart && rootCol.faceUpStart > 0) {
        const endCol = endState.tableau[col];
        // Card was moved away and column was revealed
        if (!endCol.cards.includes(cardId) || endCol.faceUpStart < rootCol.faceUpStart) {
          return true;
        }
      }
    }
    return false;
  }

  if (benefit === BENEFIT_FOUNDATION) {
    const si = suitIndex(cardId);
    return endState.foundations[si].includes(cardId) && !rootFoundationSet.has(cardId);
  }

  if (benefit === BENEFIT_WASTE) {
    // Card left waste/stock = benefit realized
    return !endState.waste.includes(cardId) && !endState.stock.includes(cardId);
  }

  return false;
}

// ── Evaluate utility U for a sequence (§5) ──
// U = 120H + 65W + 40F + 20I + 10M - 4L - 50B
// All differences relative to root S0.

function evaluateSequence(endState, rootState, rootFoundationSet, rootStockWasteSet, knownSet, path, atBoundary) {
  // H: hidden tableau cards revealed
  let H = 0;
  for (let col = 0; col < 7; col++) {
    const rootCol = rootState.tableau[col];
    const endCol = endState.tableau[col];
    if (rootCol.faceUpStart > 0) {
      // How many previously hidden cards are now exposed?
      // Count: cards below rootCol.faceUpStart that are now above endCol.faceUpStart
      // or removed entirely (column shortened)
      if (endCol.cards.length < rootCol.cards.length) {
        // Some cards were removed; hidden cards may have been exposed
        const endHidden = endCol.cards.length > 0 ? endCol.faceUpStart : 0;
        const diff = rootCol.faceUpStart - endHidden;
        if (diff > 0) H += diff;
      } else if (endCol.faceUpStart < rootCol.faceUpStart) {
        H += rootCol.faceUpStart - endCol.faceUpStart;
      }
    }
  }

  // W: distinct cards from root stock/waste now in tableau/foundations (via legal transfer)
  const countedW = new Set();
  for (let col = 0; col < 7; col++) {
    for (const id of endState.tableau[col].cards) {
      if (rootStockWasteSet.has(id) && !countedW.has(id)) {
        countedW.add(id);
      }
    }
  }
  for (let fi = 0; fi < 4; fi++) {
    for (const id of endState.foundations[fi]) {
      if (rootStockWasteSet.has(id) && !rootFoundationSet.has(id) && !countedW.has(id)) {
        countedW.add(id);
      }
    }
  }
  const W = countedW.size;

  // F: net foundation change (signed)
  let rootFoundCount = 0;
  let endFoundCount = 0;
  for (let fi = 0; fi < 4; fi++) {
    rootFoundCount += rootState.foundations[fi].length;
    endFoundCount += endState.foundations[fi].length;
  }
  const F = endFoundCount - rootFoundCount;

  // I: 1 if terminal boundary is an unknown draw, else 0
  let I = 0;
  if (atBoundary && path.length > 0) {
    const lastMove = path[path.length - 1];
    if (lastMove.type === 'draw') {
      I = 1;
    }
  }

  // L: all commands in path
  const L = path.length;

  // M/B: mobility (useful possibilities) changes
  // At an information boundary, mask newly revealed tableau/waste cards so
  // hidden card identities never leak into mobility scoring (T028-spec §4).
  let evalEndState = endState;
  if (atBoundary) {
    const maskedTableau = endState.tableau.map((col, cIdx) => {
      const rootCol = rootState.tableau[cIdx];
      if (rootCol.faceUpStart > 0) {
        const faceUpStart = Math.max(col.faceUpStart, Math.min(col.cards.length, rootCol.faceUpStart));
        return { cards: col.cards, faceUpStart };
      }
      return col;
    });
    // An unknown waste top cannot contribute moves; do not expose cards below it.
    const waste = knownSet.has(endState.waste.at(-1)) ? endState.waste : [];
    evalEndState = { ...endState, tableau: maskedTableau, waste };
  }

  const rootPoss = computePossibilities(rootState, rootFoundationSet);
  const endPoss = computePossibilities(evalEndState, rootFoundationSet);

  let M = 0;
  for (const p of endPoss) {
    if (!rootPoss.has(p)) M++;
  }

  let B = 0;
  for (const p of rootPoss) {
    if (!endPoss.has(p)) {
      // Only count as loss if benefit was NOT realized
      if (!isBenefitRealized(p, rootState, endState, rootFoundationSet)) {
        B++;
      }
    }
  }

  const score = 120 * H + 65 * W + 40 * F + 20 * I + 10 * M - 4 * L - 50 * B;
  return { score, B };
}

// ── Determine the primary goal type (§2) ──
// Preference: REVEAL > WASTE > FOUNDATION > INFORMATION

function determineGoal(endState, rootState, rootFoundationSet, rootStockWasteSet, atBoundary) {
  // H > 0 → REVEAL
  for (let col = 0; col < 7; col++) {
    const rootCol = rootState.tableau[col];
    const endCol = endState.tableau[col];
    if (rootCol.faceUpStart > 0) {
      if (endCol.cards.length < rootCol.cards.length) {
        const endHidden = endCol.cards.length > 0 ? endCol.faceUpStart : 0;
        if (rootCol.faceUpStart > endHidden) return 'REVEAL';
      } else if (endCol.faceUpStart < rootCol.faceUpStart) {
        return 'REVEAL';
      }
    }
  }

  // W > 0 → WASTE
  for (let col = 0; col < 7; col++) {
    for (const id of endState.tableau[col].cards) {
      if (rootStockWasteSet.has(id)) return 'WASTE';
    }
  }
  for (let fi = 0; fi < 4; fi++) {
    for (const id of endState.foundations[fi]) {
      if (rootStockWasteSet.has(id) && !rootFoundationSet.has(id)) return 'WASTE';
    }
  }

  // F > 0 → FOUNDATION
  let rootFC = 0, endFC = 0;
  for (let fi = 0; fi < 4; fi++) {
    rootFC += rootState.foundations[fi].length;
    endFC += endState.foundations[fi].length;
  }
  if (endFC > rootFC) return 'FOUNDATION';

  // I → INFORMATION (terminal draw of new info)
  if (atBoundary) return 'INFORMATION';

  return null;
}

// ── Check information boundaries (§4) ──

function checkBoundary(move, state, knownSet) {
  // Tableau reveal ends the branch
  if (move.type === 'move' && move.from.pile === 'tableau') {
    const column = state.tableau[move.from.index];
    if (column.faceUpStart > 0 && move.from.cardIndex === column.faceUpStart) {
      return true;
    }
  }

  // Draw with unknown cards ends the branch
  if (move.type === 'draw') {
    const count = Math.min(state.drawCount, state.stock.length);
    const drawn = state.stock.slice(-count);
    if (drawn.some(id => !knownSet.has(id))) {
      return true;
    }
  }

  // Taking from waste may expose unknown card below in fan
  if (move.type === 'move' && move.from.pile === 'waste') {
    const wasteLen = state.waste.length;
    if (wasteLen > 1) {
      // In Draw 3, up to 3 waste cards are visible. Taking the top may
      // expose a previously non-visible card beneath the fan.
      const dc = state.drawCount;
      const fanStart = Math.max(0, wasteLen - dc);
      // After removing the top card, the new fan would be:
      const newLen = wasteLen - 1;
      const newFanStart = Math.max(0, newLen - dc);
      // Cards that become newly visible:
      for (let i = newFanStart; i < fanStart && i < newLen; i++) {
        if (!knownSet.has(state.waste[i])) {
          return true;
        }
      }
    }
  }

  return false;
}

// ── Main search generator (§2–§3) ──

export function* searchSmartHint(state, knownCards = [], { maxStates = 10000, maxDepth = 12 } = {}) {
  // Pre-check WON
  if (isWon(state)) {
    return { status: 'WON', plan: [], goal: null, score: null, visitedStates: 0, truncated: false };
  }

  const knownSet = new Set(knownCards);
  const rootFoundationSet = new Set(state.foundations.flat());
  const rootStockWasteSet = new Set([...state.stock, ...state.waste]);

  const rootKey = progressStateKey(state, knownCards);
  const visited = new Map(); // key -> best cost
  visited.set(rootKey, 0);

  let bestResult = null;
  let bestScore = -Infinity;
  let bestLen = Infinity;
  let stateCount = 0;
  let truncated = false;

  // Priority queue: binary heap by (score DESC, pathLen ASC, B ASC, insertion order ASC)
  class PriorityQueue {
    constructor() {
      this.data = [];
    }
    push(item) {
      this.data.push(item);
      this._up(this.data.length - 1);
    }
    pop() {
      if (this.data.length === 0) return undefined;
      const top = this.data[0];
      const bottom = this.data.pop();
      if (this.data.length > 0) {
        this.data[0] = bottom;
        this._down(0);
      }
      return top;
    }
    get length() { return this.data.length; }
    _better(a, b) {
      if (a.score !== b.score) return a.score > b.score;
      if (a.path.length !== b.path.length) return a.path.length < b.path.length;
      if (a.B !== b.B) return a.B < b.B;
      return a.insertOrder < b.insertOrder;
    }
    _up(pos) {
      const item = this.data[pos];
      while (pos > 0) {
        const parent = (pos - 1) >> 1;
        if (!this._better(item, this.data[parent])) break;
        this.data[pos] = this.data[parent];
        pos = parent;
      }
      this.data[pos] = item;
    }
    _down(pos) {
      const half = this.data.length >> 1;
      const item = this.data[pos];
      while (pos < half) {
        let left = (pos << 1) + 1;
        const right = left + 1;
        let best = left;
        if (right < this.data.length && this._better(this.data[right], this.data[left])) {
          best = right;
        }
        if (!this._better(this.data[best], item)) break;
        this.data[pos] = this.data[best];
        pos = best;
      }
      this.data[pos] = item;
    }
  }

  const queue = new PriorityQueue();
  queue.push({ state, path: [], cost: 0, score: 0, B: 0, insertOrder: 0 });
  let insertCounter = 1;

  while (queue.length > 0) {
    const current = queue.pop();

    stateCount++;
    if (stateCount > maxStates) {
      truncated = true;
      break;
    }

    const moves = getLegalMoves(current.state);

    for (const move of moves) {
      if (current.path.length >= maxDepth) {
        truncated = true;
        continue;
      }

      const result = applyMove(current.state, move);
      if (!result.ok) continue;

      const nextState = result.state;
      const nextPath = [...current.path, move];
      const nextCost = nextPath.length;

      // Check information boundary
      const atBoundary = checkBoundary(move, current.state, knownSet);

      // Deduplication: reject if visited at equal or lower cost
      const key = progressStateKey(nextState, knownCards);
      const existingCost = visited.get(key);
      if (existingCost !== undefined && existingCost <= nextCost) continue;
      visited.set(key, nextCost);

      if (visited.size >= maxStates) truncated = true;

      // Evaluate the sequence
      const { score, B } = evaluateSequence(nextState, state, rootFoundationSet, rootStockWasteSet, knownSet, nextPath, atBoundary);
      const goal = determineGoal(nextState, state, rootFoundationSet, rootStockWasteSet, atBoundary);

      // Update best result if this is a confirmed goal (H>0, W>0, or F>0) or exploration (I>0)
      // T028-spec §5: Cel potwierdzony wymaga H>0, W>0 albo F>0; sama mobilność nie wystarcza.
      // Wybierać dodatnio oceniony cel strategiczny; jeśli go nie znaleziono, dodatnią
      // eksplorację I>0; inaczej INCONCLUSIVE.
      const isConfirmedGoal = goal === 'REVEAL' || goal === 'WASTE' || goal === 'FOUNDATION';
      const isExploration = goal === 'INFORMATION';

      if (score > 0 && (isConfirmedGoal || isExploration)) {
        // Confirmed goal always beats exploration, regardless of score (§5)
        const currentIsExploration = bestResult && bestResult.status === 'EXPLORATION';
        const shouldReplace = !bestResult ||
          (isConfirmedGoal && currentIsExploration) ||
          ((!isExploration || currentIsExploration) && (score > bestScore || (score === bestScore && nextPath.length < bestLen)));

        if (shouldReplace) {
          bestScore = score;
          bestLen = nextPath.length;
          bestResult = {
            status: isConfirmedGoal ? 'FOUND' : 'EXPLORATION',
            plan: nextPath,
            goal: isExploration ? 'INFORMATION' : goal,
            score,
            visitedStates: stateCount,
            truncated,
          };
        }
      }

      // Don't expand past boundaries; but do continue adding other branches
      if (!atBoundary && visited.size < maxStates) {
        queue.push({
          state: nextState,
          path: nextPath,
          cost: nextCost,
          score,
          B,
          insertOrder: insertCounter++,
        });
      }
    }

    // Yield between expanded states for controller cancellation
    if (queue.length > 0 || stateCount > 1) {
      yield bestResult || {
        status: 'INCONCLUSIVE',
        plan: [],
        goal: null,
        score: null,
        visitedStates: stateCount,
        truncated,
      };
    }
  }

  if (bestResult) {
    bestResult.visitedStates = stateCount;
    bestResult.truncated = truncated;
    return bestResult;
  }

  return {
    status: 'INCONCLUSIVE',
    plan: [],
    goal: null,
    score: null,
    visitedStates: stateCount,
    truncated,
  };
}
