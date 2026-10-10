# Project status

- State: deterministic deal and transfer rules are accepted. Draw, recycle and legal-move enumeration are the assigned next task. The page is still the Polish shell.
- Current task: **T003 — DONE**. **T004** is assigned and is the only authorized next task.
- Branch: `master`; use the existing branch and verify it each session.
- Canonical task states: [TASKS.md](TASKS.md). T003 evidence: [reports/T003.md](reports/T003.md).

## Completed deliverables / milestones

- T000 DONE: coordinator acceptance of eba965185ef8a60edf81f0318ab0fbf3481604f8.
- T001 DONE: accepted 2026-10-10. Accepted commit `339e0f852b60c691f52d6204aa7225b899c5844f`. Browser console and visual checks stay outstanding QA and were waived only as a T001 completion gate.
- T002 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted commit `d3c36f1df1d46d136e81d8c174f1636debed8a76`.
- T003 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `774b3e634e2b6991a91c4e24952b1919b0e4a484`. Accepted quality improvements `75070087cb4d49db1323467f8a7efb1737d325c0`. Tableau, waste and foundation transfers, atomic reveal, `assertInvariants` and `isWon`.
- P1 is complete. P2 is not finished in the acceptance commit. T004 is assigned. T005–T023 remain TODO.

## Known problems and blockers

- GitHub Actions workflow is committed but has not run on a runner. No push was made.
- Browser console and rendered layout were not verified. Browser automation still cannot start (`DevToolsActivePort not found`).
- `filelist.txt` is absent and was not recreated.
- `draw` and `recycle` still reject with `unsupported-command`. There is no `getLegalMoves` yet. Both belong to the assigned T004.
- Node 22.22.0 / npm 10.9.4; Vite 8.3.4, Vitest/coverage-v8 5.0.3; zero runtime dependencies. The production bundle does not import the engine yet.
- CI has no explicit `permissions: contents: read`. The workflow does not deploy or read secrets.

## Next recommendation

Implement assigned [T004](tasks/T004.md): Draw 1/Draw 3, separate recycle and `getLegalMoves`. Keep the accepted T003 transfers unchanged. Do not start T005.
