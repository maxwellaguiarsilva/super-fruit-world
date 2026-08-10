# stagebase-section-size — tech-debt #11

## Entry

- **Location:** `src/engine/entities/stage-base.js:34-35` — `secData['size']?.width ?? 0`
- **Rule:** R2.5 (silent fallback)
- **Description:** Section `size` is optional in stage JSON and defaults to 0. This works on plain materialized data, but is a silent default. Either every section should carry an explicit size, or the access should be strict-aware.
- **Proposed fix:** Decide a canonical section-size policy in the data; make the read strict.
