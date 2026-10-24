# Game Layer

Subject: the domain objects at `src/game/` — what a stage is, how it advances, which entity kinds exist, how they interact, and how the scenes present them. Data shapes that feed these objects are documented in [../data-model.md](../data-model.md); the player-facing result is documented in [../gameplay.md](../gameplay.md).

## Object model

| Class | File | Role |
| --- | --- | --- |
| `Entity` | `src/engine/entities/entity.js` | Base for everything with a position, size and velocity. |
| `Section` | `src/engine/entities/section.js` | Named area with a parent, children and world-position resolution. |
| `StageBase` | `src/engine/entities/stage-base.js` | Section tree, entity collection, dimensions and bounds. |
| `Stage` | `src/game/stages/stage.js` | Playable stage: per-type views, simulation pipeline, checkpoints, teleporters, completion. |
| `Checkpoint` | `src/game/stages/stage.js` | Respawn marker created from stage data. |
| `Tile` | `src/game/entities/tile.js` | Static collision, hazard, liquid, climbable or slope cell. |
| `Enemy` | `src/game/entities/enemy.js` | Base enemy: shape, palette, damage output, drops, damage intake. |
| `PatrolEnemy`, `ShooterEnemy`, `FlyerEnemy`, `BossEnemy` | `src/game/entities/enemy-types.js` | Enemy behaviors. |
| `Collectible` | `src/game/entities/collectible.js` | Pickup with an effect action. |
| `Projectile` | `src/game/entities/projectile.js` | Moving shot with a travel limit and impact rules. |
| `Player` | `src/game/entities/player.js` | Player entity with level, color, abilities, inventory, health and temporary states. |
| `TeleporterMarker`, `InnerTeleporter`, `MapTeleporter`, `SpecialTeleporter`, `KeyDoor` | `src/game/stages/teleporters.js` | Teleporter family. |
| `MapStage` | `src/game/map/map-stage.js` | World map with nodes, paths, labels and a cursor. |
| `TitleScene`, `SettingsScene`, `InfoScene`, `StageScene`, `MapScene` | `src/game/scenes/scenes.js` | Scenes the game loop updates. |
| `HUD`, `Menu` and subclasses, `InfoScreen`, `InventoryUI` | `src/game/ui/ui-components.js` | Screen-space UI. |

## Stage base and bounds

- The constructor takes stage data with `name` and optional `sections`.
- Sections are constructed first, then linked to parents whose names exist; a parent named `root` or an unknown parent produces no link.
- Dimensions are the union of every section's world box and every entity's box; an entity without width or height counts as one unit.
- `recomputeBounds()` re-runs the same union, which is how entities dispatched after construction enter the bounds.
- `resolveWorldPosition(sectionName, localPos)` adds the section world position; an unknown section returns the local position unchanged.
- `bounds` always has the shape `{ x, y, width, height }`.
- `entities` returns a copy; `entitiesByType(type)` matches `type`, `tileType` or the constructor name.
- `addEntity` and `removeEntity` operate on the base collection only; `Stage` extends them with per-type views.

## Stage

Construction:

- Takes `(stageData, dependencies)` and validates the dependency object with `requireDependencies`. The declared keys are `player`, `physicsEngine`, `collisionSolver`, `collectibleFactory`, `noteCollection`, `projectileFactory` and `damageSystem`; `navigation` is optional.
- Rejects construction without a projectile factory. The projectile factory is exposed as `stage.projectileFactory` for shooter enemies; the damage system handles hazard and enemy-contact damage.
- Creates enemy drops through the injected `collectibleFactory`; the unused `enemyFactory` parameter is gone from the stage constructor.
- Binds itself to the player at construction (`player.stage = this`), which is why the player can hold `stage: null` as its declared dependency.
- Uses `entityBox` from `src/engine/physics/aabb.js` for its overlap scans; `boxesOverlap` is the shared primitive behind `CollisionSolver.checkAABB`.
- Starts with no entities, no active checkpoint, no teleporter latches and `isCompleted` false.
- `spawnPoint` defaults to `{ x: 2, y: 0 }` until a `player-spawn` object sets it.

Per-type views:

| View | Filled by | Consumed by |
| --- | --- | --- |
| `entities` | `addEntity` | Projectile impact scan, screen-clear and slide loops, and `Stage.getTeleporterMarker`. |
| `tilesList` | `addEntity` when the entity is a `Tile` | Stage collision, overlap validation, bounds. |
| `enemiesList` | `addEntity` when the entity is an `Enemy` | Enemy simulation, removal and the earthquake item effect. |
| `collectiblesList` | `addEntity` when the entity is a `Collectible` | Pickup detection and removal. |
| `checkpointsList` | `addEntity` when the entity is a `Checkpoint` | Checkpoint detection, count and respawn. |
| `projectiles` (private) | `addEntity` when the entity is a `Projectile` | Projectile simulation and removal. |
| `teleporters` | `addTeleporter` | Teleporter activation and rendering. |

`removeEntity` prunes the base collection and every per-type view, so lists cannot drift.

Checkpoints and respawn:

- `checkpointCount` is derived from the checkpoint list length.
- The dispatcher creates a checkpoint with `index = checkpointCount + 1`, so creation order defines the index.
- The contact volume is the one-unit cell above the checkpoint origin.
- `activateCheckpoint(index)` records the index, activates that checkpoint and plays the `checkpoint` SFX.
- `respawnPlayer()` calls `healthSystem.respawn()` (which decrements lives and restores life), resets the note tracker, places the player at the active checkpoint (or the spawn point) one unit above its origin, and zeroes velocity.
- Falling more than five units below the stage bottom triggers `respawnPlayer`.
- Zero life from damage also triggers `respawnPlayer`: the stage spends one life, restores life, clears the note tracker and returns the player to the active checkpoint. Invincibility, fire shield and invulnerability frames reject the damage before life can reach zero.

Completion:

- `completeStage()` sets `isCompleted` and plays the `stage-clear` SFX.
- A completed stage returns immediately from `update`, so the simulation freezes until the scene changes.

### Update pipeline

Every branch is skipped when `isCompleted` is true.

1. Capture the player box for the ladder test.
2. Scan alive climbable tiles: any overlap sets `player.isClimbing = true`, otherwise false.
3. Apply gravity only when not climbing; apply ground friction always.
4. Call `player.update(dt, inputManager)`, which processes crouch, movement, jump and every ability.
5. When climbing: clear `onGround`, set vertical velocity to `-5` on `up`, `5` on `down`, otherwise `0`.
6. Integrate the player position.
7. Clear `onGround` and remember whether it was set before integration.
8. For each alive tile that overlaps the player box, or that is a slope whose surface may reach the player:
   - slope and solid → `CollisionSolver.resolveSlopeCollision` with the previous ground state and `dt`; apply position and velocity; a grounded result sets `onGround` and clears climbing;
   - solid → `CollisionSolver.resolveCollision` with `dt`; apply position and velocity; a top result sets `onGround` and clears climbing;
   - deadly → `DamageSystem.applyHazardDamage` with the tile damage value;
   - liquid → halve horizontal velocity and cap downward velocity at `0.5`.
9. Collect every alive collectible that overlaps the player.
10. Activate every inactive checkpoint whose contact cell overlaps the player.
11. For each alive enemy:
    - apply gravity unless the enemy is a flyer;
    - call `enemy.update(dt, stage)`;
    - unless a flyer, integrate, clear `onGround`, resolve slope or solid collisions and notify `onWallHit()` when a nonzero horizontal velocity was zeroed;
    - on player overlap, the stomp rule applies once per contact: a downward player with less than `0.3` units of penetration damages the enemy by `1`, bounces the player and latches the enemy until the boxes separate; otherwise, while the enemy is not latched, the contact applies enemy damage.
12. For each teleporter in declaration order:
    - clear its latch when the player no longer overlaps;
    - when overlapping, not latched and `up` was pressed this frame, call `canActivate(context)`;
    - when activation succeeds, latch the teleporter so a held or repeated press cannot fire it again during the same overlap, and stop the teleporter loop.
13. Update every alive projectile.
14. Sweep dead enemies (calling `resolveDrop` with its injected random source and creating the resulting collectible through the injected collectible factory), dead collectibles and dead projectiles out of the stage.
15. When `healthSystem.isDead` is true, call `respawnPlayer()` once and return from the update, so a lethal damage hit cannot also trigger the fall respawn in the same frame.
16. Respawn the player when below the fall limit.

Teleporter latching is edge-triggered by overlap, not only by the input edge: leaving the teleporter clears the latch, so a fresh press after re-entering activates it again.

### Render pipeline

`Stage.render` draws, in order: tiles, teleporters, alive collectibles, alive enemies, alive projectiles, checkpoints, the player when alive. The stage itself does not apply a camera transform; the scene does. Slope tiles render as polygons through `Renderer.drawPolygonPath`.

## Stage object kinds

`ObjectDispatcher` resolves an object `type` to a kind, then calls that kind's construction handler with the section world position plus the object's local position.

| Type or family type | Kind | Constructed object |
| --- | --- | --- |
| Any type listed in `game-config.tile-types` | `tile` | `Tile` with an overlapped size (default 1×1). |
| Any shape name in `enemies.config.shape-map` plus an optional behavior suffix | `enemy` | `Enemy` subclass through the enemy factory. |
| Any file basename under `data/collectibles/` | `collectible` | `Collectible` with data merged into the object. |
| `player-spawn` | `player-spawn` | Sets `stage.spawnPoint` and places the player one unit above. |
| `checkpoint` | `checkpoint` | `Checkpoint` with the next index. |
| `teleporter-marker` | `teleporter-marker` | `TeleporterMarker`, added as an entity. |
| `inner-teleporter` | `inner-teleporter` | `InnerTeleporter`, registered with `addTeleporter`. |
| `special-teleporter` | `special-teleporter` | `SpecialTeleporter`, registered with `addTeleporter`. |
| `map-teleporter` | `map-teleporter` | `MapTeleporter`, registered with `addTeleporter`. Valid only in stage data. |
| `key-door` | `key-door` | `KeyDoor`, registered with `addTeleporter`, with the player inventory injected. |

Resolution algorithm:

1. Build a type-to-kind map: first every literal kind, then every family type that is not already present. A literal kind therefore wins a name collision.
2. For an object type, use the exact entry when present.
3. Otherwise use the entry for the first hyphen-separated segment, which is how `triangle-patrol`, `square-shooter` and `pentagon-patrol` reach the enemy family.
4. Otherwise throw, listing every registered type.

Family rules:

| Family | Type source | Consequence |
| --- | --- | --- |
| Tiles | `game-config.tile-types` array | A new tile type needs a matching `data/tiles/<type>.json`, a `tile-types` entry and nothing in the dispatcher. |
| Enemies | Keys of `enemies.config.shape-map` | A new shape needs a `shape-map` entry; the behavior suffix selects the behavior, and `is-boss` overrides it. |
| Collectibles | Every `data/collectibles/*.json` basename | A new collectible file is dispatchable with no code change. |

## Tiles

`resolveTileType` combines tile data with per-object overrides:

| Runtime field | Source |
| --- | --- |
| `type` | Object type. |
| `solid` | Object `solid`; otherwise tile data `collision.solid !== false` when the tile file declares a `type`; otherwise false for `decorative`, `pit` and `teleporter-marker` and true for anything else. |
| `deadly` | Object `deadly`; otherwise `damage.on-contact` true or `effect.action` equal to `death`. |
| `damage-value` | Object override, then variant damage, then `damage.value`. |
| `liquid` | Object override; otherwise a `gravity-multiplier` between 0 and 1. |
| `climbable` | Object override; otherwise `collision.climbable`. |
| `variant`, `inverted`, `slope-angle` | Object variant and tile data slope table. |
| `rendered`, `fill-color`, `border-color`, `border-width`, `corner-radius` | Object visual, then tile visual; colors resolved through the palette; border width from `borders.json` when a named border is used. |
| `friction` | Object override, then tile physics. |

`Tile` consumes the resolved configuration verbatim and exposes it as read-only flags. It adds no defaults. A tile's hitbox is its full box. A slope tile owns the `SlopeSurface` built from its width, height, angle and inverted flag; that object is the only owner of the surface formula.

Behavior in the stage:

- Solid tiles resolve collision and can carry `onGround`.
- Deadly tiles call hazard damage on every overlapping frame; the invulnerability timer in `HealthSystem` limits the frequency.
- Liquid tiles damp velocity; they do not set a swim state.
- Climbable tiles suspend gravity and enable vertical climbing at ±5 units/s.
- Slopes resolve against their surface: landing and step-up use the surface height at the downhill support edge, a grounded body sticks to a descending surface within a step tolerance, and the tall vertical face and the flat underside block. The surface is the tile-box diagonal; the declared angle is used only when it matches the tile aspect ratio.
- Slopes render as triangles: non-inverted draws the high edge at the right, inverted at the left.

## Enemies

Base enemy:

- Requires a normalized configuration with a numeric `size`.
- Reads `shape` (polygon side count), `color-index` into `color-palette`, `damage-output`, `is-boss` and `drop-table`.
- Receives the projectile factory and an optional random function through factory dependencies; the random source defaults to `Math.random`.
- `takeDamage(amount)` subtracts from the color index; at zero or below the enemy dies. This means the color index doubles as a hit-point counter and as the palette position.
- `resolveDrop()` rolls the weighted `drop-table` with the injected random source. An empty table returns `null`; a non-empty table returns an entry type on every kill, so the weights are the rarity control. The stage then creates that collectible through the injected collectible factory.
- `drop-rate` and `drop-type` are not part of the enemy configuration. Only `drop-table` remains.
- Renders a polygon with the current palette color and a black border; the boss overrides the render with an inner rotated square.

| Class | Selection | Behavior |
| --- | --- | --- |
| `PatrolEnemy` | Behavior `patrol` (default) | Walks at `0.5` units/s, reverses at the configured patrol range or when a wall zeroes its horizontal velocity. |
| `ShooterEnemy` | Behavior `shooter` | Fires at the player when within `detection-range` and the fire timer elapsed; the projectile is aimed at the player with `projectile-speed`. Requires a projectile factory. Every shipped shooter declares range, rate and speed. |
| `FlyerEnemy` | Behavior `flyer` | No gravity and no tile collision; vertical position oscillates by hover amplitude and frequency. |
| `BossEnemy` | `is-boss` true, regardless of suffix | No movement behavior; only a distinct render. |

Enemy damage intake from the player comes from the stomp rule, `SlideAttackAbility`, `AirSlideAbility`, `ScreenClearAbility`, the earthquake item effect and player projectiles. Damage dealt to the player goes through `DamageSystem`.

## Collectibles

Construction merges the collectible data file with the stage object:

| Field | Precedence |
| --- | --- |
| Base configuration | `collectibles.<type>` data file. |
| Object overrides | Every key of the stage object. |
| `size` | Object size → data `visual.size` → `0.5 × 0.5`. |
| `fill-color` | Object visual fill → data visual fill → object `fruit` → `#BFBF40`. |
| `note-order` | Object value or `null`. |
| `auto-use` | Object `auto-use` → data `effect.auto-activate` → data `auto-use` → `true`. |

Every collectible renders as a circle using `fill-color`; the declared `shape`, border colors and glow effects are not read.

Effect actions implemented by `Collectible.collect`:

| Action | Effect |
| --- | --- |
| `add-coins` | Adds the value (default 1) to `ScoreSystem.addCoins`; reaching 100 coins grants a life; adds `effect.score` or 10 to the score. |
| `add-ammo` | Adds the value (default 1) to the inventory under the collectible type. |
| `add-to-inventory` | When auto-use and `usage.action` is `restore-health`, heals fully or by the value; otherwise adds `keyItemName(<key-name>)` when a key name exists, else the collectible type. Keys therefore accumulate as ordinary inventory items. |
| `invincibility` | Sets the health system invincibility timer to the duration (default 30). |
| `extra-life` | Adds one life. |
| `add-score` | Adds the value (default 50). |
| `level-up` | When the collectible name maps to a higher level, applies it; otherwise grants a life. |
| `collect-note` | Records the note order in the stage tracker; completing all notes grants a continue. |
| `set-respawn` | Activates the checkpoint with the configured index. |
| `complete-stage` | Marks the stage completed. |
| Any other value | Plays the `collect` sound and has no other effect; the inventory and the key ring are untouched. |

The key collectible uses `add-to-inventory` with `auto-activate: false` and an object-level `key-name`; there is no separate key-door collectible file.

## Projectiles

- Constructed with position, velocity, damage, source and the resolved projectile configuration (`size`, `max-travel`, `enemy-color`, `player-color`).
- `update` advances position, accumulates traveled distance as `|vx·dt| + |vy·dt|`, and dies at `max-travel`.
- It scans stage entities and skips its source, itself and dead entities; its overlap test uses `entityBox` and `boxesOverlap` from the shared AABB module.
- An overlap with a solid entity kills the projectile. A player shot damages the first overlapping enemy once and dies. An enemy shot passes through other enemies, then damages the player when it overlaps the player.
- Decorative tiles, collectibles, checkpoints and teleporter markers do not stop a shot.
- Rendering chooses the enemy color when the source is an enemy, otherwise the player color.

## Abilities

`Ability` stores name, required level, duration, cooldown duration, remaining cooldown and active state. Its base `update` decrements cooldown and expires a duration. Subclasses override activation and update. Each ability gates itself on the player level, and the level table in `player/levels.json` sets the required levels again on every level-up.

| Ability | Required level | Input | Implemented effect |
| --- | --- | --- | --- |
| `crouch` | 0 | Hold `down` while grounded | Sets `player.isCrouching`; walk speed is multiplied by `speed-multiplier` (0.5) and the drawn radius shrinks. The hitbox is unchanged. |
| `slide-attack` | 0 | Automatic while dashing on the ground | Damages the first overlapped enemy by `damage` (2) once per dash. |
| `dash` | 1 | Press `dash` | Sets horizontal velocity to `walkSpeed × speed-multiplier` (2.0) for `duration` (0.25 s); `cooldown` (0.5 s) starts when it ends. |
| `shoot` | 2 | Hold `shoot` | Consumes one ammo per `1 / fire-rate` (0.5 s), spawns a projectile at `projectile-speed + level × 0.3` in the facing direction, and raises the shield while held. |
| `flight` | 3 | Hold `dash` on the ground to charge `dash-charge-required` (1 s), then jump while `dash` is held; hold `jump` while flying | Rises at `flight-speed` for `flight-duration` (2 s). Without flight, holding `jump` while falling caps fall speed at `slow-fall-speed`. |
| `double-jump` | 4 | Press `jump` in the air | `max-jumps` (2) budget: the ground jump spends one, the air jump spends one; the budget refills on the ground. Walking off a ledge spends the ground jump. |
| `air-slide` | 5 | Press `special` in the air | Slides horizontally at `slide-speed` for `midair-distance / slide-speed` seconds, damages each overlapped enemy once per slide, and applies a ground cooldown (0.5 s). |
| `screen-clear` | 6 | Hold `down` + `special` for `hold-time` (1 s) | Damages every living enemy on screen by `damage` (4), starts a screen flash for `flash-duration` and applies a `cooldown` (5 s). |
| `invincibility` | 7 | Hold `up` + `special` for `hold-time` (1 s) | Sets the health system invincibility timer for `duration` (60 s), limited to `uses` (1) per player instance; the use is not reset by a stage load. |

The player runs every ability's `update` each fixed step after its own movement. Abilities write velocity or state; the stage integration and collision pass remain the only path that changes position.

## Teleporters

All four activatable kinds implement the same contract:

```text
canActivate(context) -> boolean
activate(context) -> boolean
```

The context is supplied by the stage and declares six keys through `requireDependencies`:

| Key | Meaning |
| --- | --- |
| `player` | The player to move or to read the inventory from. |
| `overlaps(teleporter)` | True when the player box overlaps the teleporter's 1×1 box. |
| `markerFor(name)` | Resolves a `TeleporterMarker` by name, or `null`. |
| `navigate(sceneName)` | Requests a scene change through the stage navigation seam; reports and returns false when the seam is missing or throws. |
| `inventory` | The player inventory, used by key doors. |
| `report(message)` | Reports a configuration problem once. |

| Class | Type | Activation | Target resolution |
| --- | --- | --- | --- |
| `TeleporterMarker` | `teleporter-marker` | None; a named landmark. | N/A |
| `InnerTeleporter` | `inner-teleporter` | Marker contract; `deactivate()` makes it permanently inactive. | `context.markerFor(target-marker)`; moves the player to the marker position. |
| `MapTeleporter` | `map-teleporter` | Marker contract. Valid only in stage data. | `context.markerFor(target-marker)`. |
| `SpecialTeleporter` | `special-teleporter` | `isActive` when a `target-stage` or a `target-marker` is declared. | `context.navigate(target-stage)` when declared; otherwise the target marker. |
| `KeyDoor` | `key-door` | Requires `required-key`, an active super target, and either `key:<name>` in the inventory or a previous unlock. | Same as `SpecialTeleporter`. |

Key-door rules:

- Inventory keys use one naming helper: `keyItemName(name)` from `src/game/utils/key-item-name.js`, shared by the collectible pickup, the key door and `unlockedByCompletion`.
- The door reads the key on every activation attempt, so acquiring the key after the stage loads is enough.
- A successful activation sets `isUnlocked`, so the door stays open even if the key later leaves the inventory.
- Activation never removes the key: the key door does not consume it, and the inventory use path never consumes an item without a declared usage action.

A marker target that does not exist is reported once through `report` and the teleporter stays inert; it does not throw. `Stage.getTeleporterMarker` is the marker lookup and `Stage.handleTeleporter` is a small helper over `activate`.

## Systems

| System | State | Behavior |
| --- | --- | --- |
| `ProgressionSystem` | Level, fruit and level data | Level is the index in `colors.color-order`; a fruit maps to a level through its color; each level lists ability names; `applyLevelUp` raises the level, assigns the resolved palette color for the new level and sets each ability's required level for every level up to the new one. `maxLevel` is the last color index. |
| `ScoreSystem` | Score, coins, extra lives earned | Adds score; every 100 coins grants one extra life and resets the coin counter by 100. |
| `HealthSystem` | Life, max life, lives, continues, invincibility timer, fire-shield timer, invulnerability timer | Damage is rejected while invincible, fire-shielded or during invulnerability frames; `respawn` decrements lives and refills life; `useContinue` requires a continue, sets lives to the default and refills life; `isLivesExhausted` means no lives; `isGameOver` means no lives and no continues; `isDead` means zero life. |
| `DamageSystem` | Damage configuration | Enemy damage is the explicit damage output, else the shape table (triangle 1, square 1.5, pentagon 2, hexagon 2.5, heptagon 3). Hazard damage is the tile value, else the configured default. The shoot shield multiplies incoming enemy damage by `shield-damage-multiplier`. |
| `Inventory` | Item counts, default selection, open flag, max slots, usage table, effects resolver | Add, remove, has, count, slots and use. `use` requires a declared usage action: it removes one unit, plays an item-specific sound and applies `usage` through `ItemEffects`. An item without usage, including every `key:<name>`, returns false without consuming anything or playing a sound. The inventory confirm path and the select+shoot shortcut call the same method. |
| `ItemEffects` | Health system and a player accessor | Resolves `usage.action`: `restore-health` heals by `value` (`full` or a number), `moon-gravity` sets the player gravity multiplier for `duration`, `fire-shield` sets the health fire-shield timer, `earthquake` damages every matching living enemy by `damage` (`target: ground-enemies` excludes flyers). An unknown action reports and returns false. |
| `NoteCollectionTracker` | Collected orders, note names, total | When the configuration declares `notes`, note order N maps to the Nth declared note. Without it, names are generated in whole-tone steps from `lowest` and `count`. Records an order once, reports completion and resets. |

## Map stage

Data objects read by `MapStage`:

| Type | Stored as |
| --- | --- |
| `stage-node` | `{ id, display, state, unlock-condition, data-available, position }`. Missing `stage-id` is skipped. |
| `path` | `{ from, to, visual, position }`. |
| `area-label` | `{ name, display, position }`. |
| `teleporter-marker` | `{ name, position }`. |
| `map-teleporter` | Ignored with a console warning per object: teleporters belong to stages. |
| Any other type | Ignored. |

Behavior:

- `display` is the object `display`, else the resolved `display-name-key`, else the stage id or node name.
- Selectable means state is not `locked` and the stage data file exists.
- The active node is the preferred stage id when it is selectable, else the first selectable node, else the first node.
- Directional navigation considers every other node with a positive projection on the requested axis, sorted by distance, then perpendicular offset, then id. It does not filter by lock state.
- `navigateTo` also moves the player entity to the node, which the map camera does not use.
- `selectNode()` returns whether the active node is selectable.
- Rendering: paths are green when both endpoints are completed and gray otherwise; labels are gray; node fill is green for completed, dark red for locked, dark gray for missing data, yellow for the active node and gray otherwise; the active node is drawn larger; the label is white when selectable and gray otherwise.
- Node labels are measured with `Renderer.measureText` and clamped to the camera band by `clampLabelX`; a label wider than the band is centered in it.
- All map colors, fonts and vertical offsets other than the clamp are hardcoded in `MapStage`.

## Scenes

| Scene | Enter | Update | Render |
| --- | --- | --- | --- |
| `TitleScene` | Plays `title-screen` BGM. | Menu navigation. | Clear, title text, menu. |
| `SettingsScene` | Nothing. | Settings menu. | Clear, menu overlay. |
| `InfoScene` | Nothing. | Confirm or back closes. | Clear, info screen. |
| `StageScene` | Receives `(stage, hud, pauseMenu, gameOverScreen, stageClearScreen, inventoryUI, audioEngine, dialogueEngine = null, camera = null)`; plays `stage.bgm` when the stage declares one, otherwise the stage name, activates the stage, snaps the camera and starts the intro dialogue once. | See state machine below. | Stage under the camera transform, screen-clear flash, HUD, one overlay, dialogue last. |
| `MapScene` | Receives `(mapStage, pauseMenu, audioEngine, camera = null)`; centers the camera on the active node and plays `world-map`. | Pause toggle; navigation and node selection; camera recentered every frame. | Map under the camera transform, pause overlay when paused. |

`StageScene` state priority:

1. Completion detection sets the stage-clear flag and notifies the application layer once.
2. `healthSystem.isLivesExhausted` sets the game-over flag, regardless of whether a continue remains.
3. An active dialogue updates, follows the camera and returns; the stage does not simulate.
4. When game over or stage clear is active, the matching end screen updates and the method returns. Pause and inventory input is not read in this state.
5. Otherwise input is read: `pause` closes the inventory when it is open, otherwise toggles pause; `select` toggles the inventory when not paused; `select` + `shoot` uses the default inventory item while the inventory is closed.
6. Exactly one branch updates: pause menu, inventory, or the stage plus camera follow.
7. Render priority is game over, stage clear, pause, inventory. The HUD and the stage render underneath every overlay.

End states therefore win over pause and inventory in both update and render.

`isPaused` suspends and resumes BGM. The application layer clears `isPaused` when a scene is left through an action. Both scenes receive their camera in the constructor; there is no post-construction camera setter.

## UI components

| Component | Reads from data | Notes |
| --- | --- | --- |
| `HUD` | `ui.hud` elements and text; strings for level, ammo, coins, score and notes prefixes | Draws the configured background band and bottom border, life bar, level, ammo, coins, score, note tracker and inventory indicator. Every element honors `enabled`; `inventory-indicator` shows the live default-selected item and its count. |
| `Menu` | Menu sub-configuration built by `UiBuilder` | Navigation wraps over visible items; an item whose `visible-condition` evaluates false is skipped, not rendered and cannot be confirmed; confirm dispatches the item action; back calls `onClose`; renders optional subtitle and hint. |
| `TitleMenu` | Same as `Menu` | No behavior of its own. |
| `PauseMenu` | Title key, item list, hint, `layout` | Draws its overlay and reads the title offset, item start and prefixes from configuration. |
| `SettingsMenu` | Sliders, buttons, `AudioSettings`, `layout` | Rows are sliders first, then buttons; left/right adjust the selected slider between `min` and `max` by `step`; writes through `AudioSettings`, which persists the value. Reads the title offset and font offset, first-row Y, slider row gap, button gap and selection prefixes from `menu-defaults.layout` merged with the settings `layout-overrides`. |
| `GameOverScreen` | Title key, items, health system, `layout` | Reads live continues and lives at render time; the Continue row carries `visible-condition: has-continues` and disappears at zero continues. |
| `StageClearScreen` | Title key, items, live providers, `layout` | Shows the stage `display-name-key` resolved through `TextResolver`, falling back to the stage id when no key is declared; also shows the big fruit, the abilities of that fruit's level and the live score. Rows are omitted when a provider returns nothing. |
| `InfoScreen` | Info screen configuration | Title, lines, hint; confirm or back closes. |
| `InventoryUI` | `ui.inventory` | 4×2 grid, arrow navigation, confirm uses the selected item, shoot marks it as the default, footer hints. |

## Known issues in this layer

No open defect is recorded for this layer.
