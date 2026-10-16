import { expect, test } from 'vitest';
import { planIntervals } from '../../scripts/experiments/smart-hint-prefix.mjs';
import { readFileSync } from 'node:fs';

test('completed plans partition recorded commands; inconsistent tails fail explicitly', () => {
  expect(planIntervals([3,2,1,1,2,1,0],6)).toEqual([[0,3],[3,4],[4,6]]);
  expect(() => planIntervals([3,1,1,0],3)).toThrow();
  expect(() => planIntervals([0],1)).toThrow();
});
test('recorded FIFO plan boundaries cover all142 commands without guessing or binary search', () => {
  const f = JSON.parse(readFileSync('tests/fixtures/smart-hint-seed202-fifo-plan-lengths.json','utf8'));
  const intervals = planIntervals(f.planLengths,f.commandCount);
  expect(intervals.filter(([a]) => a>=52).map(([,b])=>b))
    .toEqual([72,73,75,81,82,86,89,103,104,114,117,122,129,132,139,142]);
});
