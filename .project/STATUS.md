# Project status

- State: T012's active-pointer capture-loss fix and automated checks are complete; coordinator review is pending.
- Current task: **T012 — REVIEW**. T000–T011 are DONE.
- Branch: `master`; use the existing branch and verify it each session.
- Canonical task states: [TASKS.md](TASKS.md). Delivery/evidence: [reports/T012.md](reports/T012.md).

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
- T009 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `ae85d6b`.
- T010 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `bdd275c`.
- T011 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `fa1aa9c`.
- T012 REVIEW: Pointer drag & drop, cancellation, edge autoscroll and pull-to-refresh prevention implemented and automated checks pass.
- P1, P2, P3, P4 and P5 are complete. P6 is pending T012 coordinator review and T013 gate. T013–T023 remain TODO.

## Known problems and blockers

- GitHub Actions workflow is committed but has not run on a runner. No push was made.
- `filelist.txt` is absent and was not recreated.
- Hint ranking is not implemented. `getLegalMoves` uses a documented scan order, not the F04 hint order. There is no loss flag.
- Node 22.22.0 / npm 10.9.4; Vite 8.3.4, Vitest/coverage-v8 5.0.3, Playwright 1.64.0; zero runtime dependencies.

## Next recommendation

- T012 is in REVIEW. Await coordinator review and acceptance. Do not start T013 until authorized.
