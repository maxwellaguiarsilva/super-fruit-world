# Decisions

Subject: choices that are implemented in the current tree and that constrain future work. Each entry records the context, the decision, the consequence and the code that embodies it. Open questions are not decisions and live in [roadmap/opportunities.md](roadmap/opportunities.md).

## DEC-1 — Kind registries for abilities, enemies and stage objects

| Field | Content |
| --- | --- |
| Context | Ability construction, enemy construction and stage object construction each had to select a class from a data value. Branch chains would diverge in convention and require edits in several places for every new kind. |
| Decision | All three dispatch sites use one frozen registry factory, `createKindRegistry`, keyed by kind. Stage objects additionally support families, where a family contributes many type names to the same kind. |
| Consequence | A new kind is one registration entry. A duplicate registration fails at construction. An unknown value fails with the registered values listed. The stage object registry can absorb new tile types, enemy shapes and collectible files without editing the dispatcher. |
| Evidence | `src/app/content/kind-registry.js`, `src/app/factories/ability-factory.js`, `src/app/factories/enemy-factory.js`, `src/app/content/object-dispatcher.js`. Unit tests in `test/kind-registry.test.js`, `test/dispatch-registry.test.js` and `test/object-dispatcher-registry.test.js`. |

## DEC-2 — One dependency object for `Player`

| Field | Content |
| --- | --- |
| Context | `Player` previously received services through post-construction assignment from the application layer, which made its real dependency set invisible and made assignment order significant. |
| Decision | `Player` receives one dependency object at construction and validates it with `requireDependencies`. The declared keys are `playerConfig`, `abilities`, `inventory`, `healthSystem`, `scoreSystem`, `progressionSystem`, `audioEngine` and `stage`. |
| Consequence | A missing service fails at construction with its name. No module under `src/app/**` assigns a service to the player after construction. The stage is a declared key whose value starts as `null` and is bound by the `Stage` constructor, because the stage is constructed with the player. The note collection is derived from the stage rather than stored. |
| Evidence | `src/game/entities/player.js`, `src/app/app.js`, `src/game/stages/stage.js`, `test/dependency-contract.test.js`, `test/normalization-ownership.test.js`. |

## DEC-3 — `SceneRouter` is the navigation and menu-action seam

| Field | Content |
| --- | --- |
| Context | Scene transitions and menu actions were spread across boot code, stage loading and UI callbacks. `SceneRouter` existed as a thin forwarder over `SceneManager`. |
| Decision | Grow `SceneRouter` into the single seam for scene registration, scene switching, modal screens and menu actions. Screens dispatch action names; `App` registers every handler. |
| Consequence | Every scene transition in `src/app/**` goes through the router. Unknown actions are reported instead of ignored. Modals record the previous scene and its paused flag and restore both on close. `GameLoop` receives the router and reads `currentScene` from it. |
| Evidence | `src/app/navigation/scene-router.js`, `src/app/app.js`, `src/app/content/stage-loader.js`, `src/game/scenes/scenes.js`. |

## DEC-4 — Stage scene keys derive from the stage data identifier

| Field | Content |
| --- | --- |
| Context | Every stage scene was registered under the literal `stage-01`, so only one stage could exist per session. |
| Decision | The scene key is the stage data file basename without `.json`, produced by `stageSceneKey`. The stage data identifier is completed to `data/stages/<id>.json` first. |
| Consequence | Strawberry Fields registers as `strawberry-fields` and Avocado Grove as `avocado-grove`. Map `stage-id` values, persisted `last-stage` values and scene keys use the same namespace. A renamed stage file changes the scene key and invalidates persisted references to it. |
| Evidence | `src/app/content/stage-loader.js`, `src/app/app.js`, `data/map/fruit-world.json`, `data/stages/*.json`. |

## DEC-5 — Automatic checkpoint persistence with a versioned schema

| Field | Content |
| --- | --- |
| Context | Progress was lost on reload: the save system existed but nothing used it, and there was no save UI. |
| Decision | Persist automatically to `localStorage` under the namespace from `game-config.save-namespace` and the key `progress`, with `version: 1`. There is no save screen. A reload resumes at the world map. `start-game` loads the last valid stage. |
| Consequence | State is written when a stage is left and when a stage is completed. The persisted surface is completed stages, unlocked stages, last stage, score, level and inventory. Health, lives, continues, position and checkpoints are not persisted. A schema mismatch deletes the entry and behaves like a first run. |
| Evidence | `src/game/systems/progression-system.js` (`ProgressStore`, `serializeProgress`, `normalizeProgress`), `src/app/app.js`, `src/engine/data/save-system.js`, `test/progress-store.test.js`. The schema is reproduced in [architecture/application-layer.md](architecture/application-layer.md#persistence-flow). |

## DEC-6 — Teleporters are stage features with one activation contract

| Field | Content |
| --- | --- |
| Context | Teleporter subclasses had different activation signatures and only one kind had an active state. The world map declared teleporter markers and map teleporters that no map behavior consumed. |
| Decision | Every teleporter kind implements `canActivate(context)` and `activate(context)` over the same six-key context: player, overlap check, marker lookup, navigation seam, inventory and report channel. Teleporters belong to stages. Map data declares none; `MapStage` reports and ignores a map-level teleporter. Marker targets resolve by marker name. |
| Consequence | The stage loop is the only dispatcher: it edge-latches activation per overlap and stops after the first successful teleporter. A missing marker warns once and stays inert. A `map-teleporter` object in stage data works like the other stage kinds; the same object in map data does not. |
| Evidence | `src/game/stages/teleporters.js`, `src/game/stages/stage.js`, `src/game/map/map-stage.js`, `test/teleporter-activation.test.js`. |

## DEC-7 — Keys are permanent items on a key ring

| Field | Content |
| --- | --- |
| Context | A key-gated map node needs a durable unlock that survives leaving the stage and reloading. The old key-door path consumed the key. |
| Decision | A key pickup stores the inventory name `key:<name>`. The key is an ordinary inventory item that persists with progress. A key door requires the key, unlocks permanently on the first successful activation and never removes the key. A `key-required` map node checks the same inventory name. `Inventory.use` requires a declared `effect.usage.action`, so a key and any other item without usage are never consumed by the use path. |
| Consequence | One key can open a door and a map node, and the map unlock survives a reload because the key is restored before the map is built. The inventory confirm path and the select+shoot shortcut leave a key untouched. No shipped stage declares a key door; the delivered use is the Secret Waterfall map node. |
| Evidence | `src/game/entities/collectible.js`, `src/game/stages/teleporters.js`, `src/game/systems/inventory.js`, `src/game/systems/progression-system.js`, `data/collectibles/key.json`, `data/stages/starfruit-caverns.json`, `test/progress-store.test.js`, `test/teleporter-activation.test.js`, `test/item-effects.test.js`, `test/inventory-use-path.test.js`. |

## DEC-8 — The simulation uses a fixed timestep at the configured rate

| Field | Content |
| --- | --- |
| Context | The loop read and stored `loop.update-rate` but advanced by the real frame delta, so behavior varied with frame cadence. |
| Decision | `GameLoop` runs a fixed-step accumulator at `loop.update-rate` (current data: 60). It passes the step in seconds, clamps a frame to 100 ms, caps at five steps per frame, renders once per frame and falls back to 60 for an unusable rate. `tick(timestamp)` is the deterministic frame seam. |
| Consequence | Physics, ability timers and dialogue reveal advance by a constant step. A slow frame drops simulation time instead of spiraling. GameLoop is unit-tested without real time. |
| Evidence | `src/engine/core/game-loop.js`, `src/app/app.js`, `data/game-config.json`, `test/game-loop.test.js`. |

## DEC-9 — Audio settings are a separate versioned record

| Field | Content |
| --- | --- |
| Context | Volume sliders wrote only to the running engine, and boot always read `data/audio/config.json`. |
| Decision | Store the values of the settings-menu slider `setting-key` entries in the `settings` key of the existing `SaveSystem` namespace with schema version 1. The current menu supplies `bgm-volume` and `sfx-volume`; `master-volume` is stored only if a slider declares it. `AudioSettings` wraps only the supplied engine properties and writes through on every change; `restoreAudioSettings` applies the record after the engine is constructed. |
| Consequence | Settings and progress share one namespace but have independent keys, schemas and lifetimes. A version mismatch deletes only the settings record. Invalid fields fall back to the audio configuration. Unbound volumes such as the current `master-volume` stay at `data/audio/config.json` values. |
| Evidence | `src/engine/audio/audio-settings.js`, `src/app/app.js`, `test/audio-settings.test.js`; browser run with `super-fruit-world:settings` and a reload. |

## DEC-10 — End screens read live state and honor visibility conditions

| Field | Content |
| --- | --- |
| Context | The stage-clear screen received empty values at construction, the game-over screen captured counts at construction, and the UI builder dropped `visible-condition`. |
| Decision | `StageClearScreen` takes providers for the big fruit, the abilities of that fruit's level, the stage `display-name-key` and the score, and resolves them at render time. `GameOverScreen` reads the health system at render time. `Menu` evaluates an injected condition map for `visible-condition`; hidden items are skipped by navigation, are not rendered and cannot be confirmed. Game over and stage clear take priority over pause and inventory in both update and render. |
| Consequence | A collected fruit, a localized stage name, a score change or a spent continue appears without rebuilding the screen. Continue is reachable only while a continue remains. Pressing pause on the completion frame cannot hide the end screen. |
| Evidence | `src/game/ui/ui-components.js`, `src/app/factories/ui-builder.js`, `src/app/content/stage-loader.js`, `data/ui/menus.json`, `test/end-screen-ui.test.js`, `test/scenes.test.js`. |

## DEC-11 — HUD and menu layout belong to the UI data

| Field | Content |
| --- | --- |
| Context | The HUD ignored its background, border and several elements, while the pause, game-over and stage-clear screens hardcoded layout constants. |
| Decision | `ui.hud.json` owns the HUD chrome and every element style, and every element honors `enabled`. `ui.menus.json` owns the shared layout in `menu-defaults.layout` and per-screen deltas in `layout-overrides`; the settings screen reads its title, row and button layout from them. |
| Consequence | Editing the data changes the rendered HUD, the three end screens and the settings layout. `star-counter` was removed. |
| Evidence | `src/game/ui/ui-components.js`, `data/ui/hud.json`, `data/ui/menus.json`, `test/hud-layout.test.js`, `test/menu-layout.test.js`. |

## DEC-12 — `SlopeSurface` owns slope geometry

| Field | Content |
| --- | --- |
| Context | Slopes were treated as rectangles, with collision and rendering using different geometry. |
| Decision | `SlopeSurface` is the single owner of the slope diagonal, surface height, inverse, effective angle and declared-versus-derived decision. `Tile` builds one surface; collision and polygon rendering both read it. |
| Consequence | A declared angle is used only when it matches the tile aspect ratio. The validator rejects malformed slope data, and a catalog test asserts that every slope edge meets its adjacent platform. |
| Evidence | `src/engine/physics/slope-surface.js`, `src/engine/physics/collision-solver.js`, `src/game/entities/tile.js`, `scripts/validate-data.js`, `test/slope-collision.test.js`, `test/stage-catalog.test.js`. |

## DEC-13 — Zero life respawns through the stage

| Field | Content |
| --- | --- |
| Context | Damage could reduce life to zero while the player kept playing; only a fall below the stage bounds spent a life. |
| Decision | After damage and projectile sweeps, `Stage.update` checks `healthSystem.isDead`. When it is true, it calls `respawnPlayer()` once and returns from the update. The respawn spends one life, restores life, clears the note tracker and returns the player to the active checkpoint. Invincibility, fire shield and invulnerability frames reject the damage before life can reach zero. |
| Consequence | A lethal hit has the same consequence as a fall. The existing lives-exhausted check in `StageScene` reaches game over after the last life. Returning from the update prevents a lethal hit and the fall check from both respawning in one frame. |
| Evidence | `src/game/stages/stage.js`, `src/game/systems/health-system.js`, `src/game/scenes/scenes.js`, `test/death-respawn.test.js`, `test/stage-scene-game-over.test.js`. |

## DEC-14 — A stage plays its declared BGM track

| Field | Content |
| --- | --- |
| Context | The stage scene played the stage `name`, so a stage whose `name` differed from its `bgm` value ran without its authored track. |
| Decision | `StageBase` exposes the stage `bgm` from the stage data. `StageScene.enter` plays `stage.bgm ?? stage.name`, so a stage without a declared track keeps the previous name-based behavior. |
| Consequence | `starfruit-caverns-branch` plays `secret-waterfall`. The seven main stages declare a track equal to their name and are unchanged. |
| Evidence | `src/engine/entities/stage-base.js`, `src/game/scenes/scenes.js`, `data/stages/starfruit-caverns-branch.json`, `data/audio/bgm.json`, `test/stage-bgm.test.js`. |

## DEC-15 — Recoverable engine failures report once and return a result

| Field | Content |
| --- | --- |
| Context | `SaveSystem` swallowed storage failures, so callers could not tell a failed write from a successful one and the console stayed silent. `AudioEngine.playSFX` threw into gameplay code for an unknown sound or a missing frequency. |
| Decision | `OnceReporter` delivers the first report per key to an injectable logger, defaulting to `console.warn`. `SaveSystem.save` and `delete` return booleans, `load` returns `null` on failure, and each failure reports once per `<operation>:<storage key>`. `playSFX` reports once per unknown name or unusable frequency and returns `false`; a valid sound returns `true`. |
| Consequence | Gameplay code can continue after a storage or SFX-recovery failure. A recurring failure is visible once without flooding the console, and reports name the operation and key but never the stored value. `playBGM` is unchanged. |
| Evidence | `src/engine/core/report-once.js`, `src/engine/data/save-system.js`, `src/engine/audio/audio-engine.js`, `test/save-system.test.js`, `test/audio-engine.test.js`. |

## DEC-16 — One AABB geometry owner

| Field | Content |
| --- | --- |
| Context | The stage, the projectile and the collision solver each converted entities to boxes or tested overlap with local copies of the same arithmetic. |
| Decision | `src/engine/physics/aabb.js` owns `entityBox(entity)` and `boxesOverlap(a, b)`. `Stage`, `Projectile` and `CollisionSolver.checkAABB` consume them. |
| Consequence | An entity hitbox is converted and tested in one place. A change to the box convention applies to stage scans, projectile impact and collision checks together. |
| Evidence | `src/engine/physics/aabb.js`, `src/game/stages/stage.js`, `src/game/entities/projectile.js`, `src/engine/physics/collision-solver.js`. |

## DEC-17 — One anchor layout function

| Field | Content |
| --- | --- |
| Context | `UIElement.computeScreenPosition` and the HUD inventory indicator each implemented the same anchor switch. |
| Decision | `src/engine/ui/ui-element.js` exports `anchorPosition(anchor, offset, width, height, viewportWidth, viewportHeight)`. `UIElement` delegates to it and the HUD uses it directly. |
| Consequence | The seven shipped anchors have one implementation. A component can use the shared function without adopting the `UIElement` child tree. |
| Evidence | `src/engine/ui/ui-element.js`, `src/game/ui/ui-components.js`, `test/ui-element.test.js`, `test/hud-layout.test.js`. |

## DEC-18 — One key item name

| Field | Content |
| --- | --- |
| Context | The collectible pickup, the key door and the map unlock each built the `key:<name>` inventory name independently. |
| Decision | `keyItemName(name)` in `src/game/utils/key-item-name.js` is the only constructor of a key inventory name. `Collectible`, `KeyDoor` and `unlockedByCompletion` consume it. |
| Consequence | Pickup, door and map unlock cannot drift in prefix or formatting. The helper prefixes exactly once. |
| Evidence | `src/game/utils/key-item-name.js`, `src/game/entities/collectible.js`, `src/game/stages/teleporters.js`, `src/game/systems/progression-system.js`, `test/key-item-name.test.js`. |

## DEC-19 — One collectible path-to-type conversion

| Field | Content |
| --- | --- |
| Context | The inventory usage table and the object dispatcher each sliced `data/collectibles/<type>.json` paths with the same string operations. |
| Decision | `collectibleTypeFromPath(path)` in `src/app/content/collectible-type.js` returns the type name or `null`, and both callers use it. |
| Consequence | The collectible directory and extension are parsed once. A path outside the collectible tree is rejected consistently. |
| Evidence | `src/app/content/collectible-type.js`, `src/app/content/item-usage.js`, `src/app/content/object-dispatcher.js`. |

## DEC-20 — Scenes receive their camera in the constructor

| Field | Content |
| --- | --- |
| Context | Stage and map scenes were built without a camera and then mutated through setters. |
| Decision | `StageScene(..., dialogueEngine = null, camera = null)` and `MapScene(mapStage, pauseMenu, audioEngine, camera = null)` take the camera as a constructor argument. The camera setters are removed. |
| Consequence | A scene's camera is fixed at construction. The application passes the shared stage camera from the loader and the map camera from `buildMapScene`. |
| Evidence | `src/game/scenes/scenes.js`, `src/app/content/stage-loader.js`, `src/app/app.js`, `test/scenes.test.js`. |

## DEC-21 — Note names come from the declared scale

| Field | Content |
| --- | --- |
| Context | The note tracker generated whole-tone names from a lowest note and count, ignoring the declared `musical-note-scale`. |
| Decision | `NoteCollectionTracker` maps collection order N to the Nth `notes` entry when the configuration declares a scale. `lowest` and `count` remain the fallback when no scale is supplied. The application passes the declared scale from `audio.synthesis`. |
| Consequence | The shipped tracker uses `c4 d4 e4 f4 g4 a4 b4 c5`; on an eight-note stage, collected-note SFX for orders 4 through 8 play `f4` through `c5`. The fallback keeps range-only callers working. |
| Evidence | `src/game/systems/note-collection-tracker.js`, `src/app/app.js`, `data/audio/synthesis.json`, `test/note-collection-tracker.test.js`. |

## DEC-22 — Enemy drops are owned by the weighted drop table

| Field | Content |
| --- | --- |
| Context | Enemy configuration carried `drop-rate` and `drop-type` fields that the normalizer and flyer copied but no shipped stage used, and `drop-table` was implemented but absent from content. |
| Decision | `drop-table` is the only drop configuration. Each entry is `{ type, weight }`; `type` must name an existing collectible file and `weight` must be a positive finite number. `Enemy.resolveDrop` selects by cumulative weight using an injected random source (default `Math.random`), and the stage creates the result through the injected collectible factory. The validator checks the table shape, collectible reference and weight. |
| Consequence | A non-empty table returns one entry on every kill, so the weights control relative rarity rather than a chance to drop. `drop-rate` and `drop-type` are no longer normalized or read. Blueberry Peaks and later stages declare tables; Strawberry Fields, Avocado Grove, Banana Beach and the branch remain drop-free. |
| Evidence | `src/game/entities/enemy.js`, `src/game/entities/enemy-types.js`, `src/game/stages/stage.js`, `src/app/content/enemy-config.js`, `scripts/validate-data.js`, `test/enemy-drops.test.js`, `test/validate-data.test.js`. |

## DEC-23 — Playability validation is split into static geometry checks and a semantic visual export

| Field | Content |
| --- | --- |
| Context | Stage geometry and collectible placement had no automated check beyond the stage catalog test and manual play. A placement could sit inside a wall or a slope wedge, in a pit, below the geometry or outside the reachable region without any command reporting it, and visual review had no stable artifact to inspect. |
| Decision | Split the subject into two tools. `bun run validate:playability` performs deterministic geometry checks over the normalized stage layout; every collectible finding is an error. `bun run export:stage-maps` writes semantic overview and chunk images plus manifests for a vision-capable review. The static check is deliberately high-confidence and does not simulate jumps, dashes or flight; its reachability grid over-approximates movement. The exporter is advisory and never fails on findings. |
| Consequence | A placement defect has a stable code and a non-zero exit, while visual review has coordinate-bearing images to inspect. Both commands stay outside `bun run verify`, so a known content defect does not block the default gate. On the current tree the static check reports 5 findings, all in Strawberry Fields and spanning three optional pickups. The exit-door is checked as a collectible and receives no reachability finding, but the fill is an over-approximation of movement, so this is not a play-through proof; `test/stage-catalog.test.js` asserts exactly one exit-door per stage. |
| Evidence | `scripts/validate-playability.js`, `scripts/stage-analysis/model.js`, `scripts/stage-analysis/checks.js`, `scripts/export-stage-map.js`, `scripts/stage-analysis/chunks.js`, `scripts/stage-analysis/render.js`, `test/validate-playability.test.js`, `test/export-stage-map.test.js`, `data/stages/strawberry-fields.json`. |

## Toolchain — Bun, static serving and a browser smoke test

| Field | Content |
| --- | --- |
| Context | The project must run from plain ES modules without a bundler, while still offering reproducible checks. |
| Decision | Bun is the toolchain. Scripts are `serve`, `data:index`, `validate`, `validate:playability`, `export:stage-maps`, `check:layers`, `test`, `smoke`, `verify`, `verify:stages` and `format-4-beat-music`. There are no runtime dependencies; `playwright-core` 1.64.1 is the only development dependency and supports the smoke test, stage verification and the stage-map exporter. |
| Consequence | `index.html` loads `src/main.js` directly, imports keep explicit `.js` extensions, and `scripts/serve.js` performs no transformation. `data/index.json` is generated and gitignored. `bun install` is needed once for the browser commands; a Chromium build or `CHROMIUM_EXECUTABLE_PATH` is required. The unit suite runs without a browser; the smoke test, stage verification and stage-map export need one. |
| Evidence | `package.json`, `index.html`, `scripts/serve.js`, `scripts/generate-data-index.js`, `scripts/validate-data.js`, `scripts/validate-playability.js`, `scripts/export-stage-map.js`, `scripts/check-layers.js`, `scripts/smoke.js`, `scripts/verify-stages.js`, `.gitignore`. |

## Standing constraints

These were not recorded as numbered decisions but are enforced by the tree and must be preserved.

| Constraint | Meaning |
| --- | --- |
| No bundler | The served files are the executed files. No transform step, no `dist/` artifact. |
| Layer direction | `engine` knows nothing of `game` or `app`; `game` knows nothing of `app`; `app` is the only composer. See [architecture/application-layer.md](architecture/application-layer.md#dependency-rule). |
| Data-driven content | Stage content, UI layout, strings, colors, audio and progression tables come from `data/` and are loaded through `DataDriven`. |
| Kebab-case data | File paths, file basenames and JSON keys use `^[a-z0-9-]+$`. |
| English (US) | Documentation and file content are written in English (US). |
