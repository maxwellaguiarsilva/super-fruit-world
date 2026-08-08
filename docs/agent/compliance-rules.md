# Non-Negotiable Rules — Compliance Audit

This document defines the absolute, non-negotiable generic rules of the project. Every line of code, every asset, every configuration file, and every architectural decision must comply with these rules. Violation of any rule is a blocking defect.

**Super Fruit World identity-specific rules (colors, background, palette) are defined in [`identity-rules.md`](identity-rules.md).**

---

## Rule Numbering Convention

Rules use a hierarchical numbering scheme: **R1, R2, R3** identify categories/types of rules, and **R1.1, R1.2, R1.3** identify individual rules within each category.

When a new rule is added to an existing category, it receives a new sub-number (e.g., R1.5). When a rule is removed, its sub-number is retired — remaining rules keep their sub-numbers. No renumbering is ever needed. When a new category is added, it receives the next available major number (e.g., R7).

**Before:** Flat numbering (R1, R2, R3, ..., R14). Inserting a rule in the middle caused every subsequent rule to shift, requiring all external references to be updated.

**After:** Hierarchical numbering (R1.1, R1.2, ..., R2.1, R2.2, ...). Inserting or removing rules within a category never affects other rules or categories. External references are always stable.

References to rules should use the full hierarchical identifier (e.g., `R1.3`, `R5.2`) for precision. References to a whole category (e.g., `R2`) are acceptable when referring to all rules in that category.

---

## R1 — Architecture & Code Quality

### R1.1 — Zero Game Literals in Engine Code
> `#no-literals`

**No literal value related to the game may appear in any JavaScript file.**

This includes but is not limited to:
- Strings (game name, character names, fruit names, stage names, UI labels, messages)
- Colors (hex codes, RGB values, color keywords)
- Numeric constants (speeds, sizes, quantities, durations, damage values, cooldowns)
- Positions (coordinates, offsets, layouts)
- Mechanics (ability effects, rules, formulas)
- Tile types, enemy types, collectible types
- Audio file paths or identifiers

**All game data must be sourced from JSON files under the `data/` directory.**

The engine code may only contain:
- HTML5/Canvas API calls
- Math/physics algorithms
- Generic data loading, parsing, and interpretation logic
- Abstract engine systems (loop, rendering, input, audio, collision)

**Audit check:** Grep the `src/engine/` directory for any substring matching known game content (fruit names, color hex values, stage names, ability names, etc.). Any match is a violation.

---

### R1.2 — Object-Oriented Architecture
> `#oop`

**The codebase must follow OOP principles throughout, with a clear engine/platformer/data split.**

- **Engine layer (`src/engine/`):** Generic HTML5 game engine classes (loop, renderer, input manager, audio engine, physics engine, data loader, dialogue system).
- **Platformer layer (`src/game/`):** Generic platformer classes (Player, Enemy, Collectible, Stage, Ability, ProgressionSystem, etc.). Extends or composes engine bases.
- **Identity layer (`data/`):** All Super Fruit World specifics live exclusively in JSON.
- Systems should be encapsulated with clear responsibilities.
- All dependencies injected explicitly — no global mutable state.

**Audit check:** Every entity must extend or compose a base provided by the engine. No standalone functions operating on global state. Engine and platformer layers are both generic — identity lives in data.

---

### R1.3 — No Globals, Mandatory Dependency Injection
> `#no-globals`

**No global variables or global mutable state outside what is natively provided by the JavaScript runtime.**

- **Allowed globals:** `window`, `document`, `Math`, `requestAnimationFrame`, `AudioContext`, `navigator.getGamepads`, and other standard browser/JS APIs.
- **Forbidden:** Any custom global variable, global singleton, global registry, global event bus, or module-level mutable state that acts as implicit shared state.
- All dependencies must be **explicitly injected** into functions, classes, and modules.
- A dependency injection container or manual wiring at the composition root (`main.js`) is acceptable — but global mutable state is not.

**Audit check:**
1. Search for `window.` assignments (excluding polyfills or standard API usage). Any custom property on `window` is a violation.
2. Search for module-level `let` or `var` declarations that are mutated. If they represent shared state rather than configuration constants, it is a violation.
3. Verify that every module receives its dependencies via parameters, not by importing a global singleton.

---

### R1.4 — Native Getter/Setter Properties
> `#getters-setters`

**All data access and mutation must use native JavaScript getter/setter properties, not explicit getter/setter methods.**

- Prefer `get position()` / `set position(value)` over `getPosition()` / `setPosition(value)`.
- Property access is cleaner and less verbose while preserving the ability to encapsulate internal logic.
- This applies to both engine factory objects and game layer classes.

```js
// Correct
obj.position           // read
obj.position = { x, y } // write

// Forbidden
obj.getPosition()
obj.setPosition(x, y)
```

**Audit check:** Grep for method names matching the pattern `get[A-Z]` or `set[A-Z]` in `src/`. Any match is a violation unless it is not a getter/setter (e.g., `getElementById` from the DOM API is fine).

---


---

## R2 — Layers & Data Separation

### R2.1 — Engine Must Be Game-Agnostic
> `#engine-agnostic`

**The engine (`src/engine/`) must not contain any awareness of the Super Fruit World game.**

- It must not reference the game name, fruits, colors, players, enemies, stages, or any game-specific concept.
- It must not assume the game is a platformer — it is a general-purpose HTML5 game engine.
- It must operate purely on data passed to it.
- Any developer should be able to use this engine to build a completely different game (not necessarily a platformer) by writing their own game layer and data files.

**Audit check:** Read every file in `src/engine/`. If a developer unfamiliar with Super Fruit World could understand the code without any game knowledge, it passes.

---

### R2.2 — Platformer Layer Must Be Game-Agnostic
> `#platformer-agnostic`

**The platformer layer (`src/game/`) must not contain any awareness of the Super Fruit World game.**

- Abilities are implemented as generic platformer code (DashAbility, DoubleJumpAbility, ShootAbility, etc.). They do not know which fruit or color unlocks them.
- The progression system is generic: it reads a JSON mapping of collectible → level → ability, without knowing the specific fruits, colors, or ability names in advance.
- Entity classes (Player, Enemy, Collectible) are generic platformer constructs with no hardcoded fruit/color/name references.
- Any developer should be able to build a completely different platformer (e.g., "Space Lizard Adventure") by swapping `data/` files.

**Audit check:** Read every file in `src/game/`. If a developer could replace all `data/` JSON files and get a different platformer without touching JS, it passes.

---

### R2.3 — All Game Data Externalized in JSON
> `#data-driven`

**The `data/` directory is the single source of truth for all game configuration.**

Mandatory data files:
- `data/colors.json` — Single source of truth for all color hex values
- `data/borders.json` — Single source of truth for all border styles
- `data/game-config.json` — Global settings
- `data/player/levels.json` — Level/color/ability mapping
- `data/player/fruits.json` — Fruit to level mapping
- `data/stages/*.json` — Stage definitions (tiles, entities, layout)
- `data/enemies/*.json` — Enemy type definitions
- `data/collectibles/*.json` — Collectible definitions
- `data/tiles/*.json` — Tile definitions
- `data/i18n/default.json` — All user-facing text strings (keys are identifiers, values are displayed text). A symlink to the active locale file (e.g. `en-us.json`, the real single-source-of-truth file). Locale is selected via this symlink, never by config or runtime switching.
- `data/ui/*.json` — UI configuration
- `data/audio/config.json` — Top-level audio settings (volumes, enabled flags, crossfade)
- `data/audio/synthesis.json` — Technical synthesis configuration (wave types, tuning, temperament)
- `data/audio/sfx.json` — SFX definitions (synthesized via Web Audio API)
- `data/audio/bgm.json` — BGM track registry (maps track names to individual track files)
- `data/audio/bgm/*.json` — Individual BGM track definitions (one file per track, each with its own phrases, channels, and notes)
- `data/map/*.json` — World map data
- `data/input/*.json` — Key and button bindings
- `data/index.json` — **Generated** (never hand-maintained) list of all JSON files under `data/`. Emitted by `scripts/generate-data-index.js`; consumed by `DataDriven` for dynamic discovery. Do not edit by hand.

**Audit check:** For every game attribute (speed, HP, color, position, text, sound), trace it back to a JSON file. If it originates in JavaScript code, it is a violation.

---

### R2.4 — Single Source of Truth with Named References
> `#single-source-truth`

**Every reusable concept in the game must have exactly one JSON file as its source of truth. All consumers reference that concept by name — never by raw numeric value or literal.**

This applies to every shared concept (visual and non-visual):

- **Colors:** Only `data/colors.json` contains hex values. Every other JSON file (stages, enemies, player, UI, etc.) references colors by name such as `"red"` or `"dark-red"`. A bare name (e.g. `"red"`) means fill = light variant, border = dark variant (default). The `"dark-"` prefix inverts this: `"dark-red"` means fill = dark variant, border = light variant.
- **Borders:** Only `data/borders.json` defines border widths in visual units. Objects reference borders by name (`"thin"`, `"medium"`, `"thick"`). The raw numeric width values must never appear outside `borders.json`.
- **Text strings:** Only `data/i18n/` contains user-facing text. Every string shown to the player must be retrieved from a locale file by key. No hardcoded strings in JavaScript rendering code. This is the only directory where non-English text is permitted (in values only, never in keys).
- **Any other shared concept** (sizes, speeds, durations, fonts, audio identifiers, tile types, enemy types, etc.) follows this same pattern.

**Redundancy is forbidden.** Two JSON files must not independently define the same value. If "red" means `#FF0000`, that mapping exists only in `colors.json`. If `levels.json` needs to reference the color red, it uses the name `"red"`, not the hex value.

**No raw indices.** Game objects never reference a color by its index number (0–7). Everything is named.

**Audit check:**
1. Search all JSON files under `data/` for hex color values (`#......`). They must appear only in `colors.json`.
2. Search all JSON files under `data/` for border widths (e.g. `"width": 0.1`). They must appear only in `borders.json`.
3. For every named concept, verify exactly one source-of-truth JSON exists. If the same numeric value is defined in two files, it is a violation.
4. Search all JSON files for numeric color indices (0–7) used as a color reference. They must not exist outside `colors.json`.

---

### R2.5 — No Silent Fallback for Missing Data
> `#no-fallback`

**When the data manager is requested a value that does not exist in the external JSON files, the application must throw a hard error — never silently fall back to a default, empty string, null, or undefined.**

- The data manager (or data provider) must validate that the requested key exists before returning.
- If the key is not found, the manager must throw a descriptive error containing the missing key name and the source JSON file path.
- No implicit fallback chain (e.g., "try player/fruits.json, then player/default-fruits.json") is permitted.
- No silent coercion of missing values to `null`, `undefined`, `0`, `""`, or any other falsy sentinel.
- There is **no** fallback anywhere — not for locales, not for any data file. The `DataDriven` accessor throws a descriptive error for any missing path or key.

**Purpose:** This rule ensures that missing data is always detected during development/testing rather than causing subtle, hard-to-debug misbehavior at runtime.

**Audit check:**
1. Search the codebase for patterns like `??`, `||`, `||=`, `??=`, `.find(...) ?? defaultValue`, or ternary fallbacks used when reading from data files. Any such pattern in data-access code is a violation.
2. Verify that the data manager class has an explicit `throw` for missing keys.
3. Verify that all callers do not implement their own fallback after receiving data from the manager.

---

### R2.6 — Locale Selected via Symlink
> `#locale-symlink`

**The active locale is selected via the filesystem symlink `data/i18n/default.json`, never by application configuration or runtime switching.**

- `data/i18n/default.json` is a symlink pointing to the real locale file (e.g. `en-us.json`).
- The real locale file remains the single source of truth (R2.4); `meta.locale` inside it reports the real locale name for display.
- Changing the active locale means changing the symlink target — a build/deploy-time decision, not a runtime one.
- Consumers access strings via `dataDriven["i18n.default.<key-path>"]`. The `i18n.en-us.*` accessor also resolves (the symlinked file is real data).

**Audit check:** There is no `locale` setting in `data/game-config.json` and no runtime locale-switching code in `src/`. The only way to change locale is the symlink.

---

## R3 — Visual Standards

### R3.1 — No Pixel Art
> `#no-pixel-art`

**No sprite sheets, no pixel-based textures, no pixel art aesthetic.**

- All visuals must be rendered geometrically (circles, rectangles, triangles, paths).
- Even if a canvas renders individual pixels, the end result must appear smooth and vector-like to the user.
- Think SVG aesthetic, even if implemented via Canvas 2D API.

**Audit check:** Inspect all visual assets and rendering code. No `.png` sprite sheets. No pixel-grid-aligned artwork. Rendering must use Canvas drawing primitives (arc, rect, lineTo, bezier, etc.) or procedurally generated textures that are smooth.

---

### R3.2 — Rounded Corners Everywhere
> `#rounded-corners`

**No sharp corners or hard edges on any visible element.**

- All rectangles must have rounded corners (`cornerRadius > 0`).
- All triangles must have rounded vertices and edges.
- All joints, intersections, and line endpoints must be rounded.
- This applies to: level geometry, tiles, platforms, UI elements, enemies, player, collectibles, HUD components.

**Audit check:** Inspect rendering code for every drawn shape. Any `cornerRadius = 0` or absence of corner rounding on a visible shape is a violation.

---

## R4 — Input

### R4.1 — Keyboard + Joystick Input
> `#input`

**The game must support both keyboard and gamepad/joystick input simultaneously.**

- Input handling must be abstracted so that game logic does not care about the input source.
- All key bindings must be configurable via JSON.
- Standard gamepad API must be used for joystick support.

**Audit check:** Connect a gamepad. All player actions must be performable via gamepad without touching the keyboard.

---

## R5 — Data Conventions

### R5.1 — Slope System Data Convention
> `#slopes`

**Slopes are defined in JSON by named types, not by numeric indices or raw angle values.**

| Name        | Angle |
|-------------|-------|
| `slope-30`  | 30°   |
| `slope-45`  | 45°   |
| `slope-60`  | 60°   |

Each slope object has a boolean `"inverted"` field. When `true`, the slope tilts in the opposite direction. The engine converts named slopes to angles using `Math` at runtime.

**Audit check:** Inspect stage JSON files. Slope data must use named strings and the `inverted` boolean. No numeric angle values or indices in JSON. Engine must convert using `Math` at runtime.

---

### R5.2 — JSON Keys Lower-Kebab-Case
> `#kebab-case`

**All JSON keys in every file under `data/` must use lower-kebab-case exclusively.**

- All characters must be lowercase.
- Words are separated by hyphens (`-`), never underscores (`_`) or spaces.
- Numbers are permitted within key names.
- Uppercase letters, underscores, and spaces in JSON keys are a violation.

```json
// Correct
{ "player-speed": 1.0, "max-jump-count": 2, "bgm-volume": 0.8 }

// Forbidden
{ "playerSpeed": 1.0, "max_jump_count": 2, "BGM_VOLUME": 0.8, "max jump count": 2 }
```

**This rule applies exclusively to keys.** Values (strings, descriptions, html attributes, etc.) may contain any characters as needed.

**Runtime enforcement:** The engine validates every JSON key at load time against the pattern `^[a-z0-9-]+$`. Any key that violates this pattern triggers a validation error — the violation is reported and the application will **not start/continue**. This ensures no non-conforming data ever reaches game logic.

**Audit check:**
1. Scan all JSON files under `data/` for keys matching `[A-Z_]` (uppercase or underscore). Any match is a violation.

---

### R5.3 — JSON File and Folder Names Lower-Kebab-Case
> `#kebab-case-files`

**All `.json` file basenames and all directory names under `data/` must match `^[a-z0-9-]+$` (lower-kebab-case).**

- The `.json` extension is not part of the name; only the basename is validated.
- Non-JSON files (e.g. `.ogg`, `.png`) are **not** data and are skipped silently.
- A `.json` file (or a directory) whose name violates the pattern is a **boot-time error** — the application will not start. This catches typos early.

**Runtime enforcement:** The index generator (`scripts/data-index.js`) validates every path it discovers, and `DataDriven` re-validates the index at load time. Either one failing is a blocking error.

**Audit check:** Run `find data -type f -name '*.json'` and `find data -type d`; every basename/directory must match `^[a-z0-9-]+$`.

---

## R6 — Repository Hygiene

### R6.1 — No Secrets or Sensitive Data in Repository
> `#no-secrets`

**The repository must be clean enough to be made public at any time.**

- No API keys, tokens, passwords, or credentials.
- No personal information.
- No build artifacts, `node_modules`, or generated files.
- `.gitignore` must be comprehensive and verified.

**Audit check:** Review `.gitignore` coverage. Run `git ls-files` and inspect every tracked file for sensitive content. Imagine the repo going public in 5 minutes — would anything need to be scrubbed?

---

## Audit Procedure

1. Run `git ls-files` to list all tracked files.
2. For each JavaScript file in `src/engine/`:
   - Verify **R1.1**: Grep for any game-specific literal. Any match = violation.
   - Verify **R2.1**: Read the file. If it references any game concept, it fails.
3. For each JavaScript file in `src/game/`:
   - Verify **R2.2**: Read the file. If it references any game-specific concept, it fails.
   - Verify **R2.3**: Every game attribute must trace to a JSON data file.
4. For all code:
   - Verify **R1.2**: Check that game entities extend/compose engine-provided bases.
   - Verify **R1.3**: Search for custom `window.` assignments and module-level mutable state. Verify explicit DI.
   - Verify **R1.4**: Grep `src/` for `get[A-Z]` and `set[A-Z]` method patterns. Replace with native getter/setter properties.
5. For all rendering code:
   - Verify **R3.1**: No pixel art assets or rendering techniques.
   - Verify **R3.2**: Every drawn shape has rounded corners.
6. Verify **R4.1**: Test with a connected gamepad.
7. Verify **R6.1**: Scan `.gitignore` and all tracked files for sensitive content.
8. Verify **R5.1**: Inspect stage JSON for named slope convention (no numeric indices or raw angles).
9. Verify **R2.4**: Search all JSON files for hex colors outside `colors.json`, border widths outside `borders.json`, and numeric color indices used as references.
10. Verify **R5.2**: Scan all JSON keys under `data/` for uppercase letters or underscores — all keys must be lower-kebab-case.
11. Verify **R5.3**: All `.json` file basenames and directory names under `data/` must be lower-kebab-case (`^[a-z0-9-]+$`).
12. Verify **R2.6**: `data/i18n/default.json` is a symlink to the active locale file; there is no runtime locale switching.
13. Verify **identity rules** in [`identity-rules.md`](identity-rules.md): background color (I1), color palette (I2).
