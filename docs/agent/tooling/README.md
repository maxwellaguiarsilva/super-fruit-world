# Tooling

Subject: the development commands declared in `package.json` and the constraints they operate under. The BGM formatter is documented in [music-format-cli.md](music-format-cli.md).

## Commands

| Command | Implementation | Purpose |
| --- | --- | --- |
| `bun run serve` | `scripts/serve.js` | Serves the repository root as static files. |
| `bun run data:index` | `scripts/generate-data-index.js` | Regenerates `data/index.json`. |
| `bun run validate` | `scripts/validate-data.js` | Checks the data tree for structural and referential errors. |
| `bun run check:layers` | `scripts/check-layers.js` | Checks import direction between `engine`, `game`, `app` and `main`. |
| `bun test` | Bun test runner | Runs every `test/*.test.js` file. |
| `bun run smoke` | `scripts/smoke.js` | Boots the game in headless Chromium and asserts the first transition. |
| `bun run verify:stages` | `scripts/verify-stages.js` | Boots every shipped stage through the map in headless Chromium and asserts its HUD and intro. |
| `bun run verify` | `package.json` script chain | Runs `validate`, `check:layers`, `test` and `smoke` in order. |
| `bun run format-4-beat-music` | `src/engine/audio/format-4-beat-music.ts` | Rewrites a 4/4 BGM file into a shared phrase hierarchy. |

There is no build, bundle, lint or general format command. `bun install` is required once to install `playwright-core`, the only development dependency.

## `serve`

- Port: `process.env.PORT` when it is an integer `>= 0`, otherwise `8123`. Port `0` asks the operating system for a free port.
- Root: the repository root, resolved from the script location.
- A request path that escapes the root returns `403`; a missing file returns `404`; undecodable paths return `400`.
- Directories are not listed; a path ending in `/` resolves to `index.html`.
- MIME types are fixed for `.css`, `.htm`, `.html`, `.ico`, `.js`, `.json`, `.map`, `.png`, `.svg` and `.txt`; anything else is `application/octet-stream`.
- Every response carries `Cache-Control: no-cache, no-store, must-revalidate`.
- The server prints `Serving <root> at http://localhost:<port>` and `Press Ctrl+C to stop.` and runs until interrupted. Exit codes are not part of its contract.

## `data:index`

- Walks `data/` recursively, follows symbolic links whose target is a file, keeps `.json` files and skips `data/index.json`.
- Emits repository-relative paths with `/` separators, sorted by byte comparison, in `{ "files": [...] }` form with two-space indentation and a trailing newline.
- Compares the result with the existing file before writing: an unchanged index is reported and not rewritten.
- Output lines: `data/index.json: <n> files indexed (created)`, `(updated)` or `(unchanged)`.
- Exit `0` on success, including the unchanged case. Exit `1` when `data/` does not exist. An unexpected filesystem error propagates as a non-zero exit.
- Current data set: 57 indexed entries, excluding `data/index.json` itself: 56 regular files and one symbolic link (`data/i18n/default.json` → `data/i18n/en-us.json`).
- `data/index.json` is gitignored and is generated output. Do not edit it by hand.

## `validate`

Checks, in this order:

1. Every `.json` file under `data/` parses.
2. `data/index.json` is readable, has a `files` array of unique strings, lists only files that exist, and lists every file that exists.
3. `game-config` contains every key read at boot (visual unit, canvas percent, loop rate, tile types, initial stage, save namespace, physics, player, health, damage, projectile).
4. Every declared tile type has a matching tile file whose `type` agrees with the declaration.
5. The slope tile file declares a valid `collision.slope-angle` (or null) and a `physics.slope-types` object with angles in `0..90`; every stage slope declares a positive size, a known variant and a boolean `inverted`.
6. Every BGM registry entry points at an existing file; every track has a channel object or legacy `notes`; every channel has a `notes` array.
7. The initial stage file exists.
8. Every map `stage-node` has a non-empty `stage-id`; a missing stage file is a warning for a `locked` node and an error otherwise.
9. Every text key referenced by `data/ui/**`, `data/stages/**` and the map exists in `data/i18n/default.json`.
10. Every color-valued key in every data file is a palette name, a `dark-` name or a CSS color literal.

Output:

- One `warning:` line per warning.
- One `error:` line per error.
- Summary: `Data validation passed: <n> data files, <e> error(s), <w> warning(s).` or `Data validation failed: ...`.
- Exit `0` when there are no errors, even with warnings. Exit `1` on any error.
- Current result: 57 data files, 0 errors, 0 warnings. Every map node has stage data, so the former locked-node warnings are gone.

Failure meaning:

- A parse or index error means the game cannot boot from the current data tree.
- A tile, slope, BGM, initial-stage or boot-config error means boot would throw or a stage would render or collide incorrectly when the reference is read.
- A text or color error means a screen would fall back to the raw key or to a null color.
- A warning means content is declared but unreachable; it does not block boot.

## `check:layers`

- Walks every `.js` file under `src/` and classifies it as `engine`, `game`, `app` or `main`.
- Allowed imports: `engine` → `engine`; `game` → `game`, `engine`; `app` → `app`, `game`, `engine`; `main` → `app`.
- Nothing may import `src/main.js`.
- Inspects static imports, side-effect imports, re-exports and dynamic imports; ignores package imports and files outside the layer tree.
- A violation prints `<file>:<line> imports "<specifier>" (<from> -> <to>); <rule>` and the command exits `1`.
- A pass prints `Layer check passed: <n> source files.` and exits `0`.
- Current result: 73 source files, 0 violations. The classifier and scanner are unit-tested in `test/check-layers.test.js`.

## `test`

- Discovers `test/**/*.test.js`; `test/support/stage-fixture.js` is a helper, not a test file.
- Uses Bun's built-in assertions and mocks. No snapshot files, no browser and no network. Several tests read files from `data/` and one writes a temporary directory outside the repository.
- Current run: 666 passing tests across 63 files, 2521 assertions, 0 failures.
- The suite covers the engine primitives (including the loop with exception containment, scene manager, renderer, camera, input, physics, UI base, audio and audio settings), the application seams (dependency contract, data path, progress writer, scene router), the game systems, abilities, presentation, stage collision timing and the data catalog and tools.
- `test/verify-stages.test.js` pins stage discovery, key-condition collection, the progress seed and intro resolution through the pure helpers in `scripts/verify-stages/catalog.js`.
- Audio-settings persistence is covered by the unit suite and was also browser-verified: a slider change wrote `bgm-volume: 0.8` to the `settings` record and a reload restored 80%. See [../testing.md](../testing.md#verification-status).
- Exit `0` when every test passes; non-zero when any test fails.
- Failures print the test name, the assertion and a diff; the exit code is the only signal automation needs.

## `smoke`

Requirements:

- `playwright-core` installed (`bun install`).
- A Chromium build available to Playwright, or `CHROMIUM_EXECUTABLE_PATH` pointing at a browser binary. If the browser is missing, run `bunx playwright@1.64.1 install chromium`.
- No port needs to be free: the script starts its own server with `PORT=0` and reads the assigned URL from the server output.

Sequence:

1. Start `scripts/serve.js` as a child process and wait up to 10 s for its URL line.
2. Launch headless Chromium through `scripts/smoke/browser.js` with a 1280×720 viewport.
3. Install the page hooks from `scripts/smoke/page.js`, which record every canvas `fillText`, clear `localStorage`, and stub `navigator.getGamepads` to return no gamepads.
4. Collect console messages of type `error` (ignoring favicon noise) and uncaught page errors.
5. Load the page and wait up to 10 s for the title: either a boot-error element or more than five recorded canvas strings.
6. Assert: no boot-error element; the canvas exists with a non-zero drawing surface; at least 2 distinct colors and at least 100 non-black samples across the sampled pixels; no console error and no uncaught exception during boot.
7. Press `Enter` once and wait up to 10 s for a recorded canvas string containing `Score:`.
8. Assert: the stage HUD appeared; no console error and no uncaught exception after the transition.
9. Always close the browser and stop the server (SIGTERM, then SIGKILL after 3 s).

Output: one `ok - <assertion>` line per passed assertion and `Smoke test passed.` on success. On failure it prints `SMOKE FAIL: <reason>` and, when no custom browser path was supplied, a hint about installing Chromium. Exit `0` on success, `1` on any assertion, launch or cleanup failure.

Because the init script clears storage, the smoke test always starts at the title screen with no saved progress. It does not exercise the map, a stage clear, a game over, a reload, the inventory or a teleporter.

## `verify:stages`

Requirements:

- `playwright-core` installed (`bun install`).
- A Chromium build available to Playwright, or `CHROMIUM_EXECUTABLE_PATH` pointing at a browser binary. The launch options are the same as `smoke`, built by `scripts/smoke/browser.js`.

Inputs, all read-only:

- `data/stages/*.json`: the stage set is discovered from this directory; the file name without `.json` is the stage id.
- `data/game-config.json`: `save-namespace`.
- `data/map/fruit-world.json`: stage nodes and `key-required` conditions.
- `data/i18n/default.json`: intro speaker and text resolution.

Sequence:

1. Start `scripts/serve.js` with `PORT=0` and wait up to 10 s for its URL.
2. Launch one headless Chromium with a 1280×720 viewport.
3. For each stage, create a fresh context. The context installs the page hooks from `scripts/smoke/page.js` and then seeds `localStorage` with `<save-namespace>:progress`: schema version 1, no completed stages, every discovered stage id in `unlocked-stages`, one `key:<name>` item per key-required map condition, and `last-stage` set to the stage being checked.
4. Load the page. Saved progress makes the game resume at the map, and the map prefers the selected `last-stage` node.
5. Press `Enter` once. On the map this selects and enters the preferred node.
6. Assert: the map rendered; a canvas string contains `Score:`; the first intro line's speaker and first word appear on the canvas; no boot-error element; no console error and no uncaught page error.
7. Close the context and repeat.
8. Always close the browser and stop the server, then exit explicitly.

The canvas text log is cleared after the HUD appears, so map labels cannot satisfy the dialogue assertions. Intro values come from the resolved first intro line; a stage without an intro fails.

Timeouts: 15 s navigation, 10 s boot, 10 s HUD, 8 s per dialogue string, 60 s hard limit per stage. A timed-out stage is reported as a failure and the run continues with the next stage.

Output:

- `ok - <stage-id>` per passing stage.
- `FAIL - <stage-id>` plus indented reasons per failing stage. Failures within one stage are collected before moving on.
- `Stage verification: <n> stages, <n> passed, <n> failed.`
- Exit `0` when every stage passes; `1` on any failure, including launch or cleanup failure.
- Current run: 8 stages, 8 passed, 0 failed, exit `0`.

The command does not write game data or `data/index.json`.

## `verify`

`bun run verify` runs, in order:

```sh
bun run validate
bun run check:layers
bun run test
bun run smoke
```

It is the default gate. `verify:stages` is intentionally not part of it because it launches a browser context for every stage; run it separately when stage content or map data changes.

## `format-4-beat-music`

The command is a Bun-only developer tool outside the runtime graph. It prints the same invocation that `package.json` declares, so the printed usage runs:

```sh
bun run format-4-beat-music <path-to-json>
```

The explicit file form also works: `bun src/engine/audio/format-4-beat-music.ts <path-to-json>`. Input shape, behavior, output location and exit codes are documented in [music-format-cli.md](music-format-cli.md).

## No-bundler constraint

- `index.html` loads `src/main.js` as a module; the browser fetches every imported file directly.
- Every import carries an explicit `.js` extension so the browser resolves it without a build step.
- `scripts/serve.js` only reads and serves files; it does not transform, concatenate or transpile.
- There is no `dist/` artifact and no bundling command. `dist` and `out` are gitignored in case a local tool produces them.
- `src/engine/audio/format-4-beat-music.ts` is a Bun-only developer tool outside the runtime graph; the browser never loads it.
- Any new runtime file must be reachable through static paths and explicit module specifiers; anything requiring a transform contradicts the constraint.
