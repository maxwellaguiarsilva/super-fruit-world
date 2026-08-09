**Date:** 2026-08-08
**Phase:** orchestration — mapped & delegated debt #22 (slope collision)

### Session 2026-08-08 — Map debt #22 (slope collision), push loop-worker frame

Orchestrator session (Stack Depth 0). Backlog empty; picked flagship debt #22 from `technical-debt.md`. Mapped the slope pipeline end-to-end, then pushed a loop-worker frame (Stack Depth 1) per the delegation contract. Full mandate lives in the Session Control Register above.

#### Mapping captured
- **Data:** `data/tiles/slope.json` defines `collision.solid/walkable`, `physics.slope-types` (slope-30/45/60 → 30/45/60°), `inverted: false`. Stage uses `{"type":"slope","variant":"slope-30","inverted":false,...}` and `slope-45 inverted:true` in `strawberry-fields.json` `slope-practice` (x 137..147).
- **Composition root:** `main.js:69-70` `resolveTileType` already resolves `slope-angle` from `physics['slope-types']` by variant → `Tile` receives `slope-angle` + `inverted` in its config. So the data→config plumbing is DONE; the gap is entirely in physics + rendering.
- **Tile:** `src/game/entities/tile.js:25-34` already reads `isSlope`/`slopeAngle`/`slopeInverted`. **Bug found:** `render()` lines 55-66 has `if (this.#isSlope) {...} else {...}` with **identical bodies** — slopes render exactly like rects.
- **Collision:** `collision-solver.js` is pure AABB (`resolveCollision` takes a plain `{x,y,width,height}` solidBox). `stage.js:222-246` calls `resolveCollision(..., tileBox)` where `tileBox` is the raw AABB — the `Tile`'s slope metadata never reaches the solver.
- **Renderer:** `renderer.js` has `drawRect`, `drawCircle`, `drawPolygon` (regular polygons only) — no triangle/wedge primitive for slope visuals.
- **Validator:** `tile-overlap-validator.js` uses `checkAABB` only (BL-1); slope AABBs overlap adjacent platforms by design of the layout (slopes sit atop platforms) — left untouched, out of scope.

#### Decision / Analysis
Approach: implement slope resolution inside `CollisionSolver` keyed off slope metadata passed in the solid descriptor (angle + inverted + size), so the resolved top-contact `y` interpolates along the face by the movable's x position. Add a wedge draw primitive to the renderer and render slopes with it in `tile.js`. `stage.js` forwards the tile's slope fields. Non-slope behavior must be byte-identical (regression harness).

#### Completed Work
1. None (analysis-only session; no code changed).

#### Verification
- N/A for this session; the loop-worker verifies its own changes (`bun build`, harness, cpp_code_verifier, `git diff`).

#### Handoff
- Loop-worker (next session) assumes Level 1 frame and implements the mandate; then pops the stack back to orchestrator.
- Remaining open debt after #22: #23 (enemy AI), #9 (world map), plus items 1/2/3/8/11/12/14/15/16.

---

# Session Control Register & Status

## Session Control Register

- **Active Role:** loop-worker
- **Stack Depth:** 1
- **Active Mandate:** Implement slope collision (tech-debt #22)
- **Target Artifact:** code — `src/engine/physics/collision-solver.js`, `src/engine/renderer/renderer.js`, `src/game/entities/tile.js`, `src/game/stages/stage.js`

### Mandate Details

#### 1. Context
- Read first (files): `src/engine/physics/collision-solver.js`, `src/engine/physics/physics-engine.js`, `src/engine/renderer/renderer.js`, `src/game/entities/tile.js`, `src/game/stages/stage.js` (collision loop ~217-258), `src/main.js` (`resolveTileType` ~55-89), `src/game/utils/tile-overlap-validator.js`, `data/tiles/slope.json`, `data/stages/strawberry-fields.json` (`slope-practice` section), `src/engine/entities/entity.js`, `src/game/entities/player.js`.
- Read first (docs): `docs/agent/compliance-rules.md`, `docs/agent/technical-debt.md` (#22), `docs/agent/multi-session-flow/context-hygiene.md` (R7 budget).

#### 2. Goal
Make slope tiles (`data/tiles/slope.json`, variants `slope-30/45/60` in `data/stages/strawberry-fields.json` `slope-practice`) behave as angled collision surfaces: the landing `y` of a player/enemy resting on a slope interpolates along the slope face instead of the flat AABB top, and slopes render as angled wedges instead of plain rectangles.

#### 3. Scope
- In scope:
  - `collision-solver.js` — slope-aware resolution using the tile's `slope-angle` (+`inverted`), so the resolved top contact `y` follows the angled face based on the movable's x within the tile. Keep AABB behavior for non-slope tiles unchanged.
  - `renderer.js` — add a triangle/wedge drawing primitive (geometric style, matching `drawRect`/`drawPolygon`).
  - `tile.js` — render slopes as wedges (current `if (this.#isSlope)` branch is identical to the else branch — also fixes R1.1 rendering debt by using the resolved colors already in config).
  - `stage.js` — pass the slope metadata (angle/inverted/size) to `resolveCollision` instead of only the plain AABB box.
  - Verify the `slope-practice` section is walkable both directions (non-inverted slope-30 up, inverted slope-45 down) with the `slope-practice` coins/notes reachable.
- Out of scope (do NOT do): enemy AI (#23), world map wiring (#9), other tiles' behavior, `physics-engine.js` friction/gravity tuning, `data/` geometry redesign. Do not touch `tile-overlap-validator.js` unless slope AABB overlaps are newly flagged (then report, do not change BL-1 semantics).

#### 4. Constraints
- Compliance rules: R1.1 (single source of truth — slope angle flows from `data/tiles/slope.json` `slope-types` via `resolveTileType`; do not hardcode 30/45/60 in code), R1.2 (engine stays game-agnostic: slope *rendering/collision* primitives live in engine; the game layer passes config in), R1.3 (no globals), R1.4 (no silent fallback — throw on missing `slope-angle` when `isSlope`), R2.1 (no new hardcoded literals/colors), R4.2 (no dead code), R5.1 (update docs in this session).
- Role constraints: loop-worker executes code/doc changes only within this mandate.
- Do not touch: `src/engine/physics/physics-engine.js`, `src/engine/audio/`, `src/game/systems/`, `data/` stage geometry, `src/main.js` wiring (unless strictly needed to expose `slope-angle`; prefer no changes there).

#### 5. Output Expectation
- Implement in the listed code files; do NOT create a standalone report file.
- State explicitly in `status.md` (on pop) what was done and what was deliberately NOT done.
- Register any newly discovered debt in `docs/agent/technical-debt.md`.

#### 6. Verification
- `bun build src/main.js --target=browser` succeeds.
- cpp_code_verifier on all changed `.js` files: no formatting violations.
- Mock-renderer + mock-collision harness (like prior sessions): assert slope top contact y interpolates along the angle for sample x positions, inverted and non-inverted, and that non-slope AABB resolution is unchanged (regression).
- `git diff` reviewed: only intended files changed.

### Stack History / Return Context
- Level 0 (orchestrator): Main control loop active. Prior sessions resolved debts #5/#13/#18/#20/#21/#17/#19. Delegating #22 (slope collision) to loop-worker. Remaining open debt after #22: #23 (enemy AI), #9 (world map), plus items 1/2/3/8/11/12/14/15/16.

---

## Status Log

**Date:** 2026-08-08
**Phase:** execution — debt #19 resolved

### Session 2026-08-08 — Resolve tech-debt #19 (tile type-name matching in resolveTileConfig)

Orchestrator session (Stack Depth 0). Debt #19: `resolveTileConfig` inferred `deadly`/`liquid`/`climbable` from type-name string matching instead of the tile JSON.

#### Diagnosis
- `isTile` is computed from `tileTypesSet` (built from `game-config.tile-types`) and `tileDataMap` is populated from the **same** list; `DataDriven` throws on any listed tile file missing from the index. Therefore whenever `isTile` is true, `tileDataMap[obj.type]` is guaranteed present — the `tileDataMap[obj.type] ? resolveTileType : resolveTileConfig` ternary could never take the fallback branch. `resolveTileConfig` was dead code (also R4.2).

#### Completed Work
1. `src/main.js` — deleted the dead `resolveTileConfig` function (lines 91-112); `createStageFromData` now always resolves tiles through `resolveTileType(obj, tileDataMap, colorsConfig, bordersConfig)` (data-driven single source of truth).
2. Verified JSON semantics match the old string matching: `spike`/`pit` → deadly (`damage.on-contact`/`effect.action: death`), `water` → liquid (`gravity-multiplier 0.3`), `ladder` → climbable (`collision.climbable: true`), `decorative`/`pit` → non-solid (`collision.solid: false`).

#### Verification
- `bun build src/main.js --target=browser` succeeds.
- cpp_code_verifier on `src/main.js`: no formatting violations.
- `git diff` reviewed: only the intended removal + call-site simplification.

#### Handoff
- Stack remains at Level 0 (orchestrator). Debt #19 marked resolved in `technical-debt.md`.
- Next candidates: #22 (slope collision), #23 (enemy AI), #9 (world map), plus items 1/2/3/8/11/12/14/15/16.

---

**Date:** 2026-08-08
**Phase:** execution — debt #17 resolved; stack popped

### Session 2026-08-08 — Resolve tech-debt #17 (playSFX not wired to game events)

Loop-worker session (Stack Depth 1). Wired `audioEngine` into game events per the orchestrator's event→sound map; then popped the stack back to orchestrator.

#### Completed Work

1. `src/main.js` — inject `audioEngine`: `new Inventory(inventoryConfig, audioEngine)` and `player.audioEngine = audioEngine` (mirroring the `scoreSystem` wiring).
2. `src/game/entities/player.js` — `#audioEngine` field + getter/setter; `jump()` → `playSFX('jump')`; `takeDamage()` → `playSFX(healthSystem.isDead ? 'death' : 'hit')`.
3. `src/game/entities/collectible.js` — `collect()` plays per-action: `coin` (type coin / add-coins), `star` (invincibility), `musical-note` with `freqOverride` = `noteForOrder(noteOrder)` (guarded against null note name), `level-up` (only when actually applied), generic `collect`; `set-respawn`/`complete-stage` set `sfxName = null` so the sound comes from the `Stage` methods.
4. `src/game/stages/stage.js` — `activateCheckpoint()` → `checkpoint` (single source; covers checkpoint tiles + `set-respawn` collectibles), `completeStage()` → `stage-clear`, stomp branch → `attack`.
5. `src/game/systems/inventory.js` — new `audioEngine` constructor arg; `use()` → `moon-use`/`sun-use`/`earth-use`/`inventory-use`, silent when count is 0.
6. `src/game/scenes/scenes.js` — `StageScene` inventory open toggle → `inventory-open`.
7. Abilities — `ShootAbility` firing → `attack`; `AirSlideAbility`/`ScreenClearAbility` dealing damage → `attack` (played once per frame/activation via a `dealtDamage` flag).
8. Latent bug fixed in passing: `ShootAbility` constructed `Projectile` without the required `projectileConfig` 7th arg (would throw before any sound); now passes `player.stage.projectileConfig`, matching `enemy-types.js`.

#### Verification

- 21-case mock-AudioContext harness (spy `playSFX`; real game classes with mock engine/entities) exercising jump / non-fatal+ fatal hit / coin / star / musical-note (freq `c4`) / level-up / generic collect / set-respawn / complete-stage / direct checkpoint / stage-clear / stomp / moon / sun / earth / inventory-use / empty-use (no sound) / shoot / air-slide / screen-clear: 21/21 passed. Harness removed after the run.
- `bun build src/main.js --target=browser` succeeds (BUILD OK).
- cpp_code_verifier on the 9 changed files: no formatting violations.
- `git diff` reviewed: only the intended files changed.

#### Deliberately NOT done

- `ShooterEnemy` firing sound (would spam; no per-enemy sound gate in `data/audio/sfx.json`).
- No engine edits (`src/engine/` untouched) — `playSFX` callers live in `src/game/` + the composition root per R1.2.

#### Handoff

- Stack popped: Active Role back to `orchestrator`, Stack Depth 0. Debt #17 marked resolved in `technical-debt.md`.
- Next candidates: #22 (slope collision), #23 (enemy AI), #9 (world map), plus items 1/2/3/8/11/12/14/15/16/19.

---

**Date:** 2026-08-08
**Phase:** orchestration — delegated debt #17 to loop-worker

### Session 2026-08-08 — Delegate tech-debt #17 (playSFX not wired to game events)

Orchestrator session. Mapped the event sites and event→sound map for debt #17, then pushed a loop-worker frame (Stack Depth 1) per the delegation contract. Full mandate lives in the Session Control Register above.

#### Mapping captured
- Sound names available: `jump, attack, hit, collect, level-up, checkpoint, death, coin, star, stage-clear, musical-note, moon-use, sun-use, earth-use, inventory-open, inventory-use` (`data/audio/sfx.json`).
- Event sites located: `Player.jump`/`takeDamage` (player.js:83/74), `Collectible.collect` (collectible.js:21), `Stage.activateCheckpoint`/`completeStage`/stomp (stage.js:144/152/348), `Inventory.use` (inventory.js:55), `StageScene` inventory toggle (scenes.js:114-134), abilities `shoot`/`air-slide`/`screen-clear` (damage-dealing updates).
- `playSFX(name, freqOverride)` verified: `freq` accepts raw Hz or note name; throws on missing name/freq (R2.5). `musical-note` needs `freqOverride` = note name from `NoteCollectionTracker.noteForOrder`.

#### Completed Work
1. None (analysis-only session; no code changed).

#### Verification
- N/A for this session; the loop-worker verifies its own changes (`bun build`, mock-AudioContext harness, `git diff`).

#### Handoff
- Loop-worker (next session) assumes Level 1 frame and implements the wiring; then pops the stack back to orchestrator.

---

**Date:** 2026-08-08
**Phase:** execution — debt #21 resolved; handoff clean

### Session 2026-08-08 — Resolve tech-debt #21 (menu `subtitle`/`hint` never rendered)

Orchestrator session. Backlog empty; picked debt #21 from `technical-debt.md`: `data/ui/menus.json` defines `menu-defaults.subtitle`/`menu-defaults.hint` styles and per-screen `hint-key`s, but `buildMenuSubConfig` read them and dropped them, and `Menu.render` never drew subtitle/hint lines.

#### Completed Work

1. `src/main.js` (`buildMenuSubConfig`) — returned menu config now carries `subtitle-key`, `hint-key`, and the resolved `subtitle`/`hint` style configs (colors resolved through `resolveConfig`).
2. `src/game/ui/ui-components.js` (`Menu`) — constructor stores `#subtitleKey`/`#subtitleConfig`/`#hintKey`/`#hintConfig`; new `renderSubtitle()`/`renderHint()` draw via the shared `#renderTextLine()` helper (top-center anchor uses `offset.y`, bottom-center uses `viewportHeight + offset.y`); both called from the base `Menu.render`.
3. `src/game/ui/ui-components.js` (`PauseMenu`, `SettingsMenu`) — overridden `render()` methods (which bypass `super.render()`) now call `renderHint()`, so the already-defined `hint-key`s (`input.pause-hint`, `input.navigate-hint`) finally display.
4. `docs/agent/technical-debt.md` — marked entry #21 resolved with status note.

#### Verification

- Mocked-renderer harness exercising `Menu`/`TitleMenu`/`PauseMenu`/`SettingsMenu`: hint drawn at `x=viewportWidth/2, y=viewportHeight+offset.y` (29.5 on a 30-unit viewport), subtitle at `y=offset.y` (2.3), no-hint/no-subtitle configs render without error.
- `bun build src/main.js --target=browser` succeeds (46 modules, 164.86 KB).
- cpp_code_verifier on `ui-components.js` + `main.js`: no formatting violations.
- `git diff` reviewed: only the ui-components + main.js changes in this session.

#### Handoff

- Next candidates: debt #17 (`playSFX` not wired to game events — engine API ready, callers live in `src/game/`), debt #22 (slope collision), debt #9 (world map not wired). All registered in `technical-debt.md`.
- Not done in this session: no menu screen defines a `subtitle-key`, so subtitle rendering stays dormant until data provides one (mechanism is wired and data-driven); the other open debt entries remain deliberately deferred.
