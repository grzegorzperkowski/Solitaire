# Fresh-session handoff

## Resume protocol

1. Read [AGENTS.md](../AGENTS.md), [STATUS.md](STATUS.md) and this file.
2. Confirm the human's explicit task ID; read its specification in `tasks/`, existing report in `reports/`, and dependency/status row in [TASKS.md](TASKS.md). No assignment means stop and wait.
3. Run `git status --short`, `git branch --show-current`, `git log -5 --oneline`; inspect task-owned unfinished changes. Preserve unrelated dirty files.
4. Read the task's referenced root design/test sections and relevant [DECISIONS.md](DECISIONS.md). Do not rely on past chat context.
5. Perform only the assigned task, verify it, update report/status/handoff, commit with its ID and stop at REVIEW or a documented blocker.

## Current state and recent changes

- T000 DONE: eba965185ef8a60edf81f0318ab0fbf3481604f8.
- T001 DONE: accepted 2026-10-10. Implementation commit `339e0f852b60c691f52d6204aa7225b899c5844f`.
- T002 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation commit `d3c36f1df1d46d136e81d8c174f1636debed8a76`. DOM-free `createGame` in `src/engine/cards.js`. Golden deals: `tests/fixtures/deals.json`. Evidence: [reports/T002.md](reports/T002.md).
- QA still open, not passed: browser console and visual/layout checks (waived only as a T001 gate). GitHub Actions has not run on a remote runner. `filelist.txt` is absent; do not recreate it.
- The page shell does not import the engine. No move rules in the T002 acceptance commit.
- Node 22.22.0 / npm 10.9.4; Vite 8.3.4, Vitest and coverage-v8 5.0.3. Zero runtime dependencies.
- T003 is assigned by the same 2026-10-10 instruction. It is not started in the acceptance commit. T004 is not assigned.
- Resolve T002 implementation with commit `d3c36f1df1d46d136e81d8c174f1636debed8a76`, not the later acceptance-tracking commit.

## Blockers / next steps

- Implement T003 only: [tasks/T003.md](tasks/T003.md). Dependency T002 is DONE.
- T003 includes tableau suffix moves, foundation build and return, waste top moves, atomic reveal, `assertInvariants` and `isWon`. Draw, recycle and `getLegalMoves` belong to T004; unsupported stock commands must reject without changing state.
- Browser console, rendered layout and remote CI remain outstanding and are not T003 blockers.

## Test commands

Available now: `npm ci`, `npm test` (vitest run, non-watch), `npm run test:coverage`, `npm run build`. Card-only: `npm test -- tests/unit/cards.test.js`. See [README.md](../README.md).

Before committing run `git diff --check` and `git diff --cached --check`. Do not report unexecuted browser, device or GitHub Actions checks as passed.
