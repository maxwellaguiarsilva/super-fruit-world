# Agent Documentation

Documentation set for agents working on `super-fruit-world`. Every statement in this set was verified against the source tree and the data tree on 2026-10-24. Statements about behavior that could not be verified by reading code are labeled, and browser observations are attributed to the run recorded in [testing.md](testing.md#verification-status).

## State of the project

- Eight playable stages: Strawberry Fields, Avocado Grove, Banana Beach, Blueberry Peaks, Starfruit Caverns, Pitaya Canyon, Fruit Basket Citadel and the key-gated Secret Waterfall branch.
- A world map with eight stage nodes, all with stage data; the chain is completion-gated and Secret Waterfall is unlocked by the `secret-grove-key` item.
- Movement abilities through dash, crouch, slide attack, flight, double jump and air slide; combat abilities through shooting, shield, stomp, screen clear and invincibility.
- Inventory items with effects: heart, moon, sun and earth; keys persist as `key:<name>` inventory entries and are never consumed by the use path.
- Zero life from damage spends one life and respawns at the active checkpoint; the last life reaches the game-over screen.
- Teleporters are stage features with one `canActivate`/`activate` contract; the map declares none.
- Fixed-step simulation at `loop.update-rate` (60), with a deterministic `tick(timestamp)` seam; update and render exceptions are contained and reported once without stopping the loop.
- Input resolves each stick direction against its own axis, enforces the analog threshold and honors combo hold time.
- Automatic persistence through `localStorage`: completed and unlocked stages, the last stage, score, player level, inventory and keys, plus a separate versioned audio-settings record. A reload resumes at the map; failed reads and writes are reported once per operation and key without throwing into gameplay.
- `bun test`: 666 passing tests across 63 files, 2521 assertions.
- `bun run validate`: 57 data files, 0 errors, 0 warnings.
- `bun run check:layers`: 73 source files, 0 violations.
- `bun run smoke`: passes; the page boots, the canvas renders, Enter reaches the stage, and no console error or uncaught exception is recorded.
- `bun run verify:stages`: 8 stages, 8 passed, 0 failed; every stage enters through the map with a HUD and its first intro line.
- Runtime is plain ES modules served statically. No bundler, no runtime dependency; `playwright-core` is the only development dependency and is used by the smoke test and the stage verification command.

## Document taxonomy

| Class of subject | Destination | Indexing | Scope |
| --- | --- | --- | --- |
| Layer architecture | `architecture/` | One file per layer, listed in the index table below. | How a layer is organized, what it may import, which objects it constructs and in what order. |
| Cross-cutting subject | Repository root of `docs/agent/` | One file per subject, listed in the index table. | Content shape, player-visible behavior, verification, and settled decisions. Those four subjects own root-level files today. |
| Developer tooling | `tooling/` | `tooling/README.md` indexes the commands; each non-trivial tool gets its own sibling file. | Executable commands, their inputs, outputs, exit codes and constraints. |
| Forward-looking work | `roadmap/` | Exactly two files: the inventory and the ordered plan. | Open problems and their ordered remediation. Never describes current behavior. |

Placement rules:

- If the subject is how code is organized, it belongs under `architecture/` and names the layer it covers.
- If the subject is the shape or validation of content under `data/`, it belongs in `data-model.md`.
- If the subject is what a player experiences, it belongs in `gameplay.md`.
- If the subject is how the project is checked, it belongs in `testing.md`.
- If the subject is a choice already implemented, it belongs in `decisions.md`.
- If the subject is a command or a developer executable, it belongs under `tooling/`.
- If the subject is unresolved, it belongs under `roadmap/` and nowhere else.

A new subject takes exactly one new file in exactly one of those destinations, is added to the index table below, and is placed in the reading order.

## Index

| Document | Subject |
| --- | --- |
| [architecture/application-layer.md](architecture/application-layer.md) | Layer boundaries, dependency rule, layer check, boot sequence with settings restore and map unlock, stage and map loading flows, action table, audio-settings flow, persistence flow, screen ownership, `src/app/` inventory, application-layer known issues. |
| [architecture/engine-layer.md](architecture/engine-layer.md) | Renderer including text measurement, camera, input manager, physics with the gravity multiplier, slope surface, collision solver, fixed-step loop, audio engine, audio settings, data layer, save system, text resolver, dialogue engine, dependency contract, UI element base. |
| [architecture/game-layer.md](architecture/game-layer.md) | Stage base and bounds, entity model, stage pipeline, tiles and slopes, enemies, collectibles, projectiles, abilities, teleporter contract, systems including item effects, map stage, scenes, UI components. |
| [data-model.md](data-model.md) | `data/` tree by subject, generated index, key conventions, section and object model, the eight stages, key collectible shape, tile/enemy/collectible/audio/UI configuration shapes, slope fields, validation rules, data without a consumer. |
| [gameplay.md](gameplay.md) | Controls, movement, ability table with inputs, inventory items and effects, keys, HUD, health and lives, coins, fruits and levels, ammo, checkpoints, slopes, teleporters, stage completion, persistence, the eight stages and the world map. |
| [decisions.md](decisions.md) | Recorded architecture and product decisions with context, decision, consequence and evidence. |
| [testing.md](testing.md) | Test suite layout, coverage by subject, smoke assertions, stage verification, layer check, validator behavior, browser verification status and gaps. |
| [tooling/README.md](tooling/README.md) | `serve`, `data:index`, `validate`, `check:layers`, `test`, `smoke`, `verify`, `verify:stages` and `format-4-beat-music`: what each does, exit codes, failure meaning, no-bundler constraint. |
| [tooling/music-format-cli.md](tooling/music-format-cli.md) | The Bun BGM reformatting CLI: invocation, input shape, behavior, exit codes, output location. |
| [roadmap/opportunities.md](roadmap/opportunities.md) | Current improvement inventory, including the resolved ledger and the open opportunities with evidence. |
| [roadmap/next-steps.md](roadmap/next-steps.md) | Completed step ledger, delivered N-plan outcomes and the remaining ordered plan, with acceptance criteria. |

## Reading order

1. This file: taxonomy, index, conventions and state of the project.
2. [architecture/application-layer.md](architecture/application-layer.md): establishes the layers and the only legal dependency directions.
3. [architecture/engine-layer.md](architecture/engine-layer.md): the primitives every other layer builds on.
4. [architecture/game-layer.md](architecture/game-layer.md): the domain objects and the stage pipeline.
5. [data-model.md](data-model.md): the content shapes those objects are constructed from.
6. [gameplay.md](gameplay.md): the player-visible result of the previous four documents.
7. [testing.md](testing.md): what is verified, how, and what is not.
8. [decisions.md](decisions.md): why the current structure was chosen.
9. [tooling/README.md](tooling/README.md) and [tooling/music-format-cli.md](tooling/music-format-cli.md): how to run and check the project.
10. [roadmap/opportunities.md](roadmap/opportunities.md) and [roadmap/next-steps.md](roadmap/next-steps.md): what is still open and in which order to address it.

## Conventions

- One canonical subject per file. A file is named after its subject, not after a step, a date or a defect.
- Documents describe the system as it exists. Unresolved behavior is listed under a `Known issues` heading in the document that owns the affected layer or subject, and in the roadmap. Each issue appears in exactly one current-behavior document; other documents link to it instead of repeating it.
- Every factual claim is verified against code or data. A claim that could not be verified is either omitted or explicitly marked as unverified.
- Verification labels: `Browser-verified` means observed in the recorded browser run; `Code-verified` means established by reading the implementation or by executing the automated checks.
- Module paths are cited without line numbers, because line numbers change without changing the subject.
- English (US) only.
- No artificial line wrapping; tables and bullet trees are preferred over prose.
- Links between documents are relative and point at the canonical document for the subject, never at an anchor that duplicates another document's content.
- The roadmap never describes current behavior; the current behavior documents never prescribe work. Work that is not yet done appears only in `roadmap/`.
