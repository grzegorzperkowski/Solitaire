# Pełny kod badanego wariantu Smart Hint BFS

Materiał do diagnozy; źródła z rewizji 80039dd. Nie jest to pełna implementacja całej propozycji zewnętrznego AI. Wariant różni się od 2d1ecfc wyłącznie kolejką FIFO.

SHA256 src/engine/smart-hints.js po normalizacji LF: `48e390c7d62146352b9970a1efd892d7bc33895de252699b1ee99e43b212a785`. Kod bazowego planera: `d152efd1eabcd5278c410949ab2a0462fcbe8e527060393f6d2878eb31b486cb`.

Do samodzielnego uruchomienia zapisz bloki w osobnym katalogu pod podanymi ścieżkami i dodaj package.json z zawartością {"type":"module"}. Historyczny komentarz o kopcu nad klasą PriorityQueue pozostał z bazowego źródła; rzeczywista klasa tego wariantu to FIFO.

Poniższe bloki oznaczono ścieżkami. Zachowują importy względne. benchmark-core.js zawiera niezmienione funkcje pomiarowe, wycięte z scripts/hint-benchmark.js; dodano wyłącznie importy potrzebne do uruchomienia poza repo.

## src/engine/smart-hints.js

```javascript
import { applyMove, getLegalMoves, isWon } from './game.js';
import { suitIndex, rank, color } from './cards.js';
import { visibleCards } from './knowledge.js';
import { progressKeyFor, progressStateKey } from './progress.js';

/**
 * SmartHint — isolated, goal-directed planner (T028-spec §2–§5).
 *
 * Keep search/scoring here, separate from DOM, UI, session history and storage.
 * This project is plain JavaScript ES modules: “JS is TS, no types”—do not add
 * TypeScript syntax, annotations, interfaces or type-only dependencies.
 *
 * Model/developer guide:
 * - Read `.project/tasks/T028-spec.md` before changing goals, scoring or search
 *   limits. `REQUIREMENTS.md` F04, `ARCHITECTURE.md` §6 and `TEST_PLAN.md` T20
 *   define the surrounding contracts.
 * - State and commands belong to `src/engine/game.js`; use `getLegalMoves`,
 *   immutable `applyMove` and `isWon`. `src/engine/knowledge.js` owns
 *   `visibleCards` and lifetime `knownCards`; `src/engine/progress.js` owns
 *   `progressStateKey` for deduplicating search states. F04 reachability in
 *   `progress.js` is separate from this planner; do not conflate its status.
 * - CardId is `suitIndex * 13 + rank - 1`; rank is 1–13. Pile arrays are
 *   bottom-to-top, with the top card last. A tableau column's `faceUpStart`
 *   marks its first face-up card. These arrays and card IDs are engine data,
 *   not UI elements.
 * - Treat hidden card IDs as opaque identity/order tokens only. Score and
 *   branch decisions may use legal visible moves and recorded knowledge, never
 *   hidden rank/suit values or future values revealed at an information edge.
 *   Do not mutate input state or execute commands; this module only plans.
 * - `FOUND` means a line reaches a reveal/foundation goal; `EXPLORATION` means
 *   it reaches new information. `INCONCLUSIVE` or any `truncated` result is not
 *   proof of no progress. `NO_STRATEGIC_PROGRESS` requires exhaustive search
 *   and says nothing about whether the whole deal is winnable. `WON` is an
 *   already-complete board. The first plan command is the UI suggestion.
 * - The caller drives this generator in batches and may pass an `AbortSignal`.
 *   Cancellation marks the result truncated; it preserves a verified partial
 *   suggestion when available. Scheduling and time budgets belong to callers.
 * - Focused regressions are in `tests/unit/smart-hints.test.js` and
 *   `tests/unit/smart-hints-app.test.js`. Graph regressions and independent BFS
 *   are in `smart-hints-graph.test.js` / `smart-hints-bfs.test.js`; reproduce the
 *   saved-position audit with `node scripts/audit-smart-hints.mjs <diagnostic>`.
 *   Compare seeded quality/cost with
 *   `node scripts/benchmark-hints.mjs`. Benchmarks are measurements, not proof
 *   of deal solvability or optimality.
 */

// Reconstruct actual visits from the active history, including after reload/Undo.
// Knowledge from discarded branches is prior memory; no new save fields are needed.
export function createHintContext(snapshots, knownCards = []) {
  const observations = snapshots.map(visibleCards);
  const observed = new Set(observations.flat());
  const known = new Set(knownCards.filter(id => !observed.has(id)));
  const stateKey = progressKeyFor([...new Set([...knownCards, ...observations.flat()])]);
  const visitedStates = new Set();
  let hidden = Infinity;
  let foundationHighWater = 0;
  for (let index = 0; index < snapshots.length; index++) {
    const state = snapshots[index];
    const nextHidden = state.tableau.reduce((sum, col) => sum + col.faceUpStart, 0);
    let learned = false;
    for (const id of observations[index]) {
      if (!known.has(id)) { known.add(id); learned = true; }
    }
    if (learned || nextHidden < hidden) {
      visitedStates.clear();
      foundationHighWater = 0;
    }
    foundationHighWater = Math.max(foundationHighWater, state.foundations.reduce((sum, pile) => sum + pile.length, 0));
    visitedStates.add(stateKey(state));
    hidden = nextHidden;
  }
  return { visitedStates, foundationHighWater };
}

// ── Key for uniquely identifying a useful possibility ──

function possibilityKey(cardId, benefit) {
  return (cardId << 2) | benefit;
}

// Benefit type constants
const BENEFIT_REVEAL = 0;
const BENEFIT_FOUNDATION = 1;
const GOAL_PRIORITY = { REVEAL: 3, FOUNDATION_ADVANCE: 2, INFORMATION: 1 };

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
// W prioritizes preparation; final utility excludes incidental W.
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
  return { score, priority: score + 65 * W - 3.5 * navigation,
    components: { H, F, I, W, M, B, L }, endPoss, endMoves };
}

// Preparation is never a goal, even when W or mobility gives it a high score.
function determineGoal({ H, F, I }) {
  if (H > 0) return 'REVEAL';
  if (F > 0) return 'FOUNDATION_ADVANCE';
  if (I > 0) return 'INFORMATION';
  return null;
}

// Estimate one unknown card from the knowledge complement, never its location.
function estimatePostRevealUtility(endState, rootState, knownSet, unknownCount, unknownByRankColor) {
  if (unknownCount === 0) return 0;
  let hits = 0;
  let targets = 0;
  let hasEmptyColumn = false;
  for (let index = 0; index < 7; index++) {
    const column = endState.tableau[index];
    const length = column.cards.length;
    if (length === 0) { hasEmptyColumn = true; continue; }
    const root = rootState.tableau[index];
    if (root.faceUpStart > 0 && length === root.faceUpStart) continue;
    const top = column.cards[length - 1];
    if (!knownSet.has(top) || rank(top) === 1) continue;
    const slot = ((rank(top) - 1) << 1) | (color(top) === 'red' ? 0 : 1);
    const bit = 1 << slot;
    if (!(targets & bit)) hits += unknownByRankColor[slot];
    targets |= bit;
  }
  if (hasEmptyColumn) hits += 1.5 * (unknownByRankColor[26] + unknownByRankColor[27]);
  for (let index = 0; index < 4; index++) {
    const length = endState.foundations[index].length;
    if (length === 13) continue;
    const id = index * 13 + length;
    if (knownSet.has(id)) continue;
    const slot = ((length + 1) << 1) | (color(id) === 'red' ? 1 : 0);
    // Foundation benefit replaces a placement/king benefit for the same card.
    hits += 2 - (length === 12 && hasEmptyColumn ? 1.5 : targets & (1 << slot) ? 1 : 0);
  }
  return hits / unknownCount;
}

function firstMoveKey(move, goal) {
  if (!move) return goal;
  if (move.type !== 'move') return `${move.type}|${goal}`;
  return `${move.from.pile}:${move.from.index ?? ''}:${move.from.cardIndex ?? ''}->${move.to.pile}:${move.to.index ?? ''}|${goal}`;
}

function compareCandidates(a, b) {
  if (a.completesGame !== b.completesGame) return a.completesGame ? -1 : 1;
  if (a.goal !== b.goal) return GOAL_PRIORITY[b.goal] - GOAL_PRIORITY[a.goal];
  if (a.goal === 'REVEAL') {
    return b.components.H - a.components.H || a.plan.length - b.plan.length ||
      b.expectedPostRevealScore - a.expectedPostRevealScore || a.components.B - b.components.B ||
      b.score - a.score || (a.historyReturns ?? 0) - (b.historyReturns ?? 0) || a.order - b.order;
  }
  if (a.goal === 'INFORMATION') {
    return a.plan.length - b.plan.length || b.expectedPostRevealScore - a.expectedPostRevealScore ||
      a.components.B - b.components.B || b.score - a.score || (a.historyReturns ?? 0) - (b.historyReturns ?? 0) || a.order - b.order;
  }
  return b.components.F - a.components.F || a.components.B - b.components.B ||
    a.plan.length - b.plan.length || b.score - a.score || (a.historyReturns ?? 0) - (b.historyReturns ?? 0) || a.order - b.order;
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
function replayPlan(state, knownCards, plan, knownSet) {
  let endState = state;
  let atBoundary = false;
  const ancestors = new Set();
  for (const [index, move] of plan.entries()) {
    if (atBoundary) return { ok: false, reason: 'information-boundary', index };
    ancestors.add(progressStateKey(endState, knownCards));
    const next = applyMove(endState, move);
    if (!next.ok) return { ok: false, reason: next.reason, index };
    atBoundary = checkBoundary(move, endState, knownSet);
    endState = next.state;
  }
  return { ok: true, state: endState, atBoundary, ancestors };
}

export function analyzeHintPlan(state, knownCards, plan) {
  const knownSet = new Set([...knownCards, ...visibleCards(state)]);
  const foundations = new Set(state.foundations.flat());
  const stockWaste = new Set([...state.stock, ...state.waste]);
  const possibilities = computePossibilities(state, foundations);
  const replay = replayPlan(state, [...knownSet], plan, knownSet);
  if (!replay.ok) return replay;
  const { state: endState, atBoundary } = replay;
  const evaluation = evaluateSequence(endState, state, foundations, stockWaste, possibilities, knownSet, plan, atBoundary);
  return {
    ok: true, state: endState, goal: determineGoal(evaluation.components),
    score: evaluation.score, components: evaluation.components,
    verification: verifyEndState(endState, evaluation, atBoundary),
  };
}

// Scores are relative to the current board, so after one move a fresh search can
// prefer a plan that undoes it, and hints loop. While the player follows the shown
// plan, keep its rest: every finished plan reveals, advances or learns something.
function continuePlan(state, knownCards, previousHint, maxDepth, plannerContext) {
  if (!previousHint?.plan || previousHint.plan.length < 2 || previousHint.plan.length - 1 > maxDepth) return null;
  const first = applyMove(previousHint.state, previousHint.plan[0]);
  if (!first.ok || progressStateKey(first.state, knownCards) !== progressStateKey(state, knownCards)) return null;
  const plan = previousHint.plan.slice(1);
  const analysis = analyzeHintPlan(state, knownCards, plan);
  if (!analysis.ok || !analysis.goal) return null;
  // An unbroken commitment may cross old boards to reach a genuinely new goal.
  // Re-scoring a suffix must not replace that goal with its own reverse move.
  const newGoal = !plannerContext || isWon(analysis.state) || analysis.goal !== 'FOUNDATION_ADVANCE' ||
    analysis.state.foundations.reduce((sum, pile) => sum + pile.length, 0) > plannerContext.foundationHighWater;
  if (!newGoal || (!plannerContext && !analysis.verification.accepted)) return null;
  const commitment = previousHint.commitment || { state: previousHint.state, plan: previousHint.plan };
  if (!analysis.verification.accepted) {
    const origin = analyzeHintPlan(commitment.state, knownCards, commitment.plan);
    if (!origin.ok || !origin.verification.accepted) return null;
  }
  return {
    phase: 'FINAL', status: analysis.goal === 'INFORMATION' ? 'EXPLORATION' : 'FOUND', plan,
    goal: analysis.goal, score: analysis.score, components: analysis.components,
    verification: { ...analysis.verification, accepted: true,
      localScoreAccepted: analysis.verification.accepted, committed: true },
    commitment, visitedStates: 0, truncated: false, continued: true,
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

export function* searchSmartHint(state, knownCards = [], { maxStates = 10000, maxDepth = 32, signal, previousHint, plannerContext } = {}) {
  // Pre-check WON
  if (isWon(state)) {
    return { phase: 'FINAL', status: 'WON', plan: [], goal: null, score: null, visitedStates: 0, truncated: false };
  }
  const continued = signal?.aborted ? null : continuePlan(state, knownCards, previousHint, maxDepth, plannerContext);
  if (continued) return continued;

  const knownSet = new Set([...knownCards, ...visibleCards(state)]);
  const rootFoundationSet = new Set(state.foundations.flat());
  const rootStockWasteSet = new Set([...state.stock, ...state.waste]);
  const rootMoves = getLegalMoves(state);
  const rootPoss = computePossibilities(state, rootFoundationSet, rootMoves);
  const unknownByRankColor = new Uint8Array(28);
  let unknownCount = 0;
  for (let id = 0; id < 52; id++) {
    if (knownSet.has(id)) continue;
    unknownByRankColor[(rank(id) << 1) | (color(id) === 'red' ? 1 : 0)]++;
    unknownCount++;
  }

  const stateKey = progressKeyFor([...knownSet]);
  const rootKey = stateKey(state);
  const visited = new Map(); // key -> best cost
  visited.set(rootKey, 0);

  const graph = new Map([[rootKey, { children: new Set(), H: 0, F: 0, I: 0,
    boundary: false, expandedCost: Infinity, complete: false }]]);
  const candidates = new Map();
  let bestResult = null;
  let stateCount = 0;
  const verificationReads = 0; // No continuation-proof pass.
  let truncated = false;
  const diagnostics = {
    strategicCandidates: 0, explorationCandidates: 0, preparatoryStates: 0,
    rejectedEndStates: 0, staleQueueEntries: 0, duplicateStatesRejected: 0,
    depthLimitedBranches: 0, stateLimitedBranches: 0, unresolvedCutoffs: 0, unexpandedStates: 0,
    cachedDeadEnds: 0, nonPositiveGoals: 0, historyRejectedGoals: 0,
    shorteningAttempts: 0, shortenedPlansCount: 0, savedMovesCount: 0,
  };

  // Shorten only the winner; yield after each attempt to preserve cancellation.
  function* shortenPlan(candidate) {
    if (candidate.plan.length < 2) return candidate;
    const original = replayPlan(state, [...knownSet], candidate.plan, knownSet);
    if (!original.ok) return candidate;
    const target = candidate.components;
    for (let index = 0; index < candidate.plan.length - 1; index++) {
      const plan = [...candidate.plan.slice(0, index), ...candidate.plan.slice(index + 1)];
      const replay = replayPlan(state, [...knownSet], plan, knownSet);
      diagnostics.shorteningAttempts++;
      // Preserve the mechanical endpoint for foundation plans.
      const preservesProof = replay.ok && (original.atBoundary ||
        (stateKey(replay.state) === candidate.key &&
          [...replay.ancestors].every(key => original.ancestors.has(key))));
      if (preservesProof && replay.atBoundary === original.atBoundary) {
        const evaluation = evaluateSequence(replay.state, state, rootFoundationSet, rootStockWasteSet,
          rootPoss, knownSet, plan, replay.atBoundary);
        const components = evaluation.components;
        const goal = determineGoal(components);
        if (goal === candidate.goal && components.H >= target.H && components.F >= target.F &&
          components.I >= target.I && components.B <= target.B && evaluation.score > 0) {
          const verification = verifyEndState(replay.state, evaluation, replay.atBoundary);
          if (verification.accepted) {
            candidate = { ...candidate, plan, score: evaluation.score, components,
              key: stateKey(replay.state),
              verification,
              expectedPostRevealScore: replay.atBoundary
                ? estimatePostRevealUtility(replay.state, state, knownSet, unknownCount, unknownByRankColor) : 0 };
            candidate.completesGame = isWon(replay.state);
            diagnostics.shortenedPlansCount = 1;
            diagnostics.savedMovesCount++;
            index = -1;
          }
        }
      }
      yield candidate;
    }
    return candidate;
  }

  function cancelledResult(candidate = bestResult) {
    const { key, order, ...partial } = candidate || {};
    return {
      ...(candidate ? partial : { status: 'INCONCLUSIVE', plan: [], goal: null, score: null }),
      phase: 'CANCELLED', visitedStates: stateCount, truncated: true, cancelled: true, reason: 'CANCELLED',
      diagnostics: { ...diagnostics, retainedStates: visited.size, verificationReads,
        ...(candidate ? { expectedPostRevealScore: candidate.expectedPostRevealScore } : {}) },
    };
  }

  // Priority queue: binary heap by (score DESC, pathLen ASC, B ASC, insertion order ASC)
  class PriorityQueue {
    constructor() { this.data = []; this.head = 0; this.lastDepth = 0; }
    push(item) { this.data.push(item); }
    pop() {
      const item = this.data[this.head];
      this.data[this.head++] = null;
      if (item.path.length < this.lastDepth) throw Error('FIFO depth decreased');
      this.lastDepth = item.path.length;
      return item;
    }
    get length() { return this.data.length - this.head; }
  }

  const queue = new PriorityQueue();
  queue.push({ state, key: rootKey, moves: rootMoves, path: [], cost: 0, score: 0, B: 0, historyReturns: 0, insertOrder: 0 });
  let insertCounter = 1;

  while (queue.length > 0) {
    if (signal?.aborted) return cancelledResult();
    const current = queue.pop();

    const currentKey = current.key;
    if (current.cost > visited.get(currentKey)) {
      diagnostics.staleQueueEntries++;
      continue;
    }

    if (stateCount >= maxStates) {
      truncated = true;
      break;
    }
    stateCount++;

    const node = graph.get(currentKey);
    node.expandedCost = current.cost;
    node.complete = true;
    const moves = current.moves;

    for (const move of moves) {
      const result = applyMove(current.state, move);
      if (!result.ok) continue;

      const nextState = result.state;
      const nextPath = [...current.path, move];
      const nextCost = nextPath.length;

      // Check information boundary
      const atBoundary = checkBoundary(move, current.state, knownSet);

      // Deduplication: reject if visited at equal or lower cost
      const key = stateKey(nextState);
      const existingCost = visited.get(key);
      // Keep even missing successors: a later shorter path can resolve this cut.
      node.children.add(key);
      if (current.path.length >= maxDepth) {
        if (existingCost !== undefined && existingCost <= nextCost) diagnostics.duplicateStatesRejected++;
        else {
          diagnostics.depthLimitedBranches++;
          node.complete = false;
          truncated = true;
        }
        continue;
      }
      if (existingCost !== undefined && existingCost <= nextCost) {
        diagnostics.duplicateStatesRejected++;
        continue;
      }
      const canRetain = existingCost !== undefined || visited.size < maxStates;
      if (canRetain) visited.set(key, nextCost);
      else {
        diagnostics.stateLimitedBranches++;
        truncated = true;
        node.complete = false;
      }

      // Evaluate the sequence
      const evaluation = evaluateSequence(nextState, state, rootFoundationSet, rootStockWasteSet, rootPoss, knownSet, nextPath, atBoundary);
      const { score, components } = evaluation;
      const { B } = components;
      if (canRetain && !graph.has(key)) {
        graph.set(key, { children: new Set(), H: components.H, F: components.F, I: components.I,
          boundary: atBoundary, expandedCost: Infinity, complete: atBoundary });
      }
      const goal = determineGoal(components);
      const isConfirmedGoal = goal === 'REVEAL' || goal === 'FOUNDATION_ADVANCE';
      const isExploration = goal === 'INFORMATION';
      if (isConfirmedGoal) diagnostics.strategicCandidates++;
      else if (isExploration) diagnostics.explorationCandidates++;
      else diagnostics.preparatoryStates++;
      if (isConfirmedGoal && score <= 0) diagnostics.nonPositiveGoals++;

      // Preparation after an earlier goal must not pad the recommended plan.
      const addsGoalProgress = components.H > node.H || components.F > node.F || components.I > node.I;
      const newGoal = !plannerContext || isWon(nextState) || components.H > 0 || components.I > 0 ||
        nextState.foundations.reduce((sum, pile) => sum + pile.length, 0) > plannerContext.foundationHighWater;
      if (addsGoalProgress && goal && !newGoal) diagnostics.historyRejectedGoals++;
      if (newGoal && score > 0 && (isConfirmedGoal || isExploration) && addsGoalProgress) {
        const candidate = {
          status: isConfirmedGoal ? 'FOUND' : 'EXPLORATION',
          plan: nextPath, goal, score, components, key, order: insertCounter,
          visitedStates: stateCount, truncated,
          historyReturns: current.historyReturns + (!atBoundary && plannerContext?.visitedStates.has(key) ? 1 : 0),
          expectedPostRevealScore: atBoundary
            ? estimatePostRevealUtility(nextState, state, knownSet, unknownCount, unknownByRankColor) : 0,
        };
        candidate.completesGame = isWon(nextState);
        // Keep goal metadata even when its board cannot fit the retained-state budget.
        const previousCandidate = candidates.get(key);
        const beatsPrevious = !previousCandidate || compareCandidates(candidate, previousCandidate) < 0;
        const shouldReplace = !bestResult || compareCandidates(candidate, bestResult) < 0;
        if (beatsPrevious || shouldReplace) {
          const verification = verifyEndState(nextState, evaluation, atBoundary);
          candidate.verification = verification;
          if (beatsPrevious) candidates.set(key, candidate);
          if (shouldReplace) {
            if (!verification.accepted) diagnostics.rejectedEndStates++;
            else {
              bestResult = candidate;
            }
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
          score: evaluation.priority,
          B,
          historyReturns: current.historyReturns + (plannerContext?.visitedStates.has(key) ? 1 : 0),
          insertOrder: insertCounter++,
        });
      }
    }

    // Yield between expanded states for controller cancellation
    if (queue.length > 0 || stateCount > 1) {
      const { key: unusedKey, order: unusedOrder, ...publicBest } = bestResult || {};
      yield bestResult ? { ...publicBest, phase: 'TEMPORARY', visitedStates: stateCount, truncated,
        diagnostics: { ...diagnostics, retainedStates: visited.size, expectedPostRevealScore: bestResult.expectedPostRevealScore } } : {
        phase: 'TEMPORARY',
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

  // Historical limit hits are not unresolved cuts once another path fills the graph.
  for (const [key, node] of graph) {
    const missingChildren = [...node.children].filter(child => !graph.has(child)).length;
    diagnostics.unresolvedCutoffs += missingChildren;
    if (!node.boundary && node.expandedCost > visited.get(key)) diagnostics.unexpandedStates++;
    node.complete = node.boundary || (node.expandedCost < Infinity && missingChildren === 0);
  }
  truncated = diagnostics.unresolvedCutoffs > 0 || diagnostics.unexpandedStates > 0;

  // Achieved goals suffice; graph bookkeeping only tracks unresolved cuts.
  const ordered = [...candidates.values()].sort(compareCandidates);
  if (bestResult) {
    const shortener = shortenPlan(bestResult);
    let shortened;
    do {
      if (signal?.aborted) return cancelledResult(bestResult);
      shortened = shortener.next();
      bestResult = shortened.value;
      if (!shortened.done) {
        const { key: unusedKey, order: unusedOrder, ...partial } = bestResult;
        yield { ...partial, phase: 'TEMPORARY', visitedStates: stateCount, truncated,
          diagnostics: { ...diagnostics, retainedStates: visited.size, verificationReads,
            expectedPostRevealScore: bestResult.expectedPostRevealScore } };
      }
    } while (!shortened.done);
    const { key, order, ...result } = bestResult;
    // Boundary alternatives need no continuation proof or additional graph budget.
    const diverse = new Map();
    for (const candidate of [bestResult, ...ordered]) {
      if (!candidate.verification.accepted || (candidate !== bestResult &&
        candidate.verification.continuation !== 'INFORMATION_BOUNDARY')) continue;
      const signature = firstMoveKey(candidate.plan[0], candidate.goal);
      if (diverse.has(signature)) continue;
      const { key: unusedKey, order: unusedOrder, ...alternative } = candidate;
      diverse.set(signature, { ...alternative, visitedStates: stateCount, truncated });
      if (diverse.size === 5) break;
    }
    return { ...result, phase: 'FINAL', visitedStates: stateCount, truncated,
      alternatives: [...diverse.values()],
      diagnostics: { ...diagnostics, retainedStates: visited.size, verificationReads,
        expectedPostRevealScore: bestResult.expectedPostRevealScore } };
  }

  const status = !truncated && diagnostics.historyRejectedGoals === 0 && diagnostics.strategicCandidates === 0 && diagnostics.explorationCandidates === 0
    ? 'NO_STRATEGIC_PROGRESS'
    : 'INCONCLUSIVE';
  return {
    phase: 'FINAL',
    status,
    ...(status === 'NO_STRATEGIC_PROGRESS' ? { recommendedMove: null } : {}),
    diagnostics: { ...diagnostics, retainedStates: visited.size, verificationReads },
    reason: diagnostics.historyRejectedGoals > 0 ? 'HISTORY_RESTRICTED' : truncated ? 'LIMIT_REACHED' : status === 'NO_STRATEGIC_PROGRESS' ? 'SEARCH_EXHAUSTED' : 'NO_STRATEGIC_RECOMMENDATION',
    plan: [],
    goal: null,
    score: null,
    visitedStates: stateCount,
    truncated,
  };
}
```

## src/engine/cards.js

```javascript
const SUIT_NAMES = ['trefl', 'karo', 'kier', 'pik'];
const MAX_SEED = 4294967295;

export function suitIndex(id) {
  return Math.floor(id / 13);
}

export function rank(id) {
  return (id % 13) + 1;
}

export function color(id) {
  const suit = suitIndex(id);
  return suit === 1 || suit === 2 ? 'red' : 'black';
}

export function suitName(id) {
  return SUIT_NAMES[suitIndex(id)];
}

function reject(reason) {
  const error = new Error(reason);
  error.reason = reason;
  throw error;
}

function readOptions(options) {
  if (options === null || typeof options !== 'object') {
    reject('invalid-options');
  }
  const { seed, drawCount } = options;
  if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0 || seed > MAX_SEED) {
    reject('invalid-seed');
  }
  if (drawCount !== 1 && drawCount !== 3) {
    reject('invalid-draw-count');
  }
  const rulesVersion = options.rulesVersion === undefined ? 1 : options.rulesVersion;
  const shuffleVersion = options.shuffleVersion === undefined ? 1 : options.shuffleVersion;
  if (rulesVersion !== 1) {
    reject('unsupported-rules-version');
  }
  if (shuffleVersion !== 1) {
    reject('unsupported-shuffle-version');
  }
  return { seed: seed >>> 0, drawCount, rulesVersion, shuffleVersion };
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function sample() {
    state = (state + 0x6D2B79F5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(seed) {
  const cards = Array.from({ length: 52 }, (_, id) => id);
  const sample = mulberry32(seed);
  for (let index = cards.length - 1; index >= 1; index -= 1) {
    const swapIndex = Math.floor(sample() * (index + 1));
    const current = cards[index];
    cards[index] = cards[swapIndex];
    cards[swapIndex] = current;
  }
  return cards;
}

export function createGame(options) {
  const gameOptions = readOptions(options);
  const cards = shuffle(gameOptions.seed);
  const columns = Array.from({ length: 7 }, () => []);
  for (let row = 0; row < 7; row += 1) {
    for (let column = row; column < 7; column += 1) {
      columns[column].push(cards.pop());
    }
  }
  return Object.freeze({
    rulesVersion: gameOptions.rulesVersion,
    shuffleVersion: gameOptions.shuffleVersion,
    seed: gameOptions.seed,
    drawCount: gameOptions.drawCount,
    stock: Object.freeze(cards),
    waste: Object.freeze([]),
    tableau: Object.freeze(columns.map((column) => Object.freeze({
      cards: Object.freeze(column),
      faceUpStart: column.length - 1,
    }))),
    foundations: Object.freeze([
      Object.freeze([]),
      Object.freeze([]),
      Object.freeze([]),
      Object.freeze([]),
    ]),
  });
}
```

## src/engine/game.js

```javascript
import { color, rank, suitIndex } from './cards.js';

const MAX_SEED = 4294967295;

function invalidState(detail) {
  const error = new Error(`invalid-state: ${detail}`);
  error.reason = 'invalid-state';
  throw error;
}

function failure(reason) {
  return { ok: false, reason };
}

function isWhole(value) {
  return typeof value === 'number' && Number.isInteger(value);
}

function isIndex(value, length) {
  return isWhole(value) && value >= 0 && value < length;
}

function exactKeys(value, keys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const present = Object.keys(value);
  return present.length === keys.length && keys.every((key) => present.includes(key));
}

function descendingAlternating(cards) {
  for (let index = 0; index < cards.length - 1; index += 1) {
    const next = cards[index + 1];
    if (rank(next) !== rank(cards[index]) - 1 || color(next) === color(cards[index])) return false;
  }
  return true;
}

function fitsTableau(cardId, destination) {
  if (destination.length === 0) return rank(cardId) === 13;
  const top = destination[destination.length - 1];
  return rank(cardId) === rank(top) - 1 && color(cardId) !== color(top);
}

function freezeState(state) {
  return Object.freeze({
    rulesVersion: state.rulesVersion,
    shuffleVersion: state.shuffleVersion,
    seed: state.seed,
    drawCount: state.drawCount,
    stock: Object.freeze([...state.stock]),
    waste: Object.freeze([...state.waste]),
    tableau: Object.freeze(state.tableau.map((column) => Object.freeze({
      cards: Object.freeze([...column.cards]),
      faceUpStart: column.faceUpStart,
    }))),
    foundations: Object.freeze(state.foundations.map((foundation) => Object.freeze([...foundation]))),
  });
}

export function isWon(state) {
  if (state === null || typeof state !== 'object') return false;
  if (!Array.isArray(state.stock) || state.stock.length !== 0) return false;
  if (!Array.isArray(state.waste) || state.waste.length !== 0) return false;
  if (!Array.isArray(state.tableau) || state.tableau.length !== 7) return false;
  if (state.tableau.some((column) => !column || !Array.isArray(column.cards) || column.cards.length !== 0)) {
    return false;
  }
  if (!Array.isArray(state.foundations) || state.foundations.length !== 4) return false;
  for (let suit = 0; suit < 4; suit += 1) {
    const foundation = state.foundations[suit];
    if (!Array.isArray(foundation) || foundation.length !== 13) return false;
    for (let offset = 0; offset < 13; offset += 1) {
      if (foundation[offset] !== suit * 13 + offset) return false;
    }
  }
  return true;
}

export function assertInvariants(state) {
  if (state === null || typeof state !== 'object') invalidState('shape');
  if (state.rulesVersion !== 1 || state.shuffleVersion !== 1) invalidState('version');
  if (!isWhole(state.seed) || state.seed < 0 || state.seed > MAX_SEED) invalidState('seed');
  if (state.drawCount !== 1 && state.drawCount !== 3) invalidState('draw');
  if (!Array.isArray(state.stock) || !Array.isArray(state.waste)) invalidState('piles');
  if (!Array.isArray(state.tableau) || state.tableau.length !== 7) invalidState('tableau');
  if (!Array.isArray(state.foundations) || state.foundations.length !== 4) invalidState('foundations');

  const seen = new Set();
  const collect = (id) => {
    if (!isWhole(id) || id < 0 || id > 51 || seen.has(id)) invalidState('card');
    seen.add(id);
  };

  for (const column of state.tableau) {
    if (column === null || typeof column !== 'object' || !Array.isArray(column.cards) || !isWhole(column.faceUpStart)) {
      invalidState('column');
    }
    for (const id of column.cards) collect(id);
    if (column.cards.length === 0) {
      if (column.faceUpStart !== 0) invalidState('empty-column');
      continue;
    }
    if (column.faceUpStart < 0 || column.faceUpStart >= column.cards.length) invalidState('face');
    for (let index = column.faceUpStart; index < column.cards.length - 1; index += 1) {
      const next = column.cards[index + 1];
      if (rank(next) !== rank(column.cards[index]) - 1 || color(next) === color(column.cards[index])) {
        invalidState('tableau-order');
      }
    }
  }

  state.foundations.forEach((foundation, suit) => {
    if (!Array.isArray(foundation) || foundation.length > 13) invalidState('foundation');
    foundation.forEach((id, index) => {
      collect(id);
      if (suitIndex(id) !== suit || rank(id) !== index + 1) invalidState('foundation-order');
    });
  });
  for (const id of state.waste) collect(id);
  for (const id of state.stock) collect(id);
  if (seen.size !== 52) invalidState('count');
}

function readSource(state, from) {
  if (from === null || typeof from !== 'object' || Array.isArray(from)) return failure('invalid-command');
  if (from.pile === 'tableau') {
    if (!exactKeys(from, ['pile', 'index', 'cardIndex']) || !isIndex(from.index, 7)) {
      return failure('invalid-command');
    }
    const column = state.tableau[from.index];
    if (!column || !Array.isArray(column.cards) || !isWhole(column.faceUpStart)) {
      return failure('invalid-state');
    }
    if (!isIndex(from.cardIndex, column.cards.length)) return failure('invalid-command');
    if (from.cardIndex < column.faceUpStart) return failure('illegal-source');
    const suffix = column.cards.slice(from.cardIndex);
    if (!descendingAlternating(suffix)) return failure('illegal-sequence');
    const hiddenTop = from.cardIndex > 0 && column.faceUpStart >= from.cardIndex
      ? column.cards[from.cardIndex - 1]
      : null;
    return {
      ok: true,
      pile: 'tableau',
      index: from.index,
      cardIndex: from.cardIndex,
      suffix,
      revealed: hiddenTop,
    };
  }
  if (from.pile === 'waste') {
    if (!exactKeys(from, ['pile'])) return failure('invalid-command');
    if (state.waste.length === 0) return failure('illegal-source');
    return { ok: true, pile: 'waste', suffix: [state.waste.at(-1)], revealed: null };
  }
  if (from.pile === 'foundation') {
    if (!exactKeys(from, ['pile', 'index']) || !isIndex(from.index, 4)) return failure('invalid-command');
    const foundation = state.foundations[from.index];
    if (!Array.isArray(foundation)) return failure('invalid-state');
    if (foundation.length === 0) return failure('illegal-source');
    return { ok: true, pile: 'foundation', index: from.index, suffix: [foundation.at(-1)], revealed: null };
  }
  return failure('invalid-command');
}

function readDestination(state, source, to) {
  if (!exactKeys(to, ['pile', 'index'])) return failure('invalid-command');
  const problem = destinationProblem(state, source, to.pile, to.index);
  return problem ? failure(problem) : { ok: true, pile: to.pile, index: to.index };
}

// Returns the rejection reason or null. Move enumeration calls it about 500 times
// per board, so it must not allocate.
function destinationProblem(state, source, pile, index) {
  if (pile === 'tableau') {
    if (!isIndex(index, 7)) return 'invalid-command';
    const destination = state.tableau[index];
    if (!destination || !Array.isArray(destination.cards)) return 'invalid-state';
    if (source.pile === 'tableau' && source.index === index) return 'illegal-destination';
    if (!fitsTableau(source.suffix[0], destination.cards)) return 'illegal-destination';
    return null;
  }
  if (pile === 'foundation') {
    if (!isIndex(index, 4)) return 'invalid-command';
    if (!Array.isArray(state.foundations[index])) return 'invalid-state';
    if (source.pile === 'foundation') return 'illegal-destination';
    if (source.suffix.length !== 1) return 'illegal-sequence';
    const cardId = source.suffix[0];
    if (suitIndex(cardId) !== index || rank(cardId) !== state.foundations[index].length + 1) {
      return 'illegal-destination';
    }
    return null;
  }
  return 'invalid-command';
}

function transfer(state, source, destination) {
  const tableau = state.tableau.map((column) => ({
    cards: [...column.cards],
    faceUpStart: column.faceUpStart,
  }));
  const foundations = state.foundations.map((foundation) => [...foundation]);
  let waste = [...state.waste];

  if (source.pile === 'tableau') {
    const column = tableau[source.index];
    column.cards = column.cards.slice(0, source.cardIndex);
    column.faceUpStart = column.cards.length === 0 ? 0 : Math.min(column.faceUpStart, column.cards.length - 1);
  } else if (source.pile === 'waste') {
    waste = waste.slice(0, -1);
  } else {
    foundations[source.index].pop();
  }

  if (destination.pile === 'tableau') {
    const column = tableau[destination.index];
    if (column.cards.length === 0) column.faceUpStart = 0;
    column.cards.push(...source.suffix);
  } else {
    foundations[destination.index].push(source.suffix[0]);
  }

  return freezeState({
    rulesVersion: state.rulesVersion,
    shuffleVersion: state.shuffleVersion,
    seed: state.seed,
    drawCount: state.drawCount,
    stock: state.stock,
    waste,
    tableau,
    foundations,
  });
}

function canReadBoard(state) {
  return state !== null
    && typeof state === 'object'
    && Array.isArray(state.stock)
    && Array.isArray(state.waste)
    && Array.isArray(state.tableau)
    && state.tableau.length === 7
    && Array.isArray(state.foundations)
    && state.foundations.length === 4;
}

// Stock and waste keep the bottom card at index 0. Draw pops the last stock
// id onto the waste, repeating up to drawCount. Recycle reverses the waste
// into the stock and does not draw. [D,C,B,A] drawn by 3 becomes waste
// [A,B,C] and stock [D]. Recycling [A,B,C] becomes stock [C,B,A].
// Legality only, so move enumeration does not build and freeze a successor board.
function stockProblem(state, type) {
  if (state.drawCount !== 1 && state.drawCount !== 3) return 'invalid-state';
  if (type === 'draw') return state.stock.length === 0 ? 'illegal-source' : null;
  return state.stock.length !== 0 || state.waste.length === 0 ? 'illegal-source' : null;
}

function stockAction(state, command) {
  if (!exactKeys(command, ['type'])) return failure('invalid-command');
  const problem = stockProblem(state, command.type);
  if (problem) return failure(problem);
  if (command.type === 'draw') {
    const count = Math.min(state.drawCount, state.stock.length);
    const drawn = state.stock.slice(-count).reverse();
    return {
      ok: true,
      revealed: null,
      state: freezeState({
        ...state,
        stock: state.stock.slice(0, -count),
        waste: state.waste.concat(drawn),
      }),
    };
  }
  return {
    ok: true,
    revealed: null,
    state: freezeState({
      ...state,
      stock: state.waste.slice().reverse(),
      waste: [],
    }),
  };
}

function evaluate(state, command) {
  if (!canReadBoard(state)) return failure('invalid-state');
  if (command === null || typeof command !== 'object' || Array.isArray(command)) return failure('invalid-command');
  if (command.type === 'draw' || command.type === 'recycle') return stockAction(state, command);
  if (!exactKeys(command, ['type', 'from', 'to']) || command.type !== 'move') return failure('invalid-command');

  const source = readSource(state, command.from);
  if (!source.ok) return source;
  const destination = readDestination(state, source, command.to);
  if (!destination.ok) return destination;
  return {
    ok: true,
    state: transfer(state, source, destination),
    revealed: source.revealed,
  };
}

export function validateMove(state, command) {
  const result = evaluate(state, command);
  return result.ok ? { ok: true } : failure(result.reason);
}

export function applyMove(state, command) {
  const result = evaluate(state, command);
  if (!result.ok) return failure(result.reason);
  return { ok: true, state: result.state, revealed: result.revealed };
}

function addDestinations(state, from, moves) {
  // Enumeration needs validation only; materialize a successor when applying the command.
  const source = readSource(state, from);
  if (!source.ok) return;
  for (let index = 0; index < 7; index += 1) {
    if (!destinationProblem(state, source, 'tableau', index)) moves.push({ type: 'move', from, to: { pile: 'tableau', index } });
  }
  for (let index = 0; index < 4; index += 1) {
    if (!destinationProblem(state, source, 'foundation', index)) moves.push({ type: 'move', from, to: { pile: 'foundation', index } });
  }
}

// Stable scan, not hint rank: draw, recycle, tableau columns and face-up
// cardIndex ascending, waste, then foundations. Each source tries tableau
// destinations 0..6 before foundation destinations 0..3.
export function getLegalMoves(state) {
  if (!canReadBoard(state)) return [];
  const moves = [];
  if (!stockProblem(state, 'draw')) moves.push({ type: 'draw' });
  if (!stockProblem(state, 'recycle')) moves.push({ type: 'recycle' });
  for (let index = 0; index < 7; index += 1) {
    const column = state.tableau[index];
    for (let cardIndex = column.faceUpStart; cardIndex < column.cards.length; cardIndex += 1) {
      addDestinations(state, { pile: 'tableau', index, cardIndex }, moves);
    }
  }
  if (state.waste.length > 0) addDestinations(state, { pile: 'waste' }, moves);
  for (let index = 0; index < 4; index += 1) {
    if (state.foundations[index].length === 0) continue;
    addDestinations(state, { pile: 'foundation', index }, moves);
  }
  return moves;
}
```

## src/engine/knowledge.js

```javascript
// Match the board renderer: all face-up tableau, foundation cards and waste fan.
export function visibleCards(state) {
  return [
    ...state.tableau.flatMap((column) => column.cards.slice(column.faceUpStart)),
    ...state.foundations.flat(),
    ...state.waste.slice(-state.drawCount),
  ];
}

export function rememberVisible(state, knownCards = []) {
  const known = new Set(knownCards);
  const visible = visibleCards(state);
  if (visible.every((id) => known.has(id))) return knownCards;
  return Object.freeze([...new Set([...knownCards, ...visible])].sort((a, b) => a - b));
}
```

## src/engine/progress.js

```javascript
import { applyMove, getLegalMoves, isWon } from './game.js';
import { rememberVisible, visibleCards } from './knowledge.js';

export function progressStateKey(state, knownCards) {
  return progressKeyFor(knownCards)(state);
}

// A search keeps knowledge fixed: serialize it once, not for every state.
// The key string is identical to serializing all seven parts together.
export function progressKeyFor(knownCards) {
  const knowledge = JSON.stringify([...knownCards].sort((a, b) => a - b));
  // Hidden tableau identities cannot matter before a P1 boundary. Stock/waste
  // IDs are opaque tokens here: keep their order, never inspect hidden ranks.
  return (state) => `${JSON.stringify([
    state.rulesVersion, state.drawCount,
    state.tableau.map((c) => [c.faceUpStart, c.cards.map((id, i) => i < c.faceUpStart ? null : id)]),
    state.foundations, state.stock, state.waste,
  ]).slice(0, -1)},${knowledge}]`;
}

function classifyProgress(applied, initialFoundationCount, known) {
  const after = applied.state;
  if (applied.revealed != null) return 'REVEAL';
  if (after.foundations.reduce((total, foundation) => total + foundation.length, 0) > initialFoundationCount) {
    return 'FOUNDATION_ADVANCE';
  }
  if (visibleCards(after).some((id) => !known.has(id))) return 'INFORMATION';
  return null;
}

// One yield per expanded state lets the controller limit active time and cancel.
// No depth bound: NO_PROGRESS requires exhaustion of the entire neutral graph.
export function* searchProgress(initial, knownCards = [], { maxStates = 10000 } = {}) {
  if (isWon(initial)) return { status: 'WON', visitedStates: 0, noLegalMoves: false };
  const knowledge = rememberVisible(initial, knownCards);
  const known = new Set(knowledge);
  const initialFoundationCount = initial.foundations.reduce((total, foundation) => total + foundation.length, 0);
  const queue = [initial];
  const stateKey = progressKeyFor(knowledge);
  const visited = new Set([stateKey(initial)]);
  let cursor = 0;
  let noLegalMoves = false;
  const result = (status, goal) => ({ status, visitedStates: cursor, noLegalMoves, ...(goal ? { goal } : {}) });
  while (cursor < queue.length) {
    if (cursor >= maxStates) return result('UNKNOWN');
    const state = queue[cursor];
    queue[cursor++] = null;
    const moves = getLegalMoves(state);
    if (cursor === 1) noLegalMoves = moves.length === 0;
    for (const move of moves) {
      const applied = applyMove(state, move);
      if (!applied.ok) continue;
      const goal = classifyProgress(applied, initialFoundationCount, known);
      if (goal) return result('PROGRESS_FOUND', goal);
      const key = stateKey(applied.state);
      if (visited.has(key)) continue;
      if (visited.size >= maxStates) return result('UNKNOWN');
      visited.add(key);
      queue.push(applied.state);
    }
    if (cursor < queue.length) yield;
  }
  return result('NO_PROGRESS');
}
```

## benchmark-core.js

```javascript
import { createGame } from './src/engine/cards.js';
import { applyMove, assertInvariants, isWon } from './src/engine/game.js';
import { rememberVisible, visibleCards } from './src/engine/knowledge.js';
import { progressStateKey } from './src/engine/progress.js';
import { createHintContext } from './src/engine/smart-hints.js';

// Active computation only: same generator cutoff as the app, without scheduler waits.
export function runHint(algorithm, state, known, options, now = () => performance.now()) {
  const controller = algorithm.cancellable ? new AbortController() : null;
  const generator = algorithm.search(state, known, { maxStates: options.maxStates, maxDepth: options.maxDepth,
    signal: controller?.signal, previousHint: options.previousHint, plannerContext: options.plannerContext });
  const start = now();
  let next;
  let latest;
  do {
    next = generator.next();
    if (next.value) latest = next.value;
    if (next.done) break;
  } while (options.budget === 'states' || now() - start < options.activeMs);
  const timeCutoff = !next.done;
  if (timeCutoff) {
    if (controller) {
      controller.abort();
      next = generator.next();
      if (!next.done) { generator.return(); throw Error('planner ignored cancellation'); }
      latest = next.value;
    } else generator.return();
  }
  const elapsedMs = now() - start;
  const result = latest ?? { status: 'INCONCLUSIVE', plan: [], goal: null, visitedStates: 0 };
  return { ...result, truncated: Boolean(result.truncated || timeCutoff), elapsedMs, timeCutoff };
}

const hidden = state => state.tableau.reduce((n, c) => n + c.faceUpStart, 0);
const foundations = state => state.foundations.reduce((n, pile) => n + pile.length, 0);

// Common external measurements; neither planner's utility/goal classifier grades itself.
export function inspectPlan(state, known, plan) {
  const knownSet = new Set([...known, ...visibleCards(state)]);
  let end = state;
  let boundary = false;
  for (const move of plan) {
    if (boundary) throw Error('plan continues past an information boundary');
    const next = applyMove(end, move);
    if (!next.ok) throw Error(`illegal plan: ${next.reason}`);
    boundary = hidden(next.state) < hidden(end) || visibleCards(next.state).some(id => !knownSet.has(id));
    end = next.state;
    assertInvariants(end);
  }
  const reveal = hidden(state) - hidden(end);
  const foundationAdvance = foundations(end) - foundations(state);
  const information = visibleCards(end).some(id => !knownSet.has(id));
  return { reveal, foundationAdvance, information, preparationOnly: plan.length > 0 && reveal === 0 && foundationAdvance <= 0 && !information };
}

export function playDeal(algorithm, seed, drawCount, options, positions = [], initial = createGame({ seed, drawCount })) {
  let state = initial;
  let known = rememberVisible(state, []);
  assertInvariants(state);
  const initialHidden = hidden(state);
  const boards = new Set([progressStateKey(state, [])]);
  const observations = new Set([progressStateKey(state, known)]);
  const snapshots = [state];
  const calls = [];
  const history = [];
  let cycles = 0;
  let boardReturns = 0;
  let stop = 'MOVE_LIMIT';
  let previousHint;
  const snapshot = stage => positions.push({ id: `${algorithm.id}/${drawCount}/${seed}/${history.length}/${stage}`,
    source: algorithm.id, seed, drawCount, step: history.length, stage, state, known });
  snapshot('start');
  for (let step = 0; step < options.maxSteps; step++) {
    if (isWon(state)) { stop = 'WON'; break; }
    if (step === Math.floor(options.maxSteps / 2)) snapshot('middle');
    let result;
    let effect;
    try {
      result = runHint(algorithm, state, known, { ...options, previousHint,
        plannerContext: createHintContext(snapshots, known) });
      if (!['FOUND', 'EXPLORATION', 'INCONCLUSIVE', 'NO_STRATEGIC_PROGRESS', 'WON'].includes(result.status) || !Array.isArray(result.plan)) throw Error('invalid result');
      if (result.status === 'WON' && !isWon(state)) throw Error('false WON');
      if (['INCONCLUSIVE', 'NO_STRATEGIC_PROGRESS'].includes(result.status) && result.plan.length || ['FOUND', 'EXPLORATION'].includes(result.status) && !result.plan.length) throw Error('invalid result plan');
      effect = inspectPlan(state, known, result.plan);
    } catch (error) { throw Error(`${algorithm.id} seed=${seed} draw=${drawCount} step=${step}: ${error.message}`); }
    calls.push({ status: result.status, goal: result.goal, planLength: result.plan.length,
      elapsedMs: result.elapsedMs, visitedStates: result.visitedStates, truncated: result.truncated,
      timeCutoff: result.timeCutoff, ...effect });
    if (['INCONCLUSIVE', 'NO_STRATEGIC_PROGRESS'].includes(result.status)) { stop = result.status; break; }
    previousHint = { state, plan: result.plan,
      commitment: result.commitment || { state, plan: result.plan } };
    const move = result.plan[0];
    state = applyMove(state, move).state;
    snapshots.push(state);
    known = rememberVisible(state, known);
    history.push(move);
    const board = progressStateKey(state, []);
    const observation = progressStateKey(state, known);
    if (boards.has(board)) boardReturns++;
    if (observations.has(observation)) cycles++;
    boards.add(board);
    observations.add(observation);
  }
  if (isWon(state)) stop = 'WON';
  snapshot('end');
  return { algorithm: algorithm.id, seed, drawCount, stop, steps: history.length,
    revealed: initialHidden - hidden(state), foundationCards: foundations(state), cycles, boardReturns, history, calls };
}
```

## Jedyna różnica bazowego Best-First

Aby uzyskać bazowy planer, zastąp klasę PriorityQueue w pierwszym bloku poniższym kodem. Pozostałe źródła są wspólne. Nie zmieniaj comparatora kandydatów ani kosztu deduplikacji.

```javascript
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
      if (a.historyReturns !== b.historyReturns) return a.historyReturns < b.historyReturns;
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
```
