# Project status

- T028 IN_PROGRESS: v3 checkpoint at coordinator commit/push-only request. 81 focused tests passed; cursor-73 median 29.535 s → 11.922 s, same 88,896 states and zero goals. Full checks and broader property coverage deferred. See [checkpoint report](reports/T028-v3-audit.md). Preserve unrelated dirty files.

- Prior T028 REVIEW delivery: accepted `c677cad` preserved; graph/truncation/cancellation repairs and independent BFS comparison delivered. Cursor 73: all three searches exhaust 88,896 states with zero goals. See [audit](reports/T028-graph-audit.md). Preserve unrelated dirty files and diagnostic JSON; awaiting acceptance.

- State: T000–T015, T017, T024, T025, T027 and T029 are DONE; T026 is REVIEW; T028 is IN_PROGRESS.
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
