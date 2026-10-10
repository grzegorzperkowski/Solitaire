# Fresh-session handoff

## Resume protocol

1. Read [AGENTS.md](../AGENTS.md), [STATUS.md](STATUS.md) and this file.
2. Confirm the human's explicit task ID; read its specification in `tasks/`, existing report in `reports/`, and dependency/status row in [TASKS.md](TASKS.md). No assignment means stop and wait.
3. Run `git status --short`, `git branch --show-current`, `git log -5 --oneline`; inspect task-owned unfinished changes. Preserve unrelated dirty files.
4. Read the task's referenced root design/test sections and relevant [DECISIONS.md](DECISIONS.md). Do not rely on past chat context.
5. Perform only the assigned task, verify it, update report/status/handoff, commit with its ID and stop at REVIEW or a documented blocker.

## Current state and recent changes

- T000 DONE: coordinators authorized acceptance subject to verification, which passed for eba965185ef8a60edf81f0318ab0fbf3481604f8; see reports/T000.md.
- T001 REVIEW: minimal Polish page with semantic HTML, responsive CSS and an ES module importing CSS. No cards/rules/interactions/storage or Playwright.
- Node 22.22.0 / npm 10.9.4; Vite 8.3.4, Vitest and coverage-v8 5.0.3. Zero runtime dependencies; lockfile committed. Details in [reports/T001.md](reports/T001.md).
- The human's assignment explicitly added a bootstrap smoke test and CSS; the task spec records that clarification. Both tests passed in non-watch Node mode.
- Relative Vite base (`./`) is the bootstrap default; explicit `/Solitaire/` build and preview also verified through HTTP. Deployment/manifest/worker work remains later tasks.
- Resolve delivery with `git log -1 --format="%h %s" --grep="^T001:"`. Reports do not embed their own commit hash.

## Blockers / next steps

- Await T001 acceptance and explicit T002 assignment. This recommendation is not permission.
- No browser was available through the tools; console and visual/mobile rendering remain unverified. All task-owned dev/preview servers were stopped after HTTP checks.
- Preserve unrelated untracked filelist.txt. .gitignore already covers node_modules/dist/coverage and was left unchanged.
- Bootstrap tests verify HTML/module wiring, not engine rules or browser behavior. Coverage reports zero statements; add meaningful engine tests in T002, not placeholder coverage.

## Test commands

Available now: `npm ci`, `npm test` (vitest run, non-watch), `npm run test:coverage`, `npm run build`. See [README.md](../README.md) for dev/preview and repository-subpath checks.

Verified servers: `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort` and `npm run preview -- --host 127.0.0.1 --port 4173 --strictPort`. Both HTTP smoke checks passed. The explicit-base preview additionally used `--base=/Solitaire/` after a matching build. Stop servers after testing.

Before committing run `git diff --check` and `git diff --cached --check`. Simulation/E2E scripts do not exist until their assigned tasks create them. Do not report unexecuted browser/device checks as passed.
