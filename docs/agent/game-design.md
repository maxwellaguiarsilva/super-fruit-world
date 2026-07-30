# Game Design Document

## Core Concept

A HTML5 platformer with geometric "cute" visuals. The protagonist evolves through 8 color levels (terminal primary colors), gaining new abilities with each evolution. Progression is gated by fruit collection at the end of each stage.

### Story
"Ball" is a hero who must save the Fruit World from geometric shape invaders. A simple intro cutscene/dialogue at the start of the game communicates this premise.

## Player

### Visual Definition
The player character is a **circle with a minimalist face**: two dot eyes and an unfilled semicircle smile. The face indicates direction (left or right). No squash/stretch — the player is visually static except for:
- **Face direction:** eyes and smile orient left or right based on movement direction.
- **Damage animation:** face becomes sad for 1 second, with 50% opacity fading back to normal (standard platformer i-frames to prevent double hits).

### Size & Units
The game uses **visual units** (floats), not pixels. Game objects only know visual units. The engine determines pixel size based on canvas dimensions.

- **Default:** 1 visual unit = 1/10 of the canvas height.
- **Configurable:** `game-config.json` can override this in % or pixel terms.
- **Player size:** 1 visual unit in diameter.

### Level, Color & Abilities

The player's color and level are **the same property** — referenced nominally (e.g. `"red"`), never by numeric index. Level progression happens by collecting the big fruit. The player cannot regress in level.

| Level | Color    | Fruit (big-fruit)  | Abilities Unlocked |
|-------|----------|--------------------|--------------------|
| 0     | Black    | — (starting)       | Walk, jump, crouch (slide on slopes), climb ladders. Attacks: jump on top of enemies, slide into enemies. |
| 1     | Red      | Strawberry         | All previous + **Dash**: hold dash button for fast run (up to 2x speed). |
| 2     | Green    | Avocado            | All previous + **Shoot**: fire projectiles at enemies. Hold shoot button for **Shield** (blocks 90% damage, does not block falls/pits). |
| 3     | Yellow   | Banana             | All previous + **Flight**: after 1 second of dash running, hold jump to fly for 2 seconds. Hold jump for **Slow Fall** (parachute-like descent at 1 unit/s). |
| 4     | Blue     | Blueberry          | All previous + **Double Jump**: allows a second jump in mid-air. |
| 5     | Cyan     | Starfruit (Carambola) | All previous + **Air Slide**: perform a slide in mid-air that serves as an aerial attack. |
| 6     | Magenta  | Pitaya (Dragon Fruit) | All previous + **Screen Clear**: once per stage, deals 4 damage to all visible enemies and destroys all enemy projectiles. White flash with 1-second fade. |
| 7     | White    | Fruit Basket       | All previous + **Invincibility**: once per stage, become invincible for 60 seconds. Activated by holding up + shoot + air slide simultaneously for 1 second. |

If the player already has the level a fruit would grant, they gain an extra life instead (with the same visual/audio feedback). No downgrade is possible.

### Health & Life System

- **Life bar:** 0 to 10 (float), displayed as a red bar.
- **Integral lives:** Start with 5. No upper limit. Decrease by 1 on death.
- **Death:** Respawn at last checkpoint or stage start. Lose 1 integral life.
- **Zero lives:** Use a continue or game over.
- **Continues:** Start with 1. Earned by collecting all 8 musical notes in a stage. No upper limit. Using a continue respawns at stage start with 5 lives.
- **i-frames:** 1 second of invulnerability after taking damage (50% opacity, fading back to normal).
- **Game over:** All progress resets.

### Movement & Controls

- Keyboard and joystick compatible.
- All key bindings configurable via JSON.
- Pause: P key (keyboard) or Start button (joystick).
- Inventory: Select button (joystick) or configurable keyboard key. Opens the player's inventory backpack.
- Quick-use default inventory item: select + shoot (hold select, press shoot).

## Abilities — Detailed Parameters

### Dash
- Activated by holding the dash button.
- Player runs at 2x nominal speed while held.
- Not an attack — purely movement.

### Shoot
- Projectile: circle, radius = 1/4 player size.
- Speed: 1.0 visual units/s, increasing progressively with each level up to 3.0/s.
- Fire rate: 2 shots/s (player), 1 shot/s (enemies).
- Destroyed on contact with anything (walls, enemies, etc.).
- Objects exist up to one screen beyond the visible area in all directions.

### Shield
- Activated by holding the shoot button.
- Remains active while button is held.
- Blocks 90% of incoming damage.
- Does not block fall/pit damage.

### Flight
- Requires 1 second of dash running on ground first.
- Then hold jump to fly upward for 2 seconds.
- Horizontal direction controlled by analog stick/keys during flight.
- Interrupted by taking damage.
- Resets (requires 1s dash again) upon touching the ground.

### Slow Fall
- Available after collecting the Banana.
- Hold jump during descent to fall at 1 visual unit/s.

### Double Jump
- Available after collecting the Blueberry.
- Allows a second jump while in mid-air.

### Air Slide
- Available after collecting the Starfruit.
- Mid-air: travels 5x player size at 2x nominal speed. Deals 1 damage to enemies hit.
- Ground: travels 2x player size (shorter version).
- Cooldown: must touch ground + 0.5 seconds before reuse.

### Screen Clear
- Available after collecting the Pitaya.
- Once per stage.
- Activated by holding **down + shoot + air-slide** simultaneously for 1 second.
- Deals 4 damage to all enemies visible on screen.
- Destroys all enemy projectiles on screen.
- Visual: full-screen white flash with 1-second fade.

### Invincibility
- Available after collecting the Fruit Basket.
- Once per stage (resets on death or entering new stage).
- Duration: 60 seconds.
- Activation: hold up + shoot + air slide simultaneously for 1 second.

### Star Invincibility (Collectible)
- 30 seconds of invincibility.
- Activated automatically on pickup (not on demand).
- Stacks with White-level Invincibility (60 + 30 = 90s total).

### Crouch & Slope Sliding
- Holding crouch on an inclined surface makes the player slide down following gravity.
- If an enemy is in the path during the slide, it takes damage.
- Friction factor: 0.75 (multiplier per frame, 1.0 = no friction, 0.0 = instant stop). Defined in JSON, equally valid for running upright.

### Ladder Climbing
- When the player overlaps a ladder tile, pressing up moves the player upward along the ladder at `climb-speed` (default 0.5 visual units/s).
- Pressing down moves the player downward at the same speed.
- Gravity is suspended while the player is on a ladder.
- The player can jump off the ladder at any time, regaining normal physics.
- Horizontal movement is allowed while climbing — the player can move left/right to dismount from the ladder.
- Enemies do not use ladders.

## Enemies

### Visual Design
- **Shapes:** Polygons — triangle (3 sides), square (4), pentagon (5), hexagon (6), heptagon (7).
- **Corners:** All rounded — no sharp edges.

### Color = HP
An enemy's color indicates how many hits it can take:
- Each hit decrements the enemy's color down one index.
- When an enemy reaches black (index 0), it is defeated (falls off screen).
- Red enemy: 1 hit to defeat, white enemy: 7 hits to defeat.

### Damage to Player
Enemy damage is **shape-based**, not color-based:

| Shape     | Sides | Damage |
|-----------|-------|--------|
| Triangle  | 3     | 1.0    |
| Square    | 4     | 1.5    |
| Pentagon  | 5     | 2.0    |
| Hexagon   | 6     | 2.5    |
| Heptagon  | 7     | 3.0    |

Damage is by contact or being hit by an enemy projectile. Player gets 1 second i-frames after taking damage.

### Damage Player Deals to Enemies

| Action          | Damage |
|-----------------|--------|
| Jump on top     | 1      |
| Slide into      | 2      |
| Shoot           | 1      |
| Air slide       | 1      |
| Screen clear    | 4      |

Dash is movement-only, not an attack.

### Behavior
- Simple patrol algorithm: walk back and forth, do not fall into pits (reverse direction at edges).
- Enemy variants that shoot projectiles when the player is on screen (1 shot/s).
- Enemy variants that fly and drop objects from above.
- Stronger enemy shapes (pentagon+) reserved for later stages.
- Enemies cannot exceed the level of the stage's end fruit (e.g., Strawberry stage = red enemies only; Avocado stage = red or green enemies).

### Bosses

Bosses are enemies marked with `"is-boss": true` in stage data. They are functionally the same enemy type but visually **larger**:

- **Normal enemy size:** 1 visual unit (same as the player).
- **Boss size:** 3 visual units (3× the normal enemy/player size).

All other mechanics (color = HP, shape-based damage, behavior patterns) remain unchanged. The boss is simply a scaled-up version of the same enemy type, placed inside a dedicated `"boss-arena"` section.

### Drops (on defeat)
| Drop     | Chance  |
|----------|---------|
| Coin     | Common  |
| Apple    | 1 in 5  |
| Heart    | 1 in 10 |
| Extra life | 1 in 20 |

All drop rates defined in JSON.

## Collectibles

| Item           | Description                                      | Effect                                                      |
|----------------|--------------------------------------------------|-------------------------------------------------------------|
| Coin           | Standard currency                                | Positional. Minimum 120 per stage. 100 coins = 1 extra life (coin counter resets to 0). Group placement supported in JSON. |
| Apple          | Ammunition for shooting                         | Each apple = 1 ammo. Max capacity: 1000. No effect when full. |
| Heart          | Inventory item (accumulates)                    | On pickup, goes to inventory instead of restoring health immediately. The player can choose when to use it to fully restore their life bar. |
| Star           | Invincibility item                               | 30 seconds of invincibility. Activated on pickup (automatic). Stacks with White-level invincibility. |
| Moon           | Inventory item (accumulates)                    | When used from inventory, activates moon gravity for 30 seconds, reducing the player's weight (lower gravity). |
| Sun            | Inventory item (accumulates)                    | When used from inventory, the player catches fire for 30 seconds and takes no damage. Unlike invincibility, touching enemies does NOT kill them — the player is simply immune to damage. |
| Earth          | Inventory item (accumulates)                    | When used from inventory, triggers an earthquake that deals 3 damage to all ground enemies on screen. |
| Musical Notes  | 8 positional notes per stage (C→C' scale)       | First collected = C, second = D, ... eighth = high C. Collecting all 8 = 1 continue. |
| Mini Ball      | Half-size player ball with shine aura           | Extra life.                                                  |
| Small Fruit    | Regular fruit collectible (`small-fruit`)        | Accumulates without limit. Increments score. Stored for future trade currency use. |
| Checkpoint     | Stage progress marker                            | Max 2 per stage. Respawn here on death. Does not save full state — only prevents restarting from the beginning. |
| Big Fruit      | Large (2x player), shiny, glowing fruit (`big-fruit`) | Evolves player to the corresponding color level. If already at that level, grants extra life. |
| Key            | Inventory item stored on pickup (`key`)               | Goes to player inventory. Used to unlock a matching key-door elsewhere in the stage. Each key has a `key-name` that a key-door references nominally. Persists only within the current stage. |
| Key Door       | Gated door (`key-door`). Extends `special-teleporter` — inherits teleport behavior, adds key-gating. | Requires a key whose `key-name` matches its `required-key`. Consumes the key and teleports the player on activation. |
| Exit Door      | Stage exit (`exit-door`)                               | Completes the current stage immediately on collection. |

All collectibles are static objects (no gravity/physics applied to them).

### Key & Key-Door System

Keys and key-doors allow gated progression. The system uses **named references** — a key has a `key-name`, and a key-door has a `required-key` that must match for it to activate.

- A **key** is picked up and stored in the player's inventory. It persists only within the current stage.
- A **key-door** extends `special-teleporter` — it inherits all teleporter behavior (targets another stage or world-map location by named marker) and adds the key-gating mechanic. When activated with the matching key, the key is consumed and the player is teleported.
- Multiple distinct keys and doors can exist in the same stage, each paired by name.
- The exit-door is the standard stage completion collectible — collecting it finishes the stage.

## Inventory System

The inventory is the player's "backpack," accessed by pressing the **select** button on the joystick (or the equivalent keyboard key). It stores certain collectibles that the player can choose to use at a strategic moment, rather than having their effect applied immediately on pickup.

### Inventory Items

The following collectibles go to the inventory on pickup and can be used later at the player's discretion:

| Item   | Effect on Use                                                        |
|--------|----------------------------------------------------------------------|
| Heart  | Fully restores the life bar.                                        |
| Moon   | Activates moon gravity (reduced gravity) for 30 seconds.            |
| Sun    | Activates fire shield for 30 seconds — player takes no damage, but does not kill enemies on contact (unlike invincibility). |
| Earth  | Triggers an earthquake dealing 3 damage to all ground enemies on screen. |

All four items **accumulate** in quantity — picking up multiple of the same type increases the available count.

### Default Selected Mechanic

One item slot in the inventory can be designated as the **default selected**. This allows the player to quickly use that item without opening the full inventory screen. The shortcut for using the default selected item is **select + shoot** (hold the select button and press the shoot button). This is designed for fast-paced gameplay where opening the full inventory would interrupt the action.

### Inventory Configuration

The inventory system is configured in `data/game-config.json` under the `inventory` key:
- `open-button`: The button that opens/closes the inventory screen (default: `"select"`)
- `use-shortcut`: The button combination for using the default selected item (default: `"select+shoot"`)
- `default-selected`: The currently selected default item (null = none selected)
- `max-slots`: Maximum number of inventory slots (default: 8)

## Big Fruits (Level-Up Items)

- Fruits that evolve the player are large (2x player size), shiny, and glow prominently.
- They appear at the end of each stage as a reward.
- They are a separate collectible type (`big-fruit`), distinct from regular small fruits (`small-fruit`), identified by type name in the stage JSON — no boolean flag needed.
- There is no fruit for level 0 (black) — the player starts there. The first stage's reward is the Strawberry.

## Score System

- Score increments from: enemies killed, stage completion, items collected.
- Small fruits accumulate without limit, contributing to score and stored for future trade currency use.
- Coins are separate: 100 coins = 1 extra life, then counter resets to 0.

## Stage Progression

- Stages are accessed through a **world map** that unlocks paths.
- Structure: **world → area → stage**, with named exits and teleporters between stages (see [Teleporter System](#teleporter-system)).
- Branching paths supported from day 1 (initial stages are linear but format allows branching).
- Stage types:
  - Horizontal scrolling stages
  - Vertical stages
  - Underground stages
  - Aquatic stage (only one planned)
  - Altitude/high-elevation stages
- Stages are larger than the screen — scroll is allowed in all directions.
- Out-of-bounds (falling off the stage) = death.
- Each stage must contain at least: 120 coins, 120 apples, 2 checkpoints.

### Slope System
Slopes are defined by **named types** in JSON (not numeric indices):
- `"slope-30"`, `"slope-45"`, `"slope-60"` (30°, 45°, 60°)
- `"inverted": true` flips the slope direction.
- The engine converts named slopes to angles using trigonometry at runtime.

### Tile Types
All tile/object types are identified by **kebab-case string names** in JSON — numeric IDs are forbidden. Types include:
- Platform (solid, collides)
- Wall (solid, collides)
- Slope (angled collision)
- Decorative background (no collision)
- Spike/Danger/Lava (damage on contact)
- Water (modifies physics)
- Ladder (climbable, disables gravity while overlapped, press up to climb, down to descend, jump to dismount)
- Pit (falling out of bounds = death)

## World Map

- Visual style: world map with paths connecting stages (nodes).
- Data structure: world → area → stage, with named exits and teleporters (see [Teleporter System](#teleporter-system)).
- Initially linear: stages must be completed in order.
- Branching paths supported from day 1 for future expansion.
- Map data stored as JSON arrays with named stages and named exits.

## Section System

Stages and maps grow complex as objects are added. Inserting content mid-stage would require recalculating every subsequent object's position — a maintenance nightmare. The **section** system solves this with hierarchical spatial containers and relative positioning.

### Concept

A section is a named spatial container that groups game objects. Objects inside a section define their position **relative to the section's origin**. The section itself defines its position **relative to its parent section's origin**. The game engine resolves all relative offsets into final visual-unit positions at runtime.

```
Level origin (0,0)
  └── section "intro-area"       (x: 0, y: 0, parent: "root")
  │       ├── platform A         (x: 2,  y: 0)   → final: (2, 0)
  │       ├── enemy B            (x: 5,  y: 0)   → final: (5, 0)
  │       └── section "pit"      (x: 10, y: 0, parent: "intro-area")
  │               ├── spike C    (x: 0,  y: 1)   → final: (10, 1)
  │               └── coin D     (x: 2,  y: 0)   → final: (12, 0)
  └── section "exit-plateau"     (x: 30, y: 0, parent: "root")
          ├── platform E         (x: 0,  y: 0)   → final: (30, 0)
          └── exit-door F        (x: 5,  y: 0)   → final: (35, 0)
```

Inserting a new section between "intro-area" and "exit-plateau" only requires adjusting one number — the exiting section's x offset. Every object inside it stays unchanged.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Unique identifier within the parent scope. Used by other sections as their `parent-section` reference. |
| `parent-section` | string | Named reference to the parent section. Top-level sections use `"root"`. |
| `position` | object | `{ "x": float, "y": float }` — origin offset relative to the parent section. |

### Rules

- Sections can be nested to any depth — no limit on the hierarchy tree.
- A section's own position is always relative to its `parent-section` origin.
- Objects placed directly in a section use that section's origin as their coordinate frame.
- The game engine recursively walks the tree to compute each object's final world position.
- Applies to both stage layouts (`data/stages/*.json`) and world maps (`data/map/*.json`).
- A section with no children (empty leaf) is valid — it serves as a future anchor point.

### JSON Example

```json
{
  "sections": [
    {
      "name": "intro-valley",
      "parent-section": "root",
      "position": { "x": 0, "y": 0 },
      "objects": [
        { "type": "platform",  "position": { "x": 2,  "y": 0 } },
        { "type": "coin",      "position": { "x": 3,  "y": 1 } }
      ]
    },
    {
      "name": "hidden-cave",
      "parent-section": "intro-valley",
      "position": { "x": 5, "y": -3 },
      "objects": [
        { "type": "spike",     "position": { "x": 0,  "y": 1 } },
        { "type": "heart",     "position": { "x": 2,  "y": 0 } }
      ]
    },
    {
      "name": "boss-arena",
      "parent-section": "root",
      "position": { "x": 40, "y": 0 },
      "objects": [
        { "type": "wall",      "position": { "x": 0,  "y": 0 } }
      ]
    }
  ]
}
```

## Teleporter System

Teleporters allow the player to instantly travel between locations. The system has three fundamental concepts:

### Teleporter-Marker (Base)

A `teleporter-marker` is a **named destination point**. It defines a position that can be referenced by name. Teleporter markers are **one-way only** — they mark where to arrive, not where to depart from. The `inner-teleporter`, `map-teleporter`, and `special-teleporter` go to a destination but do not provide a return path.

### Teleporter Types (Inherit from Teleporter-Marker)

All teleporter types inherit from `teleporter-marker`, meaning every teleporter IS a marker (it can serve as a destination for other teleporters), but also ADDS the ability to reference another marker as its target.

| Type | Scope | Target |
|------|-------|--------|
| `inner-teleporter` | Within a stage | Another point in the **same stage** |
| `map-teleporter` | Within the world map | Another point on the **same map** |
| `special-teleporter` | Within a stage | A point in **another stage** OR a point on the **world map** |
| `key-door` | Within a stage | Inherits from `special-teleporter` — same target scope, but gated by a matching key |

### How It Works

1. Every teleporter-marker has a **unique name** within its scope (stage or map).
2. A teleporter (`inner-teleporter`, `map-teleporter`, `special-teleporter`, `key-door`) references a target marker by name.
3. When the player activates a teleporter, they are moved to the position of the referenced marker.
4. The teleporter does NOT provide a way back — this is not a bidirectional warp. To return, another teleporter must be placed at the destination referencing the origin.

### Creating Loops (Optional Double-Way Behavior)

To simulate a two-way (double-way) teleporter, place two teleporters:
- Teleporter A at position X → targets marker B at position Y
- Teleporter B at position Y → targets marker A at position X

This creates a bidirectional loop, allowing the player to freely travel back and forth between the two points.

### Data Structure

Teleporter-marker and teleporter data is stored in JSON:
- Stage teleporters (`inner-teleporter`, `special-teleporter`) are defined in `data/stages/*.json`.
- Map teleporters (`map-teleporter`) are defined in `data/map/*.json`.

## Visual & Audio Feedback

- Fruit collection: prominent visual and sound effects.
- Player color change on level-up must be visually clear.
- Enemy color decrement on hit must be visually clear.
- Checkpoint activation must be noticeable.
- Screen Clear: full-screen white flash with 1-second fade.
- Player damage: 1-second sad face with 50% opacity fading back.

## Audio

- Audio consumption is **name-based** — game objects request audio by name, making consumption agnostic to source type (synthesized or file-based).
- The engine resolves named audio resources from the `data/audio/` directory at runtime.
- Synthesized audio: SFX and BGM definitions in `data/audio/sfx.json` and `data/audio/bgm.json`, built on technical config from `data/audio/config.json` (wave types, tuning parameters, temperament).
- File-based audio: pre-recorded `.ogg` files placed in `data/audio/`, referenced by name.
- Top-level settings (volumes, enabled flags, crossfade) in `data/audio.json`.
- BGM (background music): per screen (title, world map, stage, stage clear). Loop-capable, with crossfade support.
- SFX: polyphony limit of 24 simultaneous voices.
- Musical notes: 8 per stage, pitch determined by collection order (C→C' scale).
- Volume: master, BGM, and SFX configurable separately. Defaults in `audio.json`; game can override at runtime.

## Save System

- Automatic save to `localStorage` on stage completion and checkpoint activation.
- Saves: world progress, lives, continues, current level/color.
- Local leaderboard (high score).
- No online features.

## Title Screen & Tutorial

- Title screen with options: Start, Tutorial, Settings, Credits.
- Tutorial is optional — player can jump straight into the game.
- Tutorial content TBD (engine supports cutscene/dialogue system, not used initially).
