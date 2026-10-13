# T028 — supplied SmartHint proposal adaptation, 2026-10-13

Status: REVIEW, awaiting coordinator acceptance. Coordinator assigned implementation/adaptation and tests
with "możesz go zastosować (dostosuj jeśli trzeba) i zrobić testy na nim".
Start: master at 54d6c7e. T014 and T027 are DONE with recorded acceptance.
Unrelated untracked solitaire-stan-2284836135-draw1-114.json remains untouched.

## Scope / execution ledger

Use the supplied design as authorization to adapt the existing planner. Execute
sequentially under AGENTS.md; no worktrees or subagents. Changes must reach the
planner, focused fixtures/tests, specification/architecture/test contract and
task records. Existing app/UI/export callers consume the unchanged base result
and optional diagnostics, so no new UI or persistence fields are needed.

1. Add failing real-engine tests for short reveal selection, color-correct
   hidden-safe post-reveal estimates, diverse legal alternatives and strict limits.
2. Implement the smallest adaptation using existing engine/helpers and graph.
3. Run focused/full unit, build, applicable E2E and paired measurements; record
   exact results. Inspect staged changes, commit explicit task files, set REVIEW.

Ruling: retain positive U, exact column keys, atomic command limits and graph
verification. The replacement's score clamp, column sorting and extended depth
would regress established contracts. Macro moves/pruning need a reachability
proof before replacing the graph, whose complete exhaustion must stay sound.
Cost if wrong: reduced search speed versus the proposed macro search.

Prior external analysis and deferred v3 work remain distinct; this assignment
does not imply their acceptance or start another task.

## Delivered behavior

- Reused existing `rank`/`color`, immutable engine moves, boundary masking and
  exact progress keys. No runtime dependencies, game/save/F04 or UI changes.
- A single comparator selects partial/final/cached candidates: positive REVEAL
  before FOUNDATION_ADVANCE before INFORMATION. Reveals prefer H, short length,
  estimated utility, low B, U and insertion order. Other goals remain U-first.
  The real fixture with an unnecessary J♣ waste transfer now recommends one
  reveal command (U=116), rather than two commands (U=177).
- A knowledge-complement estimate uses known exposed tops and opposite colors;
  newly revealed tops stay excluded even if remembered. Empty pool gives zero.
  It breaks reveal ties, never changes U or reads unknown locations.
- Final recommendations include at most five distinct first-command/goal
  alternatives: the selected plan plus positive, locally verified information
  boundaries. All alternatives share final visited/truncated metadata. Existing
  UI/diagnostic export consumes the optional fields without caller changes.
- Updated REQUIREMENTS, ARCHITECTURE, TEST_PLAN and T028-spec consistently.

Ruling: no separate greedy plan deletion. Short-reveal ordering and existing
cheapest-state deduplication address the reproduced padding case; deleting from
every candidate would add replay work to a time-bounded generator without a
global shortest-path guarantee. Cost if wrong: some unseen shorter plans can
still be missed when the budget cuts search off.

Ruling: keep U-first order for foundation/information goals, unlike the supplied
length-first order for every category. This preserves the existing regression
for two real foundation advances. Cost if wrong: some foundation plans remain
longer than a smaller one-card advance.

Ruling: additional alternatives are boundary plans, not extra foundation graph
proofs. Shared verification budget and primary recommendation remain intact.
Cost if wrong: the diagnostics list is incomplete, particularly for foundation
alternatives; it is not a user-facing exhaustive chooser.

## Tests and checks actually run

| Command | Result |
| --- | --- |
| `npm test -- tests/unit/smart-hints-proposal.test.js` (corrected RED) | Exit 1: three expected failures — two-command/U177 padding instead of one/U116, missing estimate, missing alternatives. The first fixture draft duplicated Q♦ already on its foundation; corrected to stock J♣ before any runtime changes. |
| Same command (first GREEN) | Exit 0: 6/6. Later expanded to nine real-engine cases including reveal priority, estimate tie, remembered reveal exclusion and strict depths. |
| `npm test -- tests/unit/smart-hints-proposal.test.js tests/unit/smart-hints-graph.test.js tests/unit/smart-hints-bfs.test.js tests/unit/smart-hints-goal-endpoint.test.js tests/unit/smart-hints-continuation.test.js` | Exit 0: 58/58 at the six-case stage. |
| `npm test` | Exit 0: 297 tests in 22 files with all nine new cases. Includes 300 hidden permutations, seed21 anti-loop, plan continuation/abort, graph/BFS and exact cursor73 exhaustion (88,896 states). |
| `npm run build` | Exit 0; production bundle generated. |
| `npm run test:e2e` | Exit 0: all 98 Chromium checks, 22.3 s. Production preview, SmartHint gestures/highlights, save/Undo/Redo, keyboard/accessibility and 320px layout. |
| `node scripts/benchmark-hint-proposal.mjs \| Tee-Object -FilePath .project/reports/T028-proposal-benchmark.jsonl` | Exit 0. All plan replay/goal/score/local-acceptance/depth/state-budget assertions passed. |
| `git diff --check` | Exit 0; only standard LF→CRLF notices. Staged inspection/check recorded before commit. |

## Measurements (not a win-rate claim)

Baseline `54d6c7e`; Node v22.22.0, Windows x64. Seeds 0–99, Draw 1 and 3,
up to 100 executed commands per game, accumulated knowledge and remembered
plans. Deterministic measurement budget **300 states / depth 30, no time cut**;
not the app's 10000-state/100-ms defaults. Timing is desktop wall time on this
shared machine, not mobile calibration. Raw evidence:
[T028-proposal-benchmark.jsonl](T028-proposal-benchmark.jsonl).

| Mode | Before → after |
| --- | --- |
| Draw 1 | Reveals 1269→1413; steps 8114→7731; repeats 1→0; stops 63→66; wins 0→0. Calls 8177→7797; median 0.169→0.182 ms; p95 34.944→57.431 ms; truncated 8.13%→11.29%. |
| Draw 3 | Reveals 853→966; steps 4737→4471; repeats 0→0; stops 92→93; wins 0→0. Calls 4829→4564; median 0.149→0.156 ms; p95 21.675→40.163 ms; truncated 6.73%→11.42%. |

The 200 paired **initial** boards changed 38 plans, shortening 36. Draw1
paired median 0.145→0.167 ms, Draw3 0.146→0.161 ms; initial searches are small
(median one expansion), so these do not measure difficult late positions.
Trajectories diverge, have unequal lengths and stop counts; their p95 changes
also reflect different boards/verification, not just per-state overhead.
More reveals/fewer steps are observations under this budget, not a proof of
better strategy, speed or eventual win rate. The 100-command cap prevents
interpreting zero wins as unwinnability.

Paired full searches on the same H01/H04/H05/H09 fixtures additionally used
**10000 states / depth 30**, five runs per version, no controller time cut.
[T028-proposal-paired.json](T028-proposal-paired.json) records median times:
355.43→366.26, 695.64→702.45, 1227.43→1286.53, 63.13→69.23 ms, respectively.
Expansion counts match (2765/5151/7545/452). H09 shortens 4→1 commands;
other lengths are unchanged. The module loaded baseline via `git show` and
rewrote only its relative imports to current engine file URLs (as in the
benchmark script); ran each generator to completion on the same frozen fixture
and `visibleCards`, alternating baseline/current five times. Measurements
precede the final non-behavioral constant/diagnostic cleanup. No speedup claimed.

## Review / remaining limits / resume

Final review: author self-review, sequential per AGENTS.md (no subagents).
Checked complete callers, key/command indices, hidden-value masking including
remembered reveals, cancellation and graph rejection, candidate ordering,
alternative legality/metadata, bounded replay assertions and document consistency.
No new material unresolved defect found. This is weaker than independent review;
coordinator acceptance remains required by the project protocol.

Not implemented: proposed canonical column sorting, stock macros, foundation
return/inverse pruning, positive-score clamp, extended effectiveMaxCmds and
per-candidate greedy shortener. The proposal is adapted, not a verbatim swap.
No physical touch/Safari or production-budget 200-game/mobile latency study,
publication, push, save reset or unrelated changes. Prior v3 audit/acceptance
remain outstanding and are not silently marked complete here.

Resume only after coordinator assignment. Review this report and the task-owned
commit, then record explicit acceptance (date/approver/accepted SHA) or requested
changes. T028 stays REVIEW; no successor assigned. Keep unrelated untracked
solitaire-stan-2284836135-draw1-114.json. Delivery commit message:
`T028: adapt shorter smart hints and hidden-safe alternatives`.
