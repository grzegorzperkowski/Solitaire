import { applyMove, getLegalMoves, isWon } from './game.js';
import { suitIndex } from './cards.js';
import { visibleCards } from './knowledge.js';
import { progressStateKey } from './progress.js';

/**
 * SmartHint — goal-directed hint planner (T028-spec §2–§5).
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

// ── Compute the set of useful possibilities for a state ──
// A useful possibility = an available legal transfer that directly:
//   - reveals a hidden tableau card (REVEAL)
//   - increases foundation count (FOUNDATION)
// Identified by (starting card of transferred run, benefit type).
// Equivalent destinations not multiplied.

function computePossibilities(state, rootFoundationSet, moves = getLegalMoves(state)) {
  const possibilities = new Set();

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
    } else if (from.pile === 'waste' && to.pile === 'foundation') {
      const cardId = state.waste.at(-1);
      if (!rootFoundationSet.has(cardId)) possibilities.add(possibilityKey(cardId, BENEFIT_FOUNDATION));
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

  return false;
}

// ── Evaluate utility U for a sequence (§5) ──
// Waste guides the queue, not the goal. Known stock navigation costs less than a transfer.
// All differences relative to root S0.

function evaluateSequence(endState, rootState, rootFoundationSet, rootStockWasteSet, rootPoss, knownSet, path, atBoundary) {
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

  // Tableau reveals already earn H; remembered hidden identities cannot affect I.
  const lastMove = path.at(-1);
  const I = atBoundary && (lastMove.type === 'draw' || lastMove.from?.pile === 'waste') ? 1 : 0;

  // L: all commands in path
  const L = path.length;
  const navigation = path.filter(move => move.type === 'draw' || move.type === 'recycle').length;
  const effort = 4 * (L - navigation) + 0.5 * navigation + (I > 0 && lastMove.type === 'draw' ? 3.5 : 0);

  // M/B: mobility (useful possibilities) changes
  // At an information boundary, mask newly revealed tableau/waste cards so
  // hidden card identities never leak into mobility scoring (T028-spec §4).
  let evalEndState = endState;
  if (atBoundary) {
    const maskedTableau = endState.tableau.map((col, cIdx) => {
      const rootCol = rootState.tableau[cIdx];
      if (rootCol.faceUpStart > 0) {
        const faceUpStart = Math.max(col.faceUpStart, Math.min(col.cards.length, rootCol.faceUpStart));
        // Unknown values must not become legal destinations either.
        const cards = col.cards.map((id, index) => index < faceUpStart ? undefined : id);
        return { cards, faceUpStart };
      }
      return col;
    });
    // An unknown waste top cannot contribute moves; do not expose cards below it.
    const waste = knownSet.has(endState.waste.at(-1)) ? endState.waste : [];
    evalEndState = { ...endState, tableau: maskedTableau, waste };
  }

  const endMoves = getLegalMoves(evalEndState);
  const endPoss = computePossibilities(evalEndState, rootFoundationSet, endMoves);

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

  // Independent foundation moves must not pad a plan whose goal is a reveal.
  const foundationGain = H > 0 ? Math.min(F, lastMove.to?.pile === 'foundation' ? 1 : 0) : F;
  const score = 120 * H + 40 * foundationGain + 20 * I + 10 * M - effort - 50 * B;
  return { score, components: { H, F, I, W, M, B, L }, endPoss, endMoves };
}

// Preparation is never a goal, even when W or mobility gives it a high score.
function determineGoal({ H, F, I }) {
  if (H > 0) return 'REVEAL';
  if (F > 0) return 'FOUNDATION_ADVANCE';
  if (I > 0) return 'INFORMATION';
  return null;
}

function goalPriority(goal) {
  return goal === 'REVEAL' ? 2 : goal === 'FOUNDATION_ADVANCE' ? 1 : 0;
}

// Verify the achieved goal, without demanding a second goal beyond the horizon.
function verifyEndState(endState, evaluation, atBoundary) {
  const { H, F, I, M, B } = evaluation.components;
  const goalReached = H > 0 || F > 0 || I > 0;
  const won = isWon(endState);
  const moves = atBoundary ? [] : evaluation.endMoves;
  return {
    goalReached, lostMorePossibilities: B > M,
    usefulPossibilities: evaluation.endPoss.size,
    legalActions: atBoundary ? null : moves.length,
    continuation: atBoundary ? 'INFORMATION_BOUNDARY' : won ? 'WON' : moves.length === 0 ? 'TERMINAL_PROGRESS' : 'UNPROVEN',
    horizon: 0,
    accepted: goalReached && evaluation.score > 0,
  };
}

// Diagnostic replay uses exactly the same evaluator as the planner.
export function analyzeHintPlan(state, knownCards, plan) {
  const knownSet = new Set([...knownCards, ...visibleCards(state)]);
  const foundations = new Set(state.foundations.flat());
  const stockWaste = new Set([...state.stock, ...state.waste]);
  const possibilities = computePossibilities(state, foundations);
  let endState = state;
  let atBoundary = false;
  for (const [index, move] of plan.entries()) {
    if (atBoundary) return { ok: false, reason: 'information-boundary', index };
    const next = applyMove(endState, move);
    if (!next.ok) return { ok: false, reason: next.reason, index };
    atBoundary = checkBoundary(move, endState, knownSet);
    endState = next.state;
  }
  const evaluation = evaluateSequence(endState, state, foundations, stockWaste, possibilities, knownSet, plan, atBoundary);
  return {
    ok: true, state: endState, goal: determineGoal(evaluation.components),
    score: evaluation.score, components: evaluation.components,
    verification: verifyEndState(endState, evaluation, atBoundary),
  };
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

export function* searchSmartHint(state, knownCards = [], { maxStates = 10000, maxDepth = 32 } = {}) {
  // Pre-check WON
  if (isWon(state)) {
    return { status: 'WON', plan: [], goal: null, score: null, visitedStates: 0, truncated: false };
  }

  const knownSet = new Set([...knownCards, ...visibleCards(state)]);
  const rootFoundationSet = new Set(state.foundations.flat());
  const rootStockWasteSet = new Set([...state.stock, ...state.waste]);
  const rootMoves = getLegalMoves(state);
  const rootPoss = computePossibilities(state, rootFoundationSet, rootMoves);

  const rootKey = progressStateKey(state, knownSet);
  const visited = new Map(); // key -> best cost
  visited.set(rootKey, 0);

  let bestResult = null;
  let bestScore = -Infinity;
  let bestLen = Infinity;
  let bestB = Infinity;
  let stateCount = 0;
  let truncated = false;
  const diagnostics = { strategicCandidates: 0, explorationCandidates: 0, preparatoryStates: 0, rejectedEndStates: 0 };

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
  queue.push({ state, key: rootKey, moves: rootMoves, path: [], cost: 0, score: 0, B: 0, insertOrder: 0 });
  let insertCounter = 1;

  while (queue.length > 0) {
    const current = queue.pop();
    if (current.cost > visited.get(current.key)) continue;

    stateCount++;
    if (stateCount > maxStates) {
      truncated = true;
      break;
    }

    const moves = current.moves;

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
      const key = progressStateKey(nextState, knownSet);
      const existingCost = visited.get(key);
      if (existingCost !== undefined && existingCost <= nextCost) continue;
      const canRetain = existingCost !== undefined || visited.size < maxStates;
      if (canRetain) visited.set(key, nextCost);
      else truncated = true;

      // Evaluate the sequence
      const evaluation = evaluateSequence(nextState, state, rootFoundationSet, rootStockWasteSet, rootPoss, knownSet, nextPath, atBoundary);
      const { score, components } = evaluation;
      const { B } = components;
      const goal = determineGoal(components);
      const isConfirmedGoal = goal === 'REVEAL' || goal === 'FOUNDATION_ADVANCE';
      const isExploration = goal === 'INFORMATION';
      if (isConfirmedGoal) diagnostics.strategicCandidates++;
      else if (isExploration) diagnostics.explorationCandidates++;
      else diagnostics.preparatoryStates++;

      if (score > 0 && (isConfirmedGoal || isExploration)) {
        const candidate = {
          status: isConfirmedGoal ? 'FOUND' : 'EXPLORATION',
          plan: nextPath, goal, score, components,
          visitedStates: stateCount, truncated,
        };
        const priority = goalPriority(goal);
        const bestPriority = goalPriority(bestResult?.goal);
        const sameCategory = !bestResult || priority === bestPriority;
        const betterQuality = score > bestScore || (score === bestScore &&
          (nextPath.length < bestLen || (nextPath.length === bestLen && B < bestB)));
        const shouldReplace = !bestResult || priority > bestPriority ||
          (sameCategory && betterQuality);
        if (shouldReplace) {
          const verification = verifyEndState(nextState, evaluation, atBoundary);
          candidate.verification = verification;
          if (!verification.accepted) diagnostics.rejectedEndStates++;
          if (verification.accepted) {
            bestScore = score;
            bestLen = nextPath.length;
            bestB = B;
            bestResult = candidate;
          }
        }
      }

      // Don't expand past boundaries; but do continue adding other branches
      if (!atBoundary && canRetain) {
        queue.push({
          state: nextState,
          key,
          moves: evaluation.endMoves,
          path: nextPath,
          cost: nextCost,
          score: score + 65 * components.W,
          B,
          insertOrder: insertCounter++,
        });
      }
    }

    // Yield between expanded states for controller cancellation
    if (queue.length > 0 || stateCount > 1) {
      yield bestResult ? { ...bestResult, visitedStates: stateCount, truncated, diagnostics: { ...diagnostics, retainedStates: visited.size } } : {
        status: 'INCONCLUSIVE',
        diagnostics: { ...diagnostics, retainedStates: visited.size },
        plan: [],
        goal: null,
        score: null,
        visitedStates: stateCount,
        truncated,
      };
    }
  }

  if (bestResult) {
    return { ...bestResult, visitedStates: stateCount, truncated,
      diagnostics: { ...diagnostics, retainedStates: visited.size } };
  }

  return {
    status: 'INCONCLUSIVE',
    diagnostics: { ...diagnostics, retainedStates: visited.size },
    reason: truncated ? 'LIMIT_REACHED' : 'NO_STRATEGIC_RECOMMENDATION',
    plan: [],
    goal: null,
    score: null,
    visitedStates: stateCount,
    truncated,
  };
}
