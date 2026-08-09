# General Planning

## Project Overview

**Super Fruit World** is a HTML5 platformer game featuring a cute, geometric SVG-style aesthetic (even if canvas-rendered). The visual identity is smooth and rounded — sharp corners are forbidden. Everything is rendered with softened, friendly geometry.

## Core Pillars (Non-Negotiable)

### 1. Data-Driven Architecture
The project uses a strict three-layer separation:

| Layer | What it contains |
|-------|-----------------|
| `src/engine/` | Generic HTML5 game engine (loop, render, input, audio, physics, data loading). Knows nothing about platformers or any game. |
| `src/game/` | Generic platformer engine (player, enemies, collectibles, stages, abilities, damage, save, score, progression systems). Knows nothing about fruits, colors, or "Super Fruit World". |
| `data/` | All Super Fruit World identity: fruit names, color palette, stage layouts, ability parameters, text strings, and the chain collectible → level → ability. |

All game data lives in external JSON files organized under the `data/` directory. No game literals (colors, texts, elements, positions, mechanics) may be hardcoded in JavaScript — not in the engine layer, and not in the platformer layer. A different game (e.g., "Space Lizard Adventure") could be built on the same JS code by writing different `data/` files.

### 2. Visual Identity
- **No pixel art.** The game is geometrically styled (SVG-like).
- **Rounded corners everywhere.** Squares, triangles, joints — all must have soft, rounded edges.
- **Terminal primary colors** as the game's color palette.
- Background must be pure black (`#000000`) to provide optimal contrast.
- **Visual units** (floats), not pixels. Game objects only know visual units. 1 unit = 1/10 canvas height by default, overridable in `game-config.json`.

### 3. Object-Oriented Programming
The codebase must be well-structured with OOP principles. The engine and game logic should be cleanly separated, making future extensions (authentication, persistence, APIs) straightforward even though they are not in scope.

## Color/Level Index

The 8 terminal primary colors serve as the power/level index for the player, enemies, and collectibles:

| Index | Color    | Dark      | Light     |
|-------|----------|-----------|-----------|
| 0     | Black    | `#000000` | `#000000` |
| 1     | Red      | `#880000` | `#FF0000` |
| 2     | Green    | `#008800` | `#00FF00` |
| 3     | Yellow   | `#888800` | `#FFFF00` |
| 4     | Blue     | `#000088` | `#0000FF` |
| 5     | Cyan     | `#008888` | `#00FFFF` |
| 6     | Magenta  | `#880088` | `#FF00FF` |
| 7     | White    | `#888888` | `#FFFFFF` |

Each color has a dark variant (8-bit channel) and a light variant (full channel). Black is the only color where dark = light. The hex values exist exclusively in `data/colors.json`. All other JSON files reference colors by name only.

The player starts at index 0 (black) and evolves up to 7 (white). Enemies use the same index to represent how many hits they can take before being defeated.

## Technology Stack

- **Runtime:** Bun (already installed)
- **Platform:** HTML5 (browser-based)
- **Graphics:** Canvas-based rendering with SVG-style aesthetic
- **Language:** JavaScript (ES modules)
- **Version Control:** Git + GitHub (gh CLI authenticated)
- **Repository:** Private `super-fruit-world` on GitHub
- **Dev Server:** `Bun.serve()` (no HMR)
- **Production Build:** `Bun.build()` → `dist/`

## Project Scope

- **In scope:** The game engine and the full platformer game
- **Out of scope:** Authentication, persistence (beyond localStorage), server-side routes, APIs, multiplayer, mobile touch controls
- **Future-proofing:** Architecture should be extensible enough that these could be added later
- **Save system:** localStorage (automatic on stage clear and checkpoint)

## Canvas & Rendering

- Canvas occupies 90% of the browser viewport (both width and height).
- Engine queries canvas via `document.querySelector("#game-canvas")` — error if not found.
- Game loop: limited to 60 FPS with catch-up (multiple updates per frame if behind), render decoupled from update.
- Timestep: variable, not fixed. Frame time is measured and used for calculations.

## Development Philosophy

This is not a prototype or MVP. This is a production-quality project. Doing things correctly, organized, and without redundancy takes priority over speed.

## Key Design Decisions

- Colors, levels, borders, text strings, and all shared concepts have a **single source of truth JSON** — named references only, no raw values duplicated across files.
- JSON keys use **kebab-case** exclusively.
- No numeric IDs in JSON — everything is referenced by name.
- Engine exposes `start()`, `stop()`, `pause()`, `resume()` lifecycle methods.
- All dependencies injected explicitly — no custom global variables.
- Native JavaScript getter/setter properties (`get position()` / `set position(value)`) over explicit getter/setter methods.
