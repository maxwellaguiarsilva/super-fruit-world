# i18n-symlink-host — tech-debt #14

## Entry

- **Location:** `data/i18n/default.json` symlink
- **Rule:** none specific — deployment debt
- **Description:** Locale selection relies on a filesystem symlink. `Bun.serve()` follows it, but hosts that do not support or deploy symlinks (e.g. some static file servers, zip-based publishing) would serve a 404 for `data/i18n/default.json`. The `bun run build` pipeline also does not copy `data/` into `dist/`.
- **Proposed fix:** Add a build step that materializes `default.json` as a real copy (or a generated alias file) when publishing to symlink-less hosts; revisit when a real static-hosting target is chosen.
