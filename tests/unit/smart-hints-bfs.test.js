import { expect, test, vi } from 'vitest';
import { searchSmartHint } from '../../src/engine/smart-hints.js';
import { visibleCards } from '../../src/engine/knowledge.js';
import { assertInvariants } from '../../src/engine/game.js';
import { progressFixture } from '../fixtures/progress.js';
import { hintBfs } from '../helpers/smart-hint-bfs.js';

test.each([1, 2, 3, 4, 5, 6, 7].flatMap(id => [1, 3].flatMap(drawCount =>
  [false, true].map(remembered => [id, drawCount, remembered]))))(
  'complete BFS agrees on reachable goals: fixture %i, Draw %i, remembered %s',
  (id, drawCount, remembered) => {
    const state = progressFixture(id, drawCount);
    assertInvariants(state);
    const known = remembered ? Array.from({ length: 52 }, (_, id) => id) : visibleCards(state);
    const oracle = hintBfs(state, known, 1000);
    expect(oracle.truncated).toBe(false);
    const set = Map.prototype.set;
    let graph;
    const spy = vi.spyOn(Map.prototype, 'set').mockImplementation(function (key, value) {
      if (value?.children instanceof Set) graph = this;
      return set.call(this, key, value);
    });
    let result;
    try {
      const iterator = searchSmartHint(state, known, { maxDepth: 30, maxStates: 1000 });
      let step;
      do { step = iterator.next(); } while (!step.done);
      result = step.value;
    } finally {
      spy.mockRestore();
    }
    expect(result.truncated).toBe(false);
    expect(result.diagnostics.retainedStates).toBe(oracle.uniqueStates);
    const goals = [...graph.values()].filter(node => node.H > 0 || node.F > 0 || node.I > 0);
    expect(goals).toHaveLength(oracle.goalStates);
    for (const component of ['H', 'F', 'I']) {
      expect(goals.filter(node => node[component] > 0)).toHaveLength(oracle.goals[component]);
    }
    if (oracle.goalStates > 0) expect(result.status).not.toBe('NO_STRATEGIC_PROGRESS');
    else expect(result.status).toBe('NO_STRATEGIC_PROGRESS');
    for (const node of graph.values()) {
      expect(node.complete).toBe(true);
      for (const child of node.children) expect(graph.has(child)).toBe(true);
      if (node.boundary) expect(node.children.size).toBe(0);
    }
  },
);

test('BFS stops at a remembered tableau reveal and never explores its exposed value', () => {
  const state = progressFixture(3);
  const known = Array.from({ length: 52 }, (_, id) => id);
  expect(hintBfs(state, known)).toMatchObject({ expanded: 2, uniqueStates: 4,
    goalStates: 2, truncated: false, goals: { H: 2, F: 0, I: 0 } });
});
