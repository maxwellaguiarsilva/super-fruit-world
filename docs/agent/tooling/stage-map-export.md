# Stage Map Export

Subject: the semantic stage-map exporter behind `bun run export:stage-maps`, which writes schematic images and manifests that a vision-capable LLM can read during a visual review. The static geometry check is [playability-validation.md](playability-validation.md); the command list is [README.md](README.md).

## Invocation

| Form | Meaning |
| --- | --- |
| `bun run export:stage-maps` | Runs the command through the declared `package.json` script. |
| `bun scripts/export-stage-map.js` | Runs the script directly. |
| `--stage <id>` | Exports only the named stage. Repeatable. |
| `--out <dir>` | Output directory relative to the repository root. Default: `out/stage-maps`. |
| `--scale <px>` | Pixels per world unit for the fixed-scale views. Default: `24`. |
| `--max-size <px>` | Maximum image width and height. Default: `1400`. |
| `--help`, `-h` | Prints usage and exits without exporting. |

Value options also accept the equals form, such as `--stage=strawberry-fields`. There are no positional stage ids. An unknown option, a missing value, a non-positive number or a non-integer `--max-size` prints an error plus the usage text and exits `1`.

## Modules

| Module | Role |
| --- | --- |
| `scripts/export-stage-map.js` | CLI parsing, stage selection, output tree, manifest and index assembly, browser rasterization and summary. |
| `scripts/stage-analysis/chunks.js` | Stage bounds, chunk layout, overlap, content-band cropping and pixel sizing. |
| `scripts/stage-analysis/render.js` | Standalone SVG for the overview and for each chunk, including legend, grid, labels and finding badges. |
| `scripts/stage-analysis/model.js` | Loads and normalizes the stage, tile, collectible, enemy and game configuration data. |
| `scripts/stage-analysis/checks.js` | Produces the static findings embedded as badges in the images and in the manifest. |

## Output tree

```text
out/stage-maps/
├── index.json
└── <stage-id>/
    ├── manifest.json
    ├── overview.png
    ├── overview.svg
    ├── chunk-00.png
    ├── chunk-00.svg
    └── ...
```

- `out/` is gitignored; the exporter writes only below the selected output directory.
- `index.json` lists every exported stage in id order with `generatedAt`, each stage `id`, `bounds`, `images` and `findingCounts`.
- Each stage `manifest.json` carries `stage`, `bounds`, `playerSize`, `scale`, `staticFindings` from `analyzeStage`, `sections` and `images`.
- Each manifest image entry carries `file`, `svg`, `kind`, `world`, `scale`, `pixelWidth` and `pixelHeight`.
- Every image is written twice: a PNG rasterization and the standalone SVG source.

## What the images encode

The images are a schematic, not the game render. They show geometry and semantics that the canvas leaves implicit.

| Semantic | Encoding |
| --- | --- |
| Platform, wall | Filled rectangular boxes. |
| Slope | Wedge with the walkable surface drawn on the diagonal. |
| Spike | Spike glyph. |
| Pit | Translucent magenta region with a dashed outline and label; the tile is invisible in the game. |
| Water, ladder, decorative | Distinct fills and glyphs. |
| Spawn | Spawn glyph. |
| Exit | Diamond. |
| Checkpoints | Flag glyph. |
| Collectibles | Icon only for coin, ammo, apple, heart, moon, sun and earth; note, key and big fruit are labeled in chunks. |
| Enemies | Polygon with a `P`, `S`, `F` or `B` letter for patrol, shooter, flyer or boss. |
| Teleporters | `T`. |
| Markers | `M`. |
| Sections | Separator lines and section names. |
| Coordinates | World-coordinate grid and axis labels. |
| Legend | Swatches for every semantic above. |
| Static findings | `E<n>` error and `W<n>` warning badges from `analyzeStage`. |

Labels are rendered in an overlay above the icons, so an icon or geometry never hides a label. A label can still cover part of an icon in a dense cluster.

## Views

- One overview covers the full stage and fits inside `--max-size` for the shipped stages.
- Each chunk uses the fixed `--scale`; chunk X ranges overlap by 2 world units so an object crossing a boundary appears whole in both views.
- Each chunk crops its Y range to the content of its core X range, with a 2-unit margin and a 10-unit minimum height.
- The overview suppresses teleporter, marker, note, key and big-fruit text labels; chunks keep them.
- Section separators and names appear where the layout declares sections.

## Requirements

- `playwright-core` installed (`bun install`).
- A Chromium build available to Playwright, or `CHROMIUM_EXECUTABLE_PATH` pointing at a browser binary.
- The launch helper is `scripts/smoke/browser.js`, shared with the smoke test and stage verification.
- If the browser is missing, the printed hint is `bunx playwright@1.64.1 install chromium`.

## Current result

`bun run export:stage-maps` on the shipped tree: `Stage map export: 8 stages, 29 images, 0 failed.`

The exporter is advisory:

- Findings never fail the export; they are written into the manifest and drawn as badges.
- The command is not part of `bun run verify`.
- A failed rasterization, manifest write or browser launch exits `1`; a stage with static findings still exits `0`.
- `playwright-core` is a development-only dependency, and the exporter writes outside the runtime graph, so the no-bundler constraint is unchanged.

## Tests

- `test/export-stage-map.test.js`: 42 tests covering the pure chunk layout, SVG semantics, label placement, manifest builders, argument parsing and the output-directory guard.
- Rasterization itself is exercised by running the command; the unit suite does not launch a browser.
- Coverage and current results are summarized in [../testing.md](../testing.md).

## Recommended visual-review workflow

- Run the exporter, then read `out/stage-maps/index.json` to list the stages and their image counts.
- Open the overview for global layout and the relevant chunks for detail.
- Cross-reference `manifest.json` for world coordinates, section names and static findings.
- Report the stage id, chunk file, section and world coordinates for every observation.

Check each of the following during the review:

- Every exit appears reachable in the image from the spawn without crossing a pit or a spike; this is a visual observation, not a play-through proof.
- Key, big fruit, notes and checkpoints sit on standable surfaces.
- Gaps and ledges respect the player's jump envelope.
- No collectible is inside a wall or a slope wedge, or below the geometry.
- Teleporters and markers line up.
