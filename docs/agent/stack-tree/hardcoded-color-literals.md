# hardcoded-color-literals — tech-debt #3

## Entry

- **Location:** `src/main.js` (`'#404040'`, `'#BF4040'`, `'#40BF40'`, `'#BFBF40'`, `'#000000'` fallbacks at 83,106,193,280,388,460), `src/game/stages/stage.js:34-42,424`, `src/game/entities/collectible.js:91,96`, `src/game/entities/enemy.js:76`, `src/game/entities/enemy-types.js:122,129`, `src/game/map/map-stage.js:88-105`, `src/game/entities/projectile.js:79`, `src/game/stages/teleporters.js:19,54`, `src/game/entities/player.js:144-175`, `src/game/ui/ui-components.js` (45,77,110), `src/engine/dialog/dialogue-engine.js`, `src/engine/renderer/renderer.js:55`
- **Rule:** R1.1 (`#no-literals`)
- **Description:** Fallback hex colors and inline UI colors bypass `data/colors.json` as the single source of truth.
- **Proposed fix:** Route every visual through `resolveColor()`/`resolveConfig()`; move any remaining rendering defaults into `data/colors.json` (or a UI config) and reference by name.
