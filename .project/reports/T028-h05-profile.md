# T028 — H05 CPU profile and optimization, 2026-10-11

Assigned by the coordinator after the H05 timeout: profile the existing fixture,
identify a bottleneck, speed it up and verify identical results. Base `7ad80f2`,
master, initially clean. Node v22.22.0, Windows x64. No concurrent tests during
timing runs. Default maxStates=10000 and maxDepth=12 in all H05 runs.

## Evidence and change

Native Node CPU sampling found legal-move enumeration on 80.9% of sampled CPU
stacks; computePossibilities appeared on 72.2%. These are inclusive proportions,
so they overlap and must not be added. readSource alone accounted for 32.8% of
self samples. Scoring recalculated the unchanged root possibilities once per
evaluated successor, repeating the same engine validation work.

The fix computes rootPoss once inside each search generator and passes the set
to evaluateSequence. No cross-search cache, changed move enumeration, engine
validation shortcut, rule change, adjusted weights, lower budget or higher test
timeout. State-dependent end possibilities continue to be calculated normally.

Before the fix, the new H05 regression found 93 root getLegalMoves calls at a
budget of just 16 retained states. After the fix, it passed with at most two
(one root mobility scan and one expansion scan). The spy forwards real calls;
the test also verifies the expected legal waste transfer. It asserts work count,
not machine-dependent wall-clock timing.

## Measured timings

Each row records three full searches in one process. No warmup was excluded.

| Instrumentation | Before, ms | After, ms | Median change |
| --- | --- | --- | --- |
| Native CPU sampler | 7682.42, 7836.14, 7873.23 | 4928.05, 4902.19, 4814.32 | 7836.14 → 4902.19, −37.4%, 1.60× |
| No CPU sampler | 6679.04, 6931.85, 6856.99 | 4625.77, 4744.44, 4735.99 | 6856.99 → 4735.99, −30.9%, 1.45× |

The longest measured generator.next call without the sampler was 6.51 ms before
and 5.52 ms after; these are observed maxima for three runs, not latency bounds.
After optimization, getLegalMoves still appeared on 74.9% of CPU stacks and
computePossibilities on 62.5%. Their summed inclusive sampled times across three
runs decreased from 18963.4 to 11006.1 ms and 16927.9 to 9180.1 ms respectively.
Further changes to shared source/destination validation were not made.

Complete H05 result before/after was identical: FOUND/WASTE, score 77, plan
waste→tableau[1] then draw, visitedStates=7545, truncated=true. An additional
comparison against the unchanged `7ad80f2` module gave identical complete results
on 200 initial boards (seeds 0–99, Draw 1/3, maxStates=64, maxDepth=8).

## Commands and artifacts

- `npm test -- tests/unit/smart-hints.test.js -t 'does not rescan'`: RED, exit 1,
  93 scans exceeded two; after the fix GREEN, exit 0, 1 passed/22 skipped.
- `node scripts/profile-hints.mjs`: standalone timings and assertions for the
  first move, unchanged input and deterministic complete results across runs.
- `node --cpu-prof --cpu-prof-dir="$profileDir" --cpu-prof-name=before.cpuprofile scripts/profile-hints.mjs`:
  run before changing production code; same command with after.cpuprofile after.
  `$profileDir = Join-Path $env:TEMP 'solitaire-t028-h05'`; created with
  `New-Item -ItemType Directory -Path $profileDir -Force`.
- `node "$profileDir/baseline.mjs"`: unprofiled baseline runner described below.
- `npm test`: exit 0, 207 tests in 15 files, 26.59 s, including H05 with its
  unchanged 15-second timeout. Previous full suite was 41.26 s; those separate
  suite runs are supporting evidence, not the controlled H05 speed comparison.
- `npm run build`: exit 0, 33 modules, JS 92.50 kB (gzip 26.87 kB).
- `npm run test:e2e -- tests/e2e/smart-hints.spec.js tests/e2e/progress.spec.js tests/e2e/play.spec.js tests/e2e/input.spec.js`:
  exit 0, 60 Chromium tests, 18.7 s.
- `git diff --check` and `git diff --cached --check`: exit 0; explicit staged
  paths and their diff reviewed. Sequential self-review checked root cache
  lifetime and callers; it is local to each generator and never mutated.

Raw local CPU profiles (outside Git):
[before.cpuprofile](/C:/Users/admin/AppData/Local/Temp/solitaire-t028-h05/before.cpuprofile),
[after.cpuprofile](/C:/Users/admin/AppData/Local/Temp/solitaire-t028-h05/after.cpuprofile).
They can be inspected as CPU profiles; temporary files may later be removed by
the system. The tracked runner reproduces the optimized profile without them.

To reproduce the unprofiled baseline without moving HEAD or editing production
files, generate the same harness with the original module loaded from Git:

```powershell
@'
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import {execFileSync} from 'node:child_process';
const baseline=execFileSync('git',['show','7ad80f2:src/engine/smart-hints.js'],{encoding:'utf8'}).replace(/from '\.\/(.*?)'/g,(_,p)=>`from '${pathToFileURL(path.resolve('src/engine',p)).href}'`);
const baselineUrl='data:text/javascript;base64,'+Buffer.from(baseline).toString('base64');
const runner=fs.readFileSync('scripts/profile-hints.mjs','utf8').replace(/from '\.\.\/(.*?)'/g,(_,p)=>`from '${p==='src/engine/smart-hints.js'?baselineUrl:pathToFileURL(path.resolve(p)).href}'`);
const dir=path.join(process.env.TEMP,'solitaire-t028-h05');fs.writeFileSync(path.join(dir,'baseline.mjs'),runner);
console.log(dir);
'@ | node --input-type=module
$profileDir = Join-Path $env:TEMP 'solitaire-t028-h05'
node "$profileDir/baseline.mjs"
node scripts/profile-hints.mjs
```

Module loading is outside the recorded search times. To profile the reconstructed
baseline, run `node --cpu-prof --cpu-prof-dir="$profileDir" --cpu-prof-name=baseline-replay.cpuprofile "$profileDir/baseline.mjs"`.

The read-only 200-position parity check used the same original module extraction:

```powershell
@'
import assert from 'node:assert/strict';import path from 'node:path';import {pathToFileURL} from 'node:url';import {execFileSync} from 'node:child_process';
import {searchSmartHint} from './src/engine/smart-hints.js';import {createGame} from './src/engine/cards.js';import {visibleCards} from './src/engine/knowledge.js';
const source=execFileSync('git',['show','7ad80f2:src/engine/smart-hints.js'],{encoding:'utf8'}).replace(/from '\.\/(.*?)'/g,(_,p)=>`from '${pathToFileURL(path.resolve('src/engine',p)).href}'`);
const baseline=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).searchSmartHint;
const run=(f,s)=>{let r;const g=f(s,visibleCards(s),{maxStates:64,maxDepth:8});do{r=g.next()}while(!r.done);return r.value};
let count=0;for(const drawCount of [1,3])for(let seed=0;seed<100;seed++){const state=createGame({seed,drawCount});assert.deepEqual(run(searchSmartHint,state),run(baseline,state),`seed=${seed},draw=${drawCount}`);count++;}
console.log({comparedPositions:count,result:'IDENTICAL'});
'@ | node --input-type=module
```

## Limits

This is a measured H05 optimization, not evidence that full search meets 100 ms.
The browser controller still limits active work and may return a shorter-budget
result. No physical phone/Safari timings or mandatory §8 strategy comparison
were collected. Full T028 acceptance remains blocked by the existing missing
quality benchmark. This change is ready for coordinator review, not accepted DONE.
