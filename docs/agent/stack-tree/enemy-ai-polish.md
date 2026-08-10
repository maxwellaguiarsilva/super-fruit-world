# enemy-ai-polish — tech-debt #23

## Entry

- **Location:** `src/game/entities/enemy.js`, `src/game/entities/enemy-types.js`
- **Rule:** none specific — game-feel debt (old "next step" in status log)
- **Description:** Enemies do not detect ledges before walking off (no edge detection) and have no targeting adjustments (aggro range / turn-to-face player). Behaviour is a simple patrol.
- **Proposed fix:** Add edge detection (check for ground ahead before stepping) and optional aggro/targeting in `enemy.js` / `enemy-types.js`.
