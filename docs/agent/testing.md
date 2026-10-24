# Testing

Subject: how the project is verified, what each test file pins, what the smoke test asserts, what the layer check and the validator cover, and which behavior remains unverified. Commands and exit codes are documented in [tooling/README.md](tooling/README.md).

## How to run

| Check | Command | Expected current result |
| --- | --- | --- |
| Unit suite | `bun test` | 666 passing, 0 failing, 63 files, 2521 assertions. |
| Data validation | `bun run validate` | 57 data files, 0 errors, 0 warnings. |
| Layer direction | `bun run check:layers` | 73 source files, 0 violations. |
| Boot and transition smoke | `bun run smoke` | Passes. |
| Stage boot verification | `bun run verify:stages` | 8 stages, 8 passed, 0 failed. |
| Default gate | `bun run verify` | `validate`, `check:layers`, `test` and `smoke` in that order. |

`bun run verify` is the default gate. It deliberately excludes `verify:stages` because that command launches a browser context per stage and is slower; run it when stage content changes or before a release.

The unit-suite, validator and layer-check results are from the last full run. The smoke and stage-verification results are the recorded runs. The manual browser observations in [Verification status](#verification-status) come from separate recorded runs and are not reproduced by the automated suite.

## Suite layout

- Test files live directly under `test/` and are named `<subject>.test.js`.
- `test/support/stage-fixture.js` builds a `Stage` with stubbed physics, collision, factories and damage so stage behavior can be exercised without a browser.
- Tests import source modules by relative path with explicit `.js` extensions. Several tests read real files from `data/`; the validator test writes a temporary directory under the OS temp directory.
- No snapshots, no network and no real browser. The input tests stub the `window` and `navigator` globals; the renderer tests stub the canvas context; the loop tests stub `requestAnimationFrame`.

## Coverage by subject

### Engine

| File | Pins |
| --- | --- |
| `game-loop.test.js` | Fixed step at the configured rate, accumulator remainder, 100 ms frame clamp, five-step cap with backlog dropped, one render per frame, paused-scene single step, input update/finalize per step, no-scene and invalid-timestamp behavior, rate fallback to 60, scheduling lifecycle, update and render exception containment with one report per source and continued scheduling. |
| `camera.test.js` | Position and size setters, world/screen conversion, smoothing follow, visibility edges and bounds constraint including the smaller-than-camera case. |
| `renderer.test.js` | Canvas sizing and resize, unit scale and viewport, clear, integer camera translation and restore, flash, circle, sharp and rounded rectangle, polygon with its current eight-argument signature, polygon path, line, font scaling, `measureText` in visual units and its empty-input result. |
| `physics-engine.test.js` | Configuration, gravity and fall cap, gravity multiplier, friction only on the ground, integration and applied force. |
| `slope-collision.test.js` | `SlopeSurface` angle/derived geometry, surface and inverse functions, landing, step-up, descending stick, tall face, underside, both orientations, ground reset and polygon rendering. |
| `ui-element.test.js` | Element state, anchor placement for every anchor and child update/render. |
| `input-manager.test.js` | Press that starts and ends between frames, held press, update/finalize boundaries, auto-repeat, lost keyup, blur, aliases, both confirm keys, `isDown`/`getAxis`, gamepad buttons and D-pad, vertical stick axes and signs, right stick axes, the axis threshold for analog directions, and combo hold time with a controlled clock. |
| `audio-engine.test.js` | Legacy and channel BGM shapes, volume precedence and fallbacks, tempo, note durations, unsupported waves, phrase expansion, malformed tracks, SFX finite values and warnings, unknown sound names returning false and reporting once, missing or unusable frequencies returning false and reporting once, a note-name override that resolves, and valid SFX returning true. |
| `audio-settings.test.js` | `SettingsStore` round trip and namespace isolation, version mismatch deletion, partial and out-of-range records, boot application, live slider writes and persistence through `SettingsMenu`. |
| `note-frequency-calculator.test.js` | MIDI numbers, accidentals, reference tuning, malformed and out-of-range notes, inverted range and memoized dictionary. |
| `save-system.test.js` | Namespaced round trip, isolation, missing key, invalid JSON, delete/has/clear, boolean save/delete results, false on storage failures, null on read and parse failures, once-per-operation-and-key reporting, separate keys, no report for a missing key, injected logger and no stored value in a report. |
| `text-resolver.test.js` | Known key, `has`, missing-key fallback and once-only report, throwing lookup, non-string values and required lookup. |
| `dialogue-wrap.test.js` | Word wrapping, overlong words, intro fit at every tested viewport, band below the HUD and height growth. |
| `scene-manager.test.js` | Removal by registration key when the scene name differs, current-scene clearing, keeping an unrelated current scene and reusing a removed key. |

### Registries and normalization

| File | Pins |
| --- | --- |
| `kind-registry.test.js` | Registered value resolution, unknown-value error text, duplicate rejection and registration order. |
| `dispatch-registry.test.js` | One ability entry per kind, class selection, boss selection, unknown-kind errors and the shooter projectile-factory requirement. |
| `object-dispatcher-registry.test.js` | One entry per stage object kind, every teleporter kind instantiates its class, literal kinds win over collectible files, unknown type error and family extension without dispatcher edits. |
| `normalization-ownership.test.js` | `Tile` consumes the resolved configuration verbatim; `Enemy` requires a resolved size; `parseEnemyConfig` provides every key the enemy classes read. |

### Application contracts and state

| File | Pins |
| --- | --- |
| `data-path.test.js` | `DataDriven.keyForDataPath` affix stripping, separator conversion, kebab segments and paths without affixes. |
| `dependency-contract.test.js` | `requireDependencies` errors, `Player` declared keys, note collection through the bound stage and `UiBuilder` construction through the contract. |
| `boot-error.test.js` | Boot-error banner, message and stack rendering into the body with only the document surface it needs. |
| `progress-store.test.js` | Progress round trip, versioned kebab schema, empty store, version mismatch, malformed field dropping, namespace isolation, default/completion/key-required unlocks, mixed conditions, key collectible contract and key persistence. |
| `progress-writer.test.js` | Completion merge, no input mutation, deduplication, key-gated unlock with and without the key, unlock merge and the exact snapshot-then-save order of both write paths. |
| `scene-router.test.js` | Scene registration, action registry and dispatch, unknown action reporting, modal open/close and paused-state restoration. |

### Game behavior

| File | Pins |
| --- | --- |
| `stage-bounds.test.js` | Empty bounds, sections and late entities extend bounds, interior entities do not, dimension-less entities count as one. |
| `stage-lists.test.js` | Per-type lists filled by `addEntity`, order, pruning by `removeEntity`, read-only views and the projectile factory requirement. |
| `stage-entity-views.test.js` | Every entity appears once, checkpoints are unique, screen-clear and projectile loops visit each entity once. |
| `stage-collision-dt.test.js` | The player passes the frame `dt` to solid tile collision resolution, and the same `dt` reaches slope and solid collision in one update. |
| `tile-overlap-validator.test.js` | Disjoint tiles pass, solid-solid and solid-climbable fail, non-solid overlaps pass, message content. |
| `checkpoint-respawn.test.js` | Creation-order indices, checkpoint activation, later checkpoint wins and spawn-point fallback. |
| `damage-system.test.js` | Shape damage, explicit output precedence, single application, shield multiplier, return value, hazard value and fallback, player surface, fatal-hit detection and configuration keys. |
| `combat-abilities.test.js` | Shield follows the shoot input and the configured multiplier, stomp deals one hit per contact and bounces, screen clear damages all enemies once with flash and cooldown, invincibility blocks damage for its duration and is limited to its uses. |
| `movement-abilities.test.js` | Level table and ability configurations agree, factory builds every class, dash burst and cooldown, double-jump budget and landing reset, flight charge/take-off/duration/slow fall, air-slide distance/cooldown/landing reset, crouch speed and air rejection, slide attack once per dash, dash collision and flight after a collision-established ground state. |
| `item-effects.test.js` | Usage table from data, one-unit consumption, one effect application, a key and an item without usage are not consumed and play no sound, restore-health full/numeric, moon gravity state and physics, fire shield blocking without defeating enemies, earthquake targets and repeat use. |
| `inventory-use-path.test.js` | Select opens without using, confirm uses the selected item, select+shoot uses the default while closed and does not open the grid; confirm on a key slot and select+shoot on an item without usage consume nothing and play no use sound. |
| `health-continue-flow.test.js` | Starting lives/continues, lives exhaustion with and without a continue, continue cost and restore, zero-continue limits and respawn floor. |
| `stage-scene-game-over.test.js` | Game-over state on lives exhaustion, stage freeze, continue restoration and the no-continue case. |
| `death-respawn.test.js` | Enemy and hazard damage at zero life spend one life and respawn, the active checkpoint is used, notes reset, one lethal hit spends exactly one life across frames, the last life reaches game over, and invincibility and fire shield block the lethal hit. |
| `big-fruit-progression.test.js` | Every big fruit names its fruit through `collectible`, strawberry maps to red and dash, collecting it raises the level and unlocks dash. |
| `level-up-color.test.js` | A level-up assigns the resolved palette color in the same session. |
| `projectile-injection.test.js` | No projectile class in `Stage`; injected factories reach the stage, shoot ability and shooter; missing factory fails; size and travel are applied. |
| `projectile-impact.test.js` | Decorative tiles, collectibles, checkpoints and markers do not stop a shot; solid tiles do; player shots damage one enemy; enemy shots pass other enemies and damage the player. |
| `ammo-pickups.test.js` | Ammo data effect, palette resolution, stage placement, accumulation and the HUD count. |
| `shooter-enemy-data.test.js` | Every shipped shooter declares range, rate and speed; the normalizer reads them; in-range fire, out-of-range silence and fire-rate interval. |
| `enemy-drops.test.js` | An empty table never rolls, weighted selection follows the injected random source and cumulative weights, the distribution matches the configured weights over a deterministic sequence, every shipped table names an existing collectible with positive weights, and the early stages and branch stay drop-free. |
| `key-item-name.test.js` | `keyItemName` prefixes exactly once, and pickup, key door and map unlock agree on the same inventory name. |
| `note-collection-tracker.test.js` | Declared `musical-note-scale` order and pitch mapping, declared notes winning over range fields, whole-tone fallback, duplicate/out-of-range rejection, completion and reset, and the shipped C-major scale. |

### Presentation

| File | Pins |
| --- | --- |
| `hud-layout.test.js` | Background band and bottom border, whole-HUD disable, per-element disable, inventory indicator with live item/count at the configured anchor, empty frame and the absence of `star-counter` in data. |
| `menu-layout.test.js` | Configured game-over button start, stage-clear score row, pause title offset and prefixes, settings title offset/font offset, first-row Y, slider row gap, button gap and prefixes; opaque end-screen overlays. |
| `end-screen-ui.test.js` | `visible-condition` navigation and render skipping, live continues/lives, hidden Continue at zero, live fruit/ability/score providers, stage-name `display-name-key` resolution with an id fallback, and provider re-resolution at render time. |
| `map-label-layout.test.js` | `clampLabelX` inside the band and the `MapStage` label placement through the renderer. |
| `map-stage-navigation.test.js` | Node/path/label/marker collection, display fallback, map-teleporter warning, active-node preference and fallback, directional choice and tie-breaking, player move, selection rules and input dispatch. |
| `scenes.test.js` | Title BGM and delegation, settings and info delegation, map camera/music/pause/selection/render, stage activate/music/intro-once, stage-clear notification once, game-over state, dialogue blocking, pause BGM, inventory open/route, and end screens winning over pause and inventory in update and render. |
| `color-utils.test.js` | Light/dark resolution, literal hex, unknown and empty names, missing palette, `resolveConfig` recursion and untouched non-color values. |

### Data and tooling

| File | Pins |
| --- | --- |
| `validate-data.test.js` | The real data set has no validation errors; a malformed file, malformed slope data and malformed enemy drop tables are reported with path and key. |
| `stage-catalog.test.js` | All eight stage files exist; required fields; one spawn in the first section, one exit and at least one checkpoint; big fruit exists and matches; unique note orders; teleporter targets resolve; BGM registered; every slope edge meets its platform. |
| `stage-bgm.test.js` | Every declared stage track is registered, the branch declares a track different from its name, `StageBase` exposes the declared `bgm`, and a stage without a declared track exposes `null`. |
| `teleporter-activation.test.js` | Inner/map/special/key-door contract, marker resolution by name, missing marker report and inert state, key door keeps the key after unlock, stage routing and edge-triggered latch, map data has no teleporters and the Strawberry Fields exit targets `map`. |
| `check-layers.test.js` | Layer classification, relative resolution, import collection for static/side-effect/re-export/dynamic forms, violation detection and the real tree. |
| `i18n-contract.test.js` | The default accessor and physical locale share one tree; every level and configured ability resolves through `player.abilities.*`; every fruit resolves; `stomp` and `slide-attack` use their display names; the removed keys are absent. |
| `input-bindings.test.js` | `button-count` matches the declared buttons, every index below the count is covered once, names match indices, action references are declared, and a button beyond the count activates no action. |
| `verify-stages.test.js` | Stage discovery filters non-JSON entries and strips extensions; key-required map conditions are collected once; the progress seed carries the namespace, schema version, full unlock list, key items and preferred stage; missing namespace/stage id are rejected; the first intro line and its first word resolve from the text tree. |
| `music-formatter-cli.test.js` | `package.json` declares the script the formatter prints, and the printed invocation equals the declared script. |

## Smoke test assertions

`bun run smoke` starts `scripts/serve.js`, launches headless Chromium through `playwright-core`, installs the page hooks from `scripts/smoke/page.js`, and runs five assertions:

1. The page booted without a boot-error element.
2. The canvas is present and non-blank: non-zero surface, at least 2 distinct colors and at least 100 non-black sampled pixels.
3. No console errors and no uncaught exceptions during boot.
4. Pressing Enter once reaches a stage: a recorded canvas string contains `Score:`.
5. No console errors and no uncaught exceptions after entering the stage.

Supporting mechanics: the server runs on an ephemeral port; `localStorage` is cleared in an init script; `navigator.getGamepads` is stubbed to return nothing; console errors mentioning favicon are ignored; the browser and server are always closed. Browser launch lives in `scripts/smoke/browser.js` and is shared with the stage verification command; it honors `CHROMIUM_EXECUTABLE_PATH`.

The smoke test always starts at the title screen with no saved progress. It does not exercise the map, a reload, a stage clear, a game over, dialogue, inventory or a teleporter.

## Stage verification

`bun run verify:stages` boots every stage file under `data/stages/` through the real map and checks that the stage starts. It uses the same server helper and the same page hooks as the smoke test.

Sequence for each stage, on a fresh browser context:

1. Read `data/game-config.json`, `data/map/fruit-world.json`, `data/i18n/default.json` and the stage file.
2. Seed `localStorage` under `<save-namespace>:progress` with the versioned progress record: every discovered stage id unlocked, one `key:<name>` inventory item per `key-required` map condition, empty completion list and `last-stage` set to the stage under check. The seed is written after the page hook that clears storage.
3. Load the page. With saved progress the game resumes at the map, and the map prefers the `last-stage` node because that node is selectable.
4. Press Enter once to enter the preferred node.
5. Assert: a HUD string contains `Score:`; the first intro line's speaker and first word appear on the canvas; no boot-error element exists; no console error or uncaught page error was recorded.
6. Close the context before starting the next stage.

The canvas text log is cleared after the HUD appears, so map labels recorded before the transition cannot satisfy the dialogue assertions. The intro speaker and text are resolved from `data/i18n/default.json`; a stage with an empty first intro line fails.

Failures are collected per stage and the run continues. Each stage has a 60 s hard timeout, with 15 s for navigation, 10 s for boot, 10 s for the HUD and 8 s per dialogue string. Every stage prints `ok - <stage-id>` or `FAIL - <stage-id>` plus indented reasons. The run ends with `Stage verification: <n> stages, <n> passed, <n> failed.` and exits `0` only when every stage passes. The per-stage context, the browser and the server are closed, and the process exits explicitly so no handle keeps it alive.

Coverage limit: this command proves that a stage is referenced by the map, can be unlocked, enters from the preferred node, starts its HUD and starts its intro dialogue. It does not traverse geometry, complete a stage, trigger game over, use the inventory or teleporter, or assert saved progress.

## Layer check

`bun run check:layers` runs `scripts/check-layers.js`, which walks every `.js` file under `src/` and classifies it as `engine`, `game`, `app` or `main`.

| From | May import |
| --- | --- |
| `engine` | `engine` |
| `game` | `game`, `engine` |
| `app` | `app`, `game`, `engine` |
| `main` | `app` |
| Any | Nothing may import `main`. |

The scanner resolves relative specifiers and inspects static imports, side-effect imports, re-exports and dynamic imports. It ignores package imports and files outside the layer tree. A violation prints `file:line`, the specifier, the direction and the rule; the command exits `1`. A pass prints `Layer check passed: <n> source files.` with exit `0`. Current result: 70 files, 0 violations. `test/check-layers.test.js` covers the classifier, the scanner and the real tree.

## Validator coverage

The validator is covered twice: by `test/validate-data.test.js` for the real data set and for error reporting, and by the command itself for the current tree. Its checks and warning semantics are listed in [data-model.md](data-model.md#validation). The validator does not start the game and does not verify that a data key has a consumer.

## Verification status

Browser-verified in the recorded run:

- All eight stages boot from the map with their intro dialogue and no console errors; `bun run verify:stages` automates this check with 8/8 passing.
- Game over appears after repeated pit deaths, shows `Continues: 1` and a Continue row, and confirm restarts the stage.
- Avocado Grove stage clear shows the localized name "Avocado Grove" plus the live summary (`Collected: Avocado`, `Ability: Shoot, Shield`, score), and confirm reaches the map.
- Scripted traversal is timing-sensitive: the run needed a run-up before jumping at a 2-unit platform; the earlier failure to reach the clear screen was input timing, not a game defect.
- Title to stage.
- Pause menu, settings screen, tutorial, credits and controls.
- Restart stage.
- Map reachable from the pause menu; map camera follows directional navigation; locked nodes are not selectable.
- Save written on leaving a stage; reload resumes at the map.
- Level and inventory restored after reload.
- Intro dialogue typewriter and dismissal.
- A checkpoint activates visually.
- A shooting test at level 2 consumed ammo from 10 to 8.
- An ammo pickup incremented the counter.
- Enemy and hazard contact reduced health.
- Audio settings persistence: Settings was opened from the title, two right presses moved Music Volume from 60% to 80%, `localStorage["super-fruit-world:settings"]` held `bgm-volume: 0.8` immediately, a reload showed Music Volume at 80% with SFX still 100%, and the run recorded no console or page errors.

Wired and unit-tested, not browser-verified end to end:

- The full Strawberry Fields → Avocado Grove → Banana Beach → Blueberry Peaks → Starfruit Caverns → Pitaya Canyon → Fruit Basket Citadel chain, including the key-gated Secret Waterfall branch.
- Teleporter traversal inside a stage; the unit test uses a stage fixture and a synthetic `up` press.
- Damage-death respawn and stage BGM selection; both are unit-tested, and the browser run neither took a lethal damage hit nor asserted audio output.

## Verification gaps

| Gap | Consequence |
| --- | --- |
| No test file imports `src/app/app.js` or `src/main.js`. | Boot order, the action table, the live progress snapshot and the key-unlock merge are covered through extracted seams (`ProgressWriter`, `completeStageProgress`, `unlockedByCompletion`) and browser runs; settings restore was browser-verified through a reload. None is covered through the composition root. |
| `scripts/serve.js`, `scripts/smoke.js`, `scripts/verify-stages.js` and the modules under `scripts/smoke/` and `scripts/verify-stages/` are not covered as a whole by the unit suite. | Server routing, MIME behavior and the browser harness are covered by the smoke and stage verification runs; only the pure stage discovery and seed helpers are unit-tested. |
| The smoke test clears storage and stops after Enter. | The map, reload, stage clear, game over, dialogue, inventory and teleporters have no smoke coverage; `verify:stages` covers map entry, HUD and intro for every stage. |
| Stage verification stops after the intro. | A change that breaks traversal, a stage clear, a game over, a save or an unlock chain still needs manual play to detect. `verify:stages` covers boot, map entry, HUD and intro for every shipped stage; it does not play through a stage. |
| Teleporter traversal is not exercised in a browser. | The contract, routing and latch are unit-tested; the real stage geometry and camera are not. |
