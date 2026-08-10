# underground-main-layout — tech-debt #15

## Entry

- **Location:** `data/stages/strawberry-fields.json`, section `underground-main` (object `{ "type": "wall", "position": { "x": 0, "y": -10 }, "size": { "width": 22, "height": 10 }, "visual": { "fill-color": "dark-white" } }`)
- **Rule:** correctness — unwinnable-level debt (the exact failure mode BL-1 exists to catch)
- **Description:** The 22×10 `wall` spans the entire section above the floor (`y` -16..-6 world), filling the whole room. The three `spike` tiles (and the enemies/coins/teleporters at `y` -1) sit inside it, and the player cannot physically enter the underground. BL-1 validation flags the spikes as solid-on-solid overlaps. This session changed the `wall` to a `decorative` (dark-white) backdrop so the stage boots and the room becomes reachable — the visual is unchanged, but the design intent (was it a ceiling? a side column?) was never documented.
- **Proposed fix:** Redesign the underground-main layout deliberately (walls as boundaries, not a full-room fill); decide whether the dark-white slab is a solid boundary or a backdrop and type it accordingly.
