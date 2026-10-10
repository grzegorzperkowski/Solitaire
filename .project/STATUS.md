# Project status

- State: deterministic deal is accepted. Tableau, waste and foundation transfers, atomic reveal and win detection are implemented and awaiting acceptance. Draw, recycle and legal-move enumeration are not. The page is still the Polish shell.
- Current task: **T003 — REVIEW**. T000–T002 are DONE. No later task is assigned.
- Branch: `master`; use the existing branch and verify it each session.
- Canonical task states: [TASKS.md](TASKS.md). Delivery/evidence: [reports/T003.md](reports/T003.md).

## Completed deliverables / milestones

- T000 DONE: coordinator acceptance of eba965185ef8a60edf81f0318ab0fbf3481604f8.
- T001 DONE: accepted 2026-10-10. Accepted commit `339e0f852b60c691f52d6204aa7225b899c5844f`. Browser console and visual checks stay outstanding QA and were waived only as a T001 completion gate.
- T002 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted commit `d3c36f1df1d46d136e81d8c174f1636debed8a76`.
- T003 REVIEW: `validateMove`, `applyMove`, `assertInvariants` and `isWon`. Not accepted.
- P1 is complete. P2 is incomplete until T003 is DONE and T004–T005 are done. T004–T023 remain TODO.

## Known problems and blockers

- GitHub Actions workflow is committed but has not run on a runner. No push was made.
- Browser console and rendered layout were not verified. Browser automation still cannot start (`DevToolsActivePort not found`).
- `filelist.txt` is absent and was not recreated.
- `draw` and `recycle` reject with `unsupported-command` until T004. There is no `getLegalMoves` yet, so the hint half of T08 is not implemented.
- Node 22.22.0 / npm 10.9.4; Vite 8.3.4, Vitest/coverage-v8 5.0.3; zero runtime dependencies. The production bundle does not import the engine yet.
- CI has no explicit `permissions: contents: read`. The workflow does not deploy or read secrets.

## Next recommendation

The coordinator reviews T003. After acceptance and a separate explicit assignment, [T004](tasks/T004.md) adds draw, recycle and complete legal-action enumeration. Stop until then.
