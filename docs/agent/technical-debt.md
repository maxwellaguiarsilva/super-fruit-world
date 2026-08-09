# Technical Debt Register

This document is a running register of technical debt and compliance-rule violations noticed during implementation work. It is intentionally **not** resolved inline with feature work — the goal is to track issues so they can be scheduled for dedicated cleanup later.

**Convention:** one entry per item, with location (file:line or area), the rule(s) it violates, a short description, and a proposed fix. Entries are appended over time; nothing here should be silently "fixed" while working on unrelated features without being resolved and removed from this list.

---

## 2026-08-08 — DataDriven Resource Manager implementation

Discovered while replacing `data/manifest.json` + `DataLoader` + `LocaleManager` with the dynamic `DataDriven` resource manager.

### 1. R2.5 — Silent `??` / `?.` fallbacks on data reads
- **Location:** `src/main.js` (config builders: `resolveTileType`, `resolveTileConfig`, `parseEnemyConfig`, `buildMenuSubConfig`, `createStageFromData`), `src/game/systems/damage-system.js`, `src/game/systems/health-system.js`, `src/game/systems/progression-system.js`, `src/game/entities/collectible.js`, `src/engine/input/input-manager.js`, `src/engine/audio/audio-engine.js`.
- **Rule:** R2.5 (`#no-fallback`) — "no silent fallback for missing data".
- **Description:** Dozens of `??` / `?.` patterns silently substitute JS-side defaults when a data key is absent (e.g. `physics.gravity ?? 15.0`, `effect.value ?? 1`, `shapeDamageMap[shape] ?? 1.0`). These are pre-existing violations that predate the DataDriven work.
- **Proposed fix:** Move every default value into the appropriate JSON source of truth and read it directly; where a property is genuinely optional-by-override, use explicit `Object.hasOwn(...)` checks instead of `??`. The strict accessor (`DataDriven`) already throws on missing keys, so most of these `??` clauses are now dead code.

### 2. R2.5 — Materialized (non-strict) data at the composition root
- **Location:** `src/main.js` — usage of `DataDriven.toPlain(...)`.
- **Rule:** R2.5 / proposal §3.2.6 (deep strictness).
- **Description:** Several data files (stages, tiles, collectibles, menus, input bindings, audio, player levels/fruits) are deep-copied into plain objects before being handed to generic engine/game classes. Those plain snapshots lose the strict-proxy guarantee, so optional access inside consumers still falls back silently.
- **Proposed fix:** Convert consumers (e.g. `StageBase`, `AudioEngine`, `InputManager`, `ProgressionSystem`, `Collectible`) to strict-safe reads (`Object.hasOwn`) so the proxied values can be used directly, eliminating the `toPlain` boundary.

### 3. R1.1 — Hardcoded colors / literals in composition root and game layer
- **Location:** `src/main.js` (`'#404040'`, `'#BF4040'`, `'#40BF40'`, `'#BFBF40'`, `'#000000'` fallbacks at 83,106,193,280,388,460), `src/game/stages/stage.js:34-42` (checkpoint `'#40BF40'`/`'#808080'`/`'#FFFFFF'`), `src/game/stages/stage.js:424` (`'#BFBF40'`), `src/game/entities/collectible.js:91,96` (`'#FFFF00'`, `'#000000'`), `src/game/entities/enemy.js:76`, `src/game/entities/enemy-types.js:122,129`, `src/game/map/map-stage.js:88-105` (node/path colors `'#40BF40'`/`'#800000'`/`'#BFBF40'`/`'#808080'`/`'#FFFFFF'`), `src/game/entities/projectile.js:79` (`'#000000'` border), `src/game/stages/teleporters.js:19,54` (`'#40BFBF'`/`'#4040BF'`/`'#000000'`), `src/game/entities/player.js:144-175` (`'#000000'` eyes/mouth/border), `src/game/ui/ui-components.js` (selected/hover colors `'#FFFF00'`, `'#888888'`, `'rgba(0,0,0,0.7)'`, border `'#000000'` at 45,77,110), `src/engine/dialog/dialogue-engine.js` (`'#000000'`, `'#FFFFFF'`, box geometry), `src/engine/renderer/renderer.js:55` (`'#000000'`).
- **Rule:** R1.1 (`#no-literals`).
- **Description:** Fallback hex colors and inline UI colors bypass `data/colors.json` as the single source of truth.
- **Proposed fix:** Route every visual through `resolveColor()`/`resolveConfig()`; move any remaining rendering defaults into `data/colors.json` (or a UI config) and reference by name.

### 5. SFX data shape mismatch with AudioEngine
- **Location:** `data/audio/sfx.json` vs `src/engine/audio/audio-engine.js:71-120` (`playSFX`).
- **Rule:** none specific — correctness/consistency debt.
- **Description:** `AudioEngine.playSFX` reads `sfx.frequency`, `sfx['wave-type']`, `sfx.envelope.sustain/release`; the data defines `freq`, `wave`, and envelopes with only `attack`/`decay`. Also, the sounds live under a `sounds` key while the engine indexes `sfxDefs[name]` at the top level. `playSFX` currently has **no callers**, so this is latent. If it is ever invoked, no sound will play.
- **Proposed fix:** Align either the engine reader or the JSON shape; wire `playSFX` into game events (jump, hit, collect, etc.).
- **Status:** Shape alignment resolved 2026-08-08 (see [`status.md`](status.md)). `playSFX` now reads the `sounds` wrapper, `wave`/`freq`, and merges per-sound `envelope` overrides over the `default-envelope` from `data/audio/synthesis.json` (passed as a new `AudioEngine` constructor arg); `freq` accepts a raw Hz number or a note name, with an optional per-call `freqOverride` for dynamic sounds (`musical-note`); missing sound names and missing frequencies throw descriptive errors (R2.5). Verified with a mock `AudioContext` harness against the real data (all sounds schedule finite gain/stop times). The remaining part — **wiring `playSFX` into game events (jump, hit, collect, note, etc.)** — is registered separately below as a new entry.

### 6. i18n key typo — `settings.title`
- **Location:** `src/game/ui/ui-components.js:327` — `localeManager.get('settings.title')`.
- **Rule:** correctness (latent UI bug).
- **Description:** The locale file defines `menu.settings.title`, not `settings.title`. Under the old `LocaleManager`, a missing key silently returned the key itself (`"settings.title"`), masking the typo. Under `DataDriven` this key now throws. Fixed during migration (must resolve), but the underlying pattern (silent fallback-to-key) was debt.
- **Proposed fix:** Resolved during migration; keep as a documented example of why silent fallback is dangerous.

### 8. `bun run build` output is not self-contained
- **Location:** `package.json` (`build` script) / `server.js`.
- **Rule:** none specific — tooling debt.
- **Description:** `bun build src/main.js --outdir=dist --target=browser` bundles JS but does **not** copy `data/` (nor the generated `data/index.json`) into `dist/`. The proposal's "index baked at build" only works if the static host also serves `data/`.
- **Proposed fix:** Add a small copy step to the build pipeline (copy `data/` and `index.html` into `dist/`).

### 9. World-map feature not wired
- **Location:** `src/game/map/map-stage.js`, `src/game/scenes/scenes.js` (`MapScene`), `data/map/fruit-world.json`.
- **Rule:** none specific — incomplete feature debt.
- **Description:** `MapScene`/`MapStage` exist and `data/map/fruit-world.json` is loaded by the data index, but `main.js` never instantiates them; there is no path from the title menu to the world map.
- **Proposed fix:** Wire `MapStage` into the composition root and connect the title menu / stage-complete flow.

### 10. Inline JS default object literals duplicating data
- **Location:** `src/main.js` bootstrap — `physics`, `health`, `inventory`, `projectile`, `noteRangeConfig` inline default literals.
- **Rule:** R2.3/R2.5.
- **Description:** Defaults duplicated in JS mirror JSON values (e.g. physics defaults, `max-slots: 8`). With data-driven sources these are dead code, but they still violate "single source of truth".
- **Proposed fix:** Remove once the corresponding JSON sections are guaranteed complete (see item 1).
- **Status:** Resolved 2026-08-08 (see [`status.md`](status.md)). The `physics`, `health`, `inventory`, `projectile`, and `musical-note-scale` sections were complete in `data/game-config.json` / `data/audio/synthesis.json`, so the inline fallbacks were removed and the configs now read directly from `gameConfig` (strict proxy) / `audioTuningConfig`; `projectile` colors are resolved through `resolveConfig` from `colors.json`, eliminating the hardcoded `#BF4040`/`#40BF40` fallbacks.

### 11. `StageBase` optional `size` on sections
- **Location:** `src/engine/entities/stage-base.js:34-35` — `secData['size']?.width ?? 0`.
- **Rule:** R2.5 (silent fallback).
- **Description:** Section `size` is optional in stage JSON and defaults to 0. This works on plain materialized data, but is a silent default. Either every section should carry an explicit size, or the access should be strict-aware.
- **Proposed fix:** Decide a canonical section-size policy in the data; make the read strict.

### 12. `data/index.json` generation must run before dev/build
- **Location:** `package.json` scripts.
- **Rule:** none specific — operational debt.
- **Description:** The dynamic index requires `scripts/generate-data-index.js` to run before `dev`/`build` (or the `/data/index.json` route in `server.js`). Forgetting the step produces a boot error. A bundler-agnostic alternative is a Vite-style glob, which this project intentionally avoids.
- **Proposed fix:** Keep the npm script wiring; document the invariant in `docs/agent/technical-architecture.md`.

### 13. `DataLoader` is now unused
- **Location:** `src/engine/data/data-loader.js`, `src/engine/index.js:11`.
- **Rule:** none specific — dead-code debt.
- **Description:** After the `DataDriven` migration, `DataLoader` has no consumers. The proposal only mandated deleting `LocaleManager`, so `DataLoader` remains exported as a generic utility, but it is dead code.
- **Proposed fix:** Remove `DataLoader` (and its export) once no consumers remain, or document it as a standalone utility for non-game tooling.
- **Status:** Resolved 2026-08-08 (see [`status.md`](status.md)). `src/engine/data/data-loader.js` deleted and its barrel export removed from `src/engine/index.js`; no consumers remained (`DataDriven` has its own key validation).

### 14. i18n symlink does not survive symlink-less static hosts
- **Location:** `data/i18n/default.json` symlink.
- **Rule:** none specific — deployment debt.
- **Description:** Locale selection relies on a filesystem symlink. `Bun.serve()` follows it, but hosts that do not support or deploy symlinks (e.g. some static file servers, zip-based publishing) would serve a 404 for `data/i18n/default.json`. The `bun run build` pipeline also does not copy `data/` into `dist/`.
- **Proposed fix:** Add a build step that materializes `default.json` as a real copy (or a generated alias file) when publishing to symlink-less hosts; revisit when a real static-hosting target is chosen.

## 2026-08-08 — BL-1 tile-overlap validation

Discovered while implementing BL-1 (fail fast on overlapping solid tiles). The task's background claimed a single pre-existing overlap; a strict AABB scan of the shipped stage found four. The three extra overlaps were in `underground-main` and are fixed in this session, but the underlying layout deserves a design pass.

### 15. `underground-main` room is filled by a solid `wall` backdrop
- **Location:** `data/stages/strawberry-fields.json`, section `underground-main` (object `{ "type": "wall", "position": { "x": 0, "y": -10 }, "size": { "width": 22, "height": 10 }, "visual": { "fill-color": "dark-white" } }`).
- **Rule:** correctness — unwinnable-level debt (the exact failure mode BL-1 exists to catch).
- **Description:** The 22×10 `wall` spans the entire section above the floor (`y` -16..-6 world), filling the whole room. The three `spike` tiles (and the enemies/coins/teleporters at `y` -1) sit inside it, and the player cannot physically enter the underground. BL-1 validation flags the spikes as solid-on-solid overlaps. This session changed the `wall` to a `decorative` (dark-white) backdrop so the stage boots and the room becomes reachable — the visual is unchanged, but the design intent (was it a ceiling? a side column?) was never documented.
- **Proposed fix:** Redesign the underground-main layout deliberately (walls as boundaries, not a full-room fill); decide whether the dark-white slab is a solid boundary or a backdrop and type it accordingly.

### 16. `underground-entry` collectibles are embedded in the descending column
- **Location:** `data/stages/strawberry-fields.json`, section `underground-entry` — `coin` at `{x:1.5, y:4}` and `apple` at `{x:1.5, y:8}` sit inside the 3×10 dark-white column (`{x:0, y:1}` after the BL-1 fix).
- **Rule:** correctness — unreachable-collectible debt.
- **Description:** Even after moving the 3×10 column to `y:1`, the coin/apple remain inside the solid block and can never be collected. BL-1 only validates tile-tile overlaps, so this goes unflagged.
- **Proposed fix:** Move the collectibles out of the column or relocate the column; out of scope for BL-1.

## 2026-08-08 — debt #5 SFX shape alignment

### 17. `playSFX` not wired to game events
- **Location:** `src/engine/audio/audio-engine.js` (`playSFX`) and `src/game/` event sites (jump, hit, collect, level-up, checkpoint, death, note, etc.).
- **Rule:** none specific — incomplete-feature debt (carried over from debt #5).
- **Description:** With the shape mismatch fixed, `playSFX` is correct but still has **zero callers** — no game event produces sound. The data defines 16 sounds (`jump`, `attack`, `hit`, `collect`, `level-up`, `checkpoint`, `death`, `coin`, `star`, `stage-clear`, `musical-note`, `moon-use`, `sun-use`, `earth-use`, `inventory-open`, `inventory-use`).
- **Proposed fix:** Wire `playSFX` into the game event sites (pass `audioEngine` into the systems/entities that emit events, or route through an audio event bus), using `freqOverride` for dynamic pitches (`musical-note`); respects R4.1 and the layered architecture — the engine stays game-agnostic, callers live in `src/game/`.
- **Status:** Resolved 2026-08-08 (see [`status.md`](status.md)). `audioEngine` is injected at the composition root into `Player` (`player.audioEngine`, mirroring the `scoreSystem` wiring) and as a new `Inventory` constructor arg; `StageScene` already held it. All 16 sounds are now wired: `Player.jump`→`jump`, `Player.takeDamage`→`hit`/`death` (via `healthSystem.isDead`), `Collectible.collect`→`coin`/`star`/`musical-note` (with `freqOverride` from `noteForOrder`)/`level-up`/`collect`, `Stage.activateCheckpoint`→`checkpoint`, `Stage.completeStage`→`stage-clear`, `Stage.update` stomp→`attack`, `Inventory.use`→`moon-use`/`sun-use`/`earth-use`/`inventory-use`, `StageScene` inventory toggle→`inventory-open`, `ShootAbility`/`AirSlideAbility`/`ScreenClearAbility` damage→`attack`. Deliberately NOT wired: `ShooterEnemy` firing (would spam; no per-enemy sound gate in data). Related latent bug fixed in passing: `ShootAbility` fired `new Projectile(...)` without the `projectileConfig` 7th arg (would crash before producing any sound); now passes `player.stage.projectileConfig` matching the enemy path. Verified with a 21-case mock-AudioContext harness + `bun build`.

## 2026-08-08 — pending items carried over from the status.md audit (log.txt)

The following were still open after the DataDriven migration and the old status log was reduced to these unresolved items.

### 18. Audio per-channel enable flags `bgm-enabled` / `sfx-enabled` never read
- **Location:** `src/engine/audio/audio-engine.js:28-32` (constructor reads `master-volume`, `bgm-volume`, `sfx-volume`, `sound-enabled`, `bgm-crossfade-duration`), `data/audio/config.json`.
- **Rule:** correctness — config keys defined but never consumed.
- **Description:** The original key mismatch (`enabled`/`crossfade` → `sound-enabled`/`bgm-crossfade-duration`) is fixed, but the data still defines `bgm-enabled` and `sfx-enabled` and the engine never reads them. BGM and SFX cannot be toggled independently at runtime.
- **Proposed fix:** Read `bgm-enabled`/`sfx-enabled` in the constructor (or wire into the settings UI) so the per-channel flags actually work.
- **Status:** Resolved 2026-08-08 (see [`status.md`](status.md)). Constructor now reads `bgm-enabled`/`sfx-enabled` into `#bgmEnabled`/`#sfxEnabled`; `playBGM` gates on `#bgmEnabled`, `playSFX` gates on `#sfxEnabled`; runtime toggles exposed as `bgmEnabled`/`sfxEnabled` getters/setters (mirroring the volume-flag pattern already used by `SettingsMenu`). Both keys are present in `data/audio/config.json`, so the strict reads cannot throw.

### 19. R1.1 — Hardcoded tile type-name logic in `resolveTileConfig`
- **Location:** `src/main.js:99-101` — `deadly: obj.deadly ?? (obj.type === 'spike' || obj.type === 'pit')`, `liquid: obj.liquid ?? (obj.type === 'water')`, `climbable: obj.climbable ?? (obj.type === 'ladder')`.
- **Rule:** R1.1 (`#no-literals`) / data-driven single source of truth.
- **Description:** The data-driven path (`resolveTileType`, reads `data/tiles/*.json`) is used when a tile type exists in `tileDataMap`; the fallback `resolveTileConfig` still infers `deadly`/`liquid`/`climbable` from type-name string matching instead of the JSON. Type-name matching should be eliminated entirely.
- **Proposed fix:** Remove the type-name matching branch and require every tile type to resolve through `tileDataMap` (or add explicit `deadly`/`liquid`/`climbable` flags to the fallback data).
- **Status:** Resolved 2026-08-08 (see [`status.md`](status.md)). `resolveTileConfig` was dead code: `isTile` and `tileDataMap` both derive from `game-config.tile-types`, and `DataDriven` throws if any listed tile file is missing, so `tileDataMap[obj.type]` is always present whenever `isTile` is true. The function was removed entirely and every tile now resolves through `resolveTileType` (data-driven). Verified that the JSON values match the old string-matching semantics (spike/pit deadly, water liquid, ladder climbable, decorative/pit non-solid).

### 20. `air-slide-ability.js` still uses `constructor.name` string matching
- **Location:** `src/game/abilities/air-slide-ability.js:70` — `entity.constructor.name === 'Enemy' || entity.takeDamage`.
- **Rule:** none specific — brittleness debt (same pattern fixed in `screen-clear-ability.js`).
- **Description:** `ScreenClearAbility` was migrated to `entity.isEnemy`, but `AirSlideAbility` still string-matches `constructor.name === 'Enemy'`, which breaks for subclasses (e.g. `BossEnemy`) that don't name exactly `Enemy`.
- **Proposed fix:** Replace with `entity.isEnemy` (the `Enemy` base class exposes `get isEnemy() { return true; }`).
- **Status:** Resolved 2026-08-08 (see [`status.md`](status.md)). Line 70 now reads `entity.isEnemy && entity.takeDamage`, matching `screen-clear-ability.js:45`. No other `constructor.name ===` string-matching remains in `src/`.

### 21. Menu `subtitle` / `hint` config parsed but never rendered
- **Location:** `src/main.js:182-183` (`subtitleDefaults`, `hintDefaults`) vs `data/ui/menus.json` (`menu-defaults.subtitle`, `menu-defaults.hint`); `src/game/ui/ui-components.js` (`Menu.render`).
- **Rule:** R2.3 (data consumed) — config defined but not fully consumed.
- **Description:** `buildMenuSubConfig` reads `menu-defaults.subtitle` and `menu-defaults.hint`, but the returned menu config never includes them and `Menu.render` never draws subtitle/hint lines. Menus still render only title + buttons.
- **Proposed fix:** Pass `subtitle`/`hint` into the menu config and render them in `Menu.render` (or explicitly mark them unused).
- **Status:** Resolved 2026-08-08 (see [`status.md`](status.md)). `buildMenuSubConfig` now includes `subtitle-key`, `hint-key`, and the resolved `subtitle`/`hint` style configs in the returned menu config. `Menu` stores them and `renderSubtitle()`/`renderHint()` draw the subtitle line (top-center, `offset.y`) and the hint line (bottom-center, `viewportHeight + offset.y`) via the shared `#renderTextLine()` helper, both called from the base `Menu.render`. `PauseMenu.render` and `SettingsMenu.render` (which override `render` without calling `super`) now invoke `renderHint()` so the `hint-key`s already defined in `data/ui/menus.json` (`input.pause-hint`, `input.navigate-hint`) are actually displayed. No menu screen defines a `subtitle-key` yet, so subtitle rendering stays dormant until data provides one — the mechanism is wired and data-driven. Verified with a mocked-renderer harness (hint at `y=viewportHeight-0.5`, subtitle at `y=offset.y`) and `bun build` (46 modules).

### 22. Slope collision physics not implemented
- **Location:** `src/engine/physics/collision-solver.js` (AABB-only), `data/tiles/slope.json`, `src/game/entities/tile.js`.
- **Rule:** none specific — missing feature debt (was a "next step" in the old status log).
- **Description:** Slope tiles exist in the data (`slope.json`, `slope-angle` resolved via `resolveTileType`), but `CollisionSolver` only implements AABB resolution — slope surfaces are treated as flat solids. Players/enemies cannot walk up/down slopes smoothly.
- **Proposed fix:** Implement slope collision in `collision-solver.js` using the tile's `slope-angle`, so the landing `y` interpolates along the slope face.

### 23. Enemy AI polish — edge detection and targeting
- **Location:** `src/game/entities/enemy.js`, `src/game/entities/enemy-types.js`.
- **Rule:** none specific — game-feel debt (was a "next step" in the old status log).
- **Description:** Enemies do not detect ledges before walking off (no edge detection) and have no targeting adjustments (aggro range / turn-to-face player). Behaviour is a simple patrol.
- **Proposed fix:** Add edge detection (check for ground ahead before stepping) and optional aggro/targeting in `enemy.js` / `enemy-types.js`.
