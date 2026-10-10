# Project instructions

## Scope and sources of truth

- Work only on the task explicitly assigned by the human coordinator. The human owner coordinates with ChatGPT as an external architecture/quality advisor; Codex, Grok and other coding models implement sequentially. Repository files, not conversation history, are the project memory.
- Before changing game behavior, read [REQUIREMENTS.md](REQUIREMENTS.md) for rules and acceptance criteria, and [ARCHITECTURE.md](ARCHITECTURE.md) for state/command/persistence contracts.
- Milestones remain in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md); task status and acceptance gates live in [.project/TASKS.md](.project/TASKS.md). Read the relevant cases in [TEST_PLAN.md](TEST_PLAN.md) before changing engine, storage, input or layout. Keep changed decisions consistent across these documents.

## Sequential task protocol

1. Read this file, [.project/STATUS.md](.project/STATUS.md), [.project/HANDOFF.md](.project/HANDOFF.md), then the assigned `.project/tasks/Txxx.md` and any existing report. If no task is explicitly assigned, stop; a recommended task is not an assignment.
2. Inspect `git status --short`, `git branch --show-current` and `git log -5 --oneline`; read the task's referenced design/test sections. Dependencies must be DONE with recorded coordinator approval. Record the assignment and set only that task IN_PROGRESS before implementation.
3. Implement only that task on the current branch. One implementation agent at a time: no parallel agents, automated orchestration, worktrees or agent branches. No branch creation unless explicitly requested. Never overwrite, discard or include unrelated uncommitted work without permission.
4. Run applicable checks. Update `.project/reports/Txxx.md` with changes, exact commands/results, remaining issues and resume instructions; update TASKS, STATUS and HANDOFF. Record new non-architectural decisions in DECISIONS only when needed.
5. Commit validated task changes and meaningful checkpoints with a task-ID message, e.g. `T003: implement Klondike move validation`. Inspect the staged diff and stage explicit paths. Do not push automatically. For interruption, checkpoint task-owned progress in Git and document unfinished work and unrun/failing checks; a checkpoint is not acceptance.
6. Set REVIEW when implementation and required checks are ready for coordinator acceptance; use BLOCKED for an unmet requirement and record what unblocks it. Only mark DONE after explicit coordinator approval recorded in the report (date, approver and accepted commit). A commit or advisor review alone is not approval. Stop and wait; never start the next task automatically.

If interrupted with an IN_PROGRESS/BLOCKED task, resume it only when the coordinator assigns/resumes it. If a dirty file overlaps the task and ownership is unclear, ask before editing that file. Preserve unrelated changes and note them in the report. Approval of one task never assigns its successor.

## Implementation conventions

- Use vanilla JavaScript ES modules, HTML, CSS and SVG, with Vite, Vitest and Playwright. Keep runtime dependencies at zero unless a concrete requirement justifies a change. Player-facing text and accessible names are Polish.
- Engine code is DOM-free and deterministic. All input methods, hints and completion submit the same validated commands. Invalid actions leave state/history intact; reveal belongs to the move that uncovers the card.
- Use the specified CardId/array-top conventions and versioned seed algorithm. Treat shuffle, rules and save schema changes as compatibility changes with fixtures/migrations or explicit rejection.
- Keep clocks, statistics, selection and gestures out of board state. Preserve history and exactly-once win accounting through save/restore and Undo/Redo.
- Design at 320 CSS px first: seven columns fit horizontally; readable exposed bands take priority over avoiding vertical scroll. Preserve keyboard play, browser zoom, safe areas and reduced motion.
- Treat persisted data as untrusted. Validate bounded input, replay moves, preserve the prior save on failure, and surface a Polish recovery message.
- Before a bug fix, find all callers and fix the shared cause. Reuse existing helpers and patterns; add abstractions only for demonstrated needs.

## Verification

- Use repository scripts once they exist; do not claim planned commands or unrun tests passed. New nontrivial logic needs a focused test; rule changes also need invariant/history coverage.
- Check production builds and a repository subpath before deployment. Real-device touch/Safari checks supplement Playwright emulation; disclose missing device evidence.
- Keep changes within the requested scope. Report what changed, checks actually run and remaining limitations. Do not silently reset local saves, discard user changes or publish.

<!-- context7 -->
## Current documentation

Use Context7 MCP whenever the user asks about a library, framework, SDK, API, CLI tool or cloud service, including syntax, configuration, migration, library-specific debugging, setup and CLI usage. Use it even for familiar tools; prefer it over web search for library documentation.

1. Start with `resolve-library-id` using the library name and the documentation question, unless the user supplied an exact `/org/project` ID.
2. Choose by exact name, relevance, source reputation, snippet count and benchmark score. Retry an alternate name/query if results are poor; select a version-specific ID when a version is requested.
3. Call `query-docs` with that ID and a focused concept. Query unrelated concepts separately; combine only when their interaction is the question.
4. Use the fetched documentation in the answer. If the tool is unavailable, state the limitation and consult official primary documentation instead of inventing current APIs.

This lookup is not required for ordinary refactoring, writing scripts from scratch, business-logic debugging, code review or general programming concepts.
<!-- context7 -->
