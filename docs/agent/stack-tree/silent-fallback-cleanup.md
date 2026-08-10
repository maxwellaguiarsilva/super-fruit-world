# silent-fallback-cleanup — tech-debt #1

## Entry

- **Location:** `src/main.js` (config builders: `resolveTileType`, `parseEnemyConfig`, `buildMenuSubConfig`, `createStageFromData`), `src/game/systems/damage-system.js`, `src/game/systems/health-system.js`, `src/game/systems/progression-system.js`, `src/game/entities/collectible.js`, `src/engine/input/input-manager.js`, `src/engine/audio/audio-engine.js`
- **Rule:** R2.5 (`#no-fallback`) — no silent fallback for missing data
- **Description:** Dozens of `??` / `?.` patterns silently substitute JS-side defaults when a data key is absent (e.g. `physics.gravity ?? 15.0`, `effect.value ?? 1`, `shapeDamageMap[shape] ?? 1.0`). Pre-existing violations predating the DataDriven work; the strict accessor already throws on missing keys, so most `??` clauses are now dead code.
- **Proposed fix:** Move every default value into the appropriate JSON source of truth and read it directly; where a property is genuinely optional-by-override, use explicit `Object.hasOwn(...)` checks instead of `??`.
