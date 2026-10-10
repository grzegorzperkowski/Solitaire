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
- T002 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation commit `d3c36f1df1d46d136e81d8c174f1636debed8a76`. Acceptance tracking commit: `2064a3da002e11209e463365c4d4a425980f5226`.
- T003 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `774b3e634e2b6991a91c4e24952b1919b0e4a484`. Accepted quality improvements `75070087cb4d49db1323467f8a7efb1737d325c0`. DOM-free `validateMove`, `applyMove`, `assertInvariants` and `isWon` in `src/engine/game.js`. Evidence: [reports/T003.md](reports/T003.md).
- Foundations use suit order trefl, karo, kier, pik. Tableau `cardIndex` starts the whole face-up suffix. A reveal is the newly exposed card id on that same move, or null. `isWon` requires four complete legal foundations and empty stock, waste and tableau.
- `assertInvariants` throws `invalid-state` for broken decks, face-up order and foundation contents. Move evaluation does not call it; tests and later restore do.
- Golden deals remain in `tests/fixtures/deals.json`. Hand-built boards are `tests/fixtures/boards.js`.
- The page shell does not import the engine. No `getLegalMoves`, session, storage or Playwright. `draw` and `recycle` still return `unsupported-command` in the acceptance commit.
- QA still open, not passed: browser console and visual/layout checks. GitHub Actions has not run on a remote runner. `filelist.txt` is absent; do not recreate it.
- Node 22.22.0 / npm 10.9.4; Vite 8.3.4, Vitest and coverage-v8 5.0.3. Zero runtime dependencies.
- T004 is assigned by the same 2026-10-10 instruction. It is not started in the acceptance commit. T005 is not assigned.
- Resolve T003 implementation with `774b3e634e2b6991a91c4e24952b1919b0e4a484` and quality improvements with `75070087cb4d49db1323467f8a7efb1737d325c0`, not the later acceptance-tracking commit.

## Blockers / next steps

- Implement T004 only: [tasks/T004.md](tasks/T004.md). Dependency T003 is DONE.
- T004 adds Draw 1/Draw 3, separate recycle and `getLegalMoves`. Keep the accepted tableau, waste and foundation transfers unchanged.
- Browser console, rendered layout and remote CI remain outstanding and are not T004 blockers.

## Test commands

Available now: `npm ci`, `npm test` (vitest run, non-watch), `npm run test:coverage`, `npm run build`. Required T004 file: `npm test -- tests/unit/game.test.js`. See [README.md](../README.md).

Latest local results at the T003 quality commit are in [reports/T003.md](reports/T003.md): `npm test` 28 passed; engine coverage statements 98.38% and branches 98.41%; `npm run build` exit 0.

Before committing run `git diff --check` and `git diff --cached --check`. Do not report unexecuted browser, device or GitHub Actions checks as passed.
