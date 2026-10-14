# T028 — SmartHint repair measurements, 2026-10-14

The repaired planner reveals more tableau cards in this development sample and
eliminates repeated board-plus-knowledge observations. This is evidence of
better bounded guidance, not of improved win rate: all versions won zero games
within the 100-action cap. Implementation: `23a6540`; T028 is REVIEW, not accepted.

## Reproduce

```sh
npm run benchmark:hints -- --profile=full --budget=time --output=.cache/hints-repair-full-time.json
npm run benchmark:hints -- --output=.cache/hints-repair-final-quick.json
node .project/reports/T028-repair-position-probe.mjs
```

The full run took **1631.88 s (27 min 12 s)**: seeds 0–99 in Draw 1/3,
100 actions per game, 10000 retained states, depth **32 for both planners**,
100 ms active time, 100 shared positions. Warmup is unmeasured; execution order
alternates. No tests or other timed experiments ran concurrently. Time excludes
browser scheduler waits. Windows x64, Node v22.22.0, Intel Xeon W-10885M @2.40GHz.

`previous` is A, frozen at `90fba4f`, using the same current move engine.
`current` is the repaired planner. The earlier [benchmark](T028-benchmark.md)
used depth 12; its game totals are not a controlled before/after comparison with
this depth 32 run. Original B is evaluated separately below at identical depths.
The main run started from dirty `02fb845`; the implementation was checkpointed
during the run. All measured source hashes match the final working files after
LF normalization, including unchanged engine, rules, knowledge and progress.

## Full games

Totals across 100 games per row; stops are unresolved, not losses.

| Mode | Planner | Reveals | Foundation cards | Repeated observations | Moves | INCONCLUSIVE | MOVE_LIMIT | Median / p95 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Draw 1 | previous A | 1232 | 1300 | 102 | 8342 | 62 | 38 | 45.04 / 101.69 |
| Draw 1 | repaired | 1346 | 1434 | 0 | 8700 | 43 | 57 | 100.07 / 101.55 |
| Draw 3 | previous A | 815 | 745 | 145 | 5021 | 92 | 8 | 80.70 / 101.23 |
| Draw 3 | repaired | 1071 | 1013 | 0 | 5650 | 87 | 13 | 100.09 / 101.31 |

Combined: **2417 vs 2047 reveals (+18.1%)**, 2447 vs 2045 foundation cards,
**0 vs 247 repeated observations**, and 130 vs 154 inconclusive stops. Paired
reveal outcomes: new better 103, worse 38, equal 59; Draw 1 48/25/27 and Draw 3 55/13/32.
Repaired gains are 9.3% in Draw 1 and 31.4% in Draw 3. Longer trajectories and more
MOVE_LIMIT stops contribute to totals; these percentages are not win probabilities.

A repeated observation requires the same board AND knowledge. Board-only
returns still occurred 14/54 times in repaired Draw 1/3, while knowledge changed.
Zero observed cycles is not a proof that every possible future call is cycle-free.
The three original cycle boards additionally pass deterministic eight-action
replanning tests. Fresh games for those seeds now reveal 19 (76/Draw 1), 17 (89/Draw 1)
and 21 (35/Draw 3), with zero repeated observations; original B recorded 11/7/4
reveals and 67/68/56 repeats. Historical differences include depth and timing.

| Mode | Planner | Calls | Median / p95 expanded states | Truncated calls | Time cutoffs | Preparation-only plans |
| --- | --- | ---: | --- | ---: | ---: | ---: |
| Draw 1 | previous A | 8404 | 7 / 76 | 3847 | 3823 | 252 |
| Draw 1 | repaired | 8743 | 50 / 316 | 4941 | 4874 | 0 |
| Draw 3 | previous A | 5113 | 12 / 130 | 2484 | 2469 | 165 |
| Draw 3 | repaired | 5737 | 85 / 353 | 3508 | 3462 | 0 |

The repaired planner more often uses its full active-time allowance. There is
no general latency improvement over A: on 100 identical positions both find a
real reveal/net-foundation goal on 65 and neither on 35; first commands match 78.
Median/p95: A 100.06/101.45 ms, repaired 82.78/101.23 ms. Median of paired speed
ratios 1.013x is effectively no advantage. Truncated calls 54→50; preparation-only
plans 6→0. Different full-game medians compare different workloads.

## Original B versus repair on a frozen corpus

The [tracked corpus](T028-repair-positions.json) contains the same 100 positions
from the original depth 12 benchmark, including the replayed diagnostic at
seed 2284836135/cursor114. The [assertion-based probe](T028-repair-position-probe.mjs)
loads original B from `02fb845:src/engine/smart-hints.js` with only import relocation.
Both see identical boards/knowledge. It validates 52-card inputs, statuses, every
plan and information boundary independently, alternates order and warms both.
It requires no old ignored benchmark JSON to reproduce these pairs.

| Equal budgets for B / repair | FOUND | Reveal plans | INCONCLUSIVE | Median ms | p95 ms | Median paired speed ratio |
| --- | --- | --- | --- | --- | --- | --- |
| 128 states, depth 12, no clock | 55 / 56 | 51 / 53 | 37 / 36 | 28.45 / 14.82 | 250.72 / 186.43 | 1.290x |
| 100 ms, 10000 states, depth 12 | 55 / 56 | 52 / 53 | 37 / 36 | 23.16 / 13.12 | 101.56 / 101.52 | 1.234x |
| 100 ms, 10000 states, depth 32 | 59 / 60 | 56 / 57 | 33 / 32 | 29.53 / 15.90 | 101.41 / 101.48 | 1.067x |

All three settings retain every B strategic hit and add one. Both have 8 exploration
results; first commands match 89/100. A prior scratch trial gave different timings
(depth 12 medians 18.60/11.58 ms, paired ratio 1.255x; depth 32 ratio 1.218x). Timing
variation and budget cutoffs matter; do not treat a ratio of medians as the median
of paired ratios or promise these speedups on phones. No full B-versus-repair
game experiment at matching depth was run; the full game comparison above is A.

## Artifacts and checks

[Machine-readable summary](T028-repair-benchmark-summary.json) preserves exact
options, environment, source hashes, aggregates, quick runs and artifact hashes.
Full raw JSON 30,560,339 bytes, SHA256
`4378a7a570508a5bd913ae879a61a617cb30b8b950bba55f59568f7ee0c926a9` remains
in ignored `.cache/hints-repair-full-time.json`; original evidence is preserved.
Position results and final quick data are also ignored, with hashes in the summary.
The reproducible 100-position corpus and probe are tracked. The corpus was
compacted after measurement; exact parsed equality was asserted. Both input
serialization hashes and a canonical positions hash are retained in the summary.

- `npm test`: 239 PASS /17 files, 18.28 s; 16 new strategic regressions, RED→GREEN.
- `npm run build`: PASS, 33 modules; JS 94.41kB/gzip27.77, CSS 16.50kB/gzip4.11.
- Final `npm run test:e2e`: 91 PASS, 26.7 s. The first run had one expectation of
  the removed terminal-goal rejection; the updated case verifies its actual hint.
- Final quick benchmark: exit 0, 6.47 s, fixed-state and 20 ms modes, depth 32. Small
  samples vary: Draw 1 reveals 11 vs 14, Draw 3 fixed-state 14 vs 9 and timed 15 vs 9.
  This reinforces why quick alone is not the quality gate.
- Position probe: exit 0; all assertions passed. Its first relocation attempt failed
  before measurements with an import path error, corrected before the reported run.
- Independent Node assertions recomputed per-game reveal/cycle/move aggregates,
  checked 100 games per mode/planner and verified all measured source hashes.

No extended 250/500-action, held-out-deal or full 10000-state-budget experiment,
physical-phone/Safari timing, Firefox/WebKit or remote CI run. Zero wins under
the 100-action cap cannot establish better deal completion. The 32-command search
and positive-utility requirement can still miss useful longer preparations.
The diagnostic expanded-state counter retains its legacy attempted-pop semantics
at the state cap; actual expansions/retained states remain bounded. Sequential
self-review performed per AGENTS.md; no independent agent review, push or publication.
Ready for coordinator review; record acceptance before DONE. No successor assigned.
