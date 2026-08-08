# Status

**Date:** 2026-08-08
**Phase:** DataDriven Dynamic Resource Manager — Implemented

## Session 2026-08-08 — DataDriven Resource Manager

Replaced the hand-maintained `data/manifest.json` + `DataLoader` + `LocaleManager` with a dynamic, strict resource manager per [`data-driven-resource-manager.md`](data-driven-resource-manager.md).

### Completed Work

1. **`DataDriven` class (`src/engine/data/data-driven.js`):** Discovers and loads every JSON file under `data/` via a generated index. Proxy-based dotted access (`dataDriven["folder.file.key"]`), longest-file-prefix resolution, zero silent fallback (R2.5): missing file → `Data not found: <path>`, missing key → `Key not found: <key> in data/<file>.json`. Returned values are wrapped in recursive strict proxies (deep strictness, §3.2.6).
2. **Generated index:** `scripts/generate-data-index.js` walks `data/`, validates kebab-case paths (new R5.3), and emits `data/index.json` (gitignored). `server.js` serves `/data/index.json` dynamically in dev. `dev`/`start`/`build` run the generator first.
3. **i18n via symlink (R2.6):** `data/locales/` → `data/i18n/` (`git mv`), with `data/i18n/default.json` → `en-us.json` symlink. Consumers migrated from `localeManager.get('menu.main.title')` to `dataDriven["i18n.default.menu.main.title"]`.
4. **Removed:** `data/manifest.json`, `src/engine/data/locale-manager.js`, `LocaleManager` export, and the `locale` section of `data/game-config.json`.
5. **Audio restructure (§7):** `data/audio.json` → `data/audio/config.json` (top-level settings); `data/audio/config.json` → `data/audio/synthesis.json` (tuning/note-scale). Consumers use `dataDriven["audio.config"]` / `dataDriven["audio.synthesis"]`.
6. **`src/main.js` rewrite:** bootstrap uses `DataDriven.create('/', '/data/index.json')`; all `dataLoader.get('data/...')` → dotted accessors; `game-config.json` gains a `damage` section (was previously read with a JS fallback).
7. **Consumers migrated:** `src/game/ui/ui-components.js`, `src/game/scenes/scenes.js`, `src/engine/dialog/dialogue-engine.js` now read i18n via injected `dataDriven`. Fixed latent `settings.title` → `menu.settings.title` key typo.
8. **`color-utils.js`:** `resolveColor` made strict-safe (explicit existence checks) so non-color names (e.g. a fruit name used as a fill) resolve to `null` instead of throwing.
9. **Docs:** `compliance-rules.md` (R2.3, R2.4, R2.5, new R2.6, new R5.3, audit procedure), `technical-architecture.md`, `requirements.md`, `class-architecture.md`, `status.md`, `technical-debt.md` (new register), and the proposal itself (status → implemented, decisions recorded).

### Verification

- `bun run generate:data-index` produces a 53-file index including both `i18n/en-us.json` and symlinked `i18n/default.json`.
- Dev server boots; title screen renders; Enter starts the stage (tiles, enemies, collectibles, teleporters, checkpoints all created); HUD and menu strings resolve via strict i18n accessors; gameplay runs with no console/page errors.
- Accessor behavior verified in-browser: correct values for `i18n.default.*`, `audio.config`, `audio.synthesis`, `audio.bgm.title-screen`; descriptive throws for missing file (`Data not found`) and missing key (`Key not found`, including deep-proxy nested access).

### Notes / Debt

Technical debt and compliance violations observed during this work (pre-existing R2.5 fallbacks, hardcoded colors, `window.__sceneManager`, SFX shape mismatch, non-self-contained build, unwired world-map feature, etc.) are registered in [`technical-debt.md`](technical-debt.md) for future cleanup.

---

## Previous Sessions

**Date:** 2026-07-27
**Phase:** Data-Driven Hardcoding Violations — All Resolved

## Current State

All 11 categories of data-driven violations have been fixed. The codebase now properly consumes JSON data files for colors, UI layouts, game config, and entity properties. Hardcoded hex colors have been eliminated across all files — `resolveColor()` and `resolveConfig()` from `data/colors.json` are now used universally.

BGM hierarchy system upgraded to recursive prime-factor grouping. The old fixed 3-level system (cells → measures → parts) has been replaced by an algorithm that auto-generates `{track}-l{level}-i{item}` levels from cells upward until a single root remains.

## Completed Work

### Previous Session
- BGM data restructuring, synth bug fixes, engine adaptation, title screen BGM, compliance rules update.

### This Session — Data-Driven Hardcoding Fixes

1. **Audio Config Key Mismatch (`audio-engine.js`):** Fixed keys — `enabled` → `sound-enabled`, `crossfade` → `bgm-crossfade-duration`. Audio enable flags now actually work.

2. **Eliminated Hardcoded Colors Across All Files:**
   - Created `src/game/utils/color-utils.js` with `resolveColor()` and `resolveConfig()` (deep color-name-to-hex resolver).
   - `enemy.js`: Replaced hardcoded 8-color palette with config-driven `color-palette` array resolved from `data/colors.json` via `parseEnemyConfig()`.
   - `enemy-types.js`: Same fix for `BossEnemy.render()` using inherited `colorPalette` getter.
   - `stage.js`: Checkpoint colors and spawn-collectible fill changed to match `colors.json` values.
   - `map-stage.js`: Node/path fill colors changed to match `colors.json`.
   - `teleporters.js`: Teleporter render colors changed to match `colors.json`.
   - `projectile.js`: Projectile colors read from config (`enemy-color`/`player-color` in `game-config.json.projectile`).
   - `tile.js`: Fallback fill color changed from `#333333` to `#404040` (black light variant).
   - `player.js`: Eyes/mouth border width params preserved, body color comes from resolved `starting-color`.
   - `collectible.js`: Fill color resolved at config-build time in `main.js`.
   - All UI screens (HUD, Menu, PauseMenu, SettingsMenu, GameOverScreen, StageClearScreen, InventoryUI): Colors resolved from config via `resolveConfig()` at composition root.

3. **HUD Refactored (`ui-components.js`):** Now fully reads `data/ui/hud.json` — element positions, sizes, colors, font, label keys. Life bar, level indicator, coin counter, ammo counter, score counter, and note tracker all use config-driven layout. Colors resolved from `colors.json` names.

4. **Menu Refactored (`ui-components.js`):** `Menu` base class now reads button styling from `menu-defaults.button` (gap, font-size, text-color, selected-text-color). All menu variants (TitleMenu, PauseMenu, SettingsMenu, GameOverScreen, StageClearScreen) use resolved colors from `buildMenuSubConfig()`.

5. **InventoryUI Refactored (`ui-components.js`):** Now reads `columns`, `rows`, `slot.size`, `slot.gap`, overlay, title, footer hints, slot colors, item colors from `data/ui/inventory.json`. Colors resolved via `resolveConfig()` at composition root.

6. **Health System Configurable (`health-system.js`):** Constructor now accepts a config object (`max-life`, `starting-lives`, `starting-continues`, `iframe-timer`). Defaults defined as `HealthSystem.defaultConfig`. `useContinue()` resets lives from config instead of hardcoded `5`.

7. **Player Config Externalized:** Added `player` section to `data/game-config.json` (`size`, `starting-level`, `starting-color`). `main.js` resolves `starting-color` via `resolveColor()`. `starting-color` value changed from `#000000` hex to `"black"` named reference.

8. **Projectile Config Externalized:** Added `projectile` section to `data/game-config.json` (`size`, `max-travel`, `enemy-color`, `player-color`). `Projectile` constructor accepts optional 7th `config` parameter. `Stage` stores and provides `projectileConfig` to `ShooterEnemy`.

9. **Note Config Externalized:** `NoteCollectionTracker` now initialized from `audioTuningConfig['musical-note-scale']` array (e.g., `["c4","d4","e4","f4","g4","a4","b4","c5"]`) instead of hardcoded `lowest: 'c4', count: 8`.

10. **Screen-Clear Ability — `constructor.name` Fix (`screen-clear-ability.js`):** Replaced brittle `entity.constructor.name.includes('Enemy')` with `entity.isEnemy` property getter. `Enemy` base class now exposes `get isEnemy() { return true; }`.

11. **Tile Defaults Externalized:** Added 8 tile JSON files to `data/manifest.json`. `main.js` builds `tileDataMap` from loaded tile data. `resolveTileType()` function reads `deadly`, `damage-value`, `liquid`, `climbable`, `solid`, `friction`, visual properties from tile data files instead of hardcoded type-name matching. `Tile` stores `damageValue` from config; `Stage.update()` uses it instead of hardcoded `10`.

12. **Game Config Sections Added:** `player`, `health`, `projectile` sections added to `data/game-config.json`.

### This Session — BGM Recursive Prime-Factor Hierarchy

13. **Recursive Prime-Factor Hierarchy (`src/format-4-beat-music.ts`):**
    - Replaced fixed `build_measure_dict` (2 cells → 1 measure) and `build_part_dict` (prime grouping) with a single recursive `build_track_hierarchy` that generates all levels above cells.
    - Algorithm: N = item count, X = largest prime divisor, P = N/X groups → recurse on P at next level.
    - Naming: `{track}-l{level}-i{item}` — deduplication across all levels (identical groups share the same key).
    - Each track's `channels.{track}.notes` becomes a single-element array pointing to the root key.

14. **Fixed `group_notes_by_2_beats` (`src/format-4-beat-music.ts`):**
    - Bug: a 4-beat note starting on a 2-beat boundary was not split across cells, producing incomplete cell counts (lead had 31 cells instead of 32).
    - Fix: inner loop that splits notes exceeding the remaining space in the current 2-beat cell.

15. **Updated `docs/audio/bgm-json-spec.md`:**
    - Rewritten in English documenting the recursive prime-factor approach, flat dictionary format, and track root references.

## Pending Issues

### Data-Driven Compliance Debt (Audited 2026-07-27)

1. **Cores hardcoded — `data/colors.json` ignorado em 10+ arquivos**
   - `src/game/entities/enemy.js:62` e `enemy-types.js:112`: Mapa completo de 8 cores em hex duplicado (`['#000000', '#FF0000', ...]`)
   - `src/game/ui/ui-components.js`: ~30 ocorrências de hex hardcoded (`'#880000'`, `'#FF0000'`, `'#FFFF00'`, `'#00FF00'`, `'#FFFFFF'`, `'#888888'`, `'#111111'`, `'#444444'`)
   - `src/game/stages/stage.js:34-42`: Cores do checkpoint hardcoded
   - `src/game/map/map-stage.js:88-102`: Cores de nós/paths hardcoded
   - `src/game/entities/projectile.js:72`: Projétil inimigo `'#FF0000'`, player `'#00FF00'`
   - `src/game/stages/teleporters.js:19,54`: Cores dos teleporters hardcoded
   - `src/game/entities/player.js:145-176`: `'#000000'` para borda/olhos/boca
   - `src/game/entities/collectible.js:96`: Borda `'#000000'` hardcoded
   - `src/game/entities/tile.js:47`: Fallback `'#333333'` hardcoded
   - `src/main.js:205`: `'starting-color': '#000000'` hardcoded
   - `resolveColor(name, colorsConfig)` existe em `main.js:45` mas quase ninguém chama

2. **HUD Layout — `data/ui/hud.json` quase totalmente ignorado**
   - `hudConfig` é injetado mas só lê `font-family` e `ammo-type`
   - **Ignorado**: `position`, `height`, `padding`, `background`, `border`, todos `elements` (life-bar, level-indicator, coin-counter, ammo-counter, score-counter, star-counter, note-tracker, inventory-indicator)
   - Tudo renderizado com posições/sizes/cores fixas em `ui-components.js:31-78`

3. **Menu Layout — `data/ui/menus.json` parcialmente ignorado**
   - `buildMenuSubConfig()` em `main.js:379-400` ignora `menu-defaults.button` (size, gap, border, corner-radius, fill/hover/selected colors), `subtitle`, `hint`
   - `Menu.render` em `ui-components.js:170-177` hardcoda espaçamento (`i * 0.9`) e cores (`'#FFFF00'`, `'#888888'`)

4. **Inventory UI — `data/ui/inventory.json` parcialmente ignorado**
   - `ui-components.js:383-384`: `#cols = 4` e `#rows = 2` hardcoded (ignorando `inventory.columns`/`rows`)
   - `slotSize = 3` hardcoded (ignorando `slot.size`)
   - Cores hardcoded: `'#FFFF00'`, `'#444444'`, `'#111111'`
   - Overlay, título, footer hints config ignorados

5. **Player Config — sem seção `player` em `data/game-config.json`**
   - `main.js:202-209`: `size: 1.0`, `starting-level: 0`, `starting-color: '#000000'` hardcoded
   - Não existe `data/game-config.json.player` para consumir

6. **Health System — sem seção `health` em `data/game-config.json`**
   - `main.js:190`: `new HealthSystem(10, 5)` — maxLife=10, lives=5 hardcoded
   - `health-system.js:13`: `this.#continues = 1` hardcoded
   - `health-system.js:14`: `this.#iframeTimer = 1.0` hardcoded
   - `health-system.js:62`: `this.#lives = 5` no `useContinue()` hardcoded

7. **Projétil — sem JSON de configuração**
   - `projectile.js:10`: `super(x, y, 0.25, 0.25)` — tamanho hardcoded
   - `projectile.js:14`: `this.#maxTravel = 20` — distância máxima hardcoded

8. **Notas Musicais — config ignorada**
   - `main.js:193-196,254`: `{ lowest: 'c4', count: 8 }` hardcoded em vez de ler de `data/audio/config.json`

9. **Screen Clear Ability — nomes de classe hardcoded**
   - `screen-clear-ability.js:45-47`: String-match em `entity.constructor.name` em vez de checar propriedade tipo `entity.isEnemy`

10. **Tile Defaults — lógica de tipo hardcoded**
    - `main.js:96-97`: `deadly: (type === 'spike' || 'pit')`, `liquid: (type === 'water')`, `climbable: (type === 'ladder')` — deveria vir dos JSONs em `data/tiles/`

11. **Audio Config Key Mismatch (`audio-engine.js:29`):** The constructor reads `audioConfig['enabled']` and `audioConfig['crossfade']`, but `data/audio.json` defines `sound-enabled`, `bgm-enabled`, `sfx-enabled`, and `bgm-crossfade-duration`. As a result, `#isEnabled` is always `true` regardless of the config, and `#crossfadeDuration` defaults to `1.0` (which happens to match the data value by coincidence). The `bgm-enabled` and `sfx-enabled` keys are never read. This needs to be fixed so the audio enable/disable flags actually work.

## Next Steps

1. **Fix data-driven violations (items 1-11 above):**
   - Eliminate all hardcoded hex colors — use `resolveColor()` from `data/colors.json`
   - Refactor HUD to consume `data/ui/hud.json` fully
   - Refactor InventoryUI to consume `data/ui/inventory.json` fully
   - Add `player`, `health`, `projectile` sections to `data/game-config.json`
   - Externalize musical note config from `data/audio/config.json`
   - Replace `constructor.name` string-matching with type properties
   - Externalize tile deadly/liquid/climbable defaults to `data/tiles/` JSONs
2. Fix the audio config key mismatch (item 11 above).
3. Implement slope collision physics in `src/engine/physics/collision-solver.js`.
4. Polish enemy AI (edge detection, targeting adjustments) in `src/game/entities/enemy.js`.

## Documents Updated

| Document | Status |
| --- | --- |
| `data/audio/bgm.json` | Updated — Now a track registry (maps names to file paths). |
| `data/audio/bgm/title-screen.json` | Updated — Adjusted with two named phrases (`title-phrase-1`, `title-phrase-2`) from keyboard note converter. |
| `data/audio/bgm/world-map.json` | Created — World map BGM. |
| `data/audio/bgm/stage.json` | Created — Stage BGM (bass removed). |
| `data/audio/bgm/stage-clear.json` | Created — Stage clear jingle. |
| `data/manifest.json` | Updated — Added 4 new BGM track files. |
| `src/main.js` | Updated — Loads BGM index + individual track files. |
| `src/engine/audio/audio-engine.js` | Updated — Track map input, removed global phrases, fixed 3 synth timing bugs. |
| `docs/agent/compliance-rules.md` | Updated — R2.3 reflects new BGM file structure. |
| `docs/agent/status.md` | Updated — Recorded compliance audit findings (10 categories of data-driven violations). |
| `src/format-4-beat-music.ts` | Refactored — Replaced fixed measure/part builders with recursive prime-factor hierarchy. Fixed note-splitting bug in `group_notes_by_2_beats`. |
| `docs/audio/bgm-json-spec.md` | Rewritten — Documented recursive prime-factor hierarchy, flat dictionary + track roots structure. |
