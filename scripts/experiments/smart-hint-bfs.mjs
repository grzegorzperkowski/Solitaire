// R&D only: derive FIFO from a pinned planner; production code stays unchanged.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { parseOptions, playDeal, summarizeGames, compareGames } from '../hint-benchmark.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const revision = '2d1ecfc';
const digest = source => createHash('sha256').update(source.replaceAll('\r\n', '\n')).digest('hex');

export async function loadPlanners() {
  const source = execFileSync('git', ['show', `${revision}:src/engine/smart-hints.js`], { cwd: root, encoding: 'utf8' });
  const start = source.indexOf('  class PriorityQueue {');
  const end = source.indexOf('  const queue = new PriorityQueue();', start);
  assert(start >= 0 && end > start, 'Pinned priority queue markers changed');
  const fifo = `  class PriorityQueue {
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

`;
  const modified = source.slice(0, start) + fifo + source.slice(end);
  const load = async text => {
    const relocated = text.replace(/from '\.\/(.*?)'/g, (_, file) =>
      `from '${pathToFileURL(path.join(root, 'src/engine', file)).href}'`);
    return import(`data:text/javascript;base64,${Buffer.from(relocated).toString('base64')}`);
  };
  return { baseline: await load(source), bfs: await load(modified),
    metadata: { revision, baselineSha256: digest(source), bfsSha256: digest(modified),
      change: 'Only nested priority queue replaced by FIFO with monotonic-depth assertion.' } };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  assert.equal(options.budget, 'states', 'Use deterministic --budget=states for this experiment');
  const { baseline, bfs, metadata } = await loadPlanners();
  const report = { createdAt: new Date().toISOString(), node: process.version, options, ...metadata,
    notes: 'R&D, not production. Same scoring/history/commitment/shortener. No clock cutoff or shortest-plan claim. Context outside call timing.', games: [] };
  mkdirSync(path.dirname(options.output), { recursive: true });
  for (const drawCount of [1, 3]) {
    for (let seed = options.startSeed; seed < options.startSeed + options.count; seed++) {
      const algorithms = [{ id: 'previous', search: baseline.searchSmartHint, cancellable: true },
        { id: 'current', search: bfs.searchSmartHint, cancellable: true }];
      if (seed % 2) algorithms.reverse();
      for (const algorithm of algorithms) {
        const game = playDeal(algorithm, seed, drawCount, options);
        assert(game.calls.every(call => !call.preparationOnly), 'Preparation-only recommendation');
        assert(game.calls.every(call => call.visitedStates <= options.maxStates), 'Expansion budget exceeded');
        report.games.push(game);
      }
      writeFileSync(options.output, JSON.stringify(report));
      console.log(JSON.stringify({ drawCount, seed, results: report.games.slice(-2).map(game =>
        ({ algorithm: game.algorithm, stop: game.stop, steps: game.steps, cycles: game.cycles })) }));
    }
  }
  const summary = { ...report, games: report.games.map(({ history, calls, ...game }) => game),
    summaries: Object.fromEntries([1, 3].map(draw => [draw, Object.fromEntries(['previous', 'current'].map(id =>
      [id, summarizeGames(report.games.filter(game => game.drawCount === draw && game.algorithm === id))]))])),
    paired: compareGames(report.games), rawSha256: digest(JSON.stringify(report)) };
  const summaryPath = options.output.replace(/\.json$/, '') + '-summary.json';
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify({ summaryPath, summaries: summary.summaries, paired: summary.paired }));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main();
