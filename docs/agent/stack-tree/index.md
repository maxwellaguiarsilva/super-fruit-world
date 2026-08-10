# Stack-Tree Root

The stack-tree is the contract's single persistent state: a flat folder of markdown nodes starting at this file. The hierarchy is carried by links, never by subfolders. Keep every node (including this one) under ~200 lines; if a node outgrows that, split its stack into a substack.

## Current path (breadcrumb)

- Level 0 (orchestrator) → Level 1 (loop-worker): [slope-collision.md](slope-collision.md) *(active)*

## Session frame

- **Active Role:** loop-worker
- **Stack Depth:** 1
- **Active Mandate:** Implement slope collision (tech-debt #22)
- **Target Artifact:** code — `collision-solver.js`, `renderer.js`, `tile.js`, `stage.js`

## Tasks (level 0)

- [slope-collision.md](slope-collision.md) — tech-debt #22, slope collision physics (active substack, depth 1)
- [enemy-ai-polish.md](enemy-ai-polish.md) — #23 enemy AI (edge detection + aggro/targeting)
- [world-map-wiring.md](world-map-wiring.md) — #9 world map never instantiated
- [silent-fallback-cleanup.md](silent-fallback-cleanup.md) — #1 silent `??`/`?.` fallbacks (R2.5)
- [data-proxy-boundary.md](data-proxy-boundary.md) — #2 `toPlain()` materialized snapshots (R2.5)
- [hardcoded-color-literals.md](hardcoded-color-literals.md) — #3 hardcoded colors/literals (R1.1)
- [build-data-copy.md](build-data-copy.md) — #8 `bun build` does not copy `data/` into `dist/`
- [stagebase-section-size.md](stagebase-section-size.md) — #11 `StageBase` optional `size` (R2.5)
- [data-index-build-order.md](data-index-build-order.md) — #12 `data/index.json` must run before dev/build
- [i18n-symlink-host.md](i18n-symlink-host.md) — #14 i18n symlink fails on symlink-less hosts
- [underground-main-layout.md](underground-main-layout.md) — #15 full-room `wall` backdrop needs redesign
- [underground-entry-collectibles.md](underground-entry-collectibles.md) — #16 coin/apple embedded in solid column

## Reference (non-task)

- [project-reference-docs.md](project-reference-docs.md) — pointers to planning/architecture docs

## Log

**2026-08-09 — Intake: internalize registers into the stack-tree**

Migrated `docs/agent/status.md` + `docs/agent/technical-debt.md` into the stack-tree: created 13 nodes (active frame `slope-collision.md` + 11 open-debt level-0 nodes + `project-reference-docs.md`), registered each as a task link, set current path + session frame to the `slope-collision` loop-worker substack. Old registers left untouched for manual removal. Consumed and deleted `prompt.md`.

## Substack routing

- *When a task needs decomposition, create a child node markdown (a sibling file in this folder), link it under Tasks above, and update the Current path.*
