import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { searchSmartHint } from '../../src/engine/smart-hints.js';
import { playDeal, summarizeGames } from '../../scripts/hint-benchmark.js';

const baseline = 'fa98db3';
const oldSource = execFileSync('git', ['show', `${baseline}:src/engine/smart-hints.js`], { encoding: 'utf8' });
const relocated = oldSource.replace(/from '\.\/(.*?)'/g, (_, file) => `from '${pathToFileURL(path.resolve('src/engine', file)).href}'`);
const { searchSmartHint: oldSearch } = await import(`data:text/javascript;base64,${Buffer.from(relocated).toString('base64')}`);
const digest = source => createHash('sha256').update(source.replaceAll('\r\n', '\n')).digest('hex');
const options = { maxSteps: 500, maxStates: 512, maxDepth: 32, budget: 'states' };
const report = { notes: 'Fixed-work validation; no speed claim. Tests/build/E2E may run concurrently. Context reconstruction is outside runHint timing.', createdAt: new Date().toISOString(), baseline, options,
  node: process.version, sourceHashes: {
    before: digest(oldSource), after: digest(readFileSync('src/engine/smart-hints.js', 'utf8')),
    controller: digest(readFileSync('src/app.js', 'utf8')),
    runner: digest(readFileSync('scripts/hint-benchmark.js', 'utf8')),
  }, games: [] };
mkdirSync('.cache', { recursive: true });
for (const drawCount of [1, 3]) {
  for (let seed = 100; seed < 120; seed++) {
    const algorithms = [['before', oldSearch], ['after', searchSmartHint]];
    if (seed % 2) algorithms.reverse();
    for (const [id, search] of algorithms) {
      const game = playDeal({ id, search, cancellable: true }, seed, drawCount, options);
      assert(game.calls.every(call => !call.preparationOnly));
      assert(game.calls.every(call => call.visitedStates <= options.maxStates));
      report.games.push(game);
    }
    if ((seed + 1) % 5 === 0) console.log(JSON.stringify({ drawCount, throughSeed: seed }));
  }
}
writeFileSync('.cache/belief-planner-validation.json', JSON.stringify(report));
const summary = { ...report, games: report.games.map(({ history, calls, ...game }) => game),
  summaries: Object.fromEntries([1, 3].map(draw => [draw, Object.fromEntries(['before', 'after'].map(id =>
    [id, summarizeGames(report.games.filter(game => game.drawCount === draw && game.algorithm === id))]))])),
  rawSha256: digest(readFileSync('.cache/belief-planner-validation.json', 'utf8')) };
writeFileSync('.project/reports/T028-belief-benchmark-summary.json', JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary.summaries));
