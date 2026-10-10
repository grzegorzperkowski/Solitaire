# Project status

- State: T009 and T010 follow-ups are accepted; T000–T014 are DONE. T015 is DONE; accepted by the human coordinator on 2026-10-10 at `b01fb49`.
- Current task: T017 IN_PROGRESS, assigned by the human coordinator on 2026-10-10. T015 dependency accepted at `b01fb49`.
- Branch: `master`; use the existing branch and verify it each session.
- Canonical task states: [TASKS.md](TASKS.md). Current delivery/evidence: [reports/T015.md](reports/T015.md).

## Completed deliverables / milestones

- T000 DONE: coordinator acceptance of eba965185ef8a60edf81f0318ab0fbf3481604f8.
- T001 DONE: accepted 2026-10-10. Accepted commit `339e0f852b60c691f52d6204aa7225b899c5844f`. Browser console and visual checks stay outstanding QA and were waived only as a T001 completion gate.
- T002 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted commit `d3c36f1df1d46d136e81d8c174f1636debed8a76`.
- T003 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `774b3e634e2b6991a91c4e24952b1919b0e4a484`. Accepted quality improvements `75070087cb4d49db1323467f8a7efb1737d325c0`.
- T004 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `1073dfb1828dff1944713c616c9019cfcdc14056`. Independent review `2af3ee4fead49ceab3d9d3cc9143c69c568429f4`.
- T005 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `509fe7b911ce6d336bd55bfdc362778e93fd0cc1`.
- T006 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `63b28ce3ee585ee8f243aca37e382e1f2f74983d`.
- T007 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `a4b2f853598d6020caac4cd97938a7b8ff8b97d2`.
- T008 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `a1a7567`.
- T009 original implementation DONE: accepted 2026-10-10 at `ae85d6b`; mobile spacing, card visibility and classical court artwork follow-ups accepted 2026-10-10 at `ccc9556`.
- T010 original implementation DONE: accepted 2026-10-10 by the human coordinator and ChatGPT at `bdd275c`; follow-up dialog-focus test revision accepted 2026-10-10 at `496f33f`.
- T011 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `fa1aa9c`.
- T012 DONE: accepted 2026-10-10 by the human coordinator at commit `916b3bd`.
- T013 DONE: physical checks on iPhone 15 and Android 12 found no problems; accepted 2026-10-10 at `916b3bd`. iOS/browser versions were not supplied; see [reports/T013.md](reports/T013.md).
- T014 DONE: accepted 2026-10-10 by the human coordinator at commit `6149f52`; legal-hint ranking and empty-action feedback are implemented. See [reports/T014.md](reports/T014.md).
- P1–P6 are complete. P7 is complete. T016–T023 remain TODO; T016 is optional.

## Known problems and blockers

- GitHub Actions workflow is committed but has not run on a runner. No push was made.
- `filelist.txt` is absent and was not recreated.
- Hints now rank legal actions using visible information and the F04 order. Empty legal-action feedback does not imply a loss or solvability result.
- Node 22.22.0 / npm 10.9.4; Vite 8.3.4, Vitest/coverage-v8 5.0.3, Playwright 1.64.0; zero runtime dependencies.

## Next recommendation

- T009 and T010 follow-ups are accepted; see their reports. T015 is accepted; wait for an explicit assignment before starting T016 or T017.

- T015 validation: 131 unit tests, 68 production-preview Chromium E2E tests and build passed. Seed/copy, per-mode statistics, win/reload/practice and safe preference/recovery flows implemented. No new physical-device evidence or push.

- T015 follow-up: seed input and seed/copy summary are collapsed by default behind keyboard-accessible downward disclosures; production build and targeted UI checks passed. See reports/T015.md.

- T015 chevron refinement: CSS-drawn indicator replaces the low-aligned text glyph. Build and 320px/landscape dialog checks passed; screenshot visually inspected. See reports/T015.md.

- T015 accepted by the human coordinator at `b01fb49`. P7 task complete. Optional T016 was not selected.

- T017 follow-up: added a one-shot stock shuffle and staggered tableau deal for new games started in the UI. Build and diff check passed; no animation tests or manual inspection were run per coordinator instruction. T017 remains IN_PROGRESS; see reports/T017.md.
- T017 pacing refinement: increased per-card animation to 180 ms and column stagger to 55 ms (about 510 ms total). See reports/T017.md.
- T017 appearance correction: new-game animation no longer scales, fades or moves cards; it sequences outline highlights instead. Build and diff check passed; see reports/T017.md.
- T017 layout refinement: increased spacing between the tableau and bottom controls by 4 px at each responsive breakpoint. Build passed; see reports/T017.md.
- T017 new game animation redesign: UI starts one of three random decorative shuffle overlays using local card backs; board state remains static and reduced motion skips it. Build passed; no animation tests or visual inspection were run. See reports/T017.md.
- T017 variant distribution fix: shuffled queue guarantees all three shuffle effects appear within every three new games, with no repeat across queue boundaries. Build passed; see reports/T017.md.
