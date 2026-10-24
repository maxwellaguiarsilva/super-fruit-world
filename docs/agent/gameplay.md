# Gameplay

Subject: what a player can do and what happens in response, as implemented today. Causes that live in a specific module are documented in the architecture documents; this file records the player-visible rules.

## Controls

Keyboard bindings come from `data/input/bindings.json`; both keys per action are active.

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Move left | `ArrowLeft`, `A` | D-pad left, left stick left |
| Move right | `ArrowRight`, `D` | D-pad right, left stick right |
| Move up | `ArrowUp`, `W` | D-pad up, left stick up |
| Move down | `ArrowDown`, `S` | D-pad down, left stick down |
| Jump | `Space`, `ArrowUp` | Button 0 (A/Cross) |
| Crouch | `ArrowDown` | D-pad down |
| Dash | `Shift` (left or right) | Button 2 (X/Square) |
| Shoot | `Z`, `J` | Button 1 (B/Circle) |
| Special | `X`, `K` | Button 3 (Y/Triangle) |
| Pause | `Escape`, `P` | Button 9 (Start) |
| Select / inventory | `C`, right `Shift` | Button 8 (Select) |
| Confirm | `Enter`, `Space` | Button 0 |
| Back | `Escape`, `Backspace` | Button 1 |

Notes:

- The engine resolves `left`, `right`, `up` and `down` to the `move-*` actions, and `air-slide` to `special`.
- Left-stick up and down resolve against the vertical axis; both the D-pad and the left stick work on a gamepad.
- Menu navigation uses up/down, confirm and back. The settings screen additionally uses left/right to change sliders.
- The tutorial and controls screens describe only inputs that have an implementation.

## Screens

| Screen | Reached from | Entries |
| --- | --- | --- |
| Title | Boot without saved progress, or Quit to Menu | Start Game, Tutorial, Settings, Credits |
| Tutorial | Title | Read-only lines; confirm or back returns. |
| Credits | Title | Read-only lines; confirm or back returns. |
| Settings | Title or pause menu | Music Volume, SFX Volume, Controls, Back. Sliders step by 0.1 in `0..1` and persist immediately. |
| Controls | Settings | Read-only binding list; confirm or back returns. |
| Pause | Pause during a stage, or Pause on the map | Resume, Settings, Restart Stage, Quit to Map, Quit to Menu. |
| Inventory | Select during a stage | 4×2 item grid. |
| Dialogue | Stage intro | Bottom band with speaker, typewriter text and advance hint. |
| Stage Clear | Stage completion | Continue. |
| Game Over | Lives reach zero | Continue when a continue remains, Quit. |
| World Map | Boot with saved progress, Quit to Map, or Continue on the stage-clear screen | Stage nodes and the cursor. |

## Movement

| Rule | Value |
| --- | --- |
| Gravity | `15.0` units/s², capped at `20.0` units/s falling; scaled by the moon-gravity multiplier while that item effect is active. |
| Walk speed | `5.0` units/s, multiplied by 0.5 while crouching. |
| Walk acceleration | `15.0`; applied fully on the ground and at half strength in the air. |
| Jump velocity | `10.0` units/s upward; while on the ground, on a ladder, or from the double-jump budget. |
| Ground friction | Multiplies horizontal velocity by `pow(0.25, dt × 60)` each fixed step. |
| Air control | Half of the ground acceleration. |
| Fall death | More than 5 units below the stage bottom triggers a respawn. |

- Horizontal movement is instant in direction but interpolated in speed; the player faces the last horizontal direction.
- Jump and confirm share `Space`; in a stage, `Space` jumps and confirm is only read by dialogue, menus and the inventory.
- Crouch is a held state on the ground: it halves walk speed and shrinks the drawn body without changing the hitbox.
- Dash, double jump and flight are implemented and gated by level; see [Abilities](#abilities).

Terrain interaction:

- Solid tiles block from all sides and provide the ground state.
- Ladders suspend gravity. `up` climbs at 5 units/s, `down` descends at 5 units/s, no input holds position; jumping leaves the ladder.
- Water halves horizontal velocity and caps downward speed; there is no swim state.
- Spikes deal hazard damage on overlap, limited by the invulnerability timer.
- Slopes are solid wedges whose walkable surface is the box diagonal. Landing and step-up use the surface height, a grounded body sticks to a descending surface within a step tolerance, and the tall vertical face and the underside block like a solid. The effective angle comes from the tile width and height; a declared angle is used only when it matches the tile aspect ratio. Slopes render as triangles.

## Abilities

Abilities are configured in `data/player/abilities.json` and gated by the player level. `data/player/levels.json` describes which level introduces each name; each ability class also gates itself on the numeric `required-level`. The stage-clear summary reads display names from `player.abilities.*`, including the localized `Stomp` and `Slide Attack`.

| Level | Color | Ability introduced | Input | What happens |
| --- | --- | --- | --- | --- |
| 0 | Black | Walk, jump, crouch, stomp, slide-attack | Move keys, `Space`, hold `down`, land from above, dash on the ground | Walk and jump work; crouch halves speed; stomping an enemy damages it once per contact; a grounded dash damages the first enemy it touches. |
| 1 | Red | Dash | `Shift` | Dashes horizontally at twice walk speed for 0.25 s, then waits 0.5 s. |
| 2 | Green | Shoot, shield | Hold `Z` / `J` | Fires one ammo per 0.5 s and reduces incoming enemy damage to 10% while held. |
| 3 | Yellow | Flight, slow fall | Hold `Shift` on the ground, then jump while holding it; hold `Space` in the air | Rises for up to 2 s at the flight speed; while falling, holding `Space` caps fall speed. |
| 4 | Blue | Double jump | `Space` in the air | One extra jump; the budget refills on the ground. |
| 5 | Cyan | Air slide | `X` / `K` in the air | Slides horizontally and damages each overlapped enemy once per slide. |
| 6 | Magenta | Screen clear | Hold `down` + `special` for 1 s | Damages every enemy on screen by 4, flashes the screen and enters a 5 s cooldown. |
| 7 | White | Invincibility | Hold `up` + `special` for 1 s | Becomes invincible for 60 s, once per player instance. |

Levels only rise; no ability is ever removed. Every big fruit in the eight stages maps to the next level, so levels 3 to 7 are reachable in normal play.

## Inventory items

Items are collected into the inventory instead of applying on pickup, except coins, notes, ammo and big fruits.

| Item | Effect on use | Duration |
| --- | --- | --- |
| `heart` | Restores life to full. | Instant. |
| `moon` | Moon gravity: gravity multiplier `0.4`. | 30 s. |
| `sun` | Fire shield: blocks all damage. It does not defeat touching enemies. | 30 s. |
| `earth` | Earthquake: deals 3 damage to every living ground enemy in the stage. Flyers are ignored. | Instant. |
| `apple` | No declared usage action; it is not consumed and plays no sound. | N/A. |
| `ammo` | No usage action; ammo is spent by shooting and cannot be used from the grid. | N/A. |
| `key:<name>` | No usage action; it is never consumed by the use path and plays no sound. | Permanent. |

Use paths:

- Press `select` to open the inventory. `confirm` uses the selected slot. `shoot` marks the selected slot as the default.
- While the inventory is closed, `select` + `shoot` uses the default item without opening the grid.
- Using an item consumes exactly one unit, plays an item-specific sound and applies its effect once only when the item declares `effect.usage.action`. An item without usage, including a key, is left untouched and plays no sound.

## Keys

- The key collectible has the data shape `{ "type": "key", "key-name": "<name>", "position": {...} }`; pickup adds `key:<name>` to the inventory.
- Keys persist in progress with the rest of the inventory.
- Starfruit Caverns holds the key `secret-grove-key`.
- The world map node `starfruit-caverns-branch` declares `unlock-condition: { "type": "key-required", "key-name": "secret-grove-key" }`; holding the key makes the node available on the map, including after a reload.
- A key door requires `key:<name>` and keeps it: the door path does not consume the key. No shipped stage declares a key door; the delivered key use is the map unlock.
- The inventory use path only consumes items with a declared usage action, so a key slot is inert on confirm and on the select+shoot shortcut.

## HUD

Rendered in screen space over the stage. The background band and bottom border come from `data/ui/hud.json`.

| Element | Content |
| --- | --- |
| Life bar | Current life over max life, as a filled bar over an empty bar. |
| Level | `Lv: <level>` next to the life bar. |
| Ammo | `Ammo: <count>`. |
| Coins | Coin icon and `Coins: <count>`. |
| Score | `Score: <value>` at the right edge. |
| Note tracker | `Notes: <collected>/<total>` plus one dot per configured note; filled when collected. |
| Inventory indicator | The default-selected item name and its live count; an empty frame when nothing is selected. |

Every element honors its `enabled` flag. Lives and continues are not shown in the HUD; the game-over screen shows them. The HUD reads the player's note tracker through the current stage, so it follows a newly loaded stage. Each collected note plays the pitch declared by `musical-note-scale` in order (`c4 d4 e4 f4 g4 a4 b4 c5`); on an eight-note stage, orders 4 through 8 therefore sound `f4` through `c5`.

## Health, damage and death

- Damage sources: enemy contact, deadly tiles and enemy projectiles.
- Enemy contact damage is the enemy's explicit damage output, otherwise a shape value: triangle 1, square 1.5, pentagon 2, hexagon 2.5, heptagon 3.
- Hazard damage is the tile value (`spike` 1, `danger` 2, `lava` 3), otherwise 1.
- Holding shoot multiplies incoming enemy damage by the shield multiplier (0.1).
- Stomping an enemy while falling onto its top damages it by 1 and bounces the player upward. The contact damages once; the player must separate from the enemy before another stomp can land.
- Invincibility and fire shield block all damage; invulnerability frames block damage for 1 s after a hit.
- Losing all life to damage plays the death sound, spends one life, restores life, clears the note tracker and returns the player to the active checkpoint or the stage spawn point. The respawn happens once, on the stage update that observes zero life.
- Falling below the stage bounds reaches the same respawn path and spends one life.
- The invulnerability window from the lethal hit prevents a second respawn on the next frame.
- When lives reach zero, the stage scene stops simulating and shows the game-over screen. With a continue available, Continue spends one, restores the starting lives and full life, and reloads the stage. With none, only Quit is offered.
- Game over and stage clear are end states: while either is active, pause and inventory are neither updated nor rendered.

The player entity's color, level, score, inventory, ammo and temporary item state survive a respawn; a stage reload rebuilds the stage but reuses the player and its ability instances.

## Coins, score and fruits

- A coin adds 1 coin and 10 score and plays the coin sound.
- Some enemies from Blueberry Peaks onward carry a weighted drop table. A kill of such an enemy produces one drop; the possible types are coin, ammo, heart, moon, sun or earth depending on that enemy. Common entries carry higher weights, and premium items such as sun and earth carry lower weights. Strawberry Fields, Avocado Grove, Banana Beach and the Secret Waterfall branch have no enemy drops.
- Every 100 coins grants one extra life.
- Big fruits evolve the player when they map to a higher level: strawberry → red (1), avocado → green (2), banana → yellow (3), blueberry → blue (4), starfruit → cyan (5), pitaya → magenta (6), fruit basket → white (7).
- The level and the drawn color change immediately; the level-up path assigns the resolved palette color.
- Collecting a big fruit that is not an upgrade grants a life instead.
- Big-fruit level-ups only raise the level; they never lower it and never remove an ability.

## Ammo and shooting

- Shooting requires level 2 or higher and at least one ammo unit.
- Each shot spends one ammo, waits `1 / 2` s, plays the attack sound and spawns a projectile in the facing direction.
- Projectile speed is the configured 1.0 plus `0.3 × level`, so later levels shoot faster.
- Holding shoot raises the shield; the shield does not consume ammo and does not block shooting.
- Projectiles travel at most 20 units. A player shot damages the first enemy it overlaps and stops; an enemy shot passes through other enemies and damages the player. Solid tiles stop a shot; decorative tiles, collectibles, checkpoints and markers do not.
- Ammo pickups add 10 units. The HUD shows the count.

## Checkpoints and respawn

- Strawberry Fields has two checkpoints; Avocado Grove, Banana Beach, Blueberry Peaks, Starfruit Caverns, Pitaya Canyon and Fruit Basket Citadel have one or two each; the Secret Waterfall branch has one. The current data declares 14 in total.
- Walking through the cell above a checkpoint activates it: the marker turns green and plays a sound.
- The most recently activated checkpoint is used for every later respawn in that stage.
- Dying before any checkpoint returns the player to the stage spawn point.
- Falling below the stage bounds and losing all life to damage both trigger a respawn.
- Respawning clears collected notes for the stage, so they can be collected again.
- A new stage load resets checkpoints, notes, enemies and pickups.

## Teleporters and doors

| Object | Visible | Behavior |
| --- | --- | --- |
| `teleporter-marker` | Cyan square | Named landmark; resolves a teleporter target by name. |
| `inner-teleporter` | Blue square, gray when inactive | Press `up` while overlapping. Moves the player to the named marker. A missing marker reports once and does nothing. |
| `special-teleporter` | Green square, gray when inactive | With `target-stage`, switches to that scene; otherwise moves the player to its target marker. No target means inert. |
| `map-teleporter` | Colored square, gray when inactive | Stage-only marker teleporter. The world map does not use this kind; a map-level object is reported and ignored. |
| `key-door` | Green square, gray when inactive | Requires `key:<required-key>` and a target; navigates like a special teleporter and keeps the key. No shipped stage declares one. |

Strawberry Fields contains two inner teleporters, three markers and one special teleporter at the exit plateau. The inner teleporters connect the underground detour with the surface return; the special teleporter declares `target-stage: "map"`. Activation is edge-triggered per overlap: holding `up` does not repeat it, and leaving the tile then pressing `up` again does.

## Stage completion

- The exit door is a collectible with `effect.action: complete-stage`.
- Collecting it marks the stage completed and plays the clear sound; every later stage update returns immediately.
- The stage-clear screen appears on the following frame and shows the localized stage name (`display-name-key`, falling back to the stage id), the collected big fruit, the abilities unlocked at that fruit's level, the live score, the continue hint and a Continue button. A stage with no big fruit omits the fruit and ability rows.
- The first completion adds the stage to the completed set, recomputes unlocks from the live inventory, writes progress and rebuilds the world map.
- Continue returns to the map.

## Persistence and resume

- Progress is written automatically when a stage is left or completed. There is no save screen and no manual save.
- Written state: completed stages, unlocked stages, last stage, score, level, inventory items (including keys) and the default-selected item.
- Audio volumes are written separately in the `settings` record as soon as a slider changes.
- Reloading with saved progress opens the world map, not the stage and not the title screen.
- Reloading restores score, level, color, inventory, keys and audio volumes. It does not restore health, lives, continues, position, the active checkpoint or a temporary item effect.
- Without saved progress, Start Game opens the configured initial stage (Strawberry Fields).
- A key held in the inventory unlocks its key-required map node at boot without replaying the stage.

## Stage progression

The map chain is Strawberry Fields → Avocado Grove → Banana Beach → Blueberry Peaks → Starfruit Caverns → Pitaya Canyon → Fruit Basket Citadel. Starfruit Caverns also opens the key-gated Secret Waterfall branch.

| Stage | Data id | Big fruit | Level after clear | Abilities shown on the clear screen | Notes | Checkpoints | Sections |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Strawberry Fields | `strawberry-fields` | strawberry | 1 (red) | Dash | 8 | 2 | 13 |
| Avocado Grove | `avocado-grove` | avocado | 2 (green) | Shoot, Shield | 8 | 1 | 3 |
| Banana Beach | `banana-beach` | banana | 3 (yellow) | Flight, Slow Fall | 8 | 2 | 4 |
| Blueberry Peaks | `blueberry-peaks` | blueberry | 4 (blue) | Double Jump | 8 | 2 | 5 |
| Starfruit Caverns | `starfruit-caverns` | starfruit | 5 (cyan) | Air Slide | 8 | 2 | 5 |
| Pitaya Canyon | `pitaya-canyon` | pitaya | 6 (magenta) | Screen Clear | 8 | 2 | 5 |
| Fruit Basket Citadel | `fruit-basket-citadel` | fruit-basket | 7 (white) | Invincibility | 8 | 2 | 5 |
| Secret Waterfall | `starfruit-caverns-branch` | starfruit | no upgrade after Starfruit Caverns; grants a life | Air Slide (the level's names) | 5 | 1 | 2 |

Stage details:

- Strawberry Fields: opening plateau, jump section, enemy valley, ladder ascent, first checkpoint, underground detour with two inner teleporters, return path, slope section with two slopes, enemy gauntlet, second checkpoint, boss arena and exit plateau. Enemies include triangle and square patrols, two triangle shooters with range 6, and one pentagon boss.
- Avocado Grove: grove entrance, terrace climb with a checkpoint and several notes, and the avocado terrace with the exit door. Triangle and square patrols only.
- Banana Beach: shore arrival, tidepools, banana grove and banana heart. Two checkpoints, one pit, triangle and square patrols.
- Blueberry Peaks: foothill, first climb, gap run, summit trail and blueberry peak. Two checkpoints, a pit, triangle, square and one hexagon patrol.
- Starfruit Caverns: cave mouth, crystal shaft, crystal gallery, underground lake and starfruit vault. Two checkpoints, a ladder, water, one square shooter with range 7, and the `secret-grove-key` pickup in the underground lake. The sun and moon items appear here.
- Pitaya Canyon: canyon rim, deadfall, ember climb, magma run and pitaya heart. Two checkpoints, five spike objects, a pit, and four shooters with ranges 7 to 8.
- Fruit Basket Citadel: outer gate, rampart climb, cistern, hall of mirrors and fruit-basket vault. Two checkpoints, two slopes, spikes, water, a ladder and walls; two shooters with range 8.
- Secret Waterfall: waterfall ledge and secret grove. One checkpoint, five notes, a moon item, triangle and square patrols. Its big fruit is starfruit, so after Starfruit Caverns it grants a life instead of a level. Its BGM track is `secret-waterfall`.

All eight stages declare an intro dialogue of two or three lines and a BGM track registered in `data/audio/bgm.json`. Every stage declares one player spawn, one exit door and at least one checkpoint.

## World Map

- Eight stage nodes: Strawberry Fields (available), Avocado Grove (complete Strawberry Fields), Banana Beach (complete Avocado Grove), Blueberry Peaks (complete Banana Beach), Starfruit Caverns (complete Blueberry Peaks), Pitaya Canyon (complete Starfruit Caverns), Fruit Basket Citadel (complete Pitaya Canyon), and Secret Waterfall (key-required `secret-grove-key`).
- Five area labels: Green Meadows, Azure Highlands, Volcanic Frontier, Final Horizon, Secret Grove.
- Paths are declared from Strawberry Fields to Avocado Grove, from Avocado Grove to Banana Beach, from Blueberry Peaks to Starfruit Caverns, and from Starfruit Caverns to the secret node with a dashed style. Banana Beach → Blueberry Peaks, Starfruit Caverns → Pitaya Canyon and Pitaya Canyon → Fruit Basket Citadel have no path objects, so those links are not drawn even though the unlock chain is complete.
- The cursor starts on the last played stage when that node is selectable, otherwise on the first selectable node.
- Directional input moves the cursor to the nearest node in that direction, including locked nodes.
- Confirm enters a node only when it is not locked and its stage file exists.
- Completing a stage recolors its node green; nodes without stage data are dark gray; locked nodes are dark red.
- Labels are measured and clamped to the visible camera band, so a node near the edge shows its full name.
- Map teleporters are not a map feature; the world map declares none.

## Verification status

Browser-verified in the recorded run:

- All eight stages boot from the map with their intro dialogue and no console errors.
- Game over appears after repeated pit deaths, shows `Continues: 1` and a Continue row, and confirm restarts the stage.
- Avocado Grove stage clear shows the localized name "Avocado Grove" with the live summary (`Collected: Avocado`, `Ability: Shoot, Shield`, score), and confirm reaches the map.
- Title to stage, pause menu, settings screen, tutorial, credits and controls.
- Restart stage; map reachable from the pause menu; map camera follows directional navigation; locked nodes are not selectable.
- Save written on leaving a stage; reload resumes at the map with level and inventory restored.
- Intro dialogue typewriter and dismissal; a checkpoint activates visually.
- Shooting at level 2 consumed ammo from 10 to 8; an ammo pickup incremented the counter.
- Enemy and hazard contact reduced health.
- Scripted traversal is timing-sensitive: the recorded run needed a run-up before jumping at a 2-unit platform; the earlier failure to reach the clear screen was input timing, not a game defect.
- Audio settings persistence: Settings was opened from the title, Music Volume moved from 60% to 80%, the `settings` record held `bgm-volume: 0.8`, and a reload showed 80% with SFX still 100% and no console or page errors.

Wired and unit-tested, not browser-verified end to end:

- A single run through the whole chain Strawberry Fields → Fruit Basket Citadel, including the key-gated branch.
- Teleporter traversal inside a stage.
- Death by damage; the respawn policy is unit-tested in `test/death-respawn.test.js`, while the browser run reached game over through repeated pit deaths.

## Known issues in gameplay

Code-verified unless marked otherwise.

- The full progression chain was not played end to end; every stage boot and the two end states were verified separately. Tracked as OP-20.
