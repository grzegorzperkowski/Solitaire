import { afterEach, expect, test, vi } from 'vitest';
import * as game from '../../src/engine/game.js';
import { searchSmartHint } from '../../src/engine/smart-hints.js';
import { progressStateKey } from '../../src/engine/progress.js';

afterEach(() => vi.restoreAllMocks());

// Abstract transitions isolate search bookkeeping; real Klondike is checked by BFS separately.
function graph(nodes, edges, rootStock = []) {
  const states = Object.fromEntries(Object.entries(nodes).map(([name, foundations], index) => [name, {
    rulesVersion: 1, drawCount: 1,
    tableau: Array.from({ length: 7 }, () => ({ cards: [], faceUpStart: 0 })),
    foundations: [[], [], [], [], ...foundations].slice(-4),
    stock: [40 + index, ...rootStock], waste: [],
  }]));
  const names = new Map(Object.entries(states).map(([name, state]) => [state.stock[0], name]));
  const moves = (state) => (edges[names.get(state.stock[0])] || []).map(target =>
    typeof target === 'string' ? { type: 'recycle', target } : target);
  vi.spyOn(game, 'getLegalMoves').mockImplementation(moves);
  const apply = vi.spyOn(game, 'applyMove').mockImplementation((state, move) =>
    moves(state).some(edge => edge.target === move.target)
      ? { ok: true, state: states[move.target] } : { ok: false, reason: 'test-illegal' });
  return { states, apply };
}

function finish(iterator) {
  let step;
  do { step = iterator.next(); } while (!step.done);
  return step.value;
}

test.each([false, true])('resolved depth cuts are cleared, real cuts remain (%s)', (missingBranch) => {
  const { states } = graph({ S: [], A: [[0]], B: [[0]], C: [[0]], Short: [], X: [], Missing: [], Unseen: [] }, {
    S: ['A', 'Short'], A: ['B'], B: ['C'], C: ['X'], Short: ['X'],
    X: ['S', ...(missingBranch ? ['Missing'] : [])], Missing: ['Unseen'],
  });
  const set = Map.prototype.set;
  let explored;
  vi.spyOn(Map.prototype, 'set').mockImplementation(function (key, value) {
    if (value?.children instanceof Set) explored = this;
    return set.call(this, key, value);
  });
  const result = finish(searchSmartHint(states.S, [], { maxDepth: 3, maxStates: 100 }));
  expect(result.diagnostics.depthLimitedBranches).toBeGreaterThan(0);
  expect(result.truncated).toBe(missingBranch);
  expect(result.diagnostics.unresolvedCutoffs).toBe(missingBranch ? 1 : 0);
  const parent = explored.get(progressStateKey(states.C, []));
  expect(parent.complete).toBe(true);
  expect(parent.children.has(progressStateKey(states.X, []))).toBe(true);
  expect(explored.get(progressStateKey(states.Missing, []))?.complete).toBe(missingBranch ? false : undefined);
  if (!missingBranch) expect(result.status).toBe('INCONCLUSIVE'); // All foundation ends are dead.
  else expect(result.verification.continuation).toBe('UNPROVEN');
});

test('excluded root edges do not exhaust the graph verification budget', () => {
  const { states } = graph({ S: [], Candidate: [[0]], Step: [[0]], Filler: [] }, {
    S: ['Candidate', 'Step', 'Filler'], Candidate: ['Step'], Step: ['S', 'Candidate'], Filler: ['S'],
  });
  const result = finish(searchSmartHint(states.S, [], { maxDepth: 8, maxStates: 4 }));
  expect(result).toMatchObject({ status: 'INCONCLUSIVE', truncated: false, plan: [] });
  expect(result.diagnostics.verificationReads).toBe(4);
});

test('a root detour cannot prove future progress for a candidate', () => {
  const { states } = graph({ S: [], Candidate: [[0]], Step: [[0]], Alternative: [[], [13, 14]] }, {
    S: ['Candidate', 'Alternative'], Candidate: ['Step'], Step: ['S'], Alternative: ['S'],
  }, [0]);
  const result = finish(searchSmartHint(states.S, [0], { maxDepth: 8, maxStates: 100 }));
  expect(result.status).toBe('INCONCLUSIVE');
  expect(result.plan).toEqual([]);
  expect(result.truncated).toBe(false);
  expect(result.diagnostics.rejectedEndStates).toBeGreaterThanOrEqual(2);
});

test('a genuine continuation reaches information but never crosses its boundary', () => {
  const { states, apply } = graph({ S: [], Candidate: [[0]], Info: [], Forbidden: [[0, 1]] }, {
    S: ['Candidate'], Candidate: [{ type: 'draw', target: 'Info' }], Info: ['Forbidden'],
  }, [0]);
  states.Candidate.stock.push(49);
  states.Info.waste = [51];
  const result = finish(searchSmartHint(states.S, [0], { maxDepth: 8, maxStates: 100 }));
  expect(result).toMatchObject({ status: 'FOUND', truncated: false,
    verification: { continuation: 'FUTURE_GOAL_REACHABLE', accepted: true } });
  expect(apply.mock.calls.some(([, move]) => move.target === 'Forbidden')).toBe(false);
});

function cancellationGraph() {
  return graph({ S: [], Safe: [[], [13]], SafeStep: [[], [13]], Missing: [],
    Rejected: [[0]], Dead: [[], [], [26, 27, 28]], DeadStep: [[], [], [26, 27, 28]] }, {
    S: ['Safe', 'Rejected', 'Dead'], Safe: ['SafeStep'], SafeStep: ['Missing'],
    Rejected: ['S'], Dead: ['DeadStep'], DeadStep: ['Dead'],
  }, [0]);
}

test('cancellation between final candidates preserves an earlier verified alternative', () => {
  const { states } = cancellationGraph();
  const controller = new AbortController();
  const iterator = searchSmartHint(states.S, [0], { maxDepth: 2, maxStates: 100, signal: controller.signal });
  let step;
  do { step = iterator.next(); } while (!step.done && step.value.diagnostics.verificationReads === undefined);
  expect(step.done).toBe(false);
  expect(step.value.status).toBe('INCONCLUSIVE');
  controller.abort();
  const result = finish(iterator);
  expect(result).toMatchObject({ status: 'FOUND', cancelled: true, truncated: true });
  expect(result.plan).toEqual([{ type: 'recycle', target: 'Safe' }]);
});

test('cancellation falls back to the most recently verified eligible alternative', () => {
  const { states } = graph({ S: [], Older: [[0]], Newer: [[], [13, 14]], Dead: [[], [], [26, 27, 28]],
    OlderStep: [[0]], NewerStep: [[], [13, 14]], DeadStep: [[], [], [26, 27, 28]], Missing: [] }, {
    S: ['Older', 'Newer', 'Dead'], Older: ['OlderStep'], Newer: ['NewerStep'], Dead: ['DeadStep'],
    OlderStep: ['Missing'], NewerStep: ['Missing'], DeadStep: ['Dead'],
  });
  const controller = new AbortController();
  const iterator = searchSmartHint(states.S, [], { maxDepth: 2, maxStates: 100, signal: controller.signal });
  let step;
  do { step = iterator.next(); } while (!step.done && step.value.diagnostics.verificationReads === undefined);
  expect(step.done).toBe(false);
  controller.abort();
  expect(finish(iterator).plan).toEqual([{ type: 'recycle', target: 'Newer' }]);
});

test('cancellation after every yield retains only eligible, verified plans', () => {
  const initial = cancellationGraph();
  const completed = searchSmartHint(initial.states.S, [0], { maxDepth: 2, maxStates: 100 });
  const yields = [];
  let step;
  while (!(step = completed.next()).done) yields.push(step.value);
  for (let index = 0; index < yields.length; index++) {
    const { states } = cancellationGraph();
    const controller = new AbortController();
    const iterator = searchSmartHint(states.S, [0], { maxDepth: 2, maxStates: 100, signal: controller.signal });
    for (let count = 0; count <= index; count++) expect(iterator.next().done).toBe(false);
    controller.abort();
    const result = finish(iterator);
    expect(result).toMatchObject({ cancelled: true, truncated: true });
    if (result.plan.length) {
      expect(result.verification.accepted).toBe(true);
      expect(result.verification.legalActions).not.toBe(undefined);
      expect(result.plan[0].target).not.toBe('Rejected');
    }
    if (yields[index].diagnostics.verificationReads !== undefined) {
      expect(result.plan).toEqual([{ type: 'recycle', target: 'Safe' }]);
    }
  }
});

test('cancellation at the 64-read graph yield immediately returns a verified partial plan', () => {
  const nodes = { S: [], Candidate: [[0, 1]] };
  const edges = { S: ['Candidate'], Candidate: ['N0'] };
  for (let index = 0; index < 65; index++) {
    nodes[`N${index}`] = [[0]];
    edges[`N${index}`] = [index === 64 ? 'Candidate' : `N${index + 1}`];
  }
  const { states } = graph(nodes, edges);
  const controller = new AbortController();
  const iterator = searchSmartHint(states.S, [], { maxDepth: 100, maxStates: 100, signal: controller.signal });
  let step;
  do { step = iterator.next(); } while (!step.done && step.value.diagnostics.verificationReads !== 64);
  expect(step.done).toBe(false);
  controller.abort();
  const result = finish(iterator);
  expect(result).toMatchObject({ status: 'FOUND', cancelled: true, truncated: true,
    diagnostics: { verificationReads: 64 }, verification: { accepted: true } });
  expect(result.plan).toEqual(step.value.plan);
});

test('failed candidate replay is rejected without reading absent verification', () => {
  const { states, apply } = cancellationGraph();
  const iterator = searchSmartHint(states.S, [0], { maxDepth: 2, maxStates: 100 });
  let step;
  do { step = iterator.next(); } while (!step.done && step.value.diagnostics.verificationReads === undefined);
  apply.mockImplementation(() => ({ ok: false, reason: 'test-replay-failed' }));
  const result = finish(iterator);
  expect(result.status).toBe('FOUND');
  expect(result.plan).toEqual([{ type: 'recycle', target: 'Safe' }]);
  expect(result.diagnostics.rejectedEndStates).toBeGreaterThanOrEqual(3);
});

test('stateCount counts expansions, including repeated shorter visits, without overshoot', () => {
  const { states } = graph({ S: [], A: [[0]], B: [[0]], X: [[0]], Short: [], Y: [[0]] }, {
    S: ['A', 'Short'], A: ['B'], B: ['X'], X: ['Y'], Short: ['X'], Y: ['S'],
  });
  const result = finish(searchSmartHint(states.S, [], { maxDepth: 10, maxStates: 6 }));
  expect(result.visitedStates).toBe(6);
  expect(result.truncated).toBe(true);
});

test('an unretained exploration survives rejection of retained foundation candidates', () => {
  const { states } = graph({ S: [], Dead: [[0]], Step: [[0]], Filler1: [], Filler2: [], Filler3: [], Info: [] }, {
    S: ['Dead', 'Step', 'Filler1', 'Filler2', 'Filler3', { type: 'draw', target: 'Info' }],
    Dead: ['Step'], Step: ['Dead'], Filler1: ['S'], Filler2: ['S'], Filler3: ['S'],
  });
  states.Info.waste = [51];
  const result = finish(searchSmartHint(states.S, [], { maxDepth: 8, maxStates: 6 }));
  expect(result).toMatchObject({ status: 'EXPLORATION', truncated: true, goal: 'INFORMATION' });
  expect(result.plan).toEqual([{ type: 'draw', target: 'Info' }]);
  expect(result.verification.continuation).toBe('INFORMATION_BOUNDARY');
});
