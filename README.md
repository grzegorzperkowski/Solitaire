# Pasjans Klondike

Polish, mobile-first Klondike project. Current implementation: **T001 bootstrap only** — a responsive Polish HTML page, local CSS, a vanilla JavaScript ES-module entry and Node-based bootstrap tests. Solitaire rules, cards, interactions and persistence are not implemented yet.

For a fresh AI session start with [AGENTS.md](AGENTS.md), [.project/STATUS.md](.project/STATUS.md) and [.project/HANDOFF.md](.project/HANDOFF.md). Work only on the explicitly assigned task.

## Requirements and versions

- Validated environment: Node.js **22.22.0**, npm **10.9.4**.
- Supported Node ranges: `^22.12.0 || ^24.0.0 || >=26.0.0`, matching Vitest 5 and satisfying Vite's requirement. Use a maintained LTS release within this range.
- Exact development dependencies: Vite **8.3.4**, Vitest **5.0.3**, `@vitest/coverage-v8` **5.0.3**. package-lock.json records transitive versions.
- No runtime dependencies, DOM emulation library or Playwright installation.

Requirements checked against the published npm package `engines`/peer dependencies and current official docs via Context7: [Vite setup](https://vite.dev/guide/), [Vitest setup](https://vitest.dev/guide/). Node 22.22.0 satisfies the selected versions; the coverage provider matches Vitest exactly.

## Run locally

```sh
npm ci
npm run dev
```

Use the local URL printed by Vite. To preview production output:

```sh
npm run build
npm run preview
```

Both servers bind to the local machine by default. Stop them with Ctrl+C. Preview is for local verification, not a production hosting server.

## Checks

```sh
npm test
npm run test:coverage
npm run build
```

`npm test` runs `vitest run` once (non-watch). Tests inspect the actual Polish document/viewport/module wiring and import the real entry with its local stylesheet. They need no DOM emulator and do not claim browser layout, browser console or game-rule coverage. The entry currently only imports CSS, so coverage has no meaningful gameplay statements to measure; future engine coverage targets remain in TEST_PLAN.md.

## Static hosting compatibility

The initial Vite `base` is `./`, keeping built asset references relative so this single-page shell can be served from a repository subdirectory. The eventual Pages path is not hard-coded and no deployment workflow is installed. For an explicit path smoke test:

```sh
npm run build -- --base=/Solitaire/
npm run preview -- --base=/Solitaire/
```

Open the printed local URL under `/Solitaire/`. Run plain `npm run build` afterwards to restore the default relative-base artifact. During the assigned hosting/PWA tasks select the actual repository path and verify manifest/service-worker scope; no hosting or offline capability is claimed by this bootstrap. See [Vite public base path](https://vite.dev/guide/build.html#public-base-path).

Build output (`dist/`), dependencies (`node_modules/`) and coverage reports (`coverage/`) are already ignored by .gitignore. Keep package-lock.json committed.
