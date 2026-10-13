# Task ledger

This file is the canonical status list. Specifications define scope; reports contain evidence and coordinator approval. The milestone plan remains [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md). Task IDs use three digits (T001); TEST_PLAN test groups use two (T01).

## Sequential protocol and statuses

- TODO: not started, including tasks waiting for dependency approval or optional selection. A row is not an assignment.
- IN_PROGRESS: the human explicitly assigned/resumed this task and its dependencies are DONE. At most one implementation task can be active; no parallel agents.
- REVIEW: task work and required checks are ready, reported and committed; coordinator acceptance is pending. Stop here.
- DONE: explicit human coordinator approval is recorded in the report with date/approver/accepted commit. An agent may record that approval, never invent it.
- BLOCKED: assigned work cannot meet acceptance; record the missing input/evidence and the action needed to resume. Do not silently skip it or start another task.

Normal flow: TODO → IN_PROGRESS → REVIEW → DONE. A requested revision returns REVIEW to IN_PROGRESS only on explicit assignment. Interruption can remain IN_PROGRESS with a checkpoint; use BLOCKED when a dependency/input prevents progress. Approval of a task does not assign its successor.

Coordinator acceptance is recorded in the accepted task's report, then its row becomes DONE. Record a subsequent assignment in the new task's report and STATUS/HANDOFF before editing product code. If approval arrives outside the repository, transcribe its date/approver/accepted commit before proceeding. If these records disagree, reconcile with the coordinator rather than assuming permission.

## Tasks

| ID | Milestone | Description | Dependencies (must be DONE) | Status | Acceptance reference |
| --- | --- | --- | --- | --- | --- |
| [T000](tasks/T000.md) | Setup | Workflow preparation | None | DONE | [Criteria](tasks/T000.md#acceptance-criteria); All milestones (mapping only); no product implementation |
| [T001](tasks/T001.md) | P1 | Toolchain and minimal Polish shell | T000 | DONE | [Criteria](tasks/T001.md#acceptance-criteria); P1 toolchain subset; REQUIREMENTS N06/N10 |
| [T002](tasks/T002.md) | P1 | Deterministic cards, shuffle and deal | T001 | DONE | [Criteria](tasks/T002.md#acceptance-criteria); P1 exit; TEST_PLAN T01 |
| [T003](tasks/T003.md) | P2 | Transfer rules and board invariants | T002 | DONE | [Criteria](tasks/T003.md#acceptance-criteria); P2 transfer/invariant subset; TEST_PLAN T02–T05/T08 |
| [T004](tasks/T004.md) | P2 | Stock recycling and complete legal-action enumeration | T003 | DONE | [Criteria](tasks/T004.md#acceptance-criteria); P2 rules complete; TEST_PLAN T06–T08 |
| [T005](tasks/T005.md) | P2 | Deterministic engine simulations | T004 | DONE | [Criteria](tasks/T005.md#acceptance-criteria); P2 exit; TEST_PLAN §4 (engine layer) |
| [T006](tasks/T006.md) | P3 | Session history and exactly-once accounting | T005 | DONE | [Criteria](tasks/T006.md#acceptance-criteria); P3 exit; TEST_PLAN T09/T10/T14 (accounting) |
| [T007](tasks/T007.md) | P4 | Versioned persistence and replay validation | T006 | DONE | [Criteria](tasks/T007.md#acceptance-criteria); P4 persistence subset; TEST_PLAN T11/T12/T14 (restore) |
| [T008](tasks/T008.md) | P4 | Clock, browser lifecycle and single-writer ownership | T007 | DONE | [Criteria](tasks/T008.md#acceptance-criteria); P4 exit; TEST_PLAN T11–T14 (browser/lifecycle) |
| [T009](tasks/T009.md) | P5 | Responsive board and readable SVG card basics | T008 | DONE | [Criteria](tasks/T009.md#acceptance-criteria); P5 layout subset; TEST_PLAN T17/T19 (layout); mobile spacing, card visibility and face-card icon follow-ups |
| [T010](tasks/T010.md) | P5 | Tap and keyboard play | T009 | DONE | [Criteria](tasks/T010.md#acceptance-criteria); P5 input subset; TEST_PLAN T15/T18 (board) |
| [T011](tasks/T011.md) | P5 | New Game, Restart, Pause and Help dialogs | T010 | DONE | [Criteria](tasks/T011.md#acceptance-criteria); P5 exit; TEST_PLAN T13/T15/T18/T19 (dialogs) |
| [T012](tasks/T012.md) | P6 | Pointer drag, cancellation and autoscroll | T011 | DONE | [Criteria](tasks/T012.md#acceptance-criteria); P6 automated subset; TEST_PLAN T16/T17 |
| [T013](tasks/T013.md) | P6 | Physical-device touch feasibility gate | T012 | DONE | [Criteria](tasks/T013.md#acceptance-criteria); P6 exit; TEST_PLAN T16/T19 and §5 (pre-PWA subset) |
| [T014](tasks/T014.md) | P7 | Deterministic legal hints | T013 | DONE | [Criteria](tasks/T014.md#acceptance-criteria); P7 hints subset; TEST_PLAN T20 |
| [T015](tasks/T015.md) | P7 | Seed/settings/statistics and win flow | T014 | DONE | [Criteria](tasks/T015.md#acceptance-criteria); P7 exit; TEST_PLAN T10/T13–T15 |
| [T016](tasks/T016.md) | P7a | Optional safe automatic completion | T015; explicit optional-feature selection | TODO | [Criteria](tasks/T016.md#acceptance-criteria); P7a exit (optional); TEST_PLAN T21 |
| [T017](tasks/T017.md) | P8 | Final vector artwork and motion polish | T015 | DONE | [Criteria](tasks/T017.md#acceptance-criteria); coordinator accepted 2026-10-10 at `92909b8`; outstanding checks documented in [report](reports/T017.md) |
| [T018](tasks/T018.md) | P8 | Accessibility and performance acceptance | T017 | TODO | [Criteria](tasks/T018.md#acceptance-criteria); P8 exit; TEST_PLAN T18/T19/T22 |
| [T019](tasks/T019.md) | P9 | Manifest and complete offline app build | T018 | TODO | [Criteria](tasks/T019.md#acceptance-criteria); P9 offline subset; TEST_PLAN T23 |
| [T020](tasks/T020.md) | P9 | Safe updates and installation flow | T019 | TODO | [Criteria](tasks/T020.md#acceptance-criteria); P9 lifecycle subset; TEST_PLAN T23 and §5 (PWA) |
| [T021](tasks/T021.md) | P9 | GitHub Pages preparation and build gate | T020 | TODO | [Criteria](tasks/T021.md#acceptance-criteria); P9 exit; REQUIREMENTS N10; TEST_PLAN T23/§7 |
| [T022](tasks/T022.md) | P10 | Full release verification and handoff | T021; T016 also DONE only if selected for release | TODO | [Criteria](tasks/T022.md#acceptance-criteria); P10 verification subset; TEST_PLAN T01–T23 (T21 conditional), §§4–7 |
| [T023](tasks/T023.md) | P10 | Explicitly authorized publication and smoke test | T022; explicit publication authorization and hosting access | TODO | [Criteria](tasks/T023.md#acceptance-criteria); P10 publication exit; REQUIREMENTS N10; TEST_PLAN T23 |
| [T024](tasks/T024.md) | P5 follow-up | Double-tap card shortcut | T010 | DONE | [Criteria](tasks/T024.md#acceptance-criteria); coordinator accepted 2026-10-11 at `ba7865e`; [report](reports/T024.md) |
| [T025](tasks/T025.md) | P8 follow-up | Eliminate delayed court artwork rendering | T017 | DONE | [Criteria](tasks/T025.md#acceptance-criteria); coordinator accepted 2026-10-11 at `3a50ba8`; [report](reports/T025.md) |
| [T026](tasks/T026.md) | P9 follow-up | Integrate Solitaire with the Playground PWA | None | REVIEW | [Criteria](tasks/T026.md#acceptance-criteria); implementation commits `005c25e` and `6e7db44`; [report](reports/T026.md) |
| [T027](tasks/T027.md) | P7 follow-up | Reachable progress detection | T014, T007, T008, T015 | DONE | [Report](reports/T027.md); [spec](tasks/T027-spec.md) |
| [T028](tasks/T028.md) | P7 follow-up | SmartHint goal-directed hints | T014, T027 | IN_PROGRESS | Two continuation reproductions assigned 2026-10-13, both expected RED; no repairs assigned. V3 full checks/property coverage deferred. See [report](reports/T028-continuation-reproduction.md) |
| [T029](tasks/T029.md) | P8 follow-up | Random victory animations | T015, T017 | DONE | Coordinator accepted 2026-10-12 at `2ea1a1e`; [report](reports/T029.md) |

## Selection and model suitability

T000–T014 have accepted original implementations. T001 acceptance on 2026-10-10 names commit `339e0f852b60c691f52d6204aa7225b899c5844f` and waives browser console/visual checks as a completion gate; those checks stay outstanding QA. T002 acceptance on 2026-10-10 names commit `d3c36f1df1d46d136e81d8c174f1636debed8a76`. T003 acceptance on 2026-10-10 names implementation `774b3e634e2b6991a91c4e24952b1919b0e4a484` and quality improvements `75070087cb4d49db1323467f8a7efb1737d325c0`. T004 acceptance on 2026-10-10 names implementation `1073dfb1828dff1944713c616c9019cfcdc14056`. T005 acceptance on 2026-10-10 names implementation `509fe7b911ce6d336bd55bfdc362778e93fd0cc1`. T006 acceptance on 2026-10-10 names implementation `63b28ce3ee585ee8f243aca37e382e1f2f74983d`. T007 acceptance on 2026-10-10 names implementation `a4b2f853598d6020caac4cd97938a7b8ff8b97d2`. T008 acceptance on 2026-10-10 names implementation `a1a7567`. T009 original acceptance on 2026-10-10 names implementation `ae85d6b`; mobile spacing, card visibility and classical court artwork follow-ups accepted 2026-10-10 at `ccc9556`. T010 original acceptance on 2026-10-10 names implementation `bdd275c`; follow-up focus-timing test revision accepted 2026-10-10 at `496f33f`. T011 acceptance on 2026-10-10 names implementation `fa1aa9c`. T012 and T013 were accepted by the coordinator on 2026-10-10 at `916b3bd`. T014 acceptance on 2026-10-10 names implementation and preview-test fix `6149f52`. T015 accepted on 2026-10-10 by the human coordinator at `b01fb4912aa5bcf179678150beb5336cc3b74ff7`; see reports/T015.md. T016 is optional and stays TODO unless selected; its absence does not block T017–T021. T022 additionally requires T016 DONE only if that feature is included. T023 is the separate publication step, never implied by a successful release build. Milestones are accepted only when all required member tasks are DONE and the original phase exit is satisfied. P1–P6 are complete; P7 is in progress.

Suitability suggestions in each task describe needed tools/skills, not performance rankings or permanent owners. Codex or another CLI-capable model suits toolchain/CI/persistence work; Codex, Grok or another algorithm-capable model can handle pure engine/session work; Grok, Codex or another browser/SVG-capable model can handle UI/artwork. Physical-device gates require actual device evidence or human assistance regardless of model. The human may assign any capable model; the implementer records its identity only when assigned.

All new tasks must be explicitly scoped/assigned by the coordinator; do not create an automated queue runner, agent orchestration, model-specific branches or worktrees.
