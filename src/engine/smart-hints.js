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
// U = 120H + 65W + 40F + 20I + 10M - 4L - 50B
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

  // Information includes a newly exposed waste fan card, not only a draw.
  const I = atBoundary && visibleCards(endState).some((id) => !knownSet.has(id)) ? 1 : 0;

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

  const score = 120 * H + 65 * W + 40 * F + 20 * I + 10 * M - 4 * L - 50 * B;
  return { score, components: { H, F, I, W, M, B, L }, endPoss, endMoves };
}

// Preparation is never a goal, even when W or mobility gives it a high score.
function determineGoal({ H, F, I }) {
  if (H > 0) return 'REVEAL';
  if (F > 0) return 'FOUNDATION_ADVANCE';
  if (I > 0) return 'INFORMATION';
  return null;
}

// One-ply terminal verification reuses legal transitions; it is not a safety proof.
function verifyEndState(endState, rootState, knownSet, evaluation, atBoundary) {
  const { H, F, I, M, B } = evaluation.components;
  const goalReached = H > 0 || F > 0 || I > 0;
  const won = isWon(endState);
  const moves = atBoundary ? [] : evaluation.endMoves;
  const rootKey = progressStateKey(rootState, [...knownSet]);
  let nonReturningActions = 0;
  let immediateGoals = 0;
  for (const move of moves) {
    const next = applyMove(endState, move);
    if (!next.ok) continue;
    if (progressStateKey(next.state, [...knownSet]) !== rootKey) nonReturningActions++;
    const column = move.from?.pile === 'tableau' ? endState.tableau[move.from.index] : null;
    const reveal = column && column.faceUpStart > 0 && move.from.cardIndex === column.faceUpStart;
    const advance = next.state.foundations.flat().length > endState.foundations.flat().length;
    const information = checkBoundary(move, endState, knownSet);
    if (reveal || advance || information) immediateGoals++;
  }
  const deadEnd = !atBoundary && !won && nonReturningActions === 0;
  return {
    goalReached, lostMorePossibilities: B > M,
    usefulPossibilities: evaluation.endPoss.size,
    legalActions: atBoundary ? null : moves.length,
    nonReturningActions: atBoundary ? null : nonReturningActions,
    immediateGoals: atBoundary ? null : immediateGoals,
    continuation: atBoundary ? 'INFORMATION_BOUNDARY' : won ? 'WON' : deadEnd ? 'DEAD_END' : 'UNPROVEN',
    horizon: atBoundary ? 0 : 1,
    accepted: goalReached && evaluation.score > 0 && !deadEnd,
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
    verification: verifyEndState(endState, state, knownSet, evaluation, atBoundary),
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

export function* searchSmartHint(state, knownCards = [], { maxStates = 10000, maxDepth = 12, signal } = {}) {
  // Pre-check WON
  if (isWon(state)) {
    return { status: 'WON', plan: [], goal: null, score: null, visitedStates: 0, truncated: false };
  }

  const knownSet = new Set([...knownCards, ...visibleCards(state)]);
  const rootFoundationSet = new Set(state.foundations.flat());
  const rootStockWasteSet = new Set([...state.stock, ...state.waste]);
  const rootMoves = getLegalMoves(state);
  const rootPoss = computePossibilities(state, rootFoundationSet, rootMoves);

  const rootKey = progressStateKey(state, knownCards);
  const visited = new Map(); // key -> best cost
  visited.set(rootKey, 0);

  const graph = new Map([[rootKey, { children: new Set(), H: 0, F: 0, I: 0, complete: false }]]);
  const candidates = new Map();
  let bestResult = null;
  let bestScore = -Infinity;
  let bestLen = Infinity;
  let bestB = Infinity;
  let stateCount = 0;
  let verificationReads = 0;
  let truncated = false;
  const diagnostics = { strategicCandidates: 0, explorationCandidates: 0, preparatoryStates: 0, rejectedEndStates: 0 };

  function cancelledResult(candidate = bestResult) {
    const safeCandidate = candidate?.verification?.accepted && candidate.verification.legalActions !== undefined
      ? candidate : null;
    const { key, order, ...partial } = safeCandidate || {};
    return safeCandidate
      ? { ...partial, visitedStates: stateCount, truncated: true, cancelled: true, reason: 'CANCELLED',
        diagnostics: { ...diagnostics, retainedStates: visited.size, verificationReads } }
      : { status: 'INCONCLUSIVE', plan: [], goal: null, score: null, visitedStates: stateCount,
        truncated: true, cancelled: true, reason: 'CANCELLED',
        diagnostics: { ...diagnostics, retainedStates: visited.size, verificationReads } };
  }

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
  queue.push({ state, moves: rootMoves, path: [], cost: 0, score: 0, B: 0, insertOrder: 0 });
  let insertCounter = 1;

  while (queue.length > 0) {
    if (signal?.aborted) return cancelledResult();
    const current = queue.pop();

    stateCount++;
    if (stateCount > maxStates) {
      truncated = true;
      break;
    }

    const currentKey = progressStateKey(current.state, knownCards);
    const node = graph.get(currentKey);
    node.complete = true;
    const moves = current.moves;

    for (const move of moves) {
      if (current.path.length >= maxDepth) {
        node.complete = false;
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
      if (existingCost !== undefined) node.children.add(key);
      if (existingCost !== undefined && existingCost <= nextCost) continue;
      const canRetain = existingCost !== undefined || visited.size < maxStates;
      if (canRetain) { visited.set(key, nextCost); node.children.add(key); }
      else { truncated = true; node.complete = false; }

      // Evaluate the sequence
      const evaluation = evaluateSequence(nextState, state, rootFoundationSet, rootStockWasteSet, rootPoss, knownSet, nextPath, atBoundary);
      const { score, components } = evaluation;
      const { B } = components;
      if (canRetain && !graph.has(key)) {
        graph.set(key, { children: new Set(), H: components.H, F: components.F, I: components.I, complete: atBoundary });
      }
      const goal = determineGoal(components);
      const isConfirmedGoal = goal === 'REVEAL' || goal === 'FOUNDATION_ADVANCE';
      const isExploration = goal === 'INFORMATION';
      if (isConfirmedGoal) diagnostics.strategicCandidates++;
      else if (isExploration) diagnostics.explorationCandidates++;
      else diagnostics.preparatoryStates++;

      if (score > 0 && (isConfirmedGoal || isExploration)) {
        const candidate = {
          status: isConfirmedGoal ? 'FOUND' : 'EXPLORATION',
          plan: nextPath, goal, score, components, key: canRetain ? key : null, order: insertCounter,
          visitedStates: stateCount, truncated,
        };
        // Retain goal alternatives so a proven dead end can be replaced at completion.
        if (canRetain) candidates.set(key, {
          ...candidate,
          verification: { goalReached: true, lostMorePossibilities: components.B > components.M,
            usefulPossibilities: evaluation.endPoss.size, continuation: atBoundary ? 'INFORMATION_BOUNDARY' : 'UNPROVEN',
            horizon: atBoundary ? 0 : 1, accepted: true },
        });
        const currentIsExploration = bestResult?.status === 'EXPLORATION';
        const sameCategory = !bestResult || isExploration === currentIsExploration;
        const betterQuality = score > bestScore || (score === bestScore &&
          (nextPath.length < bestLen || (nextPath.length === bestLen && B < bestB)));
        const shouldReplace = !bestResult || (isConfirmedGoal && currentIsExploration) ||
          (sameCategory && betterQuality);
        if (shouldReplace) {
          const verification = verifyEndState(nextState, state, knownSet, evaluation, atBoundary);
          candidate.verification = verification;
          if (canRetain) candidates.set(key, candidate);
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
          moves: evaluation.endMoves,
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
      const { key: unusedKey, order: unusedOrder, ...publicBest } = bestResult || {};
      yield bestResult ? { ...publicBest, visitedStates: stateCount, truncated, diagnostics: { ...diagnostics, retainedStates: visited.size } } : {
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

  if (signal?.aborted) return cancelledResult();

  // Read the already explored graph; no new moves or hidden-card lookahead.
  const ordered = [...candidates.values()];
  if (bestResult && !candidates.has(bestResult.key)) ordered.push(bestResult);
  ordered.sort((a, b) => (a.status === b.status ? 0 : a.status === 'FOUND' ? -1 : 1) ||
    b.score - a.score || a.plan.length - b.plan.length || a.components.B - b.components.B || a.order - b.order);
  bestResult = null;
  for (const [candidateIndex, candidate] of ordered.entries()) {
    bestResult = null;
    if (signal?.aborted) return cancelledResult(bestResult);
    if (candidateIndex > 0) yield {
      status: 'INCONCLUSIVE', plan: [], goal: null, score: null,
      visitedStates: stateCount, truncated,
      diagnostics: { ...diagnostics, retainedStates: visited.size, verificationReads },
    };
    if (!candidate.verification.accepted) continue;
    if (candidate.verification.legalActions === undefined) {
      const replay = analyzeHintPlan(state, knownCards, candidate.plan);
      candidate.verification = replay.verification;
      if (!candidate.verification.accepted) { diagnostics.rejectedEndStates++; continue; }
    }
    bestResult = candidate;
    if (signal?.aborted) return cancelledResult(bestResult);
    if (candidate.verification.continuation === 'UNPROVEN') {
      const pending = [candidate.key];
      const checked = new Set();
      let uncertain = false;
      let futureGoal = false;
      while (pending.length && verificationReads < maxStates) {
        if (signal?.aborted) return cancelledResult(bestResult);
        const key = pending.pop();
        if (checked.has(key)) continue;
        checked.add(key);
        verificationReads++;
        if (verificationReads % 64 === 0) {
          const { key: unusedKey, order: unusedOrder, ...publicCandidate } = candidate;
          yield { ...publicCandidate, visitedStates: stateCount, truncated,
            diagnostics: { ...diagnostics, retainedStates: visited.size, verificationReads } };
        }
        const node = graph.get(key);
        if (!node) { uncertain = true; continue; }
        if (node.H > 0 || node.I > 0 || node.F > candidate.components.F) { futureGoal = true; break; }
        if (!node.complete) uncertain = true;
        for (const child of node.children) if (!checked.has(child)) pending.push(child);
      }
      if (pending.length && !futureGoal) { uncertain = true; truncated = true; }
      candidate.verification.continuation = futureGoal ? 'FUTURE_GOAL_REACHABLE' : uncertain ? 'UNPROVEN' : 'KNOWN_DEAD_END';
      candidate.verification.graphStates = checked.size;
      if (!futureGoal && !uncertain) { diagnostics.rejectedEndStates++; bestResult = null; continue; }
    }
    bestResult = candidate;
    break;
  }
  if (bestResult) {
    const { key, order, ...result } = bestResult;
    return { ...result, visitedStates: stateCount, truncated,
      diagnostics: { ...diagnostics, retainedStates: visited.size, verificationReads } };
  }

  const status = !truncated && diagnostics.strategicCandidates === 0 && diagnostics.explorationCandidates === 0
    ? 'NO_STRATEGIC_PROGRESS'
    : 'INCONCLUSIVE';
  return {
    status,
    ...(status === 'NO_STRATEGIC_PROGRESS' ? { recommendedMove: null } : {}),
    diagnostics: { ...diagnostics, retainedStates: visited.size, verificationReads },
    reason: truncated ? 'LIMIT_REACHED' : status === 'NO_STRATEGIC_PROGRESS' ? 'SEARCH_EXHAUSTED' : 'NO_STRATEGIC_RECOMMENDATION',
    plan: [],
    goal: null,
    score: null,
    visitedStates: stateCount,
    truncated,
  };
}
