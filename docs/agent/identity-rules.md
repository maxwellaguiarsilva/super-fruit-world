# Non-Negotiable Identity Rules — Compliance Audit

This document defines Super Fruit World's identity-specific rules. These rules govern the game's visual identity and color scheme. They are part of the non-negotiable compliance framework — violation of any rule is a blocking defect.

**Generic engine and project rules (architecture, layers, rendering, input, data conventions, repository hygiene) are defined in [`compliance-rules.md`](compliance-rules.md).**

---

## Visual Identity

### I1 — Background Is Pure Black

**The game background (base layer behind all content) must be `#000000`.**

This is non-negotiable because the terminal primary color palette is designed to provide maximum contrast against a black background.

**Audit check:** Verify the background fill color in the renderer. It must be exactly `#000000`, not `#111111`, not `#0a0a0a`, not "very dark gray."

---

### I2 — 3-Bit RGB Color Palette Only

**All game colors must be drawn from the 8-color 3-bit RGB palette defined in `data/colors.json`:**

| Index | Name    | Dark       | Light      |
|-------|---------|------------|------------|
| 0     | black   | `#000000`  | `#000000`  |
| 1     | red     | `#880000`  | `#FF0000`  |
| 2     | green   | `#008800`  | `#00FF00`  |
| 3     | yellow  | `#888800`  | `#FFFF00`  |
| 4     | blue    | `#000088`  | `#0000FF`  |
| 5     | cyan    | `#008888`  | `#00FFFF`  |
| 6     | magenta | `#880088`  | `#FF00FF`  |
| 7     | white   | `#888888`  | `#FFFFFF`  |

- Each channel is either `00` (bit 0) or `88`/`FF` (bit 1, dark/light variant).
- No colors outside this palette are allowed.
- These colors define the level/power index system and enemy HP system.
- The hex values exist exclusively in `data/colors.json`.

**Audit check:** Every color rendered on screen must match one of the 16 hex values above (8 dark + 8 light, except black where dark=light). Inspect all JSON color definitions and rendering output.
