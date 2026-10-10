# Project status

- State: deterministic card identity, shuffle and deal are implemented and awaiting acceptance. The page is still the Polish shell. No move rules or card interaction.
- Current task: **T002 — REVIEW**. T001 is DONE. No later task is assigned.
- Branch: `master`; use the existing branch and verify it each session.
- Canonical task states: [TASKS.md](TASKS.md). Delivery/evidence: [reports/T002.md](reports/T002.md). T001 evidence remains [reports/T001.md](reports/T001.md).

## Completed deliverables / milestones

- T000 DONE: coordinator acceptance of eba965185ef8a60edf81f0318ab0fbf3481604f8.
- T001 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted commit `339e0f852b60c691f52d6204aa7225b899c5844f`. Browser console and visual checks stay outstanding QA and were waived only as a T001 completion gate.
- T002 REVIEW: `createGame`, Mulberry32/Fisher–Yates version 1, golden deals for seeds 0, 1, 42 and 4294967295, unit tests and a Node 22 CI workflow. Not accepted.
- P1 is incomplete until T002 is DONE. T003–T023 remain TODO.

## Known problems and blockers

- GitHub Actions workflow is committed but has not run on a runner. No push was made.
- Browser console and rendered layout were not verified. Browser automation still cannot start (`DevToolsActivePort not found`).
- `filelist.txt` is absent and was not recreated.
- Node 22.22.0 / npm 10.9.4; Vite 8.3.4, Vitest/coverage-v8 5.0.3; zero runtime dependencies. `src/engine/cards.js` coverage is 100% statements/branches/functions/lines. The production bundle does not import the engine yet.
- A leftover local `npm run dev` was stopped so `npm ci` could replace a locked rolldown binding.

## Next recommendation

The coordinator reviews T002. After acceptance and a separate explicit assignment, [T003](tasks/T003.md) adds transfer rules and board invariants. Stop until then.
