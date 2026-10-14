import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { analyzeHintPlan, searchSmartHint } from '../../src/engine/smart-hints.js';
import { assertInvariants } from '../../src/engine/game.js';

const { positions } = JSON.parse(readFileSync(new URL('../../.project/reports/T028-repair-positions.json', import.meta.url)));
const position = positions.find(p => p.id === 'current/3/84/20/end');

test('final shortening really removes a command while preserving the legal achieved goal', () => {
  assertInvariants(position.state);
  const search = searchSmartHint(position.state, position.known, { maxStates: 128, maxDepth: 32 });
  let original;
  let step;
  do {
    step = search.next();
    if (!step.done && step.value.plan.length && !step.value.diagnostics.shorteningAttempts) original = step.value;
  } while (!step.done);
  const result = step.value;
  expect(result.diagnostics.savedMovesCount).toBeGreaterThan(0);
  expect(result.plan.length).toBe(original.plan.length - result.diagnostics.savedMovesCount);
  const replay = analyzeHintPlan(position.state, position.known, result.plan);
  expect(replay).toMatchObject({ ok: true, goal: original.goal, score: result.score,
    components: result.components, verification: { accepted: true, continuation: 'INFORMATION_BOUNDARY' } });
  for (const goal of ['H', 'F', 'I']) expect(result.components[goal]).toBeGreaterThanOrEqual(original.components[goal]);
  expect(result.components.B).toBeLessThanOrEqual(original.components.B);
});

test('cancellation after successful shortening retains the shortened legal recommendation', () => {
  const controller = new AbortController();
  const search = searchSmartHint(position.state, position.known, { maxStates: 128, maxDepth: 32, signal: controller.signal });
  let step;
  do { step = search.next(); } while (!step.done && !step.value.diagnostics.savedMovesCount);
  expect(step.done).toBe(false);
  const shortened = step.value;
  controller.abort();
  const cancelled = search.next();
  expect(cancelled.done).toBe(true);
  expect(cancelled.value).toMatchObject({ phase: 'CANCELLED', cancelled: true, truncated: true,
    plan: shortened.plan, score: shortened.score, components: shortened.components });
  expect(analyzeHintPlan(position.state, position.known, cancelled.value.plan))
    .toMatchObject({ ok: true, verification: { accepted: true } });
});
