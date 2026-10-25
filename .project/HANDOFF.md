# T035 mobile regression REVIEW — 2026-10-25

Shared CSS fix keeps Menu inside short mobile viewports by scrolling the board rather than pushing down controls. Three raw-touch/viewport regressions and all 124 Chromium tests pass; build/lint pass (16 informational warnings). Coordinator explicitly authorized commit/push; do not mark DONE without acceptance. Preserve concurrent README.md/package.json changes and both diagnostic JSON files. See [report](reports/T035.md); physical Safari remains unverified.

# T035 mobile regression assignment — 2026-10-25

Resume T035 for reported mobile Menu disappearance. Reproduce viewport access without auto-scroll; fix shared layout and add regression. No other task/acceptance/push is implied; preserve unrelated diagnostics.

# T035 follow-up REVIEW — 2026-10-25

Knee-slide effect and full viewport-width scene implemented. Random slide includes run-up, knees down/folded shins, braking/recovery; uniform figure scaling follows resize. 435 unit/121 Chromium/build pass; lint 0 errors/16 warnings. See [report](reports/T035.md). Await coordinator review; no successor, push, dependencies or engine changes. Preserve both diagnostic JSON files; physical devices remain unverified.

# T035 follow-up assignment — 2026-10-25

Coordinator assigned run-up/knee slide/recovery and full viewport width. Resume T035 from `0e20525`, keep bottom-strip height and existing guards; no agents, dependencies, engine changes or push.

# T035 implementation REVIEW — 2026-10-25

Feature implemented on master: Menu → "Tańczący ludzik" (default off), three nonrepeating random dances with occasional run/jump phrases, saved boolean preference, reserved bottom strip, static reduced motion and pause/dialog/visibility/win/ownership cleanup. Full 429 unit/13 simulation/120 Chromium/build pass; final sampler 17/17, lint 0 errors/16 warnings. Production subpath and gzip budgets pass. Inspect [report](reports/T035.md) for exact commands and evidence gaps. Await coordinator acceptance; do not start a successor. No push/dependencies/engine changes; preserve both unrelated diagnostic JSON files. Local visual diagnostics are under ignored `.cache/T035-*`.

# T035 implementation assignment — 2026-10-25

Implementation explicitly assigned: optional SVG companion with random dances plus occasional running/jumping. Resume T035 on master from `006acb2`; previous documentation-only stop is superseded. Use Context7, preserve game contracts and both unrelated diagnostic JSON files. No agents/worktrees/dependencies/push.

# T035 REVIEW — 2026-10-25

Read [T035 design](tasks/T035-design.md) for the proposed dancing companion and [report](reports/T035.md) for research/verification evidence. This assignment ends at research and technical design; no application code was changed. A subsequent explicit implementation assignment is required. Primary risks: short-landscape space and believable foot contact. Prior REVIEW tasks remain unchanged. No agents, worktrees, dependencies, push or publication; preserve both unrelated diagnostic JSON files.

# T034 REVIEW — 2026-10-21

Five-function refactoring delivered sequentially: cb1789c keyboard; ace986d renderer; 1542472 persistence; 1b8ac09 arrow navigation; final T034 commit publishes SmartHint result helpers and evidence. Final 403 unit/13 simulation/107 Chromium E2E/build pass; 315 restore cases and 108 complete planner traces unchanged; lint 0 errors/16 informational warnings. No strategy/rules/schema changes or measured speed claim. Await acceptance; no push, agents, worktrees or device check. Preserve both unrelated diagnostic JSON files; prior REVIEW tasks remain unchanged. See reports/T034.md.

# T033 REVIEW — 2026-10-21

Four follow-up audit items delivered sequentially on master. Victory guard b78e00e; nested restored commands 0a344ca; final task commit adds unused-code cleanup and lint/CI. RED/GREEN regressions plus final 403 unit/13 simulation/106 Chromium E2E/build pass; lint 0 errors/15 informational complexity/nesting warnings and actionlint clean. Node 22 minimum 22.13; current 22.22 works. Await coordinator acceptance. No broad refactor, agents, worktrees, push, hosted workflow or physical-device verification. Preserve both diagnostic JSON files; see reports/T033.md.

# T016 REVIEW — 2026-10-21

Safe completion delivered with approved nonempty-waste preflight, 140ms card travel / 160ms command cadence and no separate cancel button. Real cursor-126 save wins in 15 commands. Final 401 unit / 13 simulation / 106 Chromium E2E / production build pass; 320px and travel screenshots inspected. Await coordinator acceptance. No push or physical-device evidence; both unrelated diagnostic JSON files preserved. See reports/T016.md.

# Fresh-session handoff

T032 REVIEW (2026-10-21): #1–#7 repaired and committed sequentially; report lists commits and RED/GREEN evidence. Final 384 unit/13 simulation/101 E2E/build pass; actionlint clean. Await acceptance; no push/successor. After explicit push, verify combined CI → tested artifact → Pages execution. Physical devices remain unverified. Preserve both diagnostic JSON files; see reports/T032.md.

T031 REVIEW (2026-10-21): seven-finding audit in reports/T031.md, normalized ESLint and probe JSON evidence committed beside it. Temporary CLI reports/reproduction script in `.cache/T031-*`. No fixes applied. Await coordinator acceptance and explicit selection of implementation scope; no successor or push. T030 final CI 39663303115/Pages pass. Preserve both untracked diagnostic JSON files.

T030 REVIEW (2026-10-21): delivery `fc36075` pushed. CI fetches full history for experiment loaders; html uses manipulation while face-up/selected cards retain pinch-zoom for native touch drag. 379 unit/13 simulation/98 E2E/build pass locally, GitHub CI 39662907837 passes, Pages deployment 39662907417 succeeds. Await coordinator acceptance; physical pinch/zoom evidence remains unavailable. See report; preserve both untracked diagnostic JSON files.

T030 REVIEW (2026-10-21): double-tap zoom prevention for buttons/face-up cards complete. Build and 34 targeted E2E tests pass. See `.project/reports/T030.md`; await coordinator acceptance. Physical-device zoom/drag verification remains unavailable. Preserve unrelated `solitaire-stan-2284836135-draw1-114.json` and `solitaire-stan-42-draw1-89.json`.

T028 DONE (2026-10-21): coordinator accepted X1/X2 R&D at `8a129043fb13abded404074648dd9fa397c7707e`; X2 remains rejected for production.

T028 REVIEW (2026-10-16): X1/X2 R&D complete. X1:30 switches, legal recovery witness at93; final B142 remains UNKNOWN. X2 control/variant wins11/13 on40 exploratory pairs,37/35 on80 validation pairs (1 gain,3 losses); reject production promotion.379 unit tests/build and diagnostic replay checks pass. Runtime unchanged; no push/successor. See [report](reports/T028-x1-x2-rd.md). User requested shutdown after completion.

T028 REVIEW (2026-10-16): E1 fallback R&D complete. Fallback/control wins9/11 at512+512 vs1024,11/11 at2048+2048 vs4096 (40 paired deals each);373 tests/build pass. B reachability100000 remains UNKNOWN; both forced first-choice branches win184. Production unchanged, no push/successor. See [report](reports/T028-fallback-rd.md).

T028 REVIEW (2026-10-15): external-LLM handoff ready: SMART_HINT_RND_FEEDBACK.md, SMART_HINT_BFS_CODE.md and .project/reports/T028-bfs-diagnostics.json. Six standalone-source probes reproduce exact results; both search orders have same-position coverage counterexamples. See [report](reports/T028-bfs-handoff.md). Runtime unchanged; await external feedback/coordinator assignment, preserve both untracked JSON files; no push or successor.

T028 REVIEW (2026-10-15): FIFO/BFS R&D finished. See [report](reports/T028-bfs-rd.md) and `scripts/experiments/smart-hint-bfs.mjs`; implementation checkpoint 6176477. 180 whole-game trajectories: FIFO wins 3 vs baseline 9 at 512, 3 vs 11 at 2048 (40 paired deals each), 1 vs 4 at 10000 (10-deal subset). 367 tests/build pass. Preserve production planner and both untracked diagnostic JSON files; no push/successor or DONE without explicit acceptance. No unfinished benchmark.

T028 REVIEW (2026-10-15): partial external proposal adapted with reconstructed history/high-water goals and verified plan commitments; rejected worse-performing trial weights. Final337 unit/98 Chromium/build pass. Held-out40 deals:15 wins before/after,8 fewer commands,0 same-knowledge repeats; seed42 wins in137. See [report](reports/T028-belief-planner.md). Await acceptance; no push/successor; both untracked diagnostics preserved.

## T028 browser-chat prompt delivered — 2026-10-15

REVIEW: SMART_HINT_PROMPT.md is self-contained (21,082 UTF-8 bytes), with data/command/API contracts, information boundaries, implementation-level pseudocode requirements and explicit whole-game/cross-request cycle criteria. Allows proposing a minimal plannerContext extension and new strategy; does not impose current weights or speed budgets. Static document checks and diff checks passed; no runtime tests needed for this documentation change. Await coordinator review; no successor or push. Both untracked diagnostic JSON files preserved.

## T028 browser-chat prompt assignment — 2026-10-15

Coordinator approved a detailed algorithm design with implementation-level pseudocode, not full JavaScript. Rewrite SMART_HINT_PROMPT.md so the external AI needs no repository access. Prioritize whole-game quality and cross-request cycle prevention; speed tuning is deferred. Preserve both untracked diagnostic JSON files; no runtime changes or successor.

## Current T028 integration — 2026-10-14

REVIEW: 325 unit tests, 98 Chromium E2E and build passed. Full three-planner comparison completed: 200 deals each, 105 shared boards, 100-ms budget. Integrated2588 reveals vs advanced2583/repaired2442; 0 observed same-knowledge cycles, wins0 under100 actions. Report/summary record sources and raw evidence. Acceptance pending; push explicitly authorized by coordinator. No successor.

Coordinator approved merging both local histories and selected C:\Sources\MyProjets\Solitaire. Start 2447cff; merge parent 5320616; common bdad66c. Keep advanced app features and checkpoint, integrate planner repairs and benchmark evidence. Full checks and three-planner comparison authorized; earlier basic-only restriction superseded. Preserve unrelated untracked cursor114 JSON and the other checkout. See reports/T028-integration.md for current state, commands and resume steps. No successor assigned.

## T028 p95 / shorter goals — checkpoint, 2026-10-13

Implemented cache/mask estimator with single-benefit precedence, shared
verification, field-based keys, length-first information and F/B/length-first
foundation selection. Cooperative final-only shortener preserves goals/boundary
and graph-proof scope. 36 distinct focused checks plus production build passed.
Coordinator requested only very basic checks tonight: full unit, E2E, benchmark
and shortener property/performance coverage remain. Keep IN_PROGRESS; no speed
or quality claim, no push/successor. Resume only on coordinator assignment.
See reports/T028-p95-checkpoint.md. Preserve unrelated cursor-114 JSON/prior v3 work.

## T028 p95 / shorter goals — assignment, 2026-10-13

Coordinator supplied step1/step2 optimization instructions and resumed T028.
Start master at 7a36c30, accepted dependencies T014/T027; only unrelated
untracked solitaire-stan-2284836135-draw1-114.json. Then: "bez testów na razie",
revised to "albo jakieś bardzo podstawowe - jest już późno idę spać". Perform
basic focused checks/build only; defer full suite, E2E and 200-game benchmark.
Do not claim lower p95 or <0.1ms shortener cost without later measurement.
Sequential work, no branch/subagents/push/publication. See reports/T028-p95-checkpoint.md.

## T028 supplied proposal — delivery, 2026-10-13

REVIEW: shorter positive reveal ordering, knowledge-complement/color-correct
estimate and up to five safe diagnostic alternatives. Exact keys, positive U,
strict atomic budgets and graph checks remain. 297 full unit tests, 98 Chromium
E2E and build passed. Paired seeds0–99/Draw1+3, max100 commands at 300 states:
more reveals/fewer steps and zero repeats after adaptation, but higher p95/cut
rates; no win-rate/speed guarantee. Four paired default-state-budget fixtures
have matching expansion counts; H09 shortens 4→1 commands. See
reports/T028-proposal-adaptation.md and raw JSON evidence. Await acceptance;
no push/successor, physical Safari/mobile latency or production-budget full
game calibration. Preserve unrelated untracked cursor-114 JSON and prior v3 scope.

## T028 supplied proposal — assignment, 2026-10-13

Coordinator: "możesz go zastosować (dostosuj jeśli trzeba) i zrobić testy na nim",
with replacement SmartHint code. Resume T028 on master at 54d6c7e; T014/T027
dependencies are accepted. Adapt useful ideas without removing information
boundaries, positive-score anti-loop guard, strict command/state limits or graph
verification. No parallel agents, branch, publication or save/rules change.
Preserve unrelated untracked solitaire-stan-2284836135-draw1-114.json.
Evidence/resume notes: reports/T028-proposal-adaptation.md.

## T028 external analysis checked — delivery, 2026-10-13

No current runtime defect reproduced from the eight-point analysis. Historical
cuts can resolve; H/F/I metadata is state-relative; U>0, dead-continuation
rejection and local UNPROVEN cancellation are explicit existing policies.
Proposed masking instead scores a remembered newly revealed card (M=1 versus
required M=0). Added two seed0/44 guard cases; 101 focused tests passed. Fresh
cursor73 baseline/current/BFS all exhaust 88,896 states, zero goals, no cuts at
debug 250000/100. See reports/T028-external-analysis-check.md. REVIEW awaiting
acceptance; runtime unchanged, no push, full/build/E2E/calibration unrun and
deferred v3 scope preserved. Keep unrelated untracked cursor-114 JSON.

## T028 external eight-point analysis — assignment, 2026-10-13

Coordinator: "musimy trochę poprawić smart hint", with external findings and a
four-part proposed diff. Resume T028 sequentially on master at 86896dc. Check
claims against current specification, graph regressions and cursor-73 BFS;
repair reproduced defects only. Existing contract deliberately permits local
UNPROVEN partial recommendations and requires U>0. Preserve unrelated untracked
solitaire-stan-2284836135-draw1-114.json; no push or successor assigned.

## T028 A78→B79 delivery — 2026-10-13

A falsely stretched an already achieved foundation goal into 17 commands
through W-scored preparations. Recommendations now end on an H/F/I-increasing
edge; preparation still expands for further goals. Exact A cancellation at 666
expansions yields one 4♣ foundation move, U=36. B is exactly its successor;
independent BFS and full SmartHint both exhaust 88,896 states with zero goals.
88 focused tests passed. See reports/T028-goal-endpoint-fix.md. REVIEW awaiting
acceptance; full/build/E2E and remaining v3 scope deferred. Preserve the two
unrelated pre-staged seed fixtures and original untracked diagnostics; no push.

## T028 continuation repair delivery — 2026-10-13

Coordinator explicitly assigned both confirmed repairs. Rejected continuation
tails now fall back to search; pre-aborted signals skip continuation and return
the existing CANCELLED result. 33 graph/app/reproduction tests and 22 filtered
engine tests passed; staged planner with HEAD dependencies also passed both
scenarios. Only continuation/helper API hunks are committed, leaving pending
key/depth/controller/spec/script/test/fixture work intact. See
reports/T028-continuation-fix.md. REVIEW for this limited follow-up, awaiting
acceptance. Full checks and remaining v3 audit deferred; no push assigned.

## T028 continuation reproduction — 2026-10-13

Coordinator assigned tests only, with repairs later if confirmed. New
`tests/unit/smart-hints-continuation.test.js` has two expected RED assertions:
rejected DEAD_END tail published as FOUND, and pre-aborted signal ignored by
continuation. Real boards/engine, no mocks. See reports/T028-continuation-reproduction.md.
No algorithm edits; existing uncommitted implementation/tests/spec/script and
untracked diagnostic/fixtures preserved. Parent T028 IN_PROGRESS; resume repairs
only on explicit assignment. Full suite/build/E2E unrun; no new push assigned.

## T028 v3 checkpoint — 2026-10-12

Coordinator resumed the six-item final audit and measured optimization. Preserve
fc7b658, existing limits/weights and unrelated CSS/accessibility edits/JSON.
IN_PROGRESS, sequentially on master. Coordinator then requested skipping full
tests and commit/push only. Checkpoint repairs ancestor cycles, cutoff publication
and repeated dead-proof verification; legal-move enumeration improved measured
cursor-73 median from 29.535 s to 11.922 s with identical counts/status. 81 focused
tests passed. Broader property coverage, full checks and contract documentation
remain; resume only on explicit assignment. See reports/T028-v3-audit.md.

## T028 graph audit delivery — 2026-10-12

Coordinator accepted `c677cad` (stale queue/H07) and explicitly resumed T028:
regressions for resolved depth cutoffs, root-return cycles in final verification,
candidate/cancellation retention, expansion counting and failed replay;
independent full-mechanics-key BFS and before/after cursor-73 comparison.
Delivered with regressions: resolved cuts, root-detour rejection, retained goal
metadata, cancellation fallback, exact expansions and replay guard. Full unit
265 passed, final focused graph/BFS 41 passed, Chromium E2E 45 passed, build
passed. 28 small real graphs and cursor 73 agree with full-key FIFO BFS.
Cursor 73: before/after/BFS 88,896 states, zero goals, no truncation.
See `.project/reports/T028-graph-audit.md` and the JSONL evidence. REVIEW on
master, awaiting acceptance; do not start another task. Keep limits/weights;
preserve unrelated CSS/accessibility edits and the untracked cursor-114 JSON.

## T028 SmartHint findings — 2026-10-12

Coordinator resumed T028 with “do roboty” after providing external findings.
Fixed stale priority-queue expansions and false depth truncation of a cycle;
focused/full unit tests, relevant E2E, build, and a 10-seed post-fix smoke
benchmark pass. Cursor-73 still exhausts 88,896 states with no goal. Follow-up
is REVIEW; full 100-seed benchmark was not repeated after this change. Preserve
unrelated edits in `src/styles.css`, `tests/e2e/accessibility.spec.js` and
untracked `solitaire-stan-2284836135-draw1-114.json`. See
`.project/reports/T028.md`.

## T028 model-facing planner guide — 2026-10-12

Coordinator resumed T028 to document the already-isolated
`src/engine/smart-hints.js` for external model-assisted analysis. Add a useful
module comment: plain JavaScript ES modules, no TypeScript/types; entry points,
state/card conventions, engine/knowledge boundaries, result meanings, and
relevant tests/spec/benchmark. The comment is complete; syntax and diff checks
pass. No algorithm behavior changed. Task is REVIEW; preserve unrelated dirty
files and diagnostic JSON.

## T028 external cancellation and long debug run — 2026-10-12

Coordinator resumed T028 to let an external AbortSignal cancel SmartHint while
retaining a safe best-so-far result. Focused tests/build pass. The cursor-73
search completed naturally: 88,896 states, untruncated
NO_STRATEGIC_PROGRESS (no strategic or information candidates). This does not
prove deal unwinnability. The follow-up is REVIEW; see `.project/reports/T028.md`.
Preserve unrelated changes and diagnostic JSON.

## T028 debug search budgets — 2026-10-12

Coordinator resumed T028 to parameterize SmartHint limits for debug analysis.
`createApp` now accepts `hintActiveMs` and `hintBatchMs`, retaining 100 ms / 4 ms
defaults; diagnostic JSON records the configured values. The focused controller
suite (10 tests), build and diff check pass. Task is REVIEW pending coordinator
acceptance. Preserve unrelated dirty files and untracked diagnostic save; see
the latest section of `.project/reports/T028.md`.

## T029 random victory animations — 2026-10-12

T029 is DONE, accepted by the human coordinator on 2026-10-12 at `2ea1a1e`. The progress replay E2E uses an explicit fixture-only analysis budget, while production keeps its 100 ms active-work cutoff. Unit tests (220), full Chromium E2E (98, default eight workers), stress replay (8/8) and production build pass. Preview: `http://localhost:5186/tests/harness/victory.html`. Preserve unrelated root file `solitaire-stan-2284836135-draw1-114.json`. Scope/evidence: `.project/tasks/T029.md` and `.project/reports/T029.md`.

T028 was accepted by the coordinator (“close T028”) on 2026-10-12 at `4a7a6fdb0a9065de753d23b9d71bcb3e8c661390`.

## T028 accepted — 2026-10-12

T028 is DONE, accepted by the human coordinator at
`4a7a6fdb0a9065de753d23b9d71bcb3e8c661390`. Help and Hint buttons use
`touch-action: manipulation` to suppress double-tap zoom while retaining pinch
zoom. Build and the 11-test accessibility E2E suite passed. No physical-device
Safari/Android check. Preserve the untracked root diagnostic JSON.

## T028 benchmark and speed follow-up delivered — 2026-10-12

The §8 benchmark ran seeds 0–99
for Draw 1 and Draw 3 against `rankHints`, with the app's 100 ms active search
budget. Paired revision timing covers the same 200 initial boards, baseline
planner from `276714c`, and current worktree. SmartHint reused generated legal
moves instead of rescanning each expanded state; focused test, all 214 unit
tests and build pass. Full measurements and limits: `.project/reports/T028.md`.
No physical-device latency check, push or publication.

## T028 benchmark assignment — 2026-10-12

Coordinator resumed T028: run and report the outstanding SmartHint quality
benchmark. Preserve the existing root diagnostic JSON untracked and unchanged.
Task is IN_PROGRESS on master at `3594a20`; no other task or publication.

## T028 completed SmartHint search status — 2026-10-11

When configured search finishes with `truncated:false` and no strategic or
information candidate, SmartHint returns NO_STRATEGIC_PROGRESS with null
recommendedMove and empty plan; depth/state/time cutoffs remain
INCONCLUSIVE/truncated. Cursor-114 default depth12 visits250 and is truncated;
depth16/maxStates10000 exhausts 256 and returns NO_STRATEGIC_PROGRESS. UI
message suggests Undo/alternate route if history exists, otherwise new game.
Focused unit suite 34/34 and production build pass. Benchmark remains pending;
T028 remains BLOCKED. See `.project/reports/T028.md`.

## T028 cursor-114 SmartHint regression — 2026-10-11

The exported save fixture now has a SmartHint regression: default-budget search
returns INCONCLUSIVE/LIMIT_REACHED with an empty plan and `truncated:true`,
without promoting waste preparation to progress. Focused unit command passed
24 tests. This is distinct from the completed F04 result (NO_PROGRESS after
256 known states); the SmartHint result remains uncertain. Benchmark still
outstanding and T028 remains BLOCKED. No E2E/build or benchmark run.

## Latest T028 F04 delivery — 2026-10-11

F04 now recognizes post-action REVEAL, net FOUNDATION_ADVANCE and newly visible
INFORMATION; waste transfer, known draw and foundation round trips remain BFS
preparation. User save seed2284836135/Draw1/cursor114 now returns NO_PROGRESS,
visitedStates256, noLegalMoves=false (baseline export PROGRESS_FOUND/76). Unit
suite 212/212, progress E2E 14/14, production build and diff-check pass. Benchmark
still skipped per coordinator instruction; T028 remains BLOCKED. See top of
reports/T028.md for exact reproduction and five available actions. No push.


## Strategic-goal implementation checkpoint — 2026-10-11

T028 BLOCKED: primary goals, score components, end verification and graph-based
rejection of known dead continuations implemented on master. No other task.
Independent baseline: fixture seed2284836135/cursor114 has 52 cards, five legal
actions, F04 PROGRESS_FOUND and 256 known states without strategic goal.
See reports/T028-strategic-analysis.md for components, board and reproduction.
Coordinator explicitly skipped tests and benchmark; no post-change search run,
new regression matrix or quality/performance claim. Production build succeeded.
Updated H05/profile assertions are unrun. Rules/F04/save schema unchanged.
Resume only when assigned: new regressions and paired previous/new measurements.
Checkpoint: `T028: separate strategic goals from waste preparation`; no push.

## Strategic-goal revision assignment — 2026-10-11

Coordinator explicitly resumed T028: distinguish primary strategic goals from
preparation, verify terminal states, preserve F04/hidden-information contracts,
add replay regression and compare seeds 0–99 in both draw modes. Base `90fba4f`,
master, initially clean; T014/T027 approved DONE. No other task assigned.
Sequential plan: independent replay/exhaustive known-state check; RED goal and
verification regressions; planner/UI diagnostics; GREEN/full checks; paired
old/new benchmark and report; inspect explicit staging, commit, REVIEW.


## T028 diagnostic export delivery — 2026-10-11

Menu → "Zapisz stan do analizy" downloads JSON; reproduce using
`restoreSession(JSON.stringify(diagnostic.save))`. Includes history/Undo cursor,
knowledge, mode, hint/progress, budgets and build. Local save remains intact.
Focused tests: 3 unit and 2 browser PASS; already-running full unit suite:
210 PASS / 15 files. Coordinator requested commit without further tests;
production build, broader E2E and real-device checks not rerun. See report.
T028 BLOCKED on full §8 benchmark; no next task assigned, no push/publication.
Delivery commit: `T028: export replayable game state for hint diagnostics`.

## T028 diagnostic export assignment — 2026-10-11

Coordinator approved the bounded design: menu action "Zapisz stan do analizy"
downloads JSON with replayable session/history/cursor/knownCards/draw mode,
current hint and application build. IN_PROGRESS, master `276714c`, clean tree.
Reuse schema-v2 serializeSession/restoreSession; diagnostic wrapper is separate.
Test round-trip and real browser download before implementation, preserve local
save/history/statistics, report Polish failures. No in-game import, rule changes,
parallel agents or publication. Full quality benchmark remains outstanding.

## T028 H05 profiling delivery — 2026-10-11

Root possibilities computed once per search instead of once per successor.
Regression RED (93 scans) → GREEN (at most two). Native CPU profiles and
reproduction in reports/T028-h05-profile.md; unprofiled median 6856.99→4735.99 ms,
same full H05 result and 200 initial-board results. 207 unit tests/build PASS.
60 targeted Chromium checks PASS; delivery is the `T028: reuse root mobility
after H05 CPU profiling` commit. Working/staged diff checks and self-review done.
No lowered budgets, increased timeout, rule/save change, push or publication.
BLOCKED for missing full §8 strategy benchmark; no successor assigned.

## T028 H05 profiling assignment — 2026-10-11

IN_PROGRESS, Codex, master at `7ad80f2`, clean initial tree. Coordinator requests
profiling H05 to identify and remove a measured bottleneck. Preserve planner
results, budgets, rules, information boundaries and existing timeouts. Capture
baseline CPU profile and timings, add a failing regression for avoidable work,
optimize minimally, compare and run checks. Full §8 quality benchmark remains
outside this follow-up; no parallel agents, branches, worktrees or publication.

## T028 review regression delivery — 2026-10-11

Coordinator resumed T028 for test-first repair of hidden-tableau scoring and
retained-state limits. Both fixed: four regressions failed first, two passed
after masking, all four passed after the cap fix. Final 206 unit tests, 60
targeted Chromium checks and build passed. Initial H05 timeout is recorded;
isolated H05 and final full unit rerun passed with unchanged timeouts.
BLOCKED only for missing full §8 benchmark evidence (100 seeds per mode and
same-position timing). Repairs are ready for review; not coordinator accepted.
Resume only on assignment; see reports/T028.md. No successor or publication.

## Resume protocol

1. Read [AGENTS.md](../AGENTS.md), [STATUS.md](STATUS.md) and this file.
2. Confirm the human's explicit task ID; read its specification in `tasks/`, existing report in `reports/`, and dependency/status row in [TASKS.md](TASKS.md). No assignment means stop and wait.
3. Run `git status --short`, `git branch --show-current`, `git log -5 --oneline`; inspect task-owned unfinished changes. Preserve unrelated dirty files.
4. Read the task's referenced root design/test sections and relevant [DECISIONS.md](DECISIONS.md). Do not rely on past chat context.
5. Perform only the assigned task, verify it, update report/status/handoff, commit with its ID and stop at REVIEW or a documented blocker.

## Current state and recent changes

- T000 DONE: eba965185ef8a60edf81f0318ab0fbf3481604f8.
- T001 DONE: accepted 2026-10-10. Implementation commit `339e0f852b60c691f52d6204aa7225b899c5844f`.
- T002 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation commit `d3c36f1df1d46d136e81d8c174f1636debed8a76`. Acceptance tracking commit: `2064a3da002e11209e463365c4d4a425980f5226`.
- T003 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `774b3e634e2b6991a91c4e24952b1919b0e4a484`. Accepted quality improvements `75070087cb4d49db1323467f8a7efb1737d325c0`. DOM-free `validateMove`, `applyMove`, `assertInvariants` and `isWon` in `src/engine/game.js`. Evidence: [reports/T003.md](reports/T003.md).
- Foundations use suit order trefl, karo, kier, pik. Tableau `cardIndex` starts the whole face-up suffix. A reveal is the newly exposed card id on that same move, or null. `isWon` requires four complete legal foundations and empty stock, waste and tableau.
- `assertInvariants` throws `invalid-state` for broken decks, face-up order and foundation contents. Move evaluation does not call it; tests and later restore do.
- Golden deals remain in `tests/fixtures/deals.json`. Hand-built boards are `tests/fixtures/boards.js`.
- T004 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `1073dfb1828dff1944713c616c9019cfcdc14056`. Independent review `2af3ee4fead49ceab3d9d3cc9143c69c568429f4`. Evidence: [reports/T004.md](reports/T004.md). Acceptance tracking for T003 is `70eee4ebedc27879b83087448b33de647c62e4f9`.
- Stock and waste are bottom at index 0. Draw pops the stock top onto the waste up to `drawCount` (1 or 3); a short stock moves only the remainder. Recycle reverses the remaining waste into the stock and does not draw. Example: stock `[D,C,B,A]` draw 3 → waste `[A,B,C]`, stock `[D]`. Recycle `[A,B,C]` → stock `[C,B,A]`. Played waste cards are absent from that stock.
- Failed draw/recycle preconditions return `illegal-source`. Extra command fields return `invalid-command`. `drawCount` other than 1 or 3 returns `invalid-state`. `unsupported-command` is no longer produced.
- `getLegalMoves` scan order is draw, recycle, tableau columns 0..6 and face-up `cardIndex` ascending, waste, foundations 0..3. Destinations are tableau 0..6 then foundation 0..3. T014 ranks this list by reveal, foundation, transfer, then draw/recycle while preserving scan order for ties. Empty legal list is not a loss.
- The page shell does not import the engine. No session, storage or Playwright.
- QA still open, not passed: browser console and visual/layout checks. GitHub Actions has not run on a remote runner. `filelist.txt` is absent; do not recreate it.
- Node 22.22.0 / npm 10.9.4; Vite 8.3.4, Vitest and coverage-v8 5.0.3. Zero runtime dependencies.
- Resolve T003 implementation with `774b3e634e2b6991a91c4e24952b1919b0e4a484` and quality improvements with `75070087cb4d49db1323467f8a7efb1737d325c0`. Resolve T004 implementation with `1073dfb1828dff1944713c616c9019cfcdc14056`.
- T005 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `509fe7b911ce6d336bd55bfdc362778e93fd0cc1`. Evidence: [reports/T005.md](reports/T005.md). `scripts/run-simulation.mjs` runs the CI profile (seeds 0–999 in Draw 1 and Draw 3, plus seed 4294967295, at most 300 steps) through Vitest.
- T006 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `63b28ce3ee585ee8f243aca37e382e1f2f74983d`. `src/session.js` implements session timeline, Undo/Redo, snapshot caching, attempt restart, per-mode statistics, elapsedMs independence of Undo, and simulation extended to history operations. Evidence: [reports/T006.md](reports/T006.md).
- Passing CI counts, not a win rate: 2002 deals, 600427 steps, 3 wins, 0 stuck, 1999 step bounds. Categories: draw 222976, recycle 19046, tableau 166361, waste 14072, foundation 58227, invalid 119745. Won seeds: 827 Draw 1, 681 Draw 3, 888 Draw 3.
- T007 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `a4b2f853598d6020caac4cd97938a7b8ff8b97d2`. `src/persistence.js` implements schema-v1 serialization, restore, pure-engine replay validation including redo tail, storage error and quota handling, byte retention on failure, defensive limits (1 MiB UTF-8, 10,000 commands), and simulation round trips. Evidence: [reports/T007.md](reports/T007.md). Acceptance tracking commit: `1249707`.
- T008 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `a1a7567`. `src/app.js` implements application controller connecting session timeline and persistence, active-time measurement via `performance.now()`, pause/dialog/visibility suppression, 5s checkpoints and `pagehide` saves, Web Locks single-writer ownership (`pl.solitaire.writer`) and storage revision conflict fallback. Playwright E2E infrastructure and tests in `tests/e2e/storage.spec.js`. Evidence: [reports/T008.md](reports/T008.md). Acceptance tracking commit: `b3f1a48`.
- T009 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `ae85d6b`. `src/ui/layout.js`, `src/ui/cards.js`, `src/ui/render.js`, `src/styles.css` implement responsive mobile-first board (320–430px portrait with zero horizontal scroll), SVG cards with >=14px corner ranks and >=24px exposed bands, N02 strict face-down card concealment, 2-column waste with Draw 3 fan, tableau scroller with 44px scroll handle and accessible buttons for long columns, and 44x44px bottom controls. Evidence: [reports/T009.md](reports/T009.md). Acceptance tracking commit: `ce965e0`.
- T010 original implementation DONE: accepted 2026-10-10 at `bdd275c`. Follow-up dialog-focus assertion revision accepted 2026-10-10 at `496f33f`: Playwright now waits for the first menu button to receive focus. Validation: 20 repeated focus checks, 123 unit tests, and 55 preview E2E tests passed. See [reports/T010.md](reports/T010.md).
- T011 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `fa1aa9c`. Polish game menu, New Game, Restart, Pause and Help dialogs implemented in `src/ui/dialogs.js`, with replacement confirmation on started unwon attempts (F05), pause concealment (F07), Draw 1 / Draw 3 toggle, Polish rules (N02), focus trap and restoration (N01 / T18), and full responsive support at 320px width and landscape (568x320). Evidence: [reports/T011.md](reports/T011.md). Acceptance tracking commit: `6610e7d`.
- T012 DONE: accepted by the human coordinator on 2026-10-10 at `916b3bd`; see [reports/T012.md](reports/T012.md).
- T013 DONE: physical checks on iPhone 15 and Android 12 found no problems; accepted 2026-10-10 at `916b3bd`. iOS/browser versions were not supplied; see [reports/T013.md](reports/T013.md).
- T014 DONE: accepted 2026-10-10 by the human coordinator at commit `6149f52`. Empty-action feedback and legal-hint ranking are implemented; the full preview suite passes. See [reports/T014.md](reports/T014.md).
- P1–P6 are complete. P7 is in progress.

## Blockers / next steps

- T009 and T010 follow-ups are accepted. T015 is now REVIEW; see reports/T015.md.
- A user can play a complete game on mobile and desktop via tap, keyboard, and drag & drop.
- Current task: none. T015 is DONE after coordinator acceptance; no successor assigned.
- Remote GitHub Actions CI has not run on a remote runner.
- `getLegalMoves` assumes tableau columns have `cards` and `faceUpStart`. A null column can throw. An unreadable board returns `[]`. The accepted review calls that non-blocking.

## Test commands

Available now: `npm ci`, `npm test` (vitest run, non-watch), `npm run test:e2e` (playwright test), `npm run test:coverage`, `npm run test:simulation -- --profile=ci`, `npm run build`. The release profile is `npm run test:simulation -- --profile=release` and is a T022 gate. See [README.md](../README.md).

Latest local results are in [reports/T014.md](reports/T014.md): `npm test` 123 passed across 9 files; `npm run test:e2e -- tests/e2e/play.spec.js` 12 passed in Chromium; `npm run build` exit 0 (JS bundle 73.66 kB, gzip 20.61 kB, CSS 11.97 kB, gzip 3.12 kB).

Before committing run `git diff --check` and `git diff --cached --check`. Do not report unexecuted browser, device or GitHub Actions checks as passed.

## T009 classical court artwork trial history (2026-10-10)

User approved the proposed classical J/Q/K illustrations and will review on their running development server. Twelve local public-domain SVG illustrations now replace letter badges. Card clipping follows SVG corner proportions and shadows are softer. See reports/T009.md. Status REVIEW; no deployment or push.

Latest T009 visual adjustment: enlarged J/Q/K illustration to 52x84 SVG units; upper index retained, lower duplicate omitted on court cards. Build and browser smoke checks passed; user review remains pending.

T009 latest refinement: user requested less space above court artwork; y moved from 50 to 44 SVG units. Build passed; awaiting visual review.

Latest T009 request: another approximately 1 CSS px upward nudge (SVG y=42), commit and push authorized. Build passed; user will review on iPhone.

## Follow-up acceptance (2026-10-10)

The human coordinator explicitly closed T009 and T010: “Zamykamy, wszystko działa!” Accepted T009 follow-ups through `ccc955641043bcbd68bba784b29bcaa2540a0b5c` and T010 focus-test correction `496f33f68320bfa2a639761888cb88434563157f`. Both are DONE; the historical review-pending notes above are superseded. No new device/browser version details were supplied. T015 remains TODO and unassigned.

## T015 assignment (2026-10-10)

T015 explicitly assigned: implementujemy teraz T015. IN_PROGRESS on master from 98bada8; initial worktree clean. T014 DONE/accepted at 6149f52. Only T015 is authorized; prior unassigned notes are superseded. See reports/T015.md.

## T015 delivery (2026-10-10)

T015 is REVIEW. Seed form/copy, per-mode statistics and win/reload/practice views are implemented. Dialogs retain input/focus across ticks. New-game mode and state save together; unreadable saves require explicit replacement and save failures are visible. Revision bookkeeping now compares the last successful stored revision. Schema remains v1; engine/session accounting unchanged.

Final checks: npm test — 131 passed; npm run build — passed; full Chromium E2E against fresh production preview on port 5185 — 68 passed. Details, commands and red/green regressions: reports/T015.md. No physical-device checks, push or deployment. Existing large court assets remain a later performance gate. Await coordinator acceptance; do not start T016/T017.

## T015 seed disclosure refinement

2026-10-10 coordinator request: hide seed entry behind a downward disclosure at the bottom of New Game; collapse seed display/copy behind a similar menu disclosure. T015 follow-up is implemented; targeted verification and a task-ID commit are recorded below.

T015 refinement delivered in a follow-up task commit: seed entry stays collapsed at the bottom of New Game, and menu seed display/copy is collapsed behind the same down-chevron disclosure. New E2E tests cover initial hidden state, reveal, keyboard focus and responsive dialog size.

## T015 chevron alignment

Coordinator supplied screenshot feedback: the text-glyph downward chevron sits too low. Follow-up replaces it with a CSS-drawn chevron; targeted visual verification pending.

T015 chevron refinement: replaced the text character with a centered CSS chevron. Build and two responsive dialog E2E checks passed; screenshot inspected. See reports/T015.md.

## T017 new game animation checkpoint (2026-10-10)

The UI now marks deliberate new-game and mode-change deals for a one-shot stock shuffle and staggered tableau arrival. `npm run build` and `git diff --check` passed. At the coordinator's request, no animation tests or manual animation inspection were performed. T017 was IN_PROGRESS at this checkpoint; see reports/T017.md for checks left outstanding at acceptance.

Pacing refinement: stock/card animations are 180 ms with 55 ms between tableau columns (about 510 ms total). No animation tests or manual inspection were performed.

Appearance correction: removed card opacity and transform effects that made cards appear incomplete; the sequence now uses outline/shadow highlights while cards stay stationary. Build and diff check passed; see reports/T017.md.

Bottom controls spacing increased by 4 px across desktop, portrait mobile and short landscape layouts. Build passed; see reports/T017.md.

New-game animation now uses one random finite overlay from three shuffle variants, built from existing card backs. The board remains static, the overlay passes pointer input through, and reduced motion skips it. Build passed; no animation tests or visual inspection were run per coordinator instruction. See reports/T017.md.

Variant selection now uses a shuffled three-item queue so all effects are shown in each three-game batch, without a repeat at batch boundaries. Build passed; see reports/T017.md.

Coordinator noted that the variants still looked alike. Motion is now more distinct: wide riffle, two-part cut, and staggered vertical cascade. Build and diff check passed; see reports/T017.md.

Animation passes are now faster and repeat twice; total overlay duration is 2.2 s. The overlay is positioned over the tableau scroller instead of the viewport center. Build passed; no animation tests or visual inspection were run per coordinator instruction.

## T017 coordinator acceptance (2026-10-10)

The human coordinator declared T017 complete and authorized closing it. Accepted delivery: `92909b8` (`T017: reposition and retime shuffle overlay`). T017 is DONE. Outstanding visual, reduced-motion/rapid-input and initial asset-budget checks are listed in reports/T017.md; they were not run and are not claimed as passed. No successor is assigned; wait for explicit assignment before starting T018.

Coordinator later confirmed iPhone and PC checks for T017 were performed. Device/OS/browser versions and case details were not supplied.

## T024 assignment (2026-10-10)

The human coordinator assigned the touch double-tap shortcut as T024, a follow-up to DONE T010. Implementation and docs are in `ba7865e`; `npm run test:e2e -- tests/e2e/play.spec.js tests/e2e/input.spec.js` passed 41 tests, `npm test` passed 134 tests, and `npm run build` passed. The coordinator confirmed device testing with “testy pokazują, że to działa” on 2026-10-11; T024 is DONE. See [tasks/T024.md](tasks/T024.md) and [reports/T024.md](reports/T024.md).

## T025 assignment (2026-10-11)

The human coordinator assigned a fix for delayed J/Q/K court artwork as T025, a P8 follow-up dependent on DONE T017. All twelve SVGs were optimized with SVGO, the gzip budget regression test and required unit, build, and E2E checks pass, and a 320px DPR 3 gallery screenshot was inspected. The coordinator accepted it on 2026-10-11 at `3a50ba8`; see [reports/T025.md](reports/T025.md). Codex did not perform a physical iPhone check.

## T026 added (2026-10-11)

The human coordinator assigned integration with `C:\Sources\MyProjets\mygame` as T026 on 2026-10-11. Implementation commits are `mygame` `005c25e` and Solitaire `6e7db44`; the shared PWA, offline shell, save restore and standalone route passed local browser checks. T026 is REVIEW pending coordinator acceptance; evidence and limitations are in [reports/T026.md](reports/T026.md). T021 is not a dependency because it concerns Solitaire's separate Pages workflow. No push or publication was performed.


## T015 coordinator acceptance (2026-10-10)

The human coordinator accepted T015: “commit it - it seems to works fine!” Accepted delivery: `b01fb4912aa5bcf179678150beb5336cc3b74ff7`. T015 is DONE. T017 is assigned and IN_PROGRESS. T016 automatic completion remains optional and unselected.

## T027 assignment (2026-10-11)
Human coordinator assigned implementation of no-move.md as T027. IN_PROGRESS on master; initial tree clean at f35766b. Sequential plan: tasks/T027.md. T026 acceptance is independent and pending.

## T027 delivery (2026-10-11)
T027 is REVIEW pending explicit coordinator acceptance. Implementation uses the
existing engine for all neutral transitions, stops at P1–P4, and never warns on
UNKNOWN. Knowledge survives Undo/Redo/branching/reload; old saves migrate safely.
Progress-only notifications update only the notice, preserving board animation
and input DOM. See reports/T027.md for tests and resume instructions. No push,
deployment, new task or T026 acceptance is implied.

## T027 follow-up assignment (2026-10-11)
Coordinator reviewed the feature as looking OK and requested next-step guidance.
IN_PROGRESS: add a new-game suggestion and conditional Undo guidance, with no
promise that undoing will enable progress. Existing detection rules unchanged.

T027 guidance follow-up delivered (2026-10-11), REVIEW: notices suggest a new
game and conditionally Undo/another route. Build and 14 targeted E2E checks passed.
See reports/T027.md. No push or physical-device check.

## T027 acceptance / T028 preparation (2026-10-11)

Coordinator accepted T027 through `dec2fbe17ae3af35f42a302c7accdf4edee06d49`:
T027 is DONE.

## T028 implementation and verification (2026-10-11)
T028 is REVIEW. SmartHint goal-directed hints planner implementation complete.
- Engine generator `searchSmartHint` in `src/engine/smart-hints.js` with binary heap priority queue, utility scoring $U$, information boundary masking, and deduplication.
- Full fixtures H01–H15 in `tests/fixtures/smart-hints.js`.
- Unit tests: `tests/unit/smart-hints.test.js` (15/15) and `tests/unit/smart-hints-app.test.js` (7/7) passing.
- Full unit test suite `npm test`: 197 passing across 15 test files.
- UI integration: time-sliced scheduling in `src/app.js`, interactive handling in `src/ui/input.js`, nonmodal rendering in `src/ui/render.js`, Polish announcements in `src/ui/smart-hints.js`.
- Full Playwright E2E suite `npm run test:e2e`: 87/87 passing in Chromium (including `smart-hints.spec.js`).
- Benchmark script `scripts/benchmark-hints.mjs`: evaluated Draw 1 and Draw 3, demonstrating ~2-3x increase in revealed cards and 100% elimination of cycle returns compared to baseline `rankHints`.
- Report documented in `.project/reports/T028.md`. Waiting for human coordinator approval.

## Additional T028 verification (2026-10-11)

Coordinator requested further tests. Existing 197 unit tests, CI simulation
(13 tests) and 17 targeted Chromium checks passed. Additional checks found
hidden-stock score dependence and missing truncated=true on time cutoff.
These remain unresolved; previous completion-readiness claims are superseded.
See [additional validation](reports/T028-additional-validation.md).
No product fixes or coordinator acceptance were performed in this verification.

## T028 regression repair assignment (2026-10-11)

Coordinator: “napraw algorytm”. IN_PROGRESS, Codex, master at de791db; clean tree.
Scope: hidden-information score leak and missing time-cutoff metadata, with
regression tests. Dependencies remain DONE. No UI redesign or parallel work.

## T028 regression repair delivered (2026-10-11)

REVIEW: hidden unknown waste values excluded from mobility scoring; unfinished
results correctly marked truncated without discarding the best plan. Permanent
regressions cover 300 hidden permutations and completed/unfinished time budgets.
202 unit tests, 39 targeted Chromium E2E tests, build and 40-deal assertion
simulation (793 calls/791 moves) passed. See reports/T028.md for exact evidence
and the correction to the original seed-42 timing reproduction. No push or
physical-device checks. Await coordinator acceptance; no successor assigned.


## T028 hint gesture assignment (2026-10-11)

Coordinator requests double-click/double-tap on the recommended source card
to execute the recommended destination. IN_PROGRESS, Codex, master 842941b,
clean tree. Reuse validation/execution and preserve other-card touch shortcuts.


## T028 hint gesture delivered (2026-10-11)

REVIEW: double-click/double-tap of a displayed hint source executes its exact
validated first move once. Other-card/default behavior preserved; Undo clears
recommendation. Build, 202 unit tests and 60 targeted Chromium E2E tests passed.
See reports/T028.md. No physical-device check or push; await acceptance.
