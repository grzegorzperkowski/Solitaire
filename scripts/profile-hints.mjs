import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { searchSmartHint } from '../src/engine/smart-hints.js';
import { visibleCards } from '../src/engine/knowledge.js';
import { h05 } from '../tests/fixtures/smart-hints.js';

const state = h05();
const known = visibleCards(state);
const before = JSON.stringify(state);
let expected;
const runs = [];
for (let run = 0; run < 3; run++) {
  const search = searchSmartHint(state, known);
  const start = performance.now();
  let step;
  let maxStepMs = 0;
  do {
    const stepStart = performance.now();
    step = search.next();
    maxStepMs = Math.max(maxStepMs, performance.now() - stepStart);
  } while (!step.done);
  const ms = performance.now() - start;
  const result = step.value;
  assert.notEqual(result.goal, 'WASTE');
  if (result.status === 'FOUND') {
    assert.ok(result.components.H > 0 || result.components.F > 0);
    assert.equal(result.verification.accepted, true);
  }
  assert.equal(JSON.stringify(state), before);
  if (expected) assert.deepEqual(result, expected);
  else expected = result;
  runs.push({ ms: +ms.toFixed(2), maxStepMs: +maxStepMs.toFixed(2) });
}
console.log(JSON.stringify({
  fixture: 'H05', node: process.version, platform: process.platform,
  maxStates: 10000, maxDepth: 32, runs, result: expected,
}, null, 2));
