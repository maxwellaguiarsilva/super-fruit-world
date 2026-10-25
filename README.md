# Super Fruit World

Browser platformer written in plain ES modules and served as static files. There is no bundler and no build step: `index.html` loads `src/main.js` directly as a module, so the files under `src/` are the files the browser executes.

## Requirements

- Bun 1.4.0 or newer. No runtime dependencies are declared.

## Run the game

```sh
bun run serve
```

Then open <http://localhost:8123>. The server exposes the repository root with correct MIME types for `.js`, `.json`, `.html` and `.css`, and sends no-cache headers so reloads always pick up edited sources.

To use another port:

```sh
PORT=9000 bun run serve
```

Keep the server running while playing and stop it with `Ctrl+C`.

## Regenerate the data index

`data/index.json` lists every `.json` file under `data/` with repository-root-relative paths, and `DataDriven` loads those files through it. The index is generated and gitignored, so regenerate it after adding, renaming or removing a data file:

```sh
bun run data:index
```

The generator walks `data/` recursively, skips `data/index.json` itself, emits POSIX separators in deterministic sorted order, and prints how many files were indexed. Running it again without data changes reports an unchanged index and rewrites nothing.

## Validate the data

```sh
bun run validate
```

Checks that every JSON file under `data/` parses, that `data/index.json` matches the files on disk, that tile types, slope data and BGM tracks resolve, that stage files referenced by the initial stage and the map exist, that text keys and color names resolve, and that `game-config` contains the keys read at boot. It prints one line per problem and exits non-zero on any error. The current tree has 57 data files and reports 0 errors and 0 warnings.

## Validate stage playability

```sh
bun run validate:playability
```

Checks every stage under `data/stages/` for a collectible embedded in solid geometry or a slope wedge, inside a spike or pit, below or outside the tile geometry, or unreachable from the spawn. It also reports a missing spawn, a spawn inside solid or deadly geometry, an unusable checkpoint, a teleporter or marker inside solid geometry, and an enemy overlapping solid geometry. Reachability uses a 0.25-unit flood fill that over-approximates movement: solid non-slope tiles block, including solid deadly spikes; non-solid deadly pits do not block; slopes, liquids and ladders do not block. The fill is not a play-through proof.

The current tree reports 8 stages, 5 errors and 0 warnings with exit `1`. The five findings are across three Strawberry Fields pickups: a coin at world (98.5, -12) and an apple at (98.5, -8) overlap the solid platform box (97, -15, 3, 10), and a musical note at (159, -21) overlaps the solid wedge of `slope-45` box (155, -22, 5, 3). The exit-door is checked as a collectible and receives no reachability finding, but the fill is an over-approximation of movement, so this is not a play-through proof; `test/stage-catalog.test.js` asserts exactly one exit-door per stage.

## Export stage maps

```sh
bun run export:stage-maps
```

Writes a schematic overview and fixed-scale chunks plus manifests under `out/stage-maps/`. Defaults are `--out out/stage-maps`, `--scale 24` and `--max-size 1400`; `--stage <id>` is repeatable. Output tree:

```text
out/stage-maps/
├── index.json
└── <stage-id>/
    ├── manifest.json
    ├── overview.png
    ├── overview.svg
    ├── chunk-00.png
    ├── chunk-00.svg
    └── ...
```

Requires `playwright-core` and a Chromium build through the shared `scripts/smoke/browser.js` launcher; `CHROMIUM_EXECUTABLE_PATH` selects another binary. The exporter is advisory: static findings are drawn as badges and recorded in the manifest but never fail the export. Current result: `Stage map export: 8 stages, 29 images, 0 failed.` It is not part of `bun run verify`.

## Check the layer rule

```sh
bun run check:layers
```

Scans every `.js` file under `src/` and fails when an import crosses the allowed direction: `engine` may import only `engine`, `game` may import `game` and `engine`, `app` may import `app`, `game` and `engine`, and `main` may import `app`. Nothing may import `src/main.js`. The current tree has 73 source files and 0 violations.

## Run the boot smoke test

```sh
bun run smoke
```

Starts `scripts/serve.js` on a free port, launches headless Chromium through the `playwright-core` development dependency, loads the page, and checks for console errors, uncaught exceptions, a boot-error element and a blank canvas. Run `bun install` once to install the development dependency. It then presses Enter once and waits for the stage HUD score label. The test uses the Playwright browser cache; if Chromium is not installed, run `bunx playwright@1.64.1 install chromium`. Set `CHROMIUM_EXECUTABLE_PATH` to use a different browser binary.

The browser and the server are always shut down, including when an assertion fails.

## Run the tests

```sh
bun test
```

The suite in `test/` covers DOM-free modules imported by relative path with explicit `.js` extensions. It uses no snapshots, no network and no browser. Some tests read files from `data/`, and two tests write temporary directories outside the repository. Current run: 739 passing tests across 65 files, 2902 assertions.

## Run all checks

```sh
bun run verify
```

Runs `validate`, `check:layers`, `test` and `smoke` in that order. It does not include `verify:stages`, which needs a browser context per stage, `validate:playability`, which is a geometric content check with known findings on the shipped tree, or `export:stage-maps`, which is a browser-based advisory export.

## Verify every stage

```sh
bun run verify:stages
```

Seeds progress so every stage node and key is unlocked, enters each stage through the map, and asserts the HUD, the first intro line, absence of a boot error and no console or page errors. It starts and stops its own server and browser and exits non-zero on any failure. Current run: 8 stages, 8 passed, 0 failed. It checks stage entry and the intro, not a playthrough.

## No-bundler constraint

- Source files are served directly by the static server; imports keep explicit `.js` extensions so the browser resolves them without a build.
- There is no `dist/` artifact and no bundling command. A bundle produced elsewhere is not part of this repository's workflow.
- `scripts/serve.js` only serves files; it does not transform or concatenate them.

## Layout

| Path | Purpose |
| --- | --- |
| `index.html` | Entry document, loads `src/main.js` as a module. |
| `src/` | Application, game and engine modules. |
| `data/` | JSON configuration and content. |
| `scripts/` | Development scripts: static server, data index generator, data validator, playability validator, stage-map exporter, layer check, smoke test, stage verification, the shared browser harness and the shared `scripts/stage-analysis/` modules. |
| `test/` | Bun test suite. |
| `docs/agent/` | Agent-facing documentation: architecture by layer, data model, gameplay, decisions, testing, tooling and roadmap. Start at `docs/agent/README.md`. |
