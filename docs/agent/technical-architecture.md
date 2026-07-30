# Technical Architecture

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Bun](https://bun.sh) |
| Platform | HTML5 (browser) |
| Rendering | Canvas 2D API |
| Language | JavaScript (ES modules) |
| Package Manager | Bun (not npm) |
| Version Control | Git |
| Remote | GitHub (private repo, gh CLI) |

## Project Structure (Planned)

```
super-fruit-world/
├── data/                        # All game data as JSON
│   ├── colors.json              # Single source of truth for all color hex values (3-bit RGB palette)
│   ├── borders.json             # Single source of truth for all border styles (thin, medium, thick)
│   ├── game-config.json         # Global game settings (visual unit scale, audio defaults, locale)
│   ├── stages/                  # Stage definitions
│   │   ├── stage-01.json
│   │   └── ...
│   ├── enemies/                 # Enemy definitions
│   ├── collectibles/            # Collectible definitions
│   ├── player/                  # Player progression & abilities
│   │   ├── levels.json          # Color level → abilities mapping (references colors by name)
│   │   └── fruits.json          # Fruit → level mapping (references colors by name)
│   ├── audio.json               # Top-level audio settings (volumes, enabled flags, crossfade)
│   ├── audio/                   # Audio resource directory
│   │   ├── config.json          # Technical synthesis config (wave types, tuning, temperament)
│   │   ├── sfx.json             # SFX definitions (synthesized via Web Audio API)
│   │   ├── bgm.json             # BGM track definitions
│   │   └── *.ogg                # Pre-recorded OGG audio files (optional, named)
│   ├── images/                   # Image assets (if any)
│   ├── tiles/                   # Tile definitions (platform, wall, slope, water, spike, etc.)
│   ├── map/                     # World map data (stages with named exits)
│   ├── locales/                 # User-facing text strings
│   │   └── en-us.json           # English (US) locale — keys are identifiers, values are displayed text
│   ├── ui/                      # UI definitions (menus, HUD)
│   └── input/                   # Key and button bindings
├── src/
│   ├── engine/                  # Game engine (fully agnostic)
│   │   ├── core/                # Core loop, game state, scene management
│   │   ├── renderer/            # Canvas rendering with rounded geometry primitives
│   │   ├── input/               # Keyboard + joystick input handling
│   │   ├── physics/             # Movement, collision detection (AABB), slope trigonometry
│   │   ├── audio/               # Audio engine (file playback + Web Audio API synthesis)
│   │   ├── data/                # JSON data loaders (fetch-based, eager at boot)
│   │   └── dialog/              # Cutscene/dialogue system (text boxes, sequences)
│   ├── game/                    # Generic platformer engine (no fruit/color/name awareness)
│   │   ├── entities/            # Player, enemies, collectibles
│   │   ├── stages/              # Stage logic
│   │   ├── ui/                  # Game UI (HUD, menus)
│   │   ├── abilities/           # Generic ability implementations (Dash, DoubleJump, Shoot, etc.)
│   │   ├── map/                 # World map
│   │   └── systems/             # Platformer systems (save, score, progression, damage)
│   └── main.js                  # Entry point — composition root, wires DI
├── tests/                       # Test files
├── docs/
│   ├── agent/                   # Planning & documentation
│   └── workflow/                # Workflow guides
├── .gitignore
├── package.json
└── README.md
```

## Core Architecture Principles

### 1. Three-Layer Architecture

The project uses a strict three-layer separation:

| Layer | Directory | Contains |
|-------|-----------|----------|
| Engine | `src/engine/` | Fully generic HTML5 game engine. No awareness of platformers, fruits, colors, or any game concept. |
| Platformer | `src/game/` | Generic platformer engine: player, enemies, collectibles, stages, abilities, damage, save, score, progression systems. Knows nothing about fruits, colors, or "Super Fruit World". |
| Identity | `data/` | All Super Fruit World identity: fruit names, color palette, stage layouts, ability parameters, text strings, and the mapping between collectibles → levels → abilities. |

#### Layer 1 — Engine (`src/engine/`)

Generic HTML5 game engine systems as classes:
- Game loop management (variable timestep, catch-up, decoupled render)
- Canvas rendering primitives (scaled to visual units)
- Input handling (keyboard + gamepad)
- Physics (gravity, collision AABB, slope trigonometry, movement)
- Audio playback and synthesis
- JSON data loading (fetch, eager at boot, configurable base path)
- Cutscene/dialogue system (text boxes, sequences)

#### Layer 2 — Platformer Engine (`src/game/`)

Generic platformer mechanics and systems. Implements abilities as generic gameplay code (DashAbility, DoubleJumpAbility, ShootAbility, etc.) without knowing which fruit or color unlocks them. Provides a progression system that reads JSON to wire everything together. Could be reused to build any platformer by swapping `data/`.

#### Layer 3 — Identity (`data/`)

The only place where "Super Fruit World" exists. All JSON files under `data/` collectively define:
- Which abilities exist, their names, parameters, and activation combos
- The progression chain: collectible (big fruit) → level (color) → ability
- Stage layouts, enemy placements, tile maps
- Color palette, visual style parameters
- All user-facing text strings

**Key principle:** A different game (e.g., "Space Lizard Adventure") could be built on the same `src/engine/` + `src/game/` code by writing different `data/` files. No JavaScript changes needed.

Both engine and platformer layers use classes with dependency injection.

### 1.1 Dependency Injection
- No custom global variables — dependencies injected explicitly.
- The composition root (`main.js`) assembles all services and passes them down.

### 2. Data-Driven Everything
No game value is hardcoded. Every attribute comes from JSON:
- Colors → `data/colors.json` (single source of truth for all hex values)
- Border widths → `data/borders.json` (single source of truth for all border widths in visual units)
- Player progression → `data/player/levels.json`
- Fruit mappings → `data/player/fruits.json`
- Enemy types → `data/enemies/*.json`
- Stage layouts → `data/stages/*.json`
- Tile definitions → `data/tiles/*.json`
- UI layout → `data/ui/*.json`
- Audio config → `data/audio.json` + `data/audio/config.json` + `data/audio/sfx.json` + `data/audio/bgm.json` (audio resources referenced by name)
- Text strings → `data/locales/*.json`

### 2.1 Visual Unit System
The game operates on **visual units** (floats), not pixels. Game objects never know about pixels.

- **Default scale:** 1 visual unit = 1/10 of canvas height.
- **Override:** `game-config.json` can define the unit scale in % or pixel terms.
- **Canvas size:** 90% of browser viewport width and height.
- **Body background:** pure black (`#000000`).
- The engine handles scaling from visual units to canvas pixels internally.

### 2.2 Single Source of Truth (Named References)

Every reusable concept in the game has exactly one JSON file as its source of truth. All other game data files reference that concept **by name only** — never by raw numeric value.

- **Colors:** Only `colors.json` contains hex values. Every other JSON file references colors by name (`"red"`, `"dark-red"`). A bare name (e.g. `"red"`) means fill = light variant, border = dark variant. The `"dark-"` prefix inverts this.
- **Borders:** Only `borders.json` defines border widths in visual units. Game objects reference borders by name (`"thin"`, `"medium"`, `"thick"`).
- **Text strings:** Only `locales/en-us.json` contains user-facing strings. Game code retrieves all text by key. `en-us.json` is the fallback for missing keys in other locales.
- This pattern applies to **every** shared concept (sizes, durations, speeds, fonts, sounds, etc.).
- JSON keys use **kebab-case** exclusively.

### 2.3 Section System — Hierarchical Spatial Containers

Stages and maps use a **section system** to organize objects hierarchically. All object positions are relative — objects relative to their section, sections relative to their parent section. This eliminates the need to recalculate all positions when inserting or reordering content.

```
Root ("root")
├── Section "intro"          (offset x: 0, y: 0)
│   ├── Platform A           (x: 2,  y: 0) → final: (2, 0)
│   ├── Enemy B              (x: 5,  y: 0) → final: (5, 0)
│   └── Section "pit"        (offset x: 10, y: 0)
│       ├── Spike C          (x: 0,  y: 1) → final: (10, 1)
│       └── Coin D           (x: 2,  y: 0) → final: (12, 0)
└── Section "boss"           (offset x: 30, y: 0)
    └── Wall E               (x: 0,  y: 0) → final: (30, 0)
```

**Rules:**
- Sections reference their parent by `parent-section` name. Top-level sections use `"root"`.
- Nesting has no depth limit — arbitrary tree structures are valid.
- The game engine recursively computes final world positions from the section hierarchy at load time.
- Section names must be unique within their parent scope.

**JSON structure:**
```json
{
  "name": "string",
  "parent-section": "string",
  "position": { "x": float, "y": float },
  "objects": [ ... ]
}
```

### 3. Object-Oriented Design

Both engine and game layers use classes. Engine services are injected into game classes:
- `Engine.Entity` base → extended by `Game.Player`, `Game.Enemy`, `Game.Collectible`
- `Engine.Stage` base → extended by `Game.Stage`
- `Engine.UI` base → extended by `Game.HUD`, `Game.Menu`

### 4. Rendering Style
- Canvas-based rendering with SVG-style geometric aesthetics.
- All shapes have rounded corners (no sharp corners anywhere).
- Terminal primary colors as the palette (from `colors.json`).
- Background is always `#000000`.
- Shapes are defined by geometry (circles, rounded rectangles, rounded triangles, rounded polygons), not sprites/pixel art.
- Player: circle with minimalist face (dots for eyes, semicircle smile). Face orients left/right.

### 5. Physics System

Default constants (in visual units per second, overridable via JSON):

| Constant           | Value | Unit    |
|--------------------|-------|---------|
| Gravity            | 1     | units/s² |
| Jump velocity      | 1     | units/s |
| Max fall speed     | 3     | units/s |
| Walk speed         | 1     | units/s |
| Walk acceleration  | 1     | units/s² |
| Friction           | 0.75  | (multiplier, 0=instant stop, 1=no friction) |
| Climb speed        | 0.5   | units/s |

- Collision: AABB (Axis-Aligned Bounding Box) — all entities use the same collision type for simplicity.
- Slopes: trigonometry applied to movement on inclines. Player at rest stays at rest (Newton's first law).

### 6. Slope System
Slopes are defined in JSON by **named types**, not numeric indices:
- `"slope-30"` → 30°
- `"slope-45"` → 45°
- `"slope-60"` → 60°
- `"inverted": true` flips the direction.

The engine converts named slopes to angles using `Math` functions at runtime.

### 7. Game Loop

- Frame rate limited to 60 FPS.
- Variable timestep: frame time is measured and used for calculations.
- **Catch-up:** if a frame takes longer than the target, multiple updates run before the next render.
- **Decoupled:** render is separate from update logic.
- Engine lifecycle: `start()`, `stop()`, `pause()`, `resume()`.

## Input System

- Abstract input layer supporting both keyboard and gamepad/joystick.
- Input bindings defined in `data/input/*.json`.
- Supported actions: move left/right, jump, crouch, dash, shoot/shield, air slide, special (screen clear + invincibility activation), pause.
- Pause: P key (keyboard) or Start button (gamepad).

## Audio System

Audio consumption is **name-based** — game objects request audio resources by name, making consumption agnostic to the source type. The engine resolves each audio resource at runtime from the `data/audio/` directory.

### Audio Architecture

| File | Purpose |
|------|---------|
| `data/audio.json` | Top-level engine audio settings: master/BGM/SFX volume, enabled flags, crossfade duration. |
| `data/audio/config.json` | Technical synthesis configuration: wave types (sine, square, sawtooth, triangle), tuning parameters (reference-note A4=440Hz, note-range C1-C6) for equal-temperament frequency calculation via formula `440 × 2^(semitoneOffset / 12)`, polyphony limit, default envelope parameters. Used as the foundation by SFX and BGM definition files. |
| `data/audio/sfx.json` | SFX definitions — each named sound references a wave type and frequency. Synthesized via Web Audio API using parameters from `config.json`. |
| `data/audio/bgm.json` | BGM track definitions — named tracks with note sequences (`[note_name, duration_in_beats]`), tempo (BPM), and wave type. Synthesized via Web Audio API using parameters from `config.json`. |
| `data/audio/*.ogg` | Pre-recorded OGG audio files, referenced by name. Engine falls back to file playback when a named resource matches an `.ogg` file. |

### Features

- BGM: per screen (title, map, stage, stage clear). Loop-capable, crossfade support for transitions.
- SFX: polyphony limit of 24 simultaneous voices (configured in `config.json`).
- Musical notes: 8 per stage, sequential C→C' scale, pitch determined by collection order.
- Volume: master, BGM, and SFX configurable separately. Defaults in `audio.json`; game can override at runtime.

## Canvas & DOM Integration

- Engine queries the canvas via `document.querySelector("#game-canvas")` — error if not found.
- Canvas occupies 90% of the viewport (width and height).
- Body background: `#000000`.
- The HTML file hosting the canvas is external to the engine.

## Data Loading

- JSON files loaded via `fetch()`.
- **Eager loading:** all data loaded at boot time.
- Configurable base path for assets (default: `data/`).
- Malformed JSON causes engine error and abort.
- **JSON Key Validation:** every JSON key under `data/` is validated at load time against the pattern `^[a-z0-9-]+$` (lower-kebab-case only). Any key that does not match causes a validation error and the application will not start/continue. This prevents non-conforming data from ever reaching the engine.
- No runtime cache invalidation.

## Save System

- `localStorage` for game progress.
- Auto-save triggers: stage completion and checkpoint activation.
- Saved data: world progress, fruit collection, lives, continues, current level/color, high score.
- Local leaderboard only.

## Internationalization (i18n)

- Locale files stored in `data/locales/`.
- Default/fallback locale: `en-us`. Missing keys in other locales fall back to `en-us`.
- Selected via `game-config.json` default; game can override at runtime.
- Placeholder support for variable interpolation using `{n}` syntax (e.g., `"You have {n} coins"`). No pluralization required.

## Build & Development

- `bun run dev` — Development server using `Bun.serve()` (static file server, no HMR).
- `bun run build` — Production build using `Bun.build()`, output to `dist/`.
- `bun test` — Run test suite.
- JavaScript (ES modules), no TypeScript compilation needed.

## Git & GitHub

- Private repository: `super-fruit-world`.
- Well-configured `.gitignore` to prevent leaks of sensitive/undesired files.
- Repository will be made public manually in the future — must not contain anything sensitive.
