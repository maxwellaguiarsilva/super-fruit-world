# Data Model

Subject: the content under `data/` — how it is indexed, which shapes exist, which keys are consumed and which are inert. The runtime objects these files become are documented in [architecture/game-layer.md](architecture/game-layer.md) and [architecture/application-layer.md](architecture/application-layer.md).

## Tree by subject

| Path | Files | Subject |
| --- | --- | --- |
| `data/index.json` | 1 | Generated index of every JSON file. Not tracked by Git and not counted in the total below. |
| `data/game-config.json` | 1 | Boot configuration: visual unit, canvas, loop, inventory, tile types, initial stage, save namespace, physics, player, health, damage, projectile. |
| `data/colors.json` | 1 | Eight-color palette with dark and light variants, plus the level order. |
| `data/borders.json` | 1 | Named border widths. |
| `data/tiles/` | 8 | One file per tile type: `decorative`, `ladder`, `pit`, `platform`, `slope`, `spike`, `wall`, `water`. |
| `data/enemies/config.json` | 1 | Enemy size, boss size and the shape-name to polygon-side map. There are no per-enemy files. |
| `data/collectibles/` | 11 | One file per pickup kind: `ammo`, `apple`, `big-fruit`, `coin`, `earth`, `exit-door`, `heart`, `key`, `moon`, `musical-note`, `sun`. |
| `data/stages/` | 8 | Playable stages: `strawberry-fields`, `avocado-grove`, `banana-beach`, `blueberry-peaks`, `starfruit-caverns`, `pitaya-canyon`, `fruit-basket-citadel`, `starfruit-caverns-branch`. |
| `data/map/fruit-world.json` | 1 | World map: areas, stage nodes, paths and labels. No teleporters. |
| `data/player/` | 3 | `abilities.json`, `fruits.json`, `levels.json`. |
| `data/input/bindings.json` | 1 | Keyboard and gamepad bindings per action, plus gamepad dead zone, button count and axis map. |
| `data/audio/config.json` | 1 | Volumes, enable flags, crossfade. |
| `data/audio/synthesis.json` | 1 | Tuning, note range, musical-note scale, envelope defaults. |
| `data/audio/sfx.json` | 1 | SFX definitions. |
| `data/audio/bgm.json` | 1 | Track registry mapping names to files. |
| `data/audio/bgm/` | 11 | Track definitions: `title-screen`, `world-map`, `strawberry-fields`, `avocado-grove`, `banana-beach`, `blueberry-peaks`, `starfruit-caverns`, `pitaya-canyon`, `fruit-basket-citadel`, `secret-waterfall`, `stage-clear`. |
| `data/i18n/default.json` | link | The accessor the game reads; a symbolic link to `en-us.json`. |
| `data/i18n/en-us.json` | 1 | The physical string table. |
| `data/ui/menus.json` | 1 | Menu screens, defaults, layout overrides and info screens. |
| `data/ui/hud.json` | 1 | HUD layout, chrome and element styles. |
| `data/ui/inventory.json` | 1 | Inventory overlay layout. |
| `data/ui/dialogue.json` | 1 | Dialogue band layout and typewriter rate. |

Total: 57 indexed entries, excluding the generated `data/index.json`: 56 regular files and one symbolic link.

## Index and accessor model

- `DataDriven` fetches `data/index.json`, requires a `files` array, and fetches every listed file in order. A missing index is a boot failure.
- `scripts/generate-data-index.js` walks `data/` recursively, follows symbolic links to files, keeps `.json` files, skips `data/index.json`, converts separators to `/`, sorts with a byte comparison and writes a two-space-indented `{ "files": [...] }` file with a trailing newline.
- The generator prints `created`, `updated` or `unchanged` and the number of files. The index is in `.gitignore`, so a fresh checkout must run `bun run data:index` before `bun run serve`.
- Every directory segment and `.json` basename must match `^[a-z0-9-]+$`; `DataDriven` refuses to boot otherwise.
- Every JSON object key must match `^[a-z0-9-]+$`. Numeric string keys are legal and appear in `game-config.damage.enemy-shape-damage` and in the `player.levels` string subtree.
- Accessor keys are file paths without `data/` or `.json`, with `/` replaced by `.`. `data/audio/bgm/strawberry-fields.json` becomes `audio.bgm.strawberry-fields`; `data/colors.json` becomes `colors`.
- An accessor resolves against the longest existing file prefix, then walks the remaining segments as object keys. A missing key throws; a missing file throws.
- `DataDriven.keyForDataPath` performs the same conversion for callers that hold a path from configuration, such as the BGM registry and the stage path.

## Section and object model

Stages and the map share one document shape:

```text
{
  "name": "<id>",
  "sections": [
    {
      "name": "<section-id>",
      "parent-section": "root" | "<section-id>",
      "position": { "x": <units>, "y": <units> },
      "objects": [ { "type": "<object-type>", "position": { "x": <units>, "y": <units> }, ... } ]
    }
  ]
}
```

Rules:

- Section positions are relative to their parent; `root` and unknown parents mean no offset.
- `resolveWorldPosition` sums the ancestors' positions.
- Object positions are local to their section.
- Object `size` is optional; tile objects default to 1×1, collectibles use their data `visual.size` or 0.5×0.5.
- A stage document also carries `description`, `name`, `display-name-key`, `big-fruit`, `type`, `theme`, `bgm` and `dialogue`; a map document carries `description`, `name`, `display-name-key`, `type` and `bgm`.
- For a stage, `name`, `sections`, `dialogue`, `big-fruit`, `bgm`, `display-name-key` and the objects are consumed. `StageBase` exposes `bgm` and `StageScene.enter` plays it, falling back to `name` when a stage declares no track. The stage-clear screen resolves `display-name-key` and falls back to the stage id. `type` and `theme` are unread.
- For a map, `name`, `sections` and the objects are consumed. `display-name-key` is consumed for map labels and area labels. Map `bgm` is unread; the map scene plays `world-map` by literal name.

Stage dialogue shape:

```json
{
  "dialogue": {
    "intro": [
      { "speaker": "Strawberry", "text": "dialogue.strawberry-fields.intro-1" },
      { "speaker": "Strawberry", "text": "dialogue.strawberry-fields.intro-2" }
    ]
  }
}
```

Sequence names are the `playSequence` ids. The stage scene plays `intro` once per scene instance. `text` is an i18n key; `speaker` is literal text.

Stage object types in shipped content:

| Category | Types used |
| --- | --- |
| Tiles | `platform`, `wall`, `slope`, `spike`, `ladder`, `pit`, `water`, `decorative` |
| Enemies | `triangle-patrol`, `square-patrol`, `hexagon-patrol`, `heptagon-patrol`, `triangle-shooter`, `square-shooter`, `pentagon-patrol` (with `is-boss`) |
| Collectibles | `coin`, `apple`, `heart`, `ammo`, `musical-note`, `moon`, `sun`, `earth`, `key`, `big-fruit`, `exit-door` |
| Control objects | `player-spawn`, `checkpoint`, `teleporter-marker`, `inner-teleporter`, `special-teleporter` |

`map-teleporter` and `key-door` are dispatchable kinds with no shipped stage data. `map-teleporter` is valid only in a stage document; the map reports and ignores it.

Stage object keys currently consumed:

| Key | Applies to | Meaning |
| --- | --- | --- |
| `type` | All | Kind resolution. |
| `position` | All | Local position in visual units. |
| `size` | Tiles, some collectibles | Box size; default 1×1 for tiles. |
| `name` | Teleporters, markers | Lookup name. |
| `target-marker` | Inner, special and map teleporters, key doors | Marker name; resolved through `Stage.getTeleporterMarker`. |
| `target-stage` | Special teleporter, key door | Scene id passed to the stage navigation seam. |
| `required-key` | Key door | Key name; `key:<name>` is checked in the inventory and kept. |
| `key-name` | Key collectible | Key name; pickup stores `key:<key-name>`. Also read from `effect` as a fallback. |
| `color` | Enemies | Palette name; index in `colors.color-order`. |
| `patrol-range` | Enemies | Patrol distance. |
| `is-boss` | Enemies | Selects `BossEnemy` and the boss size. |
| `damage-output`, `drop-table`, `fire-rate`, `projectile-speed`, `detection-range`, `hover-amplitude`, `hover-frequency` | Enemies | Behavior parameters. Shipped shooters declare range, rate and speed; `drop-table` entries declare `type` and `weight`. |
| `variant` | Tiles | Variant name in the tile data. |
| `inverted` | Tiles | Mirrors a slope diagonal horizontally. |
| `solid`, `deadly`, `damage-value`, `liquid`, `climbable`, `friction` | Tiles | Per-object overrides. |
| `visual.fill-color`, `visual.border-color`, `visual.border`, `visual.border-width`, `visual.rendered`, `visual.corner-radius` | Tiles, collectibles | Visual overrides. |
| `collectible` | Big fruit | Fruit name used for level-up and the stage-clear summary. |
| `note-order` | Musical note | 1-based note index. |
| `auto-use` | Collectibles | Overrides auto-use. |
| `fruit` | Collectibles | Fallback fill color name. |

Map object keys:

| Key | Applies to | Meaning |
| --- | --- | --- |
| `stage-id` | `stage-node` | Stage data id and scene key. |
| `state` | `stage-node` | Declared starting state; recomputed by `applyProgressToMapConfig`. |
| `unlock-condition` | `stage-node` | `{ type: "stage-complete", stage: "<id>" }` or `{ type: "key-required", key-name: "<name>" }`. |
| `display-name-key`, `display` | Nodes, area labels | Label text. |
| `from`, `to` | `path` | Node ids. |
| `visual.fill-color`, `visual.style` | `path` | Declared path styling; the renderer uses its own completed/not-completed colors and draws every path solid. |
| `name` | Area labels, markers | Identifier. |

`index` and any key not read by the selected kind are unused.

## Tiles

Per-type file shape:

```json
{
  "type": "platform",
  "description": "...",
  "visual": { "fill-color": "white", "border-color": "dark-white", "border": "medium", "rendered": true, "pattern": "rungs", "effect": "translucent" },
  "collision": { "solid": true, "walkable": true, "climbable": false, "surface-only": true, "slope-angle": null },
  "physics": { "gravity-multiplier": 0.3, "speed-multiplier": 0.5, "friction": 0.6, "bounciness": 0.0, "climb-speed": 0.5, "slope-types": { "slope-30": 30 } },
  "damage": { "on-contact": true, "value": 1.0, "cooldown": 0.5 },
  "variants": { "spike": { "fill-color": "red", "border-color": "dark-red", "damage": 1.0 } },
  "effect": { "action": "death", "trigger": "below-boundary" },
  "inverted": false
}
```

Consumed keys: `type`, `visual.fill-color`, `visual.border-color`, `visual.border`, `visual.rendered`, `visual.corner-radius`, `collision.solid`, `collision.climbable`, `physics.friction`, `physics.gravity-multiplier`, `physics.slope-types`, `damage.on-contact`, `damage.value`, `variants.<name>.damage`, `effect.action` and `inverted`. Inert keys include `walkable`, `surface-only`, `bounciness`, `speed-multiplier`, `climb-speed`, `damage.cooldown`, variant colors, `visual.pattern` and `visual.effect`.

Semantic notes:

- `decorative` declares `collision.solid: false`. It neither collides with the player nor stops a projectile.
- `pit` is non-solid and `rendered: false`; it does not by itself kill. Falling below the stage bounds triggers the respawn.
- `spike` is solid and deadly; `variants` supplies the damage value (`spike` 1, `danger` 2, `lava` 3).
- `water` is non-solid; a `gravity-multiplier` between 0 and 1 marks the tile liquid.
- `ladder` is non-solid and climbable; `gravity-multiplier: 0` does not mark it liquid because the value must be strictly between 0 and 1.
- `slope` declares `slope-types`; the named variant supplies `slope-angle`, and the tile size supplies the diagonal that collision and rendering use. The angle is used verbatim when `width × tan(angle)` equals the height within `1e-6`; otherwise the effective angle is derived from `width` and `height`. `inverted` mirrors the diagonal horizontally. The solid region is the wedge below the diagonal and the tile renders as a polygon.
- Strawberry Fields uses `slope-30` 5×3 and `slope-45` 5×3; Fruit Basket Citadel uses `slope-45` 4×2 and `slope-45` inverted 2×2. The catalog test asserts that every slope edge meets its adjacent platform.

## Enemies

`data/enemies/config.json`:

```json
{
  "size": 1,
  "boss-size": 3,
  "shape-map": { "triangle": 3, "square": 4, "pentagon": 5, "hexagon": 6, "heptagon": 7 }
}
```

A stage enemy type is `<shape>-<behavior>`. `parseEnemyConfig` splits on `-`, takes the first segment as the shape and the second as the behavior (default `patrol`), looks the shape up in `shape-map` (unknown shapes fall back to 3), maps the object `color` to its index in `colors.color-order` (unknown colors fall back to index 1), builds a resolved palette, and chooses the boss size when `is-boss` is true.

There is no per-enemy data file; all enemy parameters come from the stage object. The former per-enemy files were removed. `detection-range`, `fire-rate` and `projectile-speed` remain `null` in the normalizer when an object omits them, and a shooter with a null range never fires.

Enemy drop table shape:

```json
{
  "drop-table": [
    { "type": "coin", "weight": 3 },
    { "type": "heart", "weight": 1 },
    { "type": "earth", "weight": 1 }
  ]
}
```

`drop-table` is an array of `{ type, weight }` entries. `type` must name an existing `data/collectibles/<type>.json` file; `weight` must be a positive finite number. A non-empty table returns one entry on every kill, so the weights control relative rarity rather than a chance to drop. `drop-rate` and `drop-type` are not consumed.

Shipped tables:

| Stage | Enemy | Entries |
| --- | --- | --- |
| Blueberry Peaks | `hexagon-patrol` | coin 3, ammo 1 |
| Starfruit Caverns | `square-shooter` | ammo 3, heart 1 |
| Pitaya Canyon | `heptagon-patrol` | coin 3, heart 1, earth 1 |
| Pitaya Canyon | `hexagon-patrol` | coin 4, moon 1 |
| Fruit Basket Citadel | `hexagon-patrol` | coin 3, earth 1 |
| Fruit Basket Citadel | `heptagon-patrol` (x2) | coin 3, heart 1, sun 1 |

Strawberry Fields, Avocado Grove, Banana Beach and the Secret Waterfall branch declare no drop tables.

## Collectibles

Per-kind file shape:

```json
{
  "type": "coin",
  "description": "...",
  "visual": { "shape": "circle", "size": 0.5, "fill-color": "yellow", "border-color": "dark-yellow", "border": "thin" },
  "effect": {
    "action": "add-coins",
    "value": 1,
    "extra-life-threshold": 100,
    "auto-activate": false,
    "usage": { "action": "restore-health", "value": "full" },
    "note-sequence": ["C4", "D4"],
    "complete-bonus": "continue"
  },
  "inventory": { "accumulates": true },
  "placement": { "per-stage": 8 }
}
```

Consumed keys: `type`, `visual.size`, `visual.fill-color`, `effect.action`, `effect.value`, `effect.score`, `effect.duration`, `effect.auto-activate`, `effect.usage.action`, `effect.usage.value`, `effect.usage.duration`, `effect.usage.multiplier`, `effect.usage.damage`, `effect.usage.target`, `key-name` (object or effect) and `collectible`.

Inert keys: `visual.shape`, `visual.border-color`, `visual.border`, `visual.uses-fruit-color`, `visual.effect`, `effect.falls-back-to`, `effect.note-sequence` (note names come from the audio scale, not this array), `effect.complete-bonus`, `inventory.accumulates`, `placement.*` and `description`.

Key collectible shape:

```json
{
  "type": "key",
  "key-name": "secret-grove-key",
  "position": { "x": 14, "y": -1.5 }
}
```

The `key-name` is an object key on the stage object; the file `data/collectibles/key.json` supplies the visual and `effect.action: add-to-inventory`. Pickup stores `keyItemName(<key-name>)`, the shared `key:<name>` form also used by key doors and map unlocks.

Effect actions in data:

| Action | Files |
| --- | --- |
| `add-coins` | `coin` |
| `add-ammo` | `ammo` |
| `add-to-inventory` | `apple`, `heart`, `moon`, `sun`, `earth`, `key` |
| `level-up` | `big-fruit` |
| `collect-note` | `musical-note` |
| `complete-stage` | `exit-door` |

Usage actions:

| Item | `usage.action` | Parameters |
| --- | --- | --- |
| `heart` | `restore-health` | `value: "full"` |
| `moon` | `moon-gravity` | `duration: 30`, `multiplier: 0.4` |
| `sun` | `fire-shield` | `duration: 30` |
| `earth` | `earthquake` | `damage: 3`, `target: "ground-enemies"` |

## Player configuration

| File | Shape | Consumed |
| --- | --- | --- |
| `player/levels.json` | `levels.<color>.abilities[]` | Level to ability names; `applyLevelUp` sets required levels from this table and the stage-clear screen lists them. |
| `player/fruits.json` | `fruits.<fruit>.color` | Big-fruit name to target color and therefore target level. |
| `player/abilities.json` | `abilities.<name>.type` plus per-type parameters | Ability construction; the key supplies the ability name, `type` selects the class. |

The level table names `walk`, `jump`, `crouch`, `stomp`, `slide-attack`, `shield` and `slow-fall`. `crouch`, `slide-attack`, `shoot`, `flight` (which owns slow fall) and the other ability classes read their own parameters; the remaining names are descriptive labels for behavior owned by `Player`, `Stage` or `ShootAbility`. The level color order comes from `colors.color-order`.

## Audio

`audio/config.json` keys: `master-volume`, `bgm-volume`, `sfx-volume`, `sound-enabled`, `bgm-enabled`, `sfx-enabled`, `bgm-crossfade-duration`.

`audio/synthesis.json` keys consumed: `tuning.reference-note`, `tuning.reference-frequency`, `tuning.note-range.lowest`, `tuning.note-range.highest`, `musical-note-scale`, `default-envelope`. The note tracker maps collection order N to the Nth `musical-note-scale` entry; the tracker's own `lowest` and `count` fields are the fallback when no scale is supplied. `wave-types`, `temperament` and `polyphony-limit` are documentation only.

`audio/bgm.json` maps a track name to a file path. `App.start` loads every listed track eagerly.

Track shapes:

| Shape | Required keys | Example files |
| --- | --- | --- |
| Legacy single channel | `bpm`, `notes`; optional `wave`, `volume` | `world-map`, `avocado-grove`, `banana-beach`, `blueberry-peaks`, `starfruit-caverns`, `pitaya-canyon`, `fruit-basket-citadel`, `secret-waterfall`, `stage-clear` |
| Channel object | `bpm`, `channels.<name>.notes`; optional per-channel `wave`, `volume`, track `phrases` | `title-screen`, `strawberry-fields` |

A note entry is either a string phrase reference or a `[name, beats]` tuple. Names are note names (`c4`, `a#3`) or `rest`. The finite-value policy is documented in [architecture/engine-layer.md](architecture/engine-layer.md#audio).

Track names and callers:

| Track | Played by |
| --- | --- |
| `title-screen` | `TitleScene.enter`. |
| `world-map` | `MapScene.enter`. |
| `strawberry-fields` … `fruit-basket-citadel` | `StageScene.enter` using the stage `name`. |
| `secret-waterfall` | `StageScene.enter` for `starfruit-caverns-branch`, whose declared `bgm` is this track. |
| `stage-clear` | No caller. The stage-clear sound is an SFX, not this track. |

`StageScene.enter` plays `stage.bgm ?? stage.name`. The seven main stages declare a `bgm` equal to their `name`; `starfruit-caverns-branch` declares `secret-waterfall`, so the branch plays that registered track.

`audio/sfx.json` holds `sounds.<name>` with `wave`, `freq` (number or `null`), `duration` and an optional partial `envelope`. A sound with `freq: null` requires a note-name override at the call site.

Audio settings are not data: they are stored in `localStorage` under `settings` with schema version 1 and are documented in [architecture/engine-layer.md](architecture/engine-layer.md#audio-settings) and [architecture/application-layer.md](architecture/application-layer.md#audio-settings-flow).

## Input bindings

`data/input/bindings.json`:

- `actions.<name>` holds an optional `label-key`, `keyboard.primary`, `keyboard.secondary`, `gamepad.primary` and `gamepad.secondary`.
- Keyboard values are `KeyboardEvent.code` names; gamepad values are `dpad-<direction>`, `left-stick-<direction>` or a `button-<n>` key that resolves through `gamepad.button-map`.
- `gamepad` holds `dead-zone`, `axis-threshold`, `button-count`, `button-map.<name>.index` and `axis-map.<name>.index`. Current data declares `button-count: 16`, matching the 16 button-map entries.
- Stick directions resolve against their own axis (`<stick>-x` for horizontal and `<stick>-y` for vertical), and `axis-threshold` is the minimum positive projection that activates an analog direction. See [architecture/engine-layer.md](architecture/engine-layer.md#input).
- The player-facing binding list is in [gameplay.md](gameplay.md#controls).

## Strings, colors and borders

- `i18n/default.json` is a symbolic link to `i18n/en-us.json` and is the accessor the game reads. It is a nested object of string leaves; keys are addressed as `<path>` segments joined by `.` by `TextResolver`; a missing key renders as the key itself and warns once.
- `player.abilities.*` includes display names for every configured ability, including `stomp` and `slide-attack`; `fruits.*` names each big fruit. Both are read by the stage-clear summary. `i18n-contract.test.js` asserts that every level/config ability and fruit resolves, and that the removed keys `collectibles.star`, `collectibles.checkpoint`, `collectibles.extra-life`, `hud.stars` and `messages.checkpoint-activated` are absent.
- i18n subtrees with no reader: `musical-notes`, `messages`, `teleporter`, `player.levels` and `collectibles`. `meta` is also unread.
- `i18n/en-us.json` is the physical file behind both names; the index lists both and the code reads the `default` accessor.
- `colors.json` declares `colors.<name>.dark` / `.light` and `color-order`. A bare name resolves to the light variant; a `dark-` prefix resolves to the dark variant. A literal `#RRGGBB` string passes through; an unknown name resolves to `null`, and callers apply their own fallback.
- `borders.json` declares `default` and `borders.<name>.width`. Only `thin`, `medium` and `thick` are used by shipped content.

## UI configuration

`ui/menus.json`:

- `menu-defaults` supplies `overlay`, `font-family`, `title`, `subtitle`, `button`, `hint` and `layout`.
- `layout` supplies `title.offset-y`, `title.font-size-offset`, `items.start-y`, `items.gap`, the item `selected-prefix`, `selected-suffix`, `default-prefix` and `default-suffix`, `rows.font-size` and `rows.gap`; `rows.<name>.offset-y` positions the game-over and stage-clear rows. The settings screen consumes the title, item and row values.
- `menus.<screen>` supplies `title-key`, `buttons[]`, optional `sliders[]`, `hint-key`, `subtitle-key`, `start-offset`, `overlay-opacity`, `layout-overrides` and a per-screen `button` override.
- `layout-overrides` merges over `menu-defaults.layout` block by block (`title`, `items`, `rows`), so a screen can move one row without restating the rest.
- Consumed button keys: `label-key` (or `label`), `action` and `visible-condition`. `visible-condition` names an entry in the condition map injected into `Menu`; a hidden item is skipped by navigation, is not rendered and cannot be confirmed.
- `info-screens.<name>` supplies `title-key`, `lines[]`, `line` style, `hint-key` and `start-offset`.
- Consumed slider keys: `label-key`, `setting-key`, `min`, `max`, `step`, `track-size`, `track-color`, `fill-color`, `thumb-radius`, `thumb-color`, `corner-radius`.
- Inert keys: `description`, the per-screen `layout` string (the renderer selects its layout by screen class, not by this value), `summary`, `title.anchor` and the button `anchor`.

`ui/hud.json`:

- `hud` consumed: `enabled`, `height`, `background.color`, `background.opacity`, `border.style`, `border.color`, `text.font-family`, `text.label-size`, `text.value-size`.
- Elements consumed: `life-bar` (`offset`, `size`, `corner-radius`, `fill-color`, `empty-color`), `level-indicator` (`offset`, `label-color`), `ammo-counter` (`offset`, `icon-color`), `coin-counter` (`offset`, `icon-size`, `icon-color`, `label-color`), `score-counter` (`offset`, `label-color`), `note-tracker` (`offset`, `filled-color`, `empty-color`, `slot-size`, `slot-gap`), `inventory-indicator` (`anchor`, `offset`, `size`, `border`, `border-color`, `corner-radius`, `fill-color`, `item-color`, `count-color`, `label-key`, `label-offset`, `label-color`).
- Every element honors `enabled`; the whole HUD honors `hud.enabled`.
- `star-counter` was removed from the data and the renderer.
- Inert: `hud.position`, `hud.padding`, `hud.text.color`, `hud.border.corner-radius`, most element `anchor` values, `show-icon`, `show-label`, `label-key` outside the inventory indicator and the per-element `label-offset` outside the inventory indicator.

`ui/inventory.json` consumed: `inventory.font-family`, `columns`, `rows`, `overlay.background-color`, `title`, `slot.size.width`, `slot.gap`, `slot.grid-offset`, `slot.corner-radius`, `slot.filled-fill-color`, `slot.border-color`, `slot.selected-border-color`, `item.name-*`, `item.count-*`, `empty-slot.*`, `footer.hints[]` and `footer.offset`. Inert: overlay border and padding, slot empty fill and default-marker keys, item icon keys.

`ui/dialogue.json` consumed: `dialogue.enabled`, `margin`, `height`, `max-height`, `max-width`, `padding`, `font-family`, `box`, `speaker`, `text`, `hint`, `typewriter.characters-per-second`. `anchor` is declared but the engine always bottom-anchors.

## Validation

`bun run validate` runs `scripts/validate-data.js` and reports one line per problem.

| Check | Failure kind |
| --- | --- |
| Every `.json` file under `data/` parses. | Error |
| `data/index.json` exists, has a `files` array, has no duplicate or non-string entry, lists no missing file and omits no file on disk. | Error |
| `game-config` contains every key read at boot (visual unit, canvas percent, loop rate, tile types, initial stage, save namespace, physics keys, player keys, health keys, damage keys, projectile keys). | Error |
| Every declared tile type has `data/tiles/<type>.json` whose `type` matches the declaration. | Error |
| The slope tile file declares a valid `collision.slope-angle` or null and a `physics.slope-types` object with every angle between 0 and 90 degrees; every stage slope declares a positive width and height, a variant present in `physics.slope-types` and, when present, a boolean `inverted`. | Error |
| Every BGM registry entry points at an existing file, and each track has a channel object or a legacy `notes` array; each channel has a `notes` array. | Error |
| The initial stage file exists. | Error |
| Every map `stage-node` has a non-empty `stage-id`; a missing stage file is a warning when the node is `locked` and an error otherwise. | Error or warning |
| Every text-key field in `data/ui/**`, `data/stages/**` and the map resolves in `data/i18n/default.json`. | Error |
| Every stage enemy `drop-table` is an array of objects with a string `type` naming an existing `data/collectibles/<type>.json` file and a positive finite numeric `weight`. | Error |
| Every color-valued key in every data file is a palette name, a `dark-` palette name or a CSS color literal. | Error |
| The palette and the boot configuration are present. | Error |

Current result: 57 data files, 0 errors, 0 warnings. Every map node now has stage data, so the former locked-node warnings are gone.

The validator does not check enemy behavior names, object types, effect actions, required stage fields beyond those listed, or the map's `unlock-condition` variants.

## Data without a consumer

| Data | Status |
| --- | --- |
| Stage `theme` and `type` | Loaded; never read. |
| Map `bgm` | Loaded; never read; the map scene plays `world-map` by literal name. |
| `data/audio/bgm/stage-clear.json` | Loaded into the BGM map; no caller plays the track. |
| Path `visual.style` | Loaded; every path is drawn solid, and the completed color is computed from node state. |
| Menu `summary`, `description` and the per-screen `layout` string | Loaded; never read. Layout values come from `menu-defaults.layout` and `layout-overrides`. |

## Known issues in the data model

- Several declared keys are inert (per-subject lists above), so editing them changes nothing. The most visible are collectible `shape` and border colors, tile `walkable`, `surface-only` and speed multiplier, menu `summary` and `layout`, and HUD per-element label keys outside the inventory indicator.
