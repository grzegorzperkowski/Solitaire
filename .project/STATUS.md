# T037 REVIEW — 2026-10-25

Independent PWA/browser session, preferences, statistics, victory bag and writer locks delivered without legacy migration. Namespace fixed from initial standalone display mode; same-mode exclusion preserved. Regression RED→GREEN; 56 unit/70 Chromium checks, production build and lint (0 errors/17 existing warnings) pass. Android ADB confirmed the original conflicting Chrome/PWA pages; new build has not been published or tested as an installed Android PWA. Both unrelated diagnostics preserved. See reports/T037.md; await coordinator acceptance.

# T035 developer version placement REVIEW — 2026-10-25

Version remains muted at page bottom right, including companion-off mode; removed Menu duplication. Viewport minimum and auto top margin reuse the existing footer. Build and 24 companion Chromium checks pass; lint 0 errors/17 existing warnings. Await acceptance; no push or physical Safari check. Preserve both diagnostics.

# T035 bottom-right build stamp REVIEW — 2026-10-25

Restored the game version below controls at the right edge by removing compact companion CSS hiding. Existing alignment reused; no runtime JS/save/input changes. Focused visibility test RED to GREEN; production build and 24 companion Chromium checks pass; compact screenshot inspected, controls remain onscreen. Await acceptance; no push or physical Safari check. Both unrelated diagnostic JSON files preserved.

# T035 iPhone hold fix REVIEW — 2026-10-25

Replaced small SVG hit rect with transparent native HTML button (minimum 64x64 CSS px), local pinch-zoom/context-menu handling, same pointer capture and lifecycle guards. Exact offset hit test RED to GREEN; 650ms native touch hold while dancing, drag/release covered. 24 companion Chromium/23 unit/build pass; final lifecycle visibility follow-up: 3 Chromium pass. Lint 0 errors/17 existing warnings. Physical iPhone 15 Pro confirmation remains open; no push. Both diagnostics preserved.

# T035 pointer interaction REVIEW — 2026-10-25

Click/Enter/Space stop and resume the figure; captured mouse/touch dragging lifts it, release opens a parachute and lowers it to the strip, leaving it stopped. Reduced motion lands immediately. UI-only state, no engine/save changes. Build, 438 unit tests, final 23 companion Chromium tests and lint (0 errors/17 warnings, one new sync complexity warning) pass. Parachute screenshot inspected. Await coordinator acceptance; no push or physical-device/Safari verification. Preserve both unrelated diagnostic JSON files.

# T035 toggle diagnosis REVIEW — 2026-10-25

Coordinator confirms New Game/redeal disabled while Help/Statistics work: read-only ownership guard. Added Menu explanation and close-other-tabs/reload guidance. Two touch cases pass; 20 companion Chromium/build pass; recovery focused test passes; lint 0 errors/16 existing warnings. Await acceptance; no push or physical Safari verification. Both diagnostics preserved.

# T035 adaptive compact layout REVIEW — 2026-10-25

Delivered portrait compact layout at <=599px width/<=740px height: hint bubble beside 72px figure, build in Menu; taller/fullscreen and landscape preserve spacious layout. 18 Chromium/build pass; lint 0 errors/16 existing warnings. Compact/roomy screenshots inspected. Await coordinator acceptance; no push, physical Safari check or full suite. Both diagnostics preserved.

# T035 placement follow-up REVIEW — 2026-10-25

Companion strip now directly adjoins buttons; notices moved above it. 17 Chromium checks/build pass; lint 0 errors/16 existing warnings. Screenshot at 320px inspected. Await coordinator acceptance; no physical-device checks or push. Both diagnostic JSON files preserved.

# T036 duration revision REVIEW — 2026-10-25

All four effects now last 456ms. Build and both focused Chromium tests pass, including reduced motion. Await coordinator acceptance; no push.

# T036 REVIEW — 2026-10-25

Four small-success effects implemented (180ms glow/pulse; foundation streak capped at four). Fresh commands only, reduced-motion bypass, no engine/save changes. 438 unit/40 Chromium/build pass; lint 0 errors/16 existing warnings. See reports/T036.md. Await coordinator acceptance; no push. Preserve both unrelated diagnostic JSON files. Physical-device aesthetics/performance unverified.

# T032 focus-test follow-up REVIEW — 2026-10-25

Coordinator assigned the clock-focus CI failure. Reproduced a race with draw focus restoration in requestAnimationFrame; the test now awaits that frame before focusing the card. Build, 39 accessibility checks and 10 focused repetitions pass; lint has 0 errors/16 existing warnings. Runtime unchanged. Await coordinator acceptance; no push. Preserve both diagnostic JSON files. See reports/T032.md.

# T035 DONE — 2026-10-25

Human coordinator confirmed testing and accepted/closed the complete companion feature: "projekt ludzika zamykamy, przetestowany - jest OK". Accepted commit `8dd1b651b6d115b992df863b44ac767772ac5c48`, including the mobile Menu fix. Device/browser versions were not supplied. No successor assigned; preserve both unrelated diagnostic JSON files. See [report](reports/T035.md). Earlier REVIEW notes are historical.

# T035 mobile regression REVIEW — 2026-10-25

Fixed board minimum-height overflow that hid Menu on short mobile viewports. Board now scrolls independently; controls remain onscreen. Three viewport regressions RED→GREEN, final 124 Chromium/build pass; lint 0 errors/16 warnings. Coordinator authorized commit/push; acceptance still pending. Preserve unrelated README/package.json edits and both diagnostics. See [report](reports/T035.md).

# T035 mobile regression assignment — 2026-10-25

Coordinator reports missing Menu with the companion enabled in mobile mode. Assigned diagnosis and layout fix from `57c6d8f`; preserve both unrelated JSON diagnostics and game state.

# T035 follow-up REVIEW — 2026-10-25

Random knee-slide phrase delivered with run-up, grounded knees, folded feet, braking and recovery. Strip uses full viewport width with uniform SVG scaling; run/slide reach both sides. 435 unit/121 Chromium/build pass; lint 0 errors/16 warnings. Await coordinator acceptance, no push; device/performance checks remain open. Both unrelated diagnostics preserved. See [report](reports/T035.md).

# T035 follow-up assignment — 2026-10-25

Assigned knee-slide effect with run-up and full-screen-width travel from `0e20525`. Sequential work on master; preserve unrelated JSON diagnostics, game state and lifecycle contracts.

# T035 implementation REVIEW — 2026-10-25

Optional SVG companion delivered: three random dances, occasional running/jumping, curved torso/articulated limbs, persisted opt-in menu setting, responsive bottom strip and full lifecycle/reduced-motion controls. 429 unit/13 simulation/120 Chromium E2E/build pass; final geometry rerun 17/17, lint 0 errors/16 informational warnings. Production `/Solitaire/` smoke and gzip budgets pass. Physical Safari/Android, live animation aesthetics and device performance/battery remain unverified; short landscape can scroll to controls. Await coordinator acceptance; no push, dependencies or engine edits. Both unrelated diagnostic JSON files preserved. See [report](reports/T035.md).

# T035 implementation assignment — 2026-10-25

Coordinator assigned implementation from `006acb2`, extending the design to random dances, occasional running and jumping. Codex works sequentially on master; no engine changes, dependencies or push. Preserve both unrelated diagnostic JSON files.

# T035 REVIEW — 2026-10-25

Research and technical design for an optional hand-drawn dancing companion delivered. Proposed native SVG with articulated limbs and curved torso, opt-in persisted preference, reserved bottom strip, lifecycle/reduced-motion controls and verification gates. Documentation only; no prototype, runtime edits, game tests or device/performance evidence. Await coordinator review and separate implementation assignment. Both unrelated diagnostic JSON files preserved. See [design](tasks/T035-design.md) and [report](reports/T035.md).

# T034 REVIEW — 2026-10-21

Five scoped refactorings delivered: keyboard dispatch, status rendering, save validation/replay, arrow targets/effects and SmartHint public results. Final 403 unit/13 simulation/107 Chromium E2E/build pass; 315 persistence cases and 108 planner traces match baseline. Lint 0 errors/16 informational warnings; validation remains intact. Await coordinator acceptance; no push/device/performance claim. Both unrelated diagnostic JSON files preserved. See reports/T034.md.

# T033 REVIEW — 2026-10-21

Victory shortcuts and restored command immutability repaired; dead-code cleanup and pinned ESLint/CI delivered. Final 403 unit/13 simulation/106 Chromium E2E/build pass; lint 0 errors/15 informational complexity/nesting warnings, actionlint clean. Node 22 minimum is now 22.13 for ESLint 10; tested 22.22. Await coordinator acceptance; no push/hosted/device check. Both unrelated diagnostic JSON files preserved. See reports/T033.md.

# T016 REVIEW — 2026-10-21

Safe completion delivered with approved nonempty-waste preflight, 140ms card travel / 160ms command cadence and no separate cancel button. Real cursor-126 save wins in 15 commands. Final 401 unit / 13 simulation / 106 Chromium E2E / production build pass; 320px and travel screenshots inspected. Await coordinator acceptance. No push or physical-device evidence; both unrelated diagnostic JSON files preserved. See reports/T016.md.

# Project status

T032 REVIEW (2026-10-21): all seven audit findings repaired with a validated commit per issue. 384 unit/13 simulation/101 E2E/build pass; actionlint clean, ESLint 0 errors/48 informational warnings. Await coordinator acceptance; commits local, new hosted workflow/device checks unverified. Both unrelated diagnostic JSON files preserved. See reports/T032.md.

T031 REVIEW (2026-10-21): read-only audit delivered with seven prioritized findings: timer focus loss, ungated deployment, read-only moves, async lock rejection, incomplete controller teardown, dead hint variables and stale README. ESLint 88 files/51 warnings/0 errors, npm audit 0 vulnerabilities; four behavior probes reproduced. See reports/T031.md. No runtime edits; preserve both diagnostic JSON files. T030 final CI 39663303115 and Pages pass.

T030 REVIEW (2026-10-21): `fc36075` fixes CI shallow history and the native touch-drag regression caused by per-card manipulation. Document-level manipulation now suppresses double-tap zoom while cards retain pinch-only behavior. Local 379 unit/13 simulation/98 E2E/build pass; GitHub CI run 39662907837 and Pages deployment pass. Await coordinator acceptance; physical-device zoom checks remain. Both diagnostic JSON files preserved.

T030 REVIEW (2026-10-21): double-tap zoom prevention applied to buttons and face-up cards. Build and 34 accessibility/gameplay E2E tests pass. Await coordinator acceptance; physical device check remains. Preserve unrelated diagnostic JSON. See [report](reports/T030.md).

T028 DONE (2026-10-21): coordinator accepted X1/X2 R&D; X2 not promoted. Accepted commit `8a129043fb13abded404074648dd9fa397c7707e`. See [report](reports/T028-x1-x2-rd.md).

T028 REVIEW (2026-10-16): X1/X2 R&D complete. X1:30 switches, legal recovery witness at93; final B142 remains UNKNOWN. X2 control/variant wins11/13 on40 exploratory pairs,37/35 on80 validation pairs (1 gain,3 losses); reject production promotion.379 unit tests/build and diagnostic replay checks pass. Runtime unchanged; no push/successor. See [report](reports/T028-x1-x2-rd.md). User requested shutdown after completion.

T028 REVIEW (2026-10-16): E1 fallback R&D complete. Fallback/control wins9/11 at512+512 vs1024,11/11 at2048+2048 vs4096 (40 paired deals each);373 tests/build pass. B reachability100000 remains UNKNOWN; both forced first-choice branches win184. Production unchanged, no push/successor. See [report](reports/T028-fallback-rd.md).

T028 REVIEW (2026-10-15): external-LLM feedback and full exact BFS source/dependencies delivered with three diagnostic positions. Extracted-source replay reproduces all six search results; mixed coverage shown on identical boards. Runtime unchanged. See [report](reports/T028-bfs-handoff.md). Both unrelated JSON files preserved; no push; acceptance pending.

T028 REVIEW (2026-10-15): implemented isolated FIFO/BFS R&D against 2d1ecfc. Baseline/FIFO wins 9/3 at 512 and 11/3 at 2048 (40 paired deals each), 4/1 at 10000 (10-deal subset). 367 tests/build pass; FIFO not promoted, production unchanged. See [report](reports/T028-bfs-rd.md). Both diagnostic JSON files preserved; no push/successor; acceptance pending.

T028 REVIEW (2026-10-15): partial external proposal adapted with reconstructed history/high-water goals and verified plan commitments; rejected worse-performing trial weights. Final337 unit/98 Chromium/build pass. Held-out40 deals:15 wins before/after,8 fewer commands,0 same-knowledge repeats; seed42 wins in137. See [report](reports/T028-belief-planner.md). Await acceptance; no push/successor; both untracked diagnostics preserved.

- T028 documentation follow-up REVIEW (2026-10-15): self-contained SMART_HINT_PROMPT.md delivered, 21,082 UTF-8 bytes. Requests implementation-level pseudocode, whole-game quality and cross-request cycle prevention; speed tuning deferred. Static document checks passed; runtime unchanged. See reports/T028.md.

- T028 REVIEW (2026-10-14): both histories integrated in canonical C:\Sources\MyProjets\Solitaire. 325 unit tests, 98 Chromium E2E/build and 600-run benchmark passed. Integrated reveals2588 vs advanced2583/repaired2442, repeated board+knowledge0 vs repaired10; no win-rate claim. See [integration report](reports/T028-integration.md). Earlier entries are historical.

- T028 IN_PROGRESS checkpoint (2026-10-13): allocation-free estimate, shared verification, command-field alternative keys, shorter information/equal-F plans and cooperative final shortener implemented. 36 distinct focused tests and build passed; full unit/E2E/benchmark deferred at coordinator bedtime request. No p95 claim. See [checkpoint](reports/T028-p95-checkpoint.md); resume only on assignment, no push.

- T028 IN_PROGRESS (2026-10-13): coordinator assigned p95/short-plan follow-up on `master` at `7a36c30`. Latest instruction: only very basic checks tonight; full unit/E2E and benchmarks deferred. Preserve unrelated cursor-114 JSON. See [checkpoint](reports/T028-p95-checkpoint.md).

- T028 REVIEW (2026-10-13): supplied proposal adapted with shorter reveals, hidden-safe color-correct tie-breaker and boundary alternatives. 297 unit tests, 98 Chromium E2E and build passed. Paired 200-game comparison: more reveals/fewer steps, higher p95/cut rates, zero wins under the 100-command/300-state measurement limits. See [report](reports/T028-proposal-adaptation.md). Await acceptance; no push or successor.

- T028 IN_PROGRESS (2026-10-13): coordinator assigned adaptation/testing of the supplied SmartHint code. Sequentially on `master` at `54d6c7e`; preserve unrelated untracked cursor-114 JSON. Keep information safety, strict budgets and graph verification while evaluating shorter plans, alternatives and post-reveal estimates.

- T028 REVIEW (2026-10-13): external eight-point analysis checked against code/contracts and fresh evidence. Runtime unchanged; two remembered-reveal guard cases added. 101 focused tests passed; cursor73 SmartHint and BFS exhaust 88,896 states with no goals/cuts. See [report](reports/T028-external-analysis-check.md). Await acceptance; deferred v3 scope and unrelated untracked cursor-114 JSON preserved.

- T028 IN_PROGRESS (2026-10-13): coordinator resumed SmartHint with an external eight-point analysis. Verify the claims and proposed diff against current contracts and fresh tests; repair only reproduced defects. Start: `master` at `86896dc`, with only unrelated untracked cursor-114 JSON. No other task assigned.

- T028 REVIEW (2026-10-13, A78→B79): removed post-goal preparation endpoints; exact A now has one 4♣ foundation command. Full B SmartHint and independent BFS agree: 88,896 states, zero goals, no truncation. 88 focused tests passed. See [report](reports/T028-goal-endpoint-fix.md); await acceptance, preserve unrelated staged work.

- T028 REVIEW (2026-10-13): assigned continuation repairs delivered; rejected tails fall back to search, aborted signals bypass continuation. Both reproductions GREEN; 55 focused tests plus staged-module checks passed. Remaining v3 checks deferred; await acceptance. See [report](reports/T028-continuation-fix.md).

- T028 reproduction-only assignment (2026-10-13): two continuation regressions added; both fail for the expected reasons. No production repairs or full checks. See [report](reports/T028-continuation-reproduction.md). Parent task remains IN_PROGRESS; await repair assignment.

- T028 IN_PROGRESS: v3 checkpoint at coordinator commit/push-only request. 81 focused tests passed; cursor-73 median 29.535 s → 11.922 s, same 88,896 states and zero goals. Full checks and broader property coverage deferred. See [checkpoint report](reports/T028-v3-audit.md). Preserve unrelated dirty files.

- Prior T028 REVIEW delivery: accepted `c677cad` preserved; graph/truncation/cancellation repairs and independent BFS comparison delivered. Cursor 73: all three searches exhaust 88,896 states with zero goals. See [audit](reports/T028-graph-audit.md). Preserve unrelated dirty files and diagnostic JSON; awaiting acceptance.

- State: T000–T015, T017, T024, T025, T027 and T029 are DONE; T026 and T028 are REVIEW.
- Latest task: T029 random victory animations and replay E2E timeout fix, accepted by the coordinator on 2026-10-12 at `2ea1a1e`. Preview: `http://localhost:5186/tests/harness/victory.html`. See [tasks/T029.md](tasks/T029.md) and [reports/T029.md](reports/T029.md).
- T028 follow-up (2026-10-12): §8 benchmark and legal-move reuse speed improvement delivered; see [reports/T028.md](reports/T028.md).
- T027 DONE: coordinator accepted 2026-10-11 at `dec2fbe17ae3af35f42a302c7accdf4edee06d49`; see [reports/T027.md](reports/T027.md).
- Prior task: T026 REVIEW, assigned by the human coordinator on 2026-10-11. Implementation commits: `mygame` `005c25e` and Solitaire `6e7db44`. Awaiting coordinator acceptance. T021 was removed as a dependency because it covers Solitaire's independent Pages workflow, not the existing Playground assembler.
- Branch: `master`; use the existing branch and verify it each session.
- Canonical task states: [TASKS.md](TASKS.md). Latest preparation: [reports/T028.md](reports/T028.md). Historical entries below retain their original dates; the current summary supersedes them.

## Completed deliverables / milestones

- T000 DONE: coordinator acceptance of eba965185ef8a60edf81f0318ab0fbf3481604f8.
- T001 DONE: accepted 2026-10-10. Accepted commit `339e0f852b60c691f52d6204aa7225b899c5844f`. Browser console and visual checks stay outstanding QA and were waived only as a T001 completion gate.
- T002 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted commit `d3c36f1df1d46d136e81d8c174f1636debed8a76`.
- T003 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `774b3e634e2b6991a91c4e24952b1919b0e4a484`. Accepted quality improvements `75070087cb4d49db1323467f8a7efb1737d325c0`.
- T004 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `1073dfb1828dff1944713c616c9019cfcdc14056`. Independent review `2af3ee4fead49ceab3d9d3cc9143c69c568429f4`.
- T005 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `509fe7b911ce6d336bd55bfdc362778e93fd0cc1`.
- T006 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `63b28ce3ee585ee8f243aca37e382e1f2f74983d`.
- T007 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `a4b2f853598d6020caac4cd97938a7b8ff8b97d2`.
- T008 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `a1a7567`.
- T009 original implementation DONE: accepted 2026-10-10 at `ae85d6b`; mobile spacing, card visibility and classical court artwork follow-ups accepted 2026-10-10 at `ccc9556`.
- T010 original implementation DONE: accepted 2026-10-10 by the human coordinator and ChatGPT at `bdd275c`; follow-up dialog-focus test revision accepted 2026-10-10 at `496f33f`.
- T011 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `fa1aa9c`.
- T012 DONE: accepted 2026-10-10 by the human coordinator at commit `916b3bd`.
- T013 DONE: physical checks on iPhone 15 and Android 12 found no problems; accepted 2026-10-10 at `916b3bd`. iOS/browser versions were not supplied; see [reports/T013.md](reports/T013.md).
- T014 DONE: accepted 2026-10-10 by the human coordinator at commit `6149f52`; legal-hint ranking and empty-action feedback are implemented. See [reports/T014.md](reports/T014.md).
- P1–P6 are complete. P7 is complete. T016–T023 remain TODO; T016 is optional.

## Known problems and blockers

- T028 graph audit fixes resolved cutoffs, root-detour verification, candidate
  retention/cancellation, expansion counting and failed replay handling.
  Evidence: 265 full unit tests, final 41 focused graph/BFS tests, 45 Chromium
  E2E checks and build pass. 28 small real boards agree with independent BFS;
  cursor 73 agrees on 88,896 states / zero goals, untruncated. Full §8 quality
  benchmark was not repeated; physical-device latency remains unmeasured.

- T026 is awaiting coordinator acceptance. No push or publication was performed.

- GitHub Actions workflow is committed but has not run on a runner. No push was made.
- `filelist.txt` is absent and was not recreated.
- Hints now rank legal actions using visible information and the F04 order. Empty legal-action feedback does not imply a loss or solvability result.
- Node 22.22.0 / npm 10.9.4; Vite 8.3.4, Vitest/coverage-v8 5.0.3, Playwright 1.64.0; zero runtime dependencies.

## Next recommendation

- Review T026 and record acceptance or requested changes. T016–T023 remain TODO; T016 is optional.

- T015 validation: 131 unit tests, 68 production-preview Chromium E2E tests and build passed. Seed/copy, per-mode statistics, win/reload/practice and safe preference/recovery flows implemented. No new physical-device evidence or push.

- T015 follow-up: seed input and seed/copy summary are collapsed by default behind keyboard-accessible downward disclosures; production build and targeted UI checks passed. See reports/T015.md.

- T015 chevron refinement: CSS-drawn indicator replaces the low-aligned text glyph. Build and 320px/landscape dialog checks passed; screenshot visually inspected. See reports/T015.md.

- T015 accepted by the human coordinator at `b01fb49`. P7 task complete. Optional T016 was not selected.

- T017 accepted by the human coordinator on 2026-10-10 at `92909b8`; see reports/T017.md. Some visual, rapid-input and asset-budget checks remain outstanding and were accepted as such.
- T017 follow-up: added a one-shot stock shuffle and staggered tableau deal for new games started in the UI. Build and diff check passed; no animation tests or manual inspection were run per coordinator instruction. See reports/T017.md.
- T017 pacing refinement: increased per-card animation to 180 ms and column stagger to 55 ms (about 510 ms total). See reports/T017.md.
- T017 appearance correction: new-game animation no longer scales, fades or moves cards; it sequences outline highlights instead. Build and diff check passed; see reports/T017.md.
- T017 layout refinement: increased spacing between the tableau and bottom controls by 4 px at each responsive breakpoint. Build passed; see reports/T017.md.
- T017 new game animation redesign: UI starts one of three random decorative shuffle overlays using local card backs; board state remains static and reduced motion skips it. Build passed; no animation tests or visual inspection were run. See reports/T017.md.
- T017 variant distribution fix: shuffled queue guarantees all three shuffle effects appear within every three new games, with no repeat across queue boundaries. Build passed; see reports/T017.md.
- T017 visual distinction fix: expanded the riffle, split the second variant into two moving groups, and changed the third to a vertical cascade. Build and diff check passed; see reports/T017.md.
- T017 animation pacing/placement refinement: each shuffle pass is faster and repeats twice; overlay lasts 2.2 s and is centered over the tableau columns. Build passed; see reports/T017.md.

## T027 assignment (2026-10-11)
T027 IN_PROGRESS, explicitly assigned by the human coordinator. Implement the reachable-progress specification in tasks/T027-spec.md. T026 remains REVIEW. See reports/T027.md.

## T027 delivery (2026-10-11)
T027 is REVIEW. Bounded complete neutral-state search, lifetime visible-card
knowledge, schema v2 with conservative v1 migration, cancellable batches and
Polish progress notices are implemented. Unit suite: 175 passed; Chromium E2E:
83 passed; production build passed. Exact evidence and limits: reports/T027.md.
No successor assigned; T026 still awaits its independent acceptance.

T027 guidance follow-up delivered (2026-10-11), REVIEW: notices suggest a new
game and conditionally Undo/another route. Build and 14 targeted E2E checks passed.
See reports/T027.md. No push or physical-device check.

## T027 acceptance / T028 preparation (2026-10-11)

Coordinator accepted T027 through `dec2fbe17ae3af35f42a302c7accdf4edee06d49`:
T027 is DONE. Coordinator requested only preparation of the new task and
specification ("Przygotuj zadanie i specyfikację"). T028 is TODO, not assigned
for implementation. Read tasks/T028.md and tasks/T028-spec.md when assigned.
No product code changed. T026 remains REVIEW; no other task was accepted.
This entry supersedes earlier T027 pending-acceptance/no-successor notes.

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
