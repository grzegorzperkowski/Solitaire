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

test('a shorter second history updates expandedCost and preserves the complete mechanical graph', () => {
  const { states } = graph({ S: [], A: [[0]], B: [[0]], X: [[0]], Short: [], Y: [[0]] }, {
    S: ['A', 'Short'], A: ['B'], B: ['X'], X: ['Y'], Short: ['X'], Y: ['S'],
  });
  const set = Map.prototype.set;
  let explored;
  vi.spyOn(Map.prototype, 'set').mockImplementation(function (key, value) {
    if (value?.children instanceof Set) explored = this;
    return set.call(this, key, value);
  });
  const result = finish(searchSmartHint(states.S, [], { maxStates: 100, maxDepth: 8 }));
  expect(result.visitedStates).toBeGreaterThan(result.diagnostics.retainedStates);
  expect(result.diagnostics.unexpandedStates).toBe(0);
  expect(explored.get(progressStateKey(states.X, []))).toMatchObject({
    boundary: false, expandedCost: 2, complete: true,
  });
  expect(explored.get(progressStateKey(states.X, [])).children)
    .toEqual(new Set([progressStateKey(states.Y, [])]));
  expect(result.truncated).toBe(false);
});

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
  expect(result.status).toBe('FOUND'); // Net foundation advance is already a goal.
  expect(result.verification.continuation).toBe('UNPROVEN');
});

test('a genuine continuation reaches information but never crosses its boundary', () => {
  const { states, apply } = graph({ S: [], Candidate: [[0]], Info: [], Forbidden: [[0, 1]] }, {
    S: ['Candidate'], Candidate: [{ type: 'draw', target: 'Info' }], Info: ['Forbidden'],
  }, [0]);
  states.Candidate.stock.push(49);
  states.Info.waste = [51];
  const result = finish(searchSmartHint(states.S, [0], { maxDepth: 8, maxStates: 100 }));
  expect(result).toMatchObject({ status: 'FOUND', truncated: false,
    verification: { continuation: 'UNPROVEN', accepted: true } });
  expect(apply.mock.calls.some(([, move]) => move.target === 'Forbidden')).toBe(false);
});

function cancellationGraph() {
  return graph({ S: [], Safe: [[], [13]], SafeStep: [[], [13]], Missing: [],
    Rejected: [[0]], Dead: [[], [], [26, 27, 28]], DeadStep: [[], [], [26, 27, 28]] }, {
    S: ['Safe', 'Rejected', 'Dead'], Safe: ['SafeStep'], SafeStep: ['Missing'],
    Rejected: ['S'], Dead: ['DeadStep'], DeadStep: ['Dead'],
  }, [0]);
}

test('stateCount counts expansions, including repeated shorter visits, without overshoot', () => {
  const { states } = graph({ S: [], A: [[0]], B: [[0]], X: [[0]], Short: [], Y: [[0]] }, {
    S: ['A', 'Short'], A: ['B'], B: ['X'], X: ['Y'], Short: ['X'], Y: ['S'],
  });
  const result = finish(searchSmartHint(states.S, [], { maxDepth: 10, maxStates: 6 }));
  expect(result.visitedStates).toBe(6);
  expect(result.truncated).toBe(true);
});


test('exhaustive search preserves the achieved goal without requiring future progress', () => {
  const { states } = graph({ S: [], A: [[0]], B: [[0, 1]] }, { S: ['A'], A: ['B'], B: [] });
  const result = finish(searchSmartHint(states.S, [], { maxDepth: 8, maxStates: 100 }));
  expect(result).toMatchObject({ status: 'FOUND', components: { F: 2 }, truncated: false,
    verification: { accepted: true, continuation: 'TERMINAL_PROGRESS', horizon: 0 },
    diagnostics: { verificationReads: 0 } });
  expect(result.plan.map(move => move.target)).toEqual(['A', 'B']);
});

test('cancellation at every yield preserves the best achieved goal', () => {
  const setup = () => graph({ S: [], A: [[0]], B: [[0, 1]], Loop: [[0, 1]] },
    { S: ['A'], A: ['B'], B: ['Loop'], Loop: ['S'] });
  const { states } = setup();
  const iterator = searchSmartHint(states.S, [], { maxDepth: 8, maxStates: 100 });
  const yields = [];
  let step;
  while (!(step = iterator.next()).done) yields.push(step.value);
  expect(yields.length).toBeGreaterThan(1);
  for (let index = 0; index < yields.length; index++) {
    const { states } = setup();
    const controller = new AbortController();
    const search = searchSmartHint(states.S, [], { maxDepth: 8, maxStates: 100, signal: controller.signal });
    let partial;
    for (let count = 0; count <= index; count++) { partial = search.next(); expect(partial.done).toBe(false); }
    controller.abort();
    const cancelled = search.next();
    expect(cancelled.done).toBe(true);
    expect(cancelled.value).toMatchObject({ phase: 'CANCELLED', status: 'FOUND', cancelled: true, truncated: true,
      plan: partial.value.plan, components: partial.value.components, verification: { accepted: true } });
  }
});


test('a committed route may revisit an old board to exceed the epoch foundation high-water mark', () => {
  const { states } = graph({ S: [], Old: [[0]], New: [[0,1]] }, { S:['Old'], Old:['New'], New:[] });
  const known=Array.from({length:52},(_,id)=>id);
  const context={visitedStates:new Set([progressStateKey(states.Old,known)]),foundationHighWater:1};
  const result=finish(searchSmartHint(states.S,known,{plannerContext:context,maxStates:100,maxDepth:4}));
  expect(result).toMatchObject({status:'FOUND',components:{F:2}});
  expect(result.plan.map(command=>command.target)).toEqual(['Old','New']);
  const continued=finish(searchSmartHint(states.Old,known,{
    plannerContext:context,previousHint:{state:states.S,plan:result.plan},maxDepth:4,maxStates:100,
  }));
  expect(continued).toMatchObject({status:'FOUND',continued:true,verification:{committed:true,accepted:true}});
  expect(continued.plan.map(command=>command.target)).toEqual(['New']);
});


test('commitment uses its verified original goal when a suffix has negative local utility', () => {
  const { states } = graph({ S:[], A:[], B:[[],[13]] }, {
    S:['A'], A:[{type:'move',from:{pile:'waste'},to:{pile:'foundation',index:0},target:'B'}], B:[],
  });
  states.A.waste=[0];
  const known=Array.from({length:52},(_,id)=>id);
  const context={visitedStates:new Set(),foundationHighWater:0};
  const plan=finish(searchSmartHint(states.S,known,{plannerContext:context,maxDepth:4,maxStates:100})).plan;
  expect(plan).toHaveLength(2);
  const result=finish(searchSmartHint(states.A,known,{
    plannerContext:context,previousHint:{state:states.S,plan},maxStates:100,maxDepth:4,
  }));
  expect(result).toMatchObject({status:'FOUND',continued:true,verification:{accepted:true,localScoreAccepted:false,committed:true}});
  expect(result.score).toBeLessThan(0);
  expect(result.plan).toEqual(plan.slice(1));
  expect(result.commitment).toEqual({state:states.S,plan});
});
