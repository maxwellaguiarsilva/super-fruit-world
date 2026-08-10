# slope-collision — tech-debt #22 (substack of root, depth 1)

## Session frame

- **Active Role:** loop-worker
- **Stack Depth:** 1
- **Active Mandate:** Implement slope collision (tech-debt #22)
- **Target Artifact:** code — `src/engine/physics/collision-solver.js`, `src/engine/renderer/renderer.js`, `src/game/entities/tile.js`, `src/game/stages/stage.js`

## Mandate Details

### Context

- Read first (files): `src/engine/physics/collision-solver.js`, `src/engine/physics/physics-engine.js`, `src/engine/renderer/renderer.js`, `src/game/entities/tile.js`, `src/game/stages/stage.js` (collision loop ~217-258), `src/main.js` (`resolveTileType` ~55-89), `src/game/utils/tile-overlap-validator.js`, `data/tiles/slope.json`, `data/stages/strawberry-fields.json` (`slope-practice` section), `src/engine/entities/entity.js`, `src/game/entities/player.js`.
- Read first (docs): `docs/agent/compliance-rules.md`, `docs/agent/technical-debt.md` (#22), `docs/agent/multi-session-flow/context-hygiene.md` (R7 budget).

### Goal

Make slope tiles (`data/tiles/slope.json`, variants `slope-30/45/60` in `data/stages/strawberry-fields.json` `slope-practice`) behave as angled collision surfaces: the landing `y` of a player/enemy resting on a slope interpolates along the slope face instead of the flat AABB top, and slopes render as angled wedges instead of plain rectangles.

### Scope

- In scope:
  - `collision-solver.js` — slope-aware resolution using the tile's `slope-angle` (+`inverted`), so the resolved top contact `y` follows the angled face based on the movable's x within the tile. Keep AABB behavior for non-slope tiles unchanged.
  - `renderer.js` — add a triangle/wedge drawing primitive (geometric style, matching `drawRect`/`drawPolygon`).
  - `tile.js` — render slopes as wedges (current `if (this.#isSlope)` branch is identical to the else branch — also fixes R1.1 rendering debt by using the resolved colors already in config).
  - `stage.js` — pass the slope metadata (angle/inverted/size) to `resolveCollision` instead of only the plain AABB box.
  - Verify the `slope-practice` section is walkable both directions (non-inverted slope-30 up, inverted slope-45 down) with the `slope-practice` coins/notes reachable.
- Out of scope (do NOT do): enemy AI (#23), world map wiring (#9), other tiles' behavior, `physics-engine.js` friction/gravity tuning, `data/` geometry redesign. Do not touch `tile-overlap-validator.js` unless slope AABB overlaps are newly flagged (then report, do not change BL-1 semantics).

### Constraints

- Compliance rules: R1.1 (single source of truth — slope angle flows from `data/tiles/slope.json` `slope-types` via `resolveTileType`; do not hardcode 30/45/60 in code), R1.2 (engine stays game-agnostic: slope *rendering/collision* primitives live in engine; the game layer passes config in), R1.3 (no globals), R1.4 (no silent fallback — throw on missing `slope-angle` when `isSlope`), R2.1 (no new hardcoded literals/colors), R4.2 (no dead code), R5.1 (update docs in this session).
- Role constraints: loop-worker executes code/doc changes only within this mandate.
- Do not touch: `src/engine/physics/physics-engine.js`, `src/engine/audio/`, `src/game/systems/`, `data/` stage geometry, `src/main.js` wiring (unless strictly needed to expose `slope-angle`; prefer no changes there).

### Output Expectation

- Implement in the listed code files; do NOT create a standalone report file.
- State explicitly on pop what was done and what was deliberately NOT done.
- Register any newly discovered debt in `docs/agent/technical-debt.md`.

### Verification

- `bun build src/main.js --target=browser` succeeds.
- cpp_code_verifier on all changed `.js` files: no formatting violations.
- Mock-renderer + mock-collision harness: assert slope top contact y interpolates along the angle for sample x positions, inverted and non-inverted, and that non-slope AABB resolution is unchanged (regression).
- `git diff` reviewed: only intended files changed.

## Stack History / Return Context

- Level 0 (orchestrator): Main control loop active. Prior sessions resolved debts #5/#13/#18/#20/#21/#17/#19. Delegating #22 (slope collision) to loop-worker. Remaining open debt after #22: #23 (enemy AI), #9 (world map), plus items 1/2/3/8/11/12/14/15/16.
- Parent: `index.md` (root). Pop restores the orchestrator frame.
