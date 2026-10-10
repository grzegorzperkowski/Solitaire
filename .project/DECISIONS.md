# Coordination decisions

Product/rule/data decisions remain in REQUIREMENTS.md and ARCHITECTURE.md. This file records only additional workflow decisions. Changes to the product contract require coordinated updates to those sources, not a conflicting rule here.

| ID / date | Decision | Reason / authority |
| --- | --- | --- |
| D001 / 2026-10-10 | Human owner assigns and accepts tasks, with ChatGPT as external architecture/quality advisor. Codex, Grok or another model implements one assigned task at a time on the current branch; no orchestration, parallel agents, worktrees or automatic pushing. | Explicit owner instruction for this workflow; avoids concurrent edits and hidden coordination state. |
| D002 / 2026-10-10 | TASKS.md owns task status; task files own bounded scope/acceptance, reports own evidence and approval, STATUS/HANDOFF summarize the current handoff. Existing milestone/design documents keep their roles. | A fresh model can recover from repository files without duplicating specifications. |
| D003 / 2026-10-10 | Agent delivery is REVIEW. Only recorded coordinator approval makes DONE; dependency completion and next-task assignment are separate gates. | A successful commit/test run is not acceptance or permission to continue. |
| D004 / 2026-10-10 | T000 records this workflow setup. P1–P10 are split into T001–T023; T016 is optional and T023 requires explicit publication authorization. Split milestones keep all original exit criteria. | Small reviewable handoffs without changing the approved design scope or claiming publication before it occurs. |
| D005 / 2026-10-10 | Model suitability is advice based on capabilities needed, never a permanent assignment. All task specs are model-neutral; no model-specific tooling or private context is required. | Models/tools change; the human chooses the available implementer each time. |
| D006 / 2026-10-10 | Include previously untracked design files in T000's baseline commit; leave unrelated filelist.txt untouched/untracked. | Repository-only recovery requires the design in Git; unrelated local work must be preserved. |

T000 decisions accepted by the coordinator on 2026-10-10 after verification of commit eba965185ef8a60edf81f0318ab0fbf3481604f8; see reports/T000.md. The separate T001 assignment authorizes only bootstrap work.
