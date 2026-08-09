# Requirements Checklist

## Infrastructure

- [ ] Initialize project with Bun (`bun init`)
- [ ] Configure `.gitignore` (no secrets, no build artifacts, no node_modules)
- [ ] Create private GitHub repository `super-fruit-world`
- [ ] Set up project directory structure
- [ ] Create `README.md` with project overview and setup instructions

## Engine Core (`src/engine/`)

- [ ] Game loop (variable timestep with catch-up, render decoupled from update, 60 FPS limit)
- [ ] Engine lifecycle: `start()`, `stop()`, `pause()`, `resume()`
- [ ] Scene/state management system
- [ ] Canvas renderer with visual-unit scaling (default 1 unit = 1/10 canvas height)
  - [ ] Canvas query via `#game-canvas` selector (error if not found)
  - [ ] Canvas at 90% viewport width and height
  - [ ] Body background `#000000`
- [ ] Rounded-corner geometry primitives (circle, rounded rect, rounded triangle, rounded polygon)
- [ ] Abstract input system (keyboard + gamepad via Gamepad API)
- [ ] Physics system:
  - [ ] Gravity (default 1 units/s²)
  - [ ] Jump velocity (default 1 units/s)
  - [ ] Max fall speed (default 3 units/s)
  - [ ] Walk speed (default 1 units/s)
  - [ ] Walk acceleration (default 1 units/s²)
  - [ ] Friction (from JSON)
  - [ ] AABB collision detection
  - [ ] Slope physics (trigonometry on movement)
- [ ] Audio engine:
  - [ ] File playback (`.ogg` from `data/audio/`)
  - [ ] Web Audio API synthesis (oscillators)
  - [ ] Volume control: master, BGM, SFX (separate channels)
  - [ ] BGM loop and crossfade support
- [ ] JSON data loader:
  - [ ] `fetch()`-based, eager at boot
  - [ ] Configurable base path
  - [ ] Validate and abort on malformed JSON
- [ ] i18n system: locale loading via `data/i18n/default.json` symlink, key lookup, placeholder interpolation (no fallback locale)
- [ ] Entity base class (position, size, velocity, render interface)
- [ ] Stage base class (tile grid, entity management, scroll bounds)
- [ ] UI base components (classes for HUD elements, menus)
- [ ] Save/load abstraction (localStorage wrapper)

## Game Systems (`src/game/`)

- [ ] Player entity (extends/composes engine entity):
  - [ ] Visual: circle with face (eyes + semicircle smile), left/right orientation
   - [ ] Movement: walk, jump, crouch, climb ladders
   - [ ] Slope sliding (crouch on angled surface → slide with gravity)
   - [ ] Ladder climbing (overlap ladder tile → press up to climb, down to descend, jump to dismount, gravity suspended)
  - [ ] Jump attack on enemies (1 damage)
  - [ ] Slide attack into enemies (2 damage)
  - [ ] Dash (Red+): hold button → 2x speed
  - [ ] Shoot (Green+): projectile (quarter player size), 2 shots/s, speed 1.0→3.0 units/s by level
  - [ ] Shield (Green+): hold shoot button, blocks 90% damage (not falls/pits)
  - [ ] Flight (Yellow+): after 1s dash, hold jump → fly 2s (horizontal analog control)
  - [ ] Slow Fall (Yellow+): hold jump during descent → 1 unit/s fall
  - [ ] Double Jump (Blue+): second jump in mid-air
  - [ ] Air Slide (Cyan+): 5x player distance at 2x speed, 1 damage; ground version 2x distance
  - [ ] Screen Clear (Magenta+): once per stage, 4 damage to visible enemies, destroys projectiles, white flash 1s fade. Activate via down+shoot+air-slide held 1s.
  - [ ] Invincibility (White): 60s, activate via up+shoot+air-slide held 1s, once per stage
  - [ ] i-frames: 1 second after taking damage (50% opacity, fading to normal)
  - [ ] Life bar (0–10 float), integral lives (start 5, no limit)
  - [ ] Damage animation: sad face 1s + 50% opacity i-frames
- [ ] Enemy entities:
  - [ ] Polygon shapes: triangle (3), square (4), pentagon (5), hexagon (6), heptagon (7) — all rounded
  - [ ] Shape-based damage output (triangle=1, square=1.5, pentagon=2, hexagon=2.5, heptagon=3)
  - [ ] Color-indexed HP: decrement 1 per hit, defeated at black (falls off screen)
  - [ ] Damage types received: jump on top=1, slide=2, shoot=1, air slide=1, screen clear=4
  - [ ] Behavior: walk patrol, reverse at edges (no falling into pits)
  - [ ] Shooter variants: fire projectiles (1 shot/s) when player on screen
  - [ ] Flyer variants: drop objects from above
  - [ ] Drops: coin (common), apple (1/5), heart (1/10), extra life (1/20)
  - [ ] Enemy level capped to big-fruit level
- [ ] Collectible entities (all static, no physics):
  - [ ] Coin: min 120/stage, positional + grouped placement support. 100 coins = 1 extra life (resets to 0).
  - [ ] Apple (ammo): max 1000 capacity
  - [ ] Heart: goes to inventory (accumulates). Player uses it on demand to fully restore life bar.
  - [ ] Moon: goes to inventory (accumulates). When used, activates moon gravity (reduced gravity) for 30 seconds.
  - [ ] Sun: goes to inventory (accumulates). When used, player catches fire for 30s and takes no damage (does not kill enemies on contact).
  - [ ] Earth: goes to inventory (accumulates). When used, triggers earthquake dealing 3 damage to all ground enemies on screen.
- [ ] Inventory system:
  - [ ] Backpack UI opened via select button (joystick) / configurable keyboard key
  - [ ] Displays accumulated inventory items with quantities
  - [ ] Player can navigate and choose which item to use
  - [ ] Default selected mechanic: one item slot can be marked as default for quick use
  - [ ] Quick-use shortcut: select + shoot uses the default selected item immediately
  - [ ] Inventory state persists per stage
  - [ ] Star: pickup-activated 30s invincibility (stacks with White invincibility)
  - [ ] Musical Notes: 8 per stage, positional, sequential scale (C→C'), all 8 = 1 continue
  - [ ] Mini Ball: extra life
  - [ ] Small Fruit (`small-fruit`): accumulates score + stored for future trade currency. No limit.
  - [ ] Checkpoint: max 2 per stage, respawn point only (no state save)
  - [ ] Key: goes to inventory, persists within stage. Unlocks matching key-door by key-name.
  - [ ] Key Door (`key-door`): extends `special-teleporter`. Teleports player if matching key is in inventory. Consumes key.
  - [ ] Exit Door (`exit-door`): completes the stage on collection.
- [ ] Big Fruit (`big-fruit`, level-up collectible):
  - [ ] Large (2x player), shiny/glowing
  - [ ] Evolves player to corresponding color level
  - [ ] If already at that level: grants extra life instead
  - [ ] 7 fruits: Strawberry→Red, Avocado→Green, Banana→Yellow, Blueberry→Blue, Starfruit→Cyan, Pitaya→Magenta, Fruit Basket→White
- [ ] Score system:
  - [ ] Increments from: enemies killed, stage completion, items collected
  - [ ] Small fruits accumulate for score + future trade currency
- [ ] Section system:
  - [ ] Hierarchical spatial containers for stages and world maps
  - [ ] Objects positioned relative to their section origin
  - [ ] Sections positioned relative to their parent section (referenced by name)
  - [ ] Top-level parent reference: `"root"`
  - [ ] No depth limit on section nesting
  - [ ] Engine recursively resolves all relative offsets into final world positions
- [ ] Stage system:
  - [ ] Multi-screen scrolling (all directions: horizontal + vertical)
  - [ ] Tile definitions from JSON (kebab-case named types)
  - [ ] Slopes: named types (`slope-30`, `slope-45`, `slope-60`) with `inverted` boolean
   - [ ] Tile types: platform, wall, slope, decorative background, spike/danger/lava, water, ladder
  - [ ] Out-of-bounds (abyss) = death
  - [ ] Minimum per stage: 120 coins, 120 apples, 2 checkpoints
  - [ ] Stage types: horizontal, vertical, underground, aquatic, altitude
- [ ] World map:
  - [ ] Data structure: world → area → stage, with named exits and teleporters (see `game-design.md#teleporter-system`)
  - [ ] Sections for spatial organization within the map (see `game-design.md#section-system`)
  - [ ] Branching paths supported from day 1 (even if initial stages are linear)
  - [ ] Visual map with stage nodes and paths
  - [ ] Future: secret exits (keys), multiple worlds
- [ ] HUD:
  - [ ] Life bar (0–10 float, red bar)
  - [ ] Level/color indicator
  - [ ] Score counter
  - [ ] Coin counter (100 coins = 1 extra life)
  - [ ] Ammo counter
  - [ ] Star count
  - [ ] Musical note collection progress (8 slots)
  - [ ] Inventory indicator (shows available items count, default selected item)
  - [ ] Inventory backpack screen (full overlay, navigable with items + quantities)
- [ ] Menus:
  - [ ] Title screen: Start, Tutorial, Settings, Credits
  - [ ] World map (stage selection)
  - [ ] Pause menu: Resume, Restart Stage, Quit to Map, Quit to Menu
  - [ ] Settings: music volume, SFX volume, controls
  - [ ] Game over screen: Continue (if available), Quit
  - [ ] Stage clear screen

## Data (`data/`)

- [x] `game-config.json` — Global settings (visual unit scale, audio defaults, damage, paths)
- [x] `colors.json` — Color palette hex values (8 colors, dark + light variants)
- [x] `borders.json` — Border styles (thin, medium, thick) in visual units
- [x] `player/levels.json` — Color to abilities mapping (nominal, kebab-case, incremental per level)
- [x] `player/fruits.json` — Fruit to level mapping (nominal, kebab-case)
- [x] `enemies/*.json` — Enemy type definitions (shapes, behaviors, drop tables)
- [x] `collectibles/*.json` — Collectible definitions (effects, values, limits) — 15 files: coin, apple, heart, star, musical-note, mini-ball, small-fruit, big-fruit, checkpoint, key, key-door, exit-door, moon, sun, earth
- [x] `stages/*.json` — Stage layout (tiles, entities, spawns, checkpoints, slope data). Prototype: strawberry-fields.json with 13 sections using the section system.
- [x] `tiles/*.json` — Tile definitions (collision, damage, physics modifiers) — 8 files: platform, wall, slope, decorative, spike (spike/danger/lava variants), water, ladder, pit
- [x] `ui/*.json` — UI layout and styling (HUD, menus, inventory backpack)
- [x] `audio/config.json` — Top-level audio settings (volumes, enabled flags, crossfade)
- [x] `audio/synthesis.json` — Technical synthesis configuration (wave types, tuning, temperament, polyphony)
- [x] `audio/sfx.json` — SFX definitions (named sounds, wave types, frequencies, envelopes)
- [x] `audio/bgm.json` — BGM track registry (named tracks → track files)
- [x] `map/*.json` — World map structure (worlds, areas, stages, exits, map-teleporters — see `game-design.md#teleporter-system`). Prototype: fruit-world.json with 4 continents, 8 stage nodes, branching.
- [x] `input/*.json` — Key and gamepad bindings
- [x] `i18n/default.json` — Symlink to the active locale file (e.g. `en-us.json`). English (US) text strings.
- [x] `index.json` — Generated (never hand-maintained) list of all `data/` JSON files, consumed by `DataDriven` for dynamic discovery
- [ ] All JSON keys in kebab-case

## Visual Requirements

- [ ] All shapes rendered with rounded corners (no sharp edges)
- [ ] No pixel art anywhere (geometric rendering only)
- [ ] Terminal primary color palette used throughout (from `colors.json`)
- [ ] Background is `#000000` (pure black)
- [ ] Player: circle with minimalist face (eyes + smile), direction-facing
- [ ] Player damage: sad face 1s + 50% opacity fade
- [ ] Screen Clear: full-screen white flash 1s fade
- [ ] Big fruits: 2x player size, shiny/glowing
- [ ] Clear visual feedback for: hit, collect, level-up, checkpoint, death

## Audio Requirements

- [ ] Sound effects for: jump, attack, hit, collect, level-up, checkpoint, death, coin, star, stage-clear
- [ ] Musical notes play corresponding pitch on collection (C→C' scale)
- [ ] Positive feedback sounds for fruit collection
- [ ] BGM per screen: title, world map, stage, stage clear
- [ ] Master, BGM, and SFX volume controls
- [ ] Synthesized placeholder audio via Web Audio API (oscillators), defined in `data/audio/sfx.json` and `data/audio/bgm.json`
- [ ] Polyphony limit: 24 simultaneous voices

## Quality

- [ ] No game literals hardcoded in engine JavaScript code
- [ ] Clean engine/game separation with DI
- [ ] Modern browser compatibility
- [ ] Smooth 60 FPS performance
- [ ] All rules in `compliance-rules.md` satisfied

## Future (Out of Scope for Initial Release)

- Authentication system
- Server-side persistence / online save
- Online leaderboards
- Multiplayer
- Level editor
- Mobile touch controls
