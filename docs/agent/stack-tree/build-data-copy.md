# build-data-copy — tech-debt #8

## Entry

- **Location:** `package.json` (`build` script) / `server.js`
- **Rule:** none specific — tooling debt
- **Description:** `bun build src/main.js --outdir=dist --target=browser` bundles JS but does **not** copy `data/` (nor the generated `data/index.json`) into `dist/`. The "index baked at build" only works if the static host also serves `data/`.
- **Proposed fix:** Add a small copy step to the build pipeline (copy `data/` and `index.html` into `dist/`).
