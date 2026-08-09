# DataDriven — Dynamic Resource Manager (Proposal)

**Status:** Implemented on 2026-08-08 (was: Proposed — not implemented). The hand-maintained manifest is gone; `DataDriven` loads data via the generated index. Open decisions were resolved as recorded in the Implementation Notes below.

**Date:** 2026-08-08

---

## 8. Implementation Notes (2026-08-08)

Decisions taken during implementation of this proposal:

1. **Singleton vs DI (decision 1):** Single `DataDriven` instance created at the composition root (`src/main.js`) and injected into every consumer (satisfies R1.3). No module-level registry.
2. **Index strategy (decision 2):** Hybrid. `scripts/generate-data-index.js` writes `data/index.json` (gitignored); `server.js` serves `/data/index.json` dynamically in dev; `dev`/`start`/`build` run the generator first.
3. **Non-kebab `.json` file (decision 3):** Boot-time error (fail-fast). Enforced by the generator (R5.3) and re-validated by `DataDriven` at load.
4. **en-us loaded twice (decision 4):** Both `data/i18n/default.json` (symlink) and `data/i18n/en-us.json` are listed in the index and loaded — both `i18n.default.*` and `i18n.en-us.*` accessors resolve.
5. **Deep strictness (§3.2.6) + composition root:** The accessor interface is fully strict (descriptive throws, recursive strict proxies). The composition root deep-copies (`DataDriven.toPlain`) a few data files (stages, tiles, collectibles, menus, audio, input, player configs) before handing them to generic engine/game classes that rely on optional overrides. See `docs/agent/technical-debt.md` (item 2) for follow-up.
6. **`data/index.json`** is a generated artifact and is `.gitignore`d; `bun run generate:data-index` regenerates it.
7. **Removed:** `data/manifest.json`, `src/engine/data/locale-manager.js`, `LocaleManager` export, and the `locale` section of `data/game-config.json` (per R2.6).

Files changed in this implementation are listed in `docs/agent/status.md` (session 2026-08-08).

---

## 1. Objective

Replace the hand-maintained `data/manifest.json` with a dynamic resource manager:

- A single class, `DataDriven`, that discovers and loads every JSON file under `data/` on creation.
- All data consumed through Proxy-based property access with a dotted path:
  `dataDriven["folder.anotherfolder.filename.keydictname"]`.
- **Zero silent fallback:** if the requested path does not exist, a descriptive error is thrown immediately.
- Locale is set via filesystem symlink (`data/i18n/default.json` → `en-us.json`), not via application config or runtime switching.

---

## 2. Feasibility Assessment — Dynamic Listing

**Question:** can the app discover all `data/` JSON files at runtime without a manifest?

**Answer (honest):** A browser cannot enumerate directory contents. `fetch()` has no "list directory" operation, and this project uses plain `Bun.serve()` static serving (`server.js`) — no bundler glob, no Vite `import.meta.glob`. So *pure client-side dynamic discovery is impossible*.

Two viable mechanisms, both removing the *hand-maintained* manifest:

| Mechanism | Dev | Prod (`dist/`) |
|---|---|---|
| **A. Server endpoint** — `server.js` walks `data/` and serves a file index at e.g. `/data/index.json` | Works (Bun has filesystem access) | Requires shipping a server, does not fit static hosting |
| **B. Build-time generator** — a script walks `data/`, emits `data/index.json` (gitignored or committed) | Works (Bun can run the script) | Works — index is baked at build |

**Recommendation: hybrid.** A Bun script generates `data/index.json` from the filesystem (used by dev and build). `server.js` can also serve it directly in dev for convenience. The index is the only artifact; it is generated, never maintained by hand. `DataDriven` treats it as "the list of files to load" — the same shape `DataLoader.loadAll()` consumes today.

The **hand-maintained manifest is gone**; the *discovery* is dynamic. This is the maximum achievable in a browser target.

---

## 3. Design

### 3.1 Class — `DataDriven`

Location: `src/engine/data/data-driven.js` (engine layer — fully generic, no game knowledge).

```js
class DataDriven {
  // DI: receives basePath + a source of the file list (endpoint URL or generated index).
  constructor(basePath, indexSource) { ... }
  async load() { ... }   // fetch index, fetch each file, validate, build lookup
  // Proxy get trap resolves dotted paths.
  static create(basePath, indexSource) { ... } // returns Proxy-wrapped instance
}
```

Responsibilities:

1. **Discover** — fetch the generated index (the file list).
2. **Filter** — keep only entries where:
   - the file extension is `.json`;
   - the file basename and every folder segment match `^[a-z0-9-]+$` (lower-kebab-case).
   - **Recommendation:** a `.json` file whose name/path *violates* kebab-case is a boot-time error (catches typos early). Non-JSON files (`.ogg`, `.png`) are skipped silently — they are not data.
3. **Load** — `fetch()` + JSON parse + recursive R5.2 key validation (reuse current `DataLoader.validateKeys` logic).
4. **Serve** — a `Proxy` whose `get` trap resolves the dotted accessor path.

### 3.2 Path Resolution Rules

Accessor: `dataDriven["seg1.seg2.seg3.key1.key2"]`

1. Split on `.`. JSON keys cannot contain dots (R5.2 enforces `^[a-z0-9-]+$`), so segments are unambiguous.
2. Find the **longest prefix** of segments that resolves to an existing file at `data/<segments joined by />.json`. Remaining segments are the key path inside that file's JSON.
3. If no prefix matches a file → **throw** `Data not found: <path>` (includes the full accessor path).
4. If the file matched but the key path does not resolve → **throw** `Key not found: <key> in data/<file>.json`.
5. If there are no key segments, return the whole file's data.
6. **Deep strictness:** every returned value is wrapped in a recursive `Proxy` so that accessing a missing property *anywhere in the returned subtree* also throws. This guarantees R2.5 across the whole object graph, not just the top-level dotted access.

**Ambiguity example** (`data/audio.json` exists *and* `data/audio/` folder exists):
- `dataDriven["audio"]` → whole `data/audio.json` (no key segments).
- `dataDriven["audio.sfx"]` → longest file prefix is `audio/sfx.json` → whole SFX file.
- `dataDriven["audio.sfx.duration"]` → file `audio/sfx.json`, key `duration`.
- Rule: **longest file prefix wins.** (Documented behavior; consumers must be aware.)

### 3.3 i18n — Locale via Symlink

- `git mv data/locales data/i18n`
- `ln -s en-us.json data/i18n/default.json`
- The active locale is whatever `default.json` points to. `en-us.json` remains the real file (single source of truth per R2.4).
- Access: `dataDriven["i18n.default.menu.main.title"]`.
- `meta.locale` inside the locale file still reports the real locale name for display.
- Both `i18n.en-us` and `i18n.default` resolve (symlinked), so `en-us.json` is loaded twice into the lookup — acceptable, or the index generator can deduplicate by realpath.

**Consumers migrate** from `localeManager.get('menu.main.title')` → `dataDriven["i18n.default.menu.main.title"]`.

---

## 4. Compliance Impact (rules to update)

| Rule | Current | Change |
|---|---|---|
| **R1.3** (`#no-globals`) | Forbids global singletons | **Conflict.** A truly global `DataDriven` singleton violates DI. Resolution: single instance created at composition root and **injected** into every consumer; Proxy access works on the instance. *(Decision point — see §6.)* |
| **R2.3** (`#data-driven`) | Lists `data/locales/en-us.json` + "fallback locale" | Rename path to `data/i18n/default.json`; drop "fallback locale" wording. |
| **R2.4** (`#single-source-truth`) | "Only `data/locales/en-us.json` contains user-facing text" | Update path to `data/i18n/`. |
| **R2.5** (`#no-fallback`) | Has a designed exception: locale fallback to `en-us` | **Remove the exception.** No fallback anywhere, ever. |
| **R5.2** (`#kebab-case`) | Keys only | **Extend** to file and folder names under `data/` (new sub-rule R5.3): all `.json` file basenames and directory names must match `^[a-z0-9-]+$`. Enforced at load time by `DataDriven`. |
| — (new) | — | Add a rule stating locale is selected via `data/i18n/default.json` symlink, not by config or runtime switching. |
| **R2.1** (`#engine-agnostic`) | Engine must not know the game | `DataDriven` stays generic (paths + keys only). The `i18n.default.*` accessor is used only by game-layer/main consumers. |

---

## 5. Migration Plan (files affected)

1. **Delete** `data/manifest.json`.
2. **Rename** `data/locales/` → `data/i18n/` (`git mv`), add `data/i18n/default.json` symlink.
3. **`data/game-config.json`** — remove the `locale` section (`default`/`fallback`), no longer the source of truth for locale.
3.1. **Audio config flattening** — `data/audio.json` (top-level settings: volumes, enabled flags, crossfade) moves inside the folder as **`data/audio/config.json`**. The current `data/audio/config.json` (synthesis: wave types, tuning, envelope) is renamed to **`data/audio/synthesis.json`**. Consumers: `main.js` (lines ~219, 226, 238, 275) resolves `data/audio/config.json` for engine settings and `data/audio/synthesis.json` for tuning/note scale.
4. **New:** `src/engine/data/data-driven.js` (class `DataDriven`). **Delete:** `src/engine/data/locale-manager.js` and its export in `src/engine/index.js`.
5. **`server.js`** — optionally serve the generated index in dev.
6. **New:** index generator script (e.g. `scripts/generate-data-index.js`) + package.json script; wired into `dev`/`build`.
7. **`src/main.js`** — rewrite bootstrap: `DataDriven` instead of `DataLoader` + manifest + `LocaleManager`. All `dataLoader.get('data/...')` → `dataDriven["..."]`.
8. **Consumers of `localeManager.get(...)`:** `src/game/ui/ui-components.js`, `src/engine/dialog/dialogue-engine.js`, `src/game/scenes/scenes.js` → `dataDriven["i18n.default..."]` (injected instance).
9. **Docs:** `compliance-rules.md` (R2.3, R2.4, R2.5, R5.3), `technical-architecture.md`, `requirements.md`, `class-architecture.md`, `status.md`.

---

## 7. Decided Audio Restructure

- `data/audio.json` → **`data/audio/config.json`** (top-level audio settings: `master-volume`, `bgm-volume`, `sfx-volume`, `sound-enabled`, `bgm-enabled`, `sfx-enabled`, `bgm-crossfade-duration`).
- `data/audio/config.json` (synthesis: wave types, tuning, envelope, `musical-note-scale`, polyphony) → **`data/audio/synthesis.json`**.
- Naming rationale: engine-top-level settings deserve the canonical `config.json` name; the synthesis file is technical and gets a descriptive name.
- Accessor paths after migration:
  - `dataDriven["audio.config"]` — engine audio settings.
  - `dataDriven["audio.synthesis"]` — tuning/note-scale.
  - `dataDriven["audio.sfx"]` — SFX definitions.
  - `dataDriven["audio.bgm"]` — BGM registry (`tracks.*`).
  - `dataDriven["audio.bgm.title-screen"]` — individual track file (longest-prefix rule, §3.2).

---

## 6. Open Decisions

1. **Singleton vs DI.** The word "singleton" conflicts with R1.3. Options:
   - **(Recommended)** Single instance created in `main.js` and injected — satisfies R1.3, still "one instance".
   - Amend R1.3 to allow a module-level read-only data registry (larger rule change).
2. **Index strategy:** committed generated `data/index.json` vs dev-server endpoint + build-time generation. (Hybrid recommended.)
3. **Non-kebab `.json` file:** skip silently (user's literal wording) vs boot-time error (recommended for fail-fast).
4. **Load en-us via symlink twice** (both `i18n.default` and `i18n.en-us`) vs deduplicate.
