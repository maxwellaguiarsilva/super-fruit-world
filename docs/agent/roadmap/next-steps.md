# Next Steps

Subject: the ordered plan for the work that remains after the delivered sequence. The inventory behind this plan is [opportunities.md](opportunities.md); the layer rules that constrain it are in [../architecture/application-layer.md](../architecture/application-layer.md).

## Completed ledger

The original S01–S33 sequence is delivered. Steps that were delivered in a narrower form than planned are annotated; the remainder is carried into the remaining plan.

| Step | Delivered | Evidence |
| --- | --- | --- |
| S01 | Title confirm reaches a stage. | `start-game` action; smoke test presses Enter and reaches the HUD. |
| S02 | Stage scene keys derive from the stage data identifier. | `stageSceneKey`; eight distinct stages registered in one session. |
| S03 | Data index generator restored and documented. | `scripts/generate-data-index.js`; `bun run data:index`. |
| S04 | Map data contract aligned on `sections[].objects[]`. | `MapStage` constructor; `data/map/fruit-world.json`. |
| S05 | Map constructed, rendered, navigable and selectable. | `buildMapScene`; browser run. |
| S06 | Teleporter family dispatched, routed and unit-tested. | `object-dispatcher.js`, `teleporters.js`, `stage.js`; `test/teleporter-activation.test.js`. |
| S07 | End-screen confirms dispatch actions and the screens report live state. | `stage-loader.js`, `ui-builder.js`; `test/end-screen-ui.test.js`; browser run. |
| S08 | Scene router owns navigation, modals and actions. | `scene-router.js`; every action registered in `app.js`. |
| S09 | Action table replaces the single-action branch. | `registerActions`; every declared action has a handler. |
| S10 | Automatic versioned persistence with resume at the map. | `ProgressStore`; browser reload check. |
| S11 | Damage system wired for enemy and hazard damage. | `Stage.update`; `test/damage-system.test.js`. |
| S12 | Checkpoint count derived from the checkpoint list. | `Stage.checkpointCount`. |
| S13 | One note tracker per stage, read by the HUD through the player. | `StageLoader.load`; `HUD.render`. |
| S14 | One construction path per screen; settings reachable. | `UiBuilder`; title and pause menus. |
| S15 | Dialogue engine integrated as stage intro. | `StageLoader.load`; `DialogueEngine`. |
| S16 | Unreferenced data pruned. The locale is one physical file with two names (`default.json` is a symbolic link to `en-us.json`), not a duplicate. | `data/collectibles/`, `data/enemies/`, `data/index.json`, `ls -l data/i18n/`. |
| S17 | `Player` takes one dependency object; no post-construction service assignment in `src/app`. | `test/dependency-contract.test.js`. |
| S18 | Presentation resolves text through `TextResolver`. | `src/app/factories/ui-builder.js`; no UI import of `DataDriven`. |
| S19 | One kind-registry contract for abilities, enemies and stage objects. | `test/kind-registry.test.js`, `test/dispatch-registry.test.js`. |
| S20 | One normalization owner for tile and enemy configuration. | `test/normalization-ownership.test.js`. |
| S21 | One bounds computation owned by `StageBase`. | `test/stage-bounds.test.js`. |
| S22 | Per-type lists maintained by the stage itself. | `test/stage-lists.test.js`. |
| S23 | Projectile factory injected through the dependency chain. | `test/projectile-injection.test.js`. |
| S24 | Dependency bags declare and validate their keys. | `requireDependencies` at every construction site. |
| S25 | Pass-through configuration wrappers removed. | `UiBuilder` constructor. |
| S26 | Data path conversion owned by `DataDriven.keyForDataPath`. | `test/data-path.test.js`. |
| S27 | Render unit and the configured update rate drive the loop. | `src/app/app.js`; `test/game-loop.test.js`. |
| S28 | Data validation command with errors and warnings. | `bun run validate`; current result 57 files, 0 errors, 0 warnings. |
| S29 | Bun toolchain with no runtime dependencies and no bundle. | `package.json`, `index.html`. |
| S30 | Unit suite. | 666 tests across 63 files. |
| S31 | Boot and transition smoke test, sharing its browser launcher with stage verification. | `bun run smoke`; five assertions pass. `bun run verify:stages`; 8/8 stages pass. |
| S32 | Music CLI documented and declared as a script. | [../tooling/music-format-cli.md](../tooling/music-format-cli.md). |
| S33 | Documentation taxonomy, index and reading order. | [../README.md](../README.md). |

## Delivered plan

The N01–N12 plan was executed in the delivery wave. A row marked partial names the remainder that moved to the plan below; the affected opportunity keeps its original ID.

| Step | Outcome | Evidence |
| --- | --- | --- |
| N01 | All four teleporter kinds share one activation contract with a context object; marker targets resolve by name; the stage loop latches activation per overlap. Frame-exception containment was not part of this wave; the loop known issue remains in [../architecture/engine-layer.md](../architecture/engine-layer.md#known-issues-in-this-layer). | `teleporters.js`, `stage.js`; `test/teleporter-activation.test.js`. |
| N02 | A projectile stops on solid geometry or a valid target only. | `test/projectile-impact.test.js`. |
| N03 | Lives exhaustion opens the game-over screen, Continue spends a continue and restores starting lives, and the screen hides Continue at zero. A lethal damage hit now respawns through `Stage.respawnPlayer` and spends one life. | `scenes.js`, `health-system.js`, `stage.js`; `test/stage-scene-game-over.test.js`, `test/death-respawn.test.js`. |
| N04 | Inventory usage actions resolve through `ItemEffects`. | `test/item-effects.test.js`. |
| N05 | Shipped shooters declare range, rate and projectile speed. | `test/shooter-enemy-data.test.js`. |
| N06 | End screens resolve live values and honor `visible-condition`. | `test/end-screen-ui.test.js`; browser run. |
| N07 | Eight stages, the key-gated branch and the key collectible are delivered; the shadowed collectible files are removed. The locale is one symlinked file, and every stage plays its declared `bgm`, including the `secret-waterfall` branch track. | `data/stages/`, `test/stage-catalog.test.js`, `test/stage-bgm.test.js`, `bun run validate`. |
| N08 | Map labels clamp, HUD chrome and elements follow data, level-up recolors immediately, and menu layout comes from configuration. | `test/map-label-layout.test.js`, `test/hud-layout.test.js`, `test/level-up-color.test.js`, `test/menu-layout.test.js`. |
| N09 | Audio settings persist in a separate versioned record; a browser reload restored the changed Music Volume. | `test/audio-settings.test.js`; browser run with `super-fruit-world:settings`. |
| N10 | The loop uses a fixed timestep at the configured rate. | `test/game-loop.test.js`. |
| N11 | Partial. Layer direction is checked, persistence write points are tested, every extracted seam has a suite and `verify:stages` enters every stage through the map. Browser teleporter traversal, full-chain play and a direct composition-root test remain as OP-19/OP-20/OP-24. | `scripts/check-layers.js`, `test/check-layers.test.js`, `test/progress-writer.test.js`, `scripts/verify-stages.js`. |
| N12 | The music CLI alias exists and every advertised ability is implemented. | `package.json`; `test/movement-abilities.test.js`, `test/combat-abilities.test.js`. |

## Remaining plan

The open inventory has three entries. Each plan section maps to one entry; nothing else is planned.

| Priority | Meaning |
| --- | --- |
| P2 | A recorded browser or play verification path is missing. |
| P3 | A direct unit-test path is missing. |

### R1 — Verify teleporter traversal in a browser (P2; OP-19)

- Objective: teleporter traversal is observed in a real browser, not only in a stage fixture.
- Work:
  - Walk into a Strawberry Fields teleporter, press `up`, and assert the player reaches the named marker.
  - Confirm that re-entering the same overlap needs a fresh press.
  - Record that no console error or missing-marker warning appears.
- Acceptance:
  - The player leaves the underground platform and arrives at the surface marker.
  - The overlap latch prevents a repeated activation while the player stays on the tile.
- Risk: the camera follows the player, so assert recorded canvas text or exposed state rather than pixels.

### R2 — Automate the full progression chain (P2; OP-20)

- Objective: one run proves Strawberry Fields → Avocado Grove → Banana Beach → Blueberry Peaks → Starfruit Caverns → Pitaya Canyon → Fruit Basket Citadel, plus the key-gated Secret Waterfall branch. `verify:stages` already proves entry, HUD and intro for each stage; this step adds completion.
- Work:
  - Drive the map from the unlocked node sequence and enter each stage.
  - Complete each stage through its exit door, including the key pickup in Starfruit Caverns.
  - Assert the stage-clear summary and the return to the map at each step.
- Acceptance:
  - A single command reports every stage as completed and the branch as unlocked by the key.
  - The command fails on the first missing unlock or stage boot.
- Risk: a scripted run needs reliable combat and traversal input; keep the assertions on recorded canvas text and map state, not pixels.

### R3 — Cover the composition root (P3; OP-24)

- Objective: boot order, settings restore, action registration and key unlock are exercised without a browser.
- Work:
  - Stub `DataDriven`, the browser globals and the renderer, then run `App.start` against the real data index.
  - Assert the scene registry, the action table, the unlocked set and the restored inventory.
- Acceptance:
  - A regression in boot order or in the key-unlock merge fails a unit test.
  - The test needs no network, no real DOM and no browser.
- Risk: `App.start` starts the loop; the test must stop it or stub `requestAnimationFrame`.

## Not planned

- Rewriting the renderer, the data layer or the registry design. All three are stable and tested at their seams.
- Reintroducing a bundler or a build step; the no-bundler constraint is a standing decision.
- Replacing `localStorage`; persistence is small and verified.
