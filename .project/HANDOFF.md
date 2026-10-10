# Fresh-session handoff

## Resume protocol

1. Read [AGENTS.md](../AGENTS.md), [STATUS.md](STATUS.md) and this file.
2. Confirm the human's explicit task ID; read its specification in `tasks/`, existing report in `reports/`, and dependency/status row in [TASKS.md](TASKS.md). No assignment means stop and wait.
3. Run `git status --short`, `git branch --show-current`, `git log -5 --oneline`; inspect task-owned unfinished changes. Preserve unrelated dirty files.
4. Read the task's referenced root design/test sections and relevant [DECISIONS.md](DECISIONS.md). Do not rely on past chat context.
5. Perform only the assigned task, verify it, update report/status/handoff, commit with its ID and stop at REVIEW or a documented blocker.

## Current state and recent changes

- T000 DONE: eba965185ef8a60edf81f0318ab0fbf3481604f8. See reports/T000.md.
- T001 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation commit `339e0f852b60c691f52d6204aa7225b899c5844f`. Acceptance tracking commit subject: `T001: record coordinator acceptance`.
- QA exception still open: browser console and visual/layout checks were not run. They are waived only as a T001 completion gate. Do not report them as passed.
- T002 REVIEW: DOM-free `src/engine/cards.js` deals a frozen GameState. Public entry is `createGame`. Suit order is trefl, karo, kier, pik. Rejected options throw `Error` with a `reason` string (`invalid-options`, `invalid-seed`, `invalid-draw-count`, `unsupported-rules-version`, `unsupported-shuffle-version`). Golden deals: `tests/fixtures/deals.json`. Evidence: [reports/T002.md](reports/T002.md).
- The page shell does not import the engine. No moves, history, storage or Playwright.
- Node 22.22.0 / npm 10.9.4; Vite 8.3.4, Vitest and coverage-v8 5.0.3. Zero runtime dependencies. `package.json` and `vite.config.js` were not changed in T002.
- Resolve T002 delivery with `git log -1 --format="%h %s" --grep="^T002:"`. Do not treat this recommendation as permission to start T003.
- `filelist.txt` is not in the tree. Do not recreate it.

## Blockers / next steps

- Await coordinator acceptance of T002. T003 is not assigned.
- GitHub Actions (`.github/workflows/ci.yml`) has not been executed remotely.
- Browser console and 320px/desktop rendering remain outstanding QA from T001.
- The local Vite process started by `npm run dev` was stopped during T002 so `npm ci` could delete a locked native module. Start it again only when a human wants a preview.

## Test commands

Available now: `npm ci`, `npm test` (vitest run, non-watch), `npm run test:coverage`, `npm run build`. Card-only: `npm test -- tests/unit/cards.test.js`. See [README.md](../README.md).

Latest local results are in [reports/T002.md](reports/T002.md): `npm ci` exit 0 after stopping Vite; `npm test` 8 passed; card file 6 passed; `npm run build` exit 0; engine coverage 100%.

Before committing run `git diff --check` and `git diff --cached --check`. Simulation/E2E scripts do not exist until their assigned tasks create them. Do not report unexecuted browser, device or GitHub Actions checks as passed.
