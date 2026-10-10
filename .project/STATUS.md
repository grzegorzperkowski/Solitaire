# Project status

- State: P1 deterministic deal is accepted. Transfer rules are the assigned next task. The page is still the Polish shell.
- Current task: **T002 — DONE**. **T003** is assigned and is the only authorized next task.
- Branch: `master`; use the existing branch and verify it each session.
- Canonical task states: [TASKS.md](TASKS.md). T002 evidence: [reports/T002.md](reports/T002.md).

## Completed deliverables / milestones

- T000 DONE: coordinator acceptance of eba965185ef8a60edf81f0318ab0fbf3481604f8.
- T001 DONE: accepted 2026-10-10. Accepted commit `339e0f852b60c691f52d6204aa7225b899c5844f`. Browser console and visual checks stay outstanding QA and were waived only as a T001 completion gate.
- T002 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted commit `d3c36f1df1d46d136e81d8c174f1636debed8a76`. `createGame`, shuffle version 1, golden deals and unit CI.
- P1 exit is met by T001 and T002. P2 is not started in the acceptance commit. T003–T023 remain TODO aside from the T003 assignment.

## Known problems and blockers

- GitHub Actions workflow is committed but has not run on a runner. No push was made.
- Browser console and rendered layout were not verified. Browser automation still cannot start (`DevToolsActivePort not found`).
- `filelist.txt` is absent and was not recreated.
- Node 22.22.0 / npm 10.9.4; Vite 8.3.4, Vitest/coverage-v8 5.0.3; zero runtime dependencies. The production bundle does not import the engine yet.
- CI has no explicit `permissions: contents: read`. The workflow does not deploy or read secrets. Hardening can wait for a later CI edit.

## Next recommendation

Implement assigned [T003](tasks/T003.md): tableau, foundation and waste transfers, atomic reveal, `assertInvariants` and `isWon`. Draw, recycle and `getLegalMoves` stay in T004. Do not start T004.
