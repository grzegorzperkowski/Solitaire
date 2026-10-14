# T028 — previous/current SmartHint comparison, 2026-10-14

The new benchmark is ready for review. The current strategic revision performed
worse on reveals and repeated observations in this timed development sample.
There is no evidence here of improved deal completion: both versions won zero
within 100 moves. No production algorithm was changed or rolled back.

## Reproduce

```sh
npm run benchmark:hints
npm run benchmark:hints -- --profile=full --budget=time --output=.cache/hints-full-time.json
```

Quick: 5.66 s locally; seeds 0–2 in Draw1/3, 30 moves, 128 retained states,
depth12, both fixed-state and 20 ms active-time experiments, 12 shared positions.
Previous/current revealed the same totals: Draw1 14/14, Draw3 18/18, no wins
or repeated observations. Quick alone missed the quality regression below.

Full timed run: **1254.72 s (20 min 55 s)**, seeds 0–99 in each draw mode,
100 moves maximum, maxStates10000/maxDepth12, 100 ms active search budget.
All three algorithms use the same move engine and knowledge updates; only the
first suggested command executes before replanning. Warmup is outside measured
calls and execution order alternates. Timing excludes browser scheduler waits.
No unit suite/build ran concurrently with the full timing experiment.

Environment: Windows x64, Node v22.22.0, Intel Xeon W-10885M @ 2.40GHz.
Assignment base 5fbae4708c735cfb3ffe3f8198578bebadaeaa22, dirty task-owned worktree.
Previous planner: frozen 90fba4f336081367a8d28e25cde1b13d9923f227 with relocated
imports. Current: src/engine/smart-hints.js. All measured source hashes were
checked against the working files after the run: exact match after LF normalization.

## Full game results

Reveals and repeats are totals across 100 deals in each row. A repeat means the
same board AND knowledge; board-only returns are also stored separately in JSON.

| Mode | Planner | Wins | Reveals | Repeats | Moves | INCONCLUSIVE | MOVE_LIMIT | Median / p95 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Draw1 | rankHints | 0 | 424 | 8661 | 10000 | 0 | 100 | 0.07 / 0.20 |
| Draw1 | previous | 0 | 1246 | 119 | 8310 | 63 | 37 | 30.41 / 101.63 |
| Draw1 | current | 0 | 1167 | 665 | 7958 | 63 | 37 | 13.76 / 101.45 |
| Draw3 | rankHints | 0 | 421 | 8749 | 10000 | 0 | 100 | 0.08 / 0.18 |
| Draw3 | previous | 0 | 827 | 81 | 4907 | 93 | 7 | 37.06 / 101.33 |
| Draw3 | current | 0 | 773 | 243 | 4451 | 92 | 8 | 28.73 / 101.20 |

The current version revealed 133 fewer cards across 200 deals (1940 vs2073)
and returned to a repeated observation 908 times vs200. Per-deal paired reveals:
Draw1 current better/worse/equal 8/17/75; Draw3 3/12/85. No discordant wins,
so the conditional win-share confidence interval is absent, not a claim of equal
win strength. MOVE_LIMIT and INCONCLUSIVE remain unresolved, never losses.

| Mode | Planner | Calls | Median / p95 expanded states | Truncated | Time cutoffs | Preparation-only plans |
| --- | --- | ---: | --- | ---: | ---: | ---: |
| Draw1 | previous | 8373 | 7 / 88 | 3974 | 3585 | 215 |
| Draw1 | current | 8021 | 22 / 167 | 3261 | 3012 | 0 |
| Draw3 | previous | 5000 | 9 / 151 | 2831 | 1995 | 236 |
| Draw3 | current | 4543 | 46 / 214 | 2314 | 1692 | 0 |

Current produces no preparation-only plans, as intended by its goal contract,
but that did not translate into better play in this experiment. The metric
describes effects of the entire proposed plan, not just its executed first move.

## Identical-position comparison

100 shared positions: sampled unique start/middle/end-of-run observations from
both SmartHint trajectories, plus the replayed seed2284836135/cursor114 diagnostic.
End-of-run can be a move limit or inconclusive stop, not a finished game.
Both planners get precisely the same board and remembered cards in each pair.

| Planner | Median ms | p95 ms | Truncated calls | Preparation-only plans |
| --- | ---: | ---: | ---: | ---: |
| previous | 25.33 | 101.10 | 49/100 | 10 |
| current | 25.82 | 101.71 | 49/100 | 0 |

Median previous/current time ratio: **0.995x** (above1 would favor current).
This run shows no clear speed advantage on these positions. Lower medians over
different full game trajectories measure different workloads and do not establish
that one planner is intrinsically faster. Both found a real reveal/net-foundation
goal on the same55 cases; neither did on45. The first-choice comparison matched
89/100 pairs, including pairs where both returned an empty plan.

## Concrete regressions retained for follow-up

| Seed / mode | Previous reveals / repeats | Current reveals / repeats |
| --- | --- | --- |
| 89 / Draw1 | 19 / 0 | 7 / 68 |
| 76 / Draw1 | 21 / 0 | 11 / 67 |
| 35 / Draw3 | 14 / 0 | 4 / 56 |

Observed cycles move a card foundation→tableau→the same foundation across two
separate recommendations. This is an observation of executed commands; it does
not claim a diagnosed root cause inside the plan evaluator. Each individual
recommended plan passed independent legality and information-boundary checks.

[T028-benchmark-cycles.json](T028-benchmark-cycles.json) preserves all three
short cycle cases with exact prefixes, board and knowledge. Node assert replay
confirmed all52-card invariants and exact equality of board/knowledge at both
ends of each cycle. Replay these traces without running either planner to verify
the evidence cheaply. Time-budget search itself can choose differently on rerun.

## Artifacts, checks and limits

- Raw quick JSON: `.cache/hints-quick.json`, SHA256
  `a8a85ec2817484d306ac3fa592f82c846bebbbaef31d4c75eb73ccb26aa2091d`.
- Raw full JSON: `.cache/hints-full-time.json`, 29,585,632 bytes, SHA256
  `d8545911a53f66c968dc7e0910ca453f96f45d3364bb9e2dcc5bb6b503839221`.
- Raw files are local ignored artifacts. This summary and cycle evidence are
  tracked; reports store source hashes, exact options, histories and positions.
- `npm test -- tests/unit/benchmark-hints.test.js`: 13 PASS, 893 ms.
- `npm test`: 223 PASS /16 files, 24.03 s.
- `npm run build`: exit0, 33 modules; JS96.70 kB/gzip28.49, CSS16.50 kB/gzip4.11.

No full 100-seed fixed-state experiment, held-out evaluation, repeated timing
trials, extended strategic regression matrix, Firefox/WebKit or physical-device
timing was run. E2E was not rerun for this Node-only tooling change; the earlier
same-session existing application run had91 Chromium checks passing. No phone
100 ms guarantee or overall win-rate superiority is established.

T028 remains BLOCKED for strategic regressions/remaining acceptance gates. The
benchmark tool and its observations are ready for coordinator review. Algorithm
repair requires assignment; no successor, push or publication was performed.
