# Application Layer

Subject: the application layer at `src/app/`, its position between `src/engine/` and `src/game/`, the data flow it owns, and the composition root that wires the running game together.

## Layers

| Layer | Responsibility | Directory | Entry point |
| --- | --- | --- | --- |
| Entry | Installs the pre-boot error handler and starts the application. | `src/main.js` | `new App().start()` |
| Application | Composition, data selection, normalization into runtime configurations, factory registries, stage and map assembly, UI construction, navigation and menu-action routing, persistence policy. | `src/app/` | `App.start()` |
| Game | Domain objects and their behavior: entities, abilities, systems, stages, scenes, UI components. | `src/game/` | imported by the application layer |
| Engine | Reusable primitives with no knowledge of this game. | `src/engine/` | barrel `src/engine/index.js` |

## Dependency rule

| From | May import | Observed in the tree |
| --- | --- | --- |
| `src/main.js` | `src/app/app.js`, `src/app/boot-error.js` | Yes. |
| `src/app/**` | `src/engine/index.js` (barrel only) and `src/game/**` by concrete file path | Yes; no `src/app` module imports an engine file directly. |
| `src/game/**` | `src/engine/**` by concrete file path, and other `src/game/**` files | Yes; no `src/game` module imports the engine barrel. |
| `src/engine/**` | Only `src/engine/**` | Yes; no engine module imports `src/game` or `src/app`. |
| Any module | Must never import `src/main.js` | Yes; `src/main.js` has no importers. |

Ownership rules:

- `engine` knows nothing about `game` or `app`; all game-specific names, colors, scenes and data paths arrive as configuration or as injected objects.
- `game` knows nothing about `app`; it never imports a loader, a factory or the router.
- `app` is the only layer allowed to know both sides, and it is the only place where data files become runtime objects.

The rule is executable: `bun run check:layers` scans every `.js` file under `src/` and reports an import that crosses the allowed direction. The check accepts static imports, side-effect imports, re-exports and dynamic imports. Current result: 73 source files, 0 violations. The rule is also unit-tested in `test/check-layers.test.js`.

## Source tree by layer

```text
src/
├── main.js                              Entry: installs the error policy and calls App.start().
├── app/
│   ├── app.js                           Composition root: reads data, builds every collaborator, registers actions and scenes, starts the loop.
│   ├── boot-error.js                    Replaces the document body with a boot-error <pre>.
│   ├── content/
│   │   ├── collectible-type.js          Converts a collectible data path to its type name.
│   │   ├── enemy-config.js              Normalizes one stage enemy object into the enemy runtime configuration, including `drop-table`; it no longer resolves `drop-rate` or `drop-type`.
│   │   ├── item-usage.js                Collects `effect.usage` from every collectible file into the inventory usage table.
│   │   ├── kind-registry.js             Creates a frozen kind -> entry table with duplicate and unknown-value errors.
│   │   ├── object-dispatcher.js         Maps a stage object type to its construction handler and adds the result to a stage.
│   │   ├── stage-loader.js              Builds a Stage and its StageScene from a stage data identifier; keeps the scene-key helper module-local.
│   │   └── tile-config.js               Normalizes one stage tile object into the tile runtime configuration.
│   ├── factories/
│   │   ├── ability-factory.js           Builds every declared ability through the ability kind registry.
│   │   ├── collectible-factory.js       Creates a Collectible from a resolved configuration.
│   │   ├── enemy-factory.js             Selects the enemy class by boss flag or behavior and creates it.
│   │   ├── projectile-factory.js        Creates a Projectile from the resolved projectile configuration.
│   │   └── ui-builder.js                Builds menus, info screens, HUD, inventory UI and the per-stage screen set from UI data.
│   ├── navigation/scene-router.js       Scene registry, scene switching, modal stack and the action table.
│   └── state/progress-writer.js         Builds the live progress snapshot and owns both persistence write paths.
├── game/
│   ├── abilities/
│   │   ├── ability.js                   Base ability: name, required level, duration, cooldown fields.
│   │   ├── air-slide-ability.js         Midair slide that damages overlapped enemies once per slide.
│   │   ├── crouch-ability.js            Grounded crouch state and reduced walk speed.
│   │   ├── dash-ability.js              Timed horizontal dash with a cooldown.
│   │   ├── double-jump-ability.js       Ground and air jump budget.
│   │   ├── flight-ability.js            Dash-charge flight and slow fall.
│   │   ├── invincibility-ability.js     Held-combo temporary invincibility with limited uses.
│   │   ├── screen-clear-ability.js      Held-combo area damage, screen flash and cooldown.
│   │   ├── shoot-ability.js             Ammo-consuming projectile fire and the shield state.
│   │   └── slide-attack-ability.js      Damages one overlapped enemy while a dash is grounded.
│   ├── entities/
│   │   ├── collectible.js               Pickup entity and its effect dispatch.
│   │   ├── enemy.js                     Base enemy: shape, palette, damage, drops, damage intake, rendering.
│   │   ├── enemy-types.js               Patrol, shooter, flyer and boss behaviors.
│   │   ├── player.js                    Player entity: movement, jump, crouch, dash state, damage, level and color.
│   │   ├── projectile.js                Moving shot with travel limit, damage and impact rules.
│   │   └── tile.js                      Static tile with collision, damage, liquid, climbable and slope state.
│   ├── map/
│   │   ├── label-layout.js              Clamps a measured label inside the visible camera band.
│   │   └── map-stage.js                 World-map stage: nodes, paths, labels, cursor navigation and node selection.
│   ├── scenes/
│   │   └── scenes.js                    Title, settings, info, stage and map scenes.
│   ├── stages/
│   │   ├── stage.js                     Playable stage: entity pipeline, checkpoints, respawn, teleporters, completion.
│   │   └── teleporters.js               Marker, inner, map, special teleporter and key-door classes.
│   ├── systems/
│   │   ├── damage-system.js             Converts enemy shape or explicit output into player damage; hazard damage.
│   │   ├── health-system.js             Life, lives, continues, invincibility, fire-shield and invulnerability timers.
│   │   ├── inventory.js                 Item counts, default selection and item use.
│   │   ├── item-effects.js              Resolves a usage action against health, player state or the stage.
│   │   ├── note-collection-tracker.js   Per-stage note orders, names, collected count and completion.
│   │   ├── progression-system.js        Level/color/fruit mapping, the versioned progress store and map unlock derivation.
│   │   └── score-system.js              Score and coin counters with the extra-life threshold.
│   ├── ui/
│   │   └── ui-components.js             HUD, menus, info screen, inventory overlay and the two end screens.
│   └── utils/
│       ├── color-utils.js               Resolves named palette colors and color-valued configuration keys.
│       ├── key-item-name.js             Builds the `key:<name>` inventory name shared by pickup, door and map unlock.
│       └── tile-overlap-validator.js    Throws when two solid tiles, or a solid and a climbable tile, overlap.
└── engine/
    ├── audio/
    │   ├── audio-engine.js              Web Audio SFX and BGM scheduling with finite-value resolution.
    │   ├── audio-settings.js            Versioned settings record and engine-volume write-through.
    │   ├── format-4-beat-music.ts       Bun CLI that rewrites 4/4 BGM files; outside the runtime graph.
    │   └── note-frequency-calculator.js MIDI parsing, range validation and equal-temperament frequency.
    ├── core/
    │   ├── dependency-contract.js       requireDependencies: fails on a missing dependency key.
    │   ├── game-loop.js                 Fixed-timestep loop with contained update/render errors: input update, scene update, render, input finalize.
    │   ├── report-once.js               OnceReporter: first report per key to an injectable logger.
    │   ├── scene.js                     Base scene with enter, exit, update and render.
    │   └── scene-manager.js             Scene registry with a single current scene and enter/exit transitions.
    ├── data/
    │   ├── data-driven.js               Index-driven JSON loader, kebab-case validation, accessor proxy, path key conversion.
    │   ├── save-system.js               Namespaced localStorage wrapper with boolean write results and once-per-key failure reports.
    │   └── text-resolver.js             Text lookup with a non-throwing, once-per-key fallback to the key.
    ├── dialog/
    │   └── dialogue-engine.js           Sequence playback, typewriter reveal, layout and rendering.
    ├── entities/
    │   ├── entity.js                    Position, size, velocity, hitbox, center, alive and on-ground flags.
    │   ├── section.js                   Named section with parent, children and world-position resolution.
    │   └── stage-base.js                Section tree, entity collection, dimensions, bounds, type views and the declared BGM track.
    ├── index.js                         The engine barrel; the only engine entry point the application layer uses.
    ├── input/
    │   └── input-manager.js             Keyboard/gamepad state, frame-latched presses, axes and action aliases.
    ├── physics/
    │   ├── aabb.js                      `entityBox` and `boxesOverlap` shared by stage, projectile and collision solver.
    │   ├── collision-solver.js          AABB test, overlap extent, side resolution, normal and slope resolution.
    │   ├── physics-engine.js            Gravity with the entity multiplier, fall-speed cap, friction and integration.
    │   └── slope-surface.js             The single owner of slope geometry and the surface formula.
    ├── renderer/
    │   ├── camera.js                    Position, size, follow, visibility and bounds constraint.
    │   └── renderer.js                  Canvas sizing, camera transform, primitives and text measurement.
    └── ui/
        └── ui-element.js                Base UI element with anchor math and child update/render.
```

## Boot sequence

`App.start()` performs the following in order. The order is load-bearing: the audio engine exists before settings are restored, the player exists before any stage, and the map is registered before the first scene switch.

1. Create `DataDriven` with base path `'/'` and index `'/data/index.json'`; await `load()`.
2. Read configuration snapshots: `game-config`, `colors`, `borders`, `enemies.config`, `player.levels` (plain), `player.fruits` (plain), `player.abilities`, `audio.config` (plain), `audio.sfx` (plain), `audio.bgm`.
3. For every entry of `audio.bgm.tracks`, resolve the track file through `DataDriven.keyForDataPath` and store its plain object under the track name.
4. Read `audio.synthesis` (plain), `input.bindings` (plain) and `ui.menus` (plain).
5. Build `tileDataMap`: for each type in `gameConfig['tile-types']`, read `tiles.<type>` and keep the plain object.
6. Create `TextResolver` with a lookup into `i18n.default.<key>`.
7. Create `NoteFrequencyCalculator` from `audio.synthesis.tuning`; create `AudioEngine` from the audio configuration, SFX definitions, BGM track map, calculator and default envelope.
8. Register one-shot `click` and `keydown` listeners that call `audioEngine.init()`.
9. Read `visual-unit.value`, `canvas.viewport-percent` and `loop.update-rate` from `game-config`.
10. Create `Renderer` on `#game-canvas` with `{ unitHeight, viewportPercent }`; create `Camera` and size it to the renderer viewport.
11. Create `InputManager` with `input.bindings`; create `PhysicsEngine` with `game-config.physics`; create `CollisionSolver`.
12. Create `SaveSystem` with `game-config.save-namespace`.
13. Resolve the `settings` menu, collect the `setting-key` of every slider, create `SettingsStore` over the save system, and call `restoreAudioSettings({ engine, store, settingKeys })`. The saved volumes are applied to the engine that was just constructed.
14. Create `ProgressStore` over the same save system and load saved progress; fall back to an empty record with empty stage sets and a null last stage.
15. Create `ProgressionSystem`, `ScoreSystem`, `HealthSystem` and `DamageSystem`.
16. Read `audio.synthesis.musical-note-scale` into `noteRangeConfig`: the array becomes `notes`, with its first entry as `lowest` and its length as `count` for the fallback path.
17. Create `ItemEffects` with the health system and a `getPlayer` closure that reads the player variable, then create `Inventory` with `{ audioEngine, usage: collectItemUsage(dataDriven), effects: itemEffects }`.
18. Build the player configuration from `game-config.player` and the physics block, resolving the starting color; resolve the projectile configuration and create the projectile factory; create abilities with that factory.
19. Create `Player` with one dependency object: `playerConfig`, `abilities`, `inventory`, `healthSystem`, `scoreSystem`, `progressionSystem`, `audioEngine`, `stage: null`.
20. If saved progress exists, restore score, level (clamped to `progressionSystem.maxLevel`), color for the restored level, inventory items and `defaultSelected`. Item names are restored verbatim, including `key:<name>`.
21. Resolve `ui.dialogue`, create `UiBuilder` and create the single HUD bound to the player.
22. Create `ProgressWriter` with the progress store and a snapshot builder that reads the live score system, player level and inventory.
23. Create `SceneRouter` and `GameLoop` with `loop.update-rate`, the router, the input manager and the renderer.
24. Create the title menu and `TitleScene`; create the settings menu over the wrapper returned by `restoreAudioSettings` and `SettingsScene`; create one `InfoScreen` scene for each of `tutorial`, `show-credits` and `open-controls`.
25. Create the enemy factory, collectible factory, `ObjectDispatcher` and `StageLoader` with their declared dependency objects. `StageLoader` declares `dataDriven`, `textResolver`, `dialogueConfig`, `dispatcher`, `player`, `noteRangeConfig`, `physicsEngine`, `collisionSolver`, `collectibleFactory`, `projectileFactory`, `damageSystem`, `hud`, `camera`, `audioEngine`, `sceneRouter`, `uiBuilder` and `navigation`; it takes no `enemyFactory`. The navigation seam is `{ navigate: (sceneName) => leaveTo(sceneName) }`.
26. Create the progressive-state helpers: `persistProgress`, `handleStageClear`, `openStage`, `resumeCurrentScene`, `leaveTo`, `resetHealth`, `restartCurrentStage`, `continueAfterGameOver`.
27. Read `map.fruit-world` (plain); warn once when a `stage-node` has no data file; merge default, persisted and completion unlocks into the in-memory progress using the live inventory.
28. Define `buildMapScene` and `refreshMap`; build and register the `map` scene.
29. Register all menu actions through `sceneRouter.registerActions`.
30. Register `settings`, register the freshly built `map`, register `title`, then switch to `map` when saved progress exists, otherwise to `title`.
31. Call `gameLoop.start()`.

`mapConfig` is read after the helper closures are defined, but no helper runs before the read, so `handleStageClear` and `buildMapScene` always see the loaded map.

## Stage loading and scene registration

1. A caller invokes `openStage(stageDataId)`. Callers are the `start-game` action, a map node confirmation, `restart-stage` and `continue`.
2. `openStage` stores `currentStageId` and calls `stageLoader.load(stageDataId, { fresh: true })`.
3. `StageLoader.load` derives the scene key with the module-local `stageSceneKey`: the stage data path is completed (`data/stages/<id>.json`), and the key is the file basename without `.json`. With `fresh`, the loader first drops any cached `{ stage, scene }` for that key.
4. The loader reads the stage object through `DataDriven.keyForDataPath` + `DataDriven.toPlain`.
5. It creates a new `NoteCollectionTracker` from `noteRangeConfig`; the declared `musical-note-scale` array supplies the eight note names, with `lowest` and `count` as the fallback.
6. It constructs `Stage(stageConfig, dependencies)` with `player`, `physicsEngine`, `collisionSolver`, `collectibleFactory`, `noteCollection`, `projectileFactory`, `damageSystem` and `navigation`. The `Stage` constructor binds itself to the player (`player.stage = this`).
7. For every section in `stageConfig.sections`, it calls `ObjectDispatcher.dispatchSection`.
8. After dispatch it calls `validateTileOverlaps(stage.tilesList, collisionSolver)`, which throws on a solid-solid or solid-climbable overlap.
9. It calls `stage.recomputeBounds()` so bounds include dispatched entities.
10. It calls `uiBuilder.stageScreens({ stageName, stageNameKey, bigFruit })` and receives a stage-clear screen, a game-over screen, a pause menu and an inventory UI. The stage name key is `stageConfig['display-name-key']`. The stage-clear screen receives live providers for the big fruit, the abilities of that fruit's level and the score; the game-over screen receives the health system. The HUD is not part of this set: the single HUD built at boot is reused.
11. It assigns `onConfirm` on the stage-clear and game-over screens to `sceneRouter.dispatch`.
12. It creates a `DialogueEngine` from `stageConfig.dialogue` and the resolved `ui.dialogue` layout, then builds `StageScene(stage, hud, pauseMenu, gameOverScreen, stageClearScreen, inventoryUI, audioEngine, dialogueEngine, camera)`. The shared camera is a constructor argument; the scene has no camera setter.
13. It assigns the pause-menu `onConfirm` and `onClose` (`resume`).
14. It caches `{ stage, scene, sceneKey }` and returns it.
15. `openStage` sets `progress.lastStageId = sceneKey`, marks `inStage = true`, assigns `scene.onStageClear`, registers the scene under `sceneKey`, and switches to it.

Consequences of this flow:

- Two different stages can coexist in one session; each is registered under its own data basename.
- Re-entering a stage always rebuilds it, so enemy positions, collectibles, checkpoints and note progress reset.
- Stage data identifiers used by the map (`stage-id`) are the same names as scene keys, because both come from the file basename.
- `StageScene` detects completion once, calls `onStageClear` once and then keeps rendering the clear screen.

## Map flow

1. At boot, `mapConfig` is read once from `map.fruit-world` and kept in memory.
2. `missingStageIds` is computed from `stage-node` objects whose `stage-id` has no `data/stages/<id>.json`; a single warning lists them. Current data has none.
3. Unlock state is derived by `mergeUnlockedStages`: default-unlocked nodes, the persisted unlocked set, `stage-complete` conditions whose prerequisite is completed, and `key-required` conditions whose `key:<name>` is in the inventory.
4. `buildMapScene` deep-copies the map through `applyProgressToMapConfig`, which calls `mergeUnlockedStages` with `progress.completedStageIds`, `progress.unlockedStageIds` and `progress.inventory`, then rewrites each node's `state` to `completed`, `available` or `locked`. It constructs `MapStage` with `hasStageData`, a text resolver and `preferredStageId`.
5. The map scene receives its own `PauseMenu` (registered with the same action table) and its own `Camera` sized to the renderer viewport; the camera is passed to the `MapScene` constructor.
6. `MapScene.onStageSelected` calls `openStage(stageId)`.
7. `refreshMap` rebuilds the map scene and re-registers it under `map`. It runs at boot, after every stage clear and whenever `leaveTo` targets the map.
8. `MapScene.enter` centers the camera on the active node and plays `world-map`. Every update recenters the camera; directional presses move the cursor to the nearest node in that direction; confirm selects the node when it is selectable.
9. `leaveTo('map')` persists progress when the player is in a stage, resumes the current scene, rebuilds the map and switches to it.

Navigation and selection are independent: the cursor can move onto a locked node, but `selectNode()` returns false for a node whose state is `locked` or whose stage data is missing.

`MapStage` reads `stage-node`, `path`, `area-label` and `teleporter-marker`. A `map-teleporter` object in map data is not a map feature: the stage reports it once and ignores it. A `map-teleporter` object in stage data is a stage teleporter and is dispatched like the other stage teleporter kinds.

## Action table

The table is registered once with `sceneRouter.registerActions`. Menus dispatch an action name; the router looks up the handler and logs an error for an unknown name.

| Action | Declared in `data/ui/menus.json` | Handler behavior |
| --- | --- | --- |
| `start-game` | `title-screen` | `openStage(resolveStartStage())`. `resolveStartStage` returns the persisted last stage when its data file exists, otherwise `game-config.initial-stage`. |
| `tutorial` | `title-screen` | Opens the `tutorial` info scene as a modal. |
| `open-settings` | `title-screen`, `pause-menu` | Opens `settings` as a modal; the modal stack records the current scene and its paused flag. |
| `show-credits` | `title-screen` | Opens the `show-credits` info scene as a modal. |
| `open-controls` | `settings` | Opens the `open-controls` info scene as a modal on top of the settings scene. |
| `back` | `settings` | Closes the top modal and restores the scene and paused flag recorded when it opened. |
| `resume` | `pause-menu` | Clears `isPaused` on the current scene. |
| `restart-stage` | `pause-menu` | Resets life and, when lives are exhausted, lives to `health.starting-lives`; then reloads `currentStageId` fresh. Logs an error when no stage was loaded. |
| `quit-to-map` | `pause-menu` | `leaveTo('map')`: persists progress when in a stage, resumes the current scene, rebuilds the map and switches to it. |
| `quit-to-menu` | `pause-menu`, `game-over` | `leaveTo('title')`: persists progress when in a stage, resumes the current scene and switches to the title. |
| `continue` | `game-over` | Spends a continue when one exists, otherwise resets health; then reloads `currentStageId` fresh. Logs an error when no stage was loaded. |
| `continue-to-map` | `stage-clear` | `leaveTo('map')`: persists progress, rebuilds the map and switches to it. |

Behavioral notes:

- Every action declared in the shipped menu data has a registered handler. `SceneRouter.dispatch` reports an unknown action to the console and returns `false`.
- `leaveTo` skips the switch when the target is already current and only clears `isPaused`; in that case it also skips the map rebuild.
- Opening a modal from a paused stage restores the paused state on return, so the pause menu is visible again.
- `visible-condition` is read by `Menu`: an item whose condition evaluates false is skipped by navigation, is not rendered and cannot be confirmed. The game-over screen injects the condition map `{ 'has-continues': () => canContinue }`.
- The stage-clear screen has a single `continue-to-map` button and no condition.

## Audio settings flow

Settings are stored separately from progress, in the same `SaveSystem` namespace:

| Property | Value |
| --- | --- |
| Key prefix written by `SaveSystem` | `super-fruit-world:`. |
| Settings key | `super-fruit-world:settings`. |
| Schema version | `1`, defined in `src/engine/audio/audio-settings.js`. |
| Stored fields | Only the keys supplied as slider `setting-key` values; the current settings menu supplies `bgm-volume` and `sfx-volume`. |
| Recognized keys | `master-volume`, `bgm-volume` and `sfx-volume` when a slider declares them; `master-volume` has no slider in the current data. |

`SettingsStore` recognizes `master-volume`, `bgm-volume` and `sfx-volume`, but `AudioSettings` binds and saves only the `settingKeys` passed at construction. The current boot passes the settings-menu slider keys, so the record contains `bgm-volume` and `sfx-volume`; `master-volume` would be saved only if a slider declared that `setting-key`. Every write through a bound property calls `save`, so a slider change is persisted immediately. `restoreAudioSettings` constructs the wrapper and applies the stored record; boot applies it after the engine exists and before the settings scene is built.

A missing record, malformed JSON, a non-object entry or a version mismatch yields `null`; a version mismatch deletes the entry. Invalid or out-of-range fields are dropped while valid fields survive, so the engine keeps the value from `data/audio/config.json` for a dropped field.

Persistence across a real browser reload was verified: Settings was opened from the title, Music Volume moved from 60% to 80%, `localStorage["super-fruit-world:settings"]` held `bgm-volume: 0.8`, and a reload showed 80% with SFX still 100% and no console or page errors. The unit test covers the store and the boot application in isolation.

## Persistence flow

Storage:

| Property | Value |
| --- | --- |
| Backend | `localStorage` through `SaveSystem`. |
| Namespace | `game-config.save-namespace` = `super-fruit-world`. |
| Key prefix written by `SaveSystem` | `super-fruit-world:`. |
| Progress key | `super-fruit-world:progress`. |
| Settings key | `super-fruit-world:settings`. |
| Progress schema version | `1`, defined in `src/game/systems/progression-system.js`. |
| UI for saving | None. Persistence is automatic. |

Schema written by `serializeProgress` (example values):

```json
{
  "version": 1,
  "completed-stages": ["strawberry-fields", "avocado-grove"],
  "unlocked-stages": ["strawberry-fields", "avocado-grove", "banana-beach"],
  "last-stage": "avocado-grove",
  "score": 1240,
  "level": 2,
  "inventory": {
    "items": [
      { "name": "ammo", "count": 18 },
      { "name": "apple", "count": 3 },
      { "name": "key:secret-grove-key", "count": 1 }
    ],
    "default-selected": "ammo"
  }
}
```

Rules applied on write:

- Stage-id arrays are deduplicated, non-empty strings only.
- `last-stage` is a non-empty string or `null`.
- `score` and `level` are floored non-negative integers.
- Inventory entries with an empty name or a count of zero or less are dropped.
- Inventory item names are stored exactly as used by the runtime, including the `key:<name>` form.
- `default-selected` is a string or `null`.

Write points:

| Trigger | Code path | State written |
| --- | --- | --- |
| Leaving a stage for the map, the title or another target while `inStage` is true | `leaveTo` → `persistProgress` → `ProgressWriter.save` | Completed/unlocked sets, last stage, live score, live level, live inventory. |
| Completing a stage | `StageScene` detects `stage.isCompleted`, calls `scene.onStageClear` → `handleStageClear` → `ProgressWriter.completeStage`, then `refreshMap` | Adds the stage to completed, sets last stage, recomputes unlocks from the live inventory, live score, live level, live inventory. |

`ProgressWriter` is the single writer. Its `buildSnapshot` reads the live score system, player level and inventory slots; `completeStage` merges the completion and unlock record first, then saves the snapshot of the merged record. No other code path writes progress. Starting, restarting or continuing a stage does not write; the write happens when the stage is left or completed.

Failed persistence operations:

- `SaveSystem.save` and `SaveSystem.delete` return `false` when storage throws; `load` returns `null` for a missing key, a storage read failure or unparseable JSON. Each failure is reported once per `<operation>:<storage key>` through the injected logger, which defaults to `console.warn`; the message names the operation and key, never the stored value.
- A failed progress write is not rolled back: the in-memory progress record keeps its new value, the failure is reported and the next write retries. `ProgressWriter.save` still returns the record it attempted to write.
- A failed progress read at boot is treated like no saved progress, so the game starts at the title screen with defaults. A failed settings read is treated like no settings record, so `data/audio/config.json` supplies the volumes.
- `SaveSystem.has` and `SaveSystem.clear` are thin namespace operations and do not add a separate failure report.

Read behavior on boot:

- A missing entry, malformed JSON, a non-object entry or a version mismatch yields `null`; a version mismatch additionally deletes the entry.
- With saved progress, the game restores score, level, color, inventory (including keys) and `defaultSelected`, registers the map, and starts on the map scene.
- Without saved progress, the game starts on the title scene.
- Health, lives, continues, the active checkpoint and the in-stage position are not persisted. A reload always returns to the map, never into a stage.
- Unlocked stages are recomputed at boot with the restored inventory, so a key held in progress makes its map node available without replaying the stage that awarded it.

## Screen ownership and scene keys

Screen construction:

| Screen | Constructed by | Registered as | Reached from |
| --- | --- | --- | --- |
| Title | `App.start` (`TitleMenu` + `TitleScene`) | `title` | Boot without progress, `quit-to-menu` |
| Settings | `App.start` (`SettingsMenu` + `SettingsScene`) | `settings` | `open-settings` modal |
| Tutorial | `App.start` (`InfoScreen` + `InfoScene`) | `tutorial` | `tutorial` modal |
| Credits | `App.start` (`InfoScreen` + `InfoScene`) | `show-credits` | `show-credits` modal |
| Controls | `App.start` (`InfoScreen` + `InfoScene`) | `open-controls` | `open-controls` modal |
| World map | `buildMapScene` (`MapStage` + `MapScene`) | `map` | Boot with progress, `quit-to-map`, `continue-to-map` |
| Stage | `StageLoader.load` (`Stage` + `StageScene`) | stage data basename | `start-game`, map node confirm, `restart-stage`, `continue` |
| HUD | `App.start` (`uiBuilder.hud(player)`) | not a scene | Rendered by every `StageScene` |

Scene key derivation:

| Scene | Key | Derived from |
| --- | --- | --- |
| Title | `title` | Literal in `App.start`. |
| Settings | `settings` | Literal in `App.start`. |
| Info screens | `tutorial`, `show-credits`, `open-controls` | The `info-screens` key used to build the screen. |
| Map | `map` | Literal in `refreshMap`. |
| Stages | `strawberry-fields`, `avocado-grove`, … | `stageSceneKey`: `data/stages/<name>.json` → `<name>`. |

Notes:

- `StageScene` calls `super('stage')`, so the scene object's own `name` is `stage`; the registration key is the stage basename. The router's `currentSceneName` is found by identity over its registry, not through the scene's `name`.
- `progress.lastStageId` stores the stage scene key, so it is both the persisted resume target and the map node id.

## Files in `src/app/`

| File | Single responsibility |
| --- | --- |
| `src/app/app.js` | Composition root: reads data, constructs engine, game and application collaborators, defines the stage and map flows, registers scenes and actions, starts the loop. |
| `src/app/boot-error.js` | Replaces the page with a boot-error block when boot fails. |
| `src/app/navigation/scene-router.js` | Scene registry, switching, modal stack, action registry and dispatch. |
| `src/app/state/progress-writer.js` | Live snapshot construction and the two persistence write paths. |
| `src/app/content/stage-loader.js` | Stage data identifier to scene key, stage data read, tracker creation, section dispatch, overlap validation, bounds recomputation, per-stage screens and `StageScene` assembly, with a cache keyed by scene key. |
| `src/app/content/object-dispatcher.js` | Object kind registry, family expansion through `collectibleTypeFromPath`, type-to-kind resolution, section dispatch and the construction handlers. |
| `src/app/content/kind-registry.js` | Frozen registry factory shared by abilities, enemies and stage objects. |
| `src/app/content/tile-config.js` | Tile object plus tile data to runtime tile configuration. |
| `src/app/content/enemy-config.js` | Enemy object plus enemy data plus palette to runtime enemy configuration, including `drop-table`; it no longer resolves `drop-rate` or `drop-type`. |
| `src/app/content/collectible-type.js` | Collectible data path to type name, shared by the usage table and the dispatcher family. |
| `src/app/content/item-usage.js` | Collectible files to the inventory usage table through `collectibleTypeFromPath`. |
| `src/app/factories/ability-factory.js` | Ability kind registry and construction of every declared ability. |
| `src/app/factories/enemy-factory.js` | Enemy kind registry and boss/behavior selection. |
| `src/app/factories/collectible-factory.js` | Collectible construction with size from configuration. |
| `src/app/factories/projectile-factory.js` | Projectile construction with the resolved projectile configuration. |
| `src/app/factories/ui-builder.js` | Menu sub-configuration resolution, title/pause/settings menus, info screens, HUD, inventory UI and the per-stage screen set with live providers. |

## Known issues in this layer

No open defect is owned by the composition root. The verification gaps that touch this layer are recorded in [../testing.md](../testing.md#verification-gaps) and the open inventory in [../roadmap/opportunities.md](../roadmap/opportunities.md).
