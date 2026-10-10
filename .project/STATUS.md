# Project status

- State: deterministic deal, transfer rules, Draw 1/Draw 3, recycle, legal-move enumeration and the CI engine simulation are implemented. T005 awaits acceptance. The page is still the Polish shell.
- Current task: **T005 — REVIEW**. T000–T004 are DONE. T006 is not assigned.
- Branch: `master`; use the existing branch and verify it each session.
- Canonical task states: [TASKS.md](TASKS.md). Delivery/evidence: [reports/T005.md](reports/T005.md).

## Completed deliverables / milestones

- T000 DONE: coordinator acceptance of eba965185ef8a60edf81f0318ab0fbf3481604f8.
- T001 DONE: accepted 2026-10-10. Accepted commit `339e0f852b60c691f52d6204aa7225b899c5844f`. Browser console and visual checks stay outstanding QA and were waived only as a T001 completion gate.
- T002 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted commit `d3c36f1df1d46d136e81d8c174f1636debed8a76`.
- T003 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `774b3e634e2b6991a91c4e24952b1919b0e4a484`. Accepted quality improvements `75070087cb4d49db1323467f8a7efb1737d325c0`.
- T004 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `1073dfb1828dff1944713c616c9019cfcdc14056`. Independent review `2af3ee4fead49ceab3d9d3cc9143c69c568429f4`.
- T005 REVIEW: CI/release simulation profiles for engine moves and invalid actions. Not accepted. Undo and restore are not included.
- P1 is complete. P2 is incomplete until T005 is DONE. T006–T023 remain TODO.

## Known problems and blockers

- GitHub Actions workflow is committed but has not run on a runner. No push was made.
- Browser console and rendered layout were not verified. Browser automation still cannot start (`DevToolsActivePort not found`).
- `filelist.txt` is absent and was not recreated.
- Hint ranking is not implemented. `getLegalMoves` uses a documented scan order, not the F04 hint order. There is no loss flag.
- Node 22.22.0 / npm 10.9.4; Vite 8.3.4, Vitest/coverage-v8 5.0.3; zero runtime dependencies. The production bundle does not import the engine yet.
- CI has no explicit `permissions: contents: read`. The workflow does not deploy or read secrets.

## Next recommendation

The coordinator reviews T005. After acceptance and a separate explicit assignment, [T006](tasks/T006.md) adds session history, Undo/Redo and exactly-once accounting. Do not start T006.
