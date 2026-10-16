import assert from 'node:assert/strict';

// Observe a pinned source in memory; never alter production or queue decisions.
export function observeSource(input) {
  let source = input;
  const replace = (before, after) => {
    assert.equal(source.split(before).length - 1, 1, `Observation anchor changed: ${before}`);
    source = source.replace(before, after);
  };
  replace('import { applyMove, getLegalMoves, isWon }', 'import { applyMove as rawApplyMove, getLegalMoves as rawGetLegalMoves, isWon }');
  replace('export function* searchSmartHint(', 'function* searchSmartHintCore(');
  replace('function replayPlan(state, knownCards, plan, knownSet) {', "function replayPlan(state, knownCards, plan, knownSet, category = 'replay') {");
  replace('const next = applyMove(endState, move);', 'const next = observedApplyMove(category, endState, move);');
  replace('const first = applyMove(previousHint.state, previousHint.plan[0]);', "const first = observedApplyMove('replay', previousHint.state, previousHint.plan[0]);");
  replace('const result = applyMove(current.state, move);', "const result = observedApplyMove('search', current.state, move);");
  replace('replayPlan(state, [...knownSet], candidate.plan, knownSet);', "replayPlan(state, [...knownSet], candidate.plan, knownSet, 'shortening');");
  replace('      const replay = replayPlan(state, [...knownSet], plan, knownSet);', "      const replay = replayPlan(state, [...knownSet], plan, knownSet, 'shortening');");
  replace('function evaluateSequence(endState, rootState, rootFoundationSet, rootStockWasteSet, rootPoss, knownSet, path, atBoundary) {',
    'function evaluateSequence(endState, rootState, rootFoundationSet, rootStockWasteSet, rootPoss, knownSet, path, atBoundary) {\n  if (activeWork) activeWork.evaluations++;');
  replace('    stateCount++;', `    stateCount++;
    activeWork.expandedByDepth[current.path.length] = (activeWork.expandedByDepth[current.path.length] || 0) + 1;
    activeWork.maxExpandedDepth = Math.max(activeWork.maxExpandedDepth, current.path.length);`);
  replace('const atBoundary = checkBoundary(move, current.state, knownSet);', `const atBoundary = checkBoundary(move, current.state, knownSet);
      const rawGoal = result.revealed != null || nextState.foundations.flat().length > rootFoundationSet.size ||
        visibleCards(nextState).some(id => !knownSet.has(id));
      if (rawGoal) {
        activeWork.rawGoalsBeforeDedup++;
        if (activeWork.firstRawGoalDepth == null) activeWork.firstRawGoalDepth = nextCost;
        if (nextCost > maxDepth) activeWork.rawGoalsBeyondDepth++;
      }`);
  replace('        diagnostics.duplicateStatesRejected++;\n        continue;',
    '        diagnostics.duplicateStatesRejected++;\n        if (rawGoal) activeWork.rawGoalsSkippedByDedup++;\n        continue;');
  replace("const isExploration = goal === 'INFORMATION';", "const isExploration = goal === 'INFORMATION';\n      if (goal && score <= 0) activeWork.rejectedByU++;");
  replace('if (addsGoalProgress && goal && !newGoal) diagnostics.historyRejectedGoals++;',
    'if (addsGoalProgress && goal && !newGoal) { diagnostics.historyRejectedGoals++; activeWork.rejectedByHistory++; }\n      if (goal && !addsGoalProgress) activeWork.rejectedByAddsGoalProgress++;');
  replace('if (newGoal && score > 0 && (isConfirmedGoal || isExploration) && addsGoalProgress) {',
    'if (newGoal && score > 0 && (isConfirmedGoal || isExploration) && addsGoalProgress) {\n        if (activeWork.firstAcceptedGoalDepth == null) activeWork.firstAcceptedGoalDepth = nextCost;');
  replace('          insertOrder: insertCounter++,\n        });',
    '          insertOrder: insertCounter++,\n        });\n        activeWork.maxFrontierSize = Math.max(activeWork.maxFrontierSize, queue.length);');
  replace('  let insertCounter = 1;', '  activeWork.maxFrontierSize = queue.length;\n  let insertCounter = 1;');
  return source + `
let activeWork;
function observedApplyMove(category, ...args) {
  if (activeWork) activeWork[category === 'search' ? 'applyMovesSearch' : category === 'shortening' ? 'applyMovesShortening' : 'applyMovesReplay']++;
  return rawApplyMove(...args);
}
function getLegalMoves(...args) {
  if (activeWork) activeWork.getLegalMoves++;
  return rawGetLegalMoves(...args);
}
export function* searchSmartHint(...args) {
  const work = { expandedByDepth: [], maxExpandedDepth: 0, firstRawGoalDepth: null, firstAcceptedGoalDepth: null,
    rawGoalsBeforeDedup: 0, rawGoalsBeyondDepth: 0, rawGoalsSkippedByDedup: 0, rejectedByU: 0,
    rejectedByHistory: 0, rejectedByAddsGoalProgress: 0, maxFrontierSize: 0,
    applyMovesSearch: 0, applyMovesReplay: 0, applyMovesShortening: 0, getLegalMoves: 0, evaluations: 0 };
  const iterator = searchSmartHintCore(...args);
  try {
    while (true) {
      const previous = activeWork;
      let step;
      activeWork = work;
      try { step = iterator.next(); } finally { activeWork = previous; }
      const value = { ...step.value, diagnostics: { ...step.value?.diagnostics,
        work: { ...work, expandedByDepth: Array.from(work.expandedByDepth, n => n || 0) } } };
      if (step.done) return value;
      yield value;
    }
  } finally { iterator.return(); }
}
`;
}
