# Previous SmartHint

`smart-hints-90fba4f.js` freezes the planner from commit
`90fba4f336081367a8d28e25cde1b13d9923f227`, immediately before the strategic-goal
revision. Only relative imports were relocated to `../../src/engine/`.
The shared game/cards/knowledge/progress modules did not change between that
commit and the benchmark assignment base `5fbae47`.

Keep this file unchanged when improving the current planner. The unit test
verifies its original normalized source SHA-256 after reversing import relocation:
`77bacb4aebc3f2ba582f3ffc6948c41aa2fe0ba034245a7fcd6f1f8b93e388d9`.

The current version remains `src/engine/smart-hints.js`, used directly by both
the game and the benchmark. The frozen version is only imported by Node benchmark
code and tests; it is not part of the browser application bundle.
