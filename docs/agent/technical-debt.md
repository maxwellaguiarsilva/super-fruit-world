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
- **Location:** `src/main.js` (`'#404040'`, `'#BF4040'`, `'#40BF40'`, `'#BFBF40'`, `'#000000'` fallbacks), `src/game/stages/stage.js:34-42` (checkpoint `'#40BF40'`/`'#808080'`/`'#FFFFFF'`), `src/game/entities/collectible.js:96` (`'#000000'`, `'#FFFF00'`), `src/game/ui/ui-components.js` (selected/hover colors `'#FFFF00'`, `'#888888'`, `'rgba(0,0,0,0.7)'`), `src/engine/dialog/dialogue-engine.js` (`'#000000'`, `'#FFFFFF'`, box geometry), `src/game/stages/stage.js:424` (`'#BFBF40'`).
- **Rule:** R1.1 (`#no-literals`).
- **Description:** Fallback hex colors and inline UI colors bypass `data/colors.json` as the single source of truth.
- **Proposed fix:** Route every visual through `resolveColor()`/`resolveConfig()`; move any remaining rendering defaults into `data/colors.json` (or a UI config) and reference by name.

### 4. R1.3 — Global state in composition root
- **Location:** `src/main.js:467` — `window.__sceneManager = sceneManager;`.
- **Rule:** R1.3 (`#no-globals`).
- **Description:** Exposes the scene manager as a global on `window` (appears to be a debug/devenv shortcut). Any custom `window.` property is a violation.
- **Proposed fix:** Remove it, or gate it behind an explicit debug flag that is off in production.

### 5. SFX data shape mismatch with AudioEngine
- **Location:** `data/audio/sfx.json` vs `src/engine/audio/audio-engine.js:71-120` (`playSFX`).
- **Rule:** none specific — correctness/consistency debt.
- **Description:** `AudioEngine.playSFX` reads `sfx.frequency`, `sfx['wave-type']`, `sfx.envelope.sustain/release`; the data defines `freq`, `wave`, and envelopes with only `attack`/`decay`. Also, the sounds live under a `sounds` key while the engine indexes `sfxDefs[name]` at the top level. `playSFX` currently has **no callers**, so this is latent. If it is ever invoked, no sound will play.
- **Proposed fix:** Align either the engine reader or the JSON shape; wire `playSFX` into game events (jump, hit, collect, etc.).

### 6. i18n key typo — `settings.title`
- **Location:** `src/game/ui/ui-components.js:327` — `localeManager.get('settings.title')`.
- **Rule:** correctness (latent UI bug).
- **Description:** The locale file defines `menu.settings.title`, not `settings.title`. Under the old `LocaleManager`, a missing key silently returned the key itself (`"settings.title"`), masking the typo. Under `DataDriven` this key now throws. Fixed during migration (must resolve), but the underlying pattern (silent fallback-to-key) was debt.
- **Proposed fix:** Resolved during migration; keep as a documented example of why silent fallback is dangerous.

### 7. Stale config keys in `data/game-config.json`
- **Location:** `data/game-config.json` — `locale` (removed during migration) and `paths.assets`.
- **Rule:** none specific — hygiene debt.
- **Description:** `paths.assets: "data/"` is unused by any consumer; `locale` was the old locale source of truth.
- **Proposed fix:** Remove `paths.assets` (or wire it as the DataDriven base path).

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

### 14. i18n symlink does not survive symlink-less static hosts
- **Location:** `data/i18n/default.json` symlink.
- **Rule:** none specific — deployment debt.
- **Description:** Locale selection relies on a filesystem symlink. `Bun.serve()` follows it, but hosts that do not support or deploy symlinks (e.g. some static file servers, zip-based publishing) would serve a 404 for `data/i18n/default.json`. The `bun run build` pipeline also does not copy `data/` into `dist/`.
- **Proposed fix:** Add a build step that materializes `default.json` as a real copy (or a generated alias file) when publishing to symlink-less hosts; revisit when a real static-hosting target is chosen.
