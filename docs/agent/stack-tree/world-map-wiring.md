# world-map-wiring — tech-debt #9

## Entry

- **Location:** `src/game/map/map-stage.js`, `src/game/scenes/scenes.js` (`MapScene`), `data/map/fruit-world.json`
- **Rule:** none specific — incomplete feature debt
- **Description:** `MapScene`/`MapStage` exist and `data/map/fruit-world.json` is loaded by the data index, but `main.js` never instantiates them; there is no path from the title menu to the world map.
- **Proposed fix:** Wire `MapStage` into the composition root and connect the title menu / stage-complete flow.
