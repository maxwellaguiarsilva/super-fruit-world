# data-index-build-order — tech-debt #12

## Entry

- **Location:** `package.json` scripts
- **Rule:** none specific — operational debt
- **Description:** The dynamic index requires `scripts/generate-data-index.js` to run before `dev`/`build` (or the `/data/index.json` route in `server.js`). Forgetting the step produces a boot error. A bundler-agnostic alternative is a Vite-style glob, which this project intentionally avoids.
- **Proposed fix:** Keep the npm script wiring; document the invariant in `docs/agent/technical-architecture.md`.
