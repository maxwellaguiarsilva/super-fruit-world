# underground-entry-collectibles — tech-debt #16

## Entry

- **Location:** `data/stages/strawberry-fields.json`, section `underground-entry` — `coin` at `{x:1.5, y:4}` and `apple` at `{x:1.5, y:8}` sit inside the 3×10 dark-white column (`{x:0, y:1}` after the BL-1 fix)
- **Rule:** correctness — unreachable-collectible debt
- **Description:** Even after moving the 3×10 column to `y:1`, the coin/apple remain inside the solid block and can never be collected. BL-1 only validates tile-tile overlaps, so this goes unflagged.
- **Proposed fix:** Move the collectibles out of the column or relocate the column; out of scope for BL-1.
