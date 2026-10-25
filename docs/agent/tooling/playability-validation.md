# Playability Validation

Subject: the static geometry check behind `bun run validate:playability`, which reports stage placements that cannot be collected or used without simulating movement. The visual companion is [stage-map-export.md](stage-map-export.md); the command list is [README.md](README.md).

## Invocation

| Form | Meaning |
| --- | --- |
| `bun run validate:playability` | Runs the command through the declared `package.json` script. |
| `bun scripts/validate-playability.js` | Runs the script directly. |
| `--stage <id>` | Validates only the named stage. Repeatable. |
| `--stage=<id>` | Equals form of the same option. |
| `--help`, `-h` | Prints usage and exits without validating. |

There are no positional stage ids. An unknown option or a missing `--stage` value prints `error:` plus the usage text and exits `1`.

## Modules

| Module | Role |
| --- | --- |
| `scripts/validate-playability.js` | CLI parsing, stage selection, finding output, summary and exit code. |
| `scripts/stage-analysis/model.js` | Loads the stage, tile, collectible, enemy and game configuration data into normalized layouts; resolves world positions, hitboxes and tile classification. |
| `scripts/stage-analysis/checks.js` | Runs every geometry and reachability check through `analyzeStage` and `analyzeLayouts`. |

## Inputs

All inputs are read-only; the command writes no file.

| Path | Use |
| --- | --- |
| `data/stages/*.json` | Stage sections, objects, spawns, checkpoints, teleporters, markers, collectibles and enemies. |
| `data/tiles/*.json` | Tile collision, damage, slope, liquid and climbable configuration. |
| `data/collectibles/*.json` | Collectible visual size when a stage object does not declare one. |
| `data/enemies/config.json` | Enemy and boss size. |
| `data/game-config.json` | Player size. |

## Coordinate and size model

- A world position is the sum of the section offsets and the object position; section positions are relative to their parent.
- The y axis grows downward.
- Entity positions are the top-left corner of their box.
- The effective collectible hitbox is 0.5×0.5 unless the stage object or the collectible data declares an object `size` with a numeric `width`; then that width is used and a missing height falls back to 0.5.
- The player size comes from `game-config.player.size`; the shipped value is 1.
- Tiles are classified through `resolveTileType` in `src/app/content/tile-config.js`, the same owner the runtime uses, so solid, deadly, liquid, climbable and slope flags agree with gameplay.
- A slope is the solid wedge below its diagonal. The check applies the same declared-versus-derived diagonal rule as `src/engine/physics/slope-surface.js`, so a box that only overlaps the empty part above the diagonal is not reported.

## Checks

Every finding is an error except `reachability-skipped`.

| Code | Severity | Meaning |
| --- | --- | --- |
| `collectible-embedded-in-solid` | Error | The collectible box overlaps a solid tile, including the solid wedge of a slope. |
| `collectible-in-deadly-tile` | Error | The collectible box overlaps a deadly tile such as a spike or a pit. |
| `collectible-below-geometry` | Error | The collectible is entirely below the tile bounds. |
| `collectible-outside-geometry` | Error | The collectible is entirely outside the tile bounds horizontally. |
| `collectible-unreachable-region` | Error | The flood fill cannot place the player box on the pickup. |
| `spawn-in-solid` | Error | The player box at the spawn overlaps a solid tile. |
| `spawn-in-deadly` | Error | The player box at the spawn overlaps a deadly tile. |
| `spawn-missing` | Error | The stage declares no `player-spawn`. |
| `checkpoint-unusable` | Error | The checkpoint activation cell overlaps a solid or deadly tile. |
| `teleporter-in-solid` | Error | The teleporter cell overlaps a solid or deadly tile. |
| `teleporter-marker-in-solid` | Error | The marker cell overlaps a solid or deadly tile. |
| `enemy-in-solid` | Error | The enemy box overlaps a solid tile. |
| `reachability-skipped` | Warning | The grid would exceed 2,000,000 cells, or no free cell matches the spawn; collectible reachability is not evaluated. |

## Reachability model

- Grid step: 0.25 world units.
- Player box: the configured `player.size` (shipped 1×1).
- Flood fill: 8-neighbor from the spawn cell, no corner cutting.
- Blocking: solid non-slope tiles block, including solid deadly spikes; non-solid deadly pits do not block; slopes, liquids and ladders do not block.
- Pickup test: a collectible is reachable when any reachable cell places the player top-left inside `[c.x - playerSize, c.x + c.width] × [c.y - playerSize, c.y + c.height]` and the player box overlaps the pickup.
- The flood fill over-approximates movement: it treats every free cell as connected regardless of gravity, jump height or momentum.

## Output and exit codes

- One line per finding in the form `error: <stage>: <message>` or `warning: <stage>: <message>`.
- Pass summary: `Playability validation passed: <n> stages, 0 errors, <w> warning(s).`
- Fail summary: `Playability validation failed: <n> stages, <e> error(s), <w> warning(s).`
- Exit `0` only when there are no errors; warnings do not fail the command.
- Exit `1` on any error, an unknown stage id, an unreadable data tree or an argument error.

## Current result

`bun run validate:playability` on the shipped tree: 8 stages, 5 errors, 0 warnings, exit `1`.

| Code | Object | World position | Detail |
| --- | --- | --- | --- |
| `collectible-embedded-in-solid` | coin | (98.5, -12) | Overlaps the solid platform box (97, -15, 3, 10). |
| `collectible-embedded-in-solid` | apple | (98.5, -8) | Overlaps the same platform box. |
| `collectible-embedded-in-solid` | musical-note | (159, -21) | Overlaps the solid wedge of slope `slope-45` box (155, -22, 5, 3). |
| `collectible-unreachable-region` | coin | (98.5, -12) | Not reachable from the spawn at (3, 0). |
| `collectible-unreachable-region` | apple | (98.5, -8) | Not reachable from the spawn at (3, 0). |

All five findings are in Strawberry Fields and span three optional pickups. The seven other stages have no findings. The exit-door is checked as a collectible and receives no reachability finding, but the fill is an over-approximation of movement, so this is not a play-through proof; `test/stage-catalog.test.js` asserts exactly one exit-door per stage.

## Limits

- No jump, dash, double-jump or flight graph is modeled.
- The flood fill over-approximates movement and is not a proof of reachability.
- Enemy AI is not simulated.
- Teleporter traversal is not simulated.
- Musical-note order is not validated.
- Exit-door presence is covered by `test/stage-catalog.test.js`, not by this command.

## Tests

- `test/validate-playability.test.js`: 31 tests covering layout normalization, tile classification, argument parsing, every finding code including `spawn-missing` and `reachability-skipped`, slope wedges, the reachability grid and the shipped tree.
- The command is not part of `bun run verify`; run it separately when stage geometry changes.
- Coverage and current results are summarized in [../testing.md](../testing.md).
