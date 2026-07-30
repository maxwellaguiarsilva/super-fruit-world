# Super Fruit World

HTML5 geometric platformer. Cute, rounded, terminal-colored. Data-driven engine.

## Setup

```bash
bun install
```

## Run

```bash
bun run dev
```

## Project Structure

- `src/engine/` — Agnostic HTML5 game engine (loop, render, input, audio, physics, data loading)
- `src/game/` — Generic platformer engine (player, enemies, collectibles, stages, abilities, progression). Knows nothing about fruits, colors, or "Super Fruit World".
- `data/` — All Super Fruit World identity as JSON: colors, fruits, stage layouts, ability parameters, text strings, the mapping between collectibles → levels → abilities, etc.
- `docs/agent/` — Planning, architecture, compliance rules
