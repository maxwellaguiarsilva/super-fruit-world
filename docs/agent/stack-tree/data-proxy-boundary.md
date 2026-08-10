# data-proxy-boundary — tech-debt #2

## Entry

- **Location:** `src/main.js` — usage of `DataDriven.toPlain(...)`
- **Rule:** R2.5 / proposal §3.2.6 (deep strictness)
- **Description:** Several data files (stages, tiles, collectibles, menus, input bindings, audio, player levels/fruits) are deep-copied into plain objects before being handed to generic engine/game classes. Those plain snapshots lose the strict-proxy guarantee, so optional access inside consumers still falls back silently.
- **Proposed fix:** Convert consumers (e.g. `StageBase`, `AudioEngine`, `InputManager`, `ProgressionSystem`, `Collectible`) to strict-safe reads (`Object.hasOwn`) so the proxied values can be used directly, eliminating the `toPlain` boundary.
