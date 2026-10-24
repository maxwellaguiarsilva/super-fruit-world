# Music Formatting CLI

Subject: `src/engine/audio/format-4-beat-music.ts`, a Bun command-line tool that rewrites 4/4 background-music JSON into a shared phrase hierarchy. It is part of the tooling set indexed in [README.md](README.md).

## Status

| Property | Value |
| --- | --- |
| Kind | Developer tool. |
| Runtime relation | None. No module under `src/` imports it, `src/engine/index.js` does not export it, and the browser never loads it because `index.html` only loads `src/main.js`. |
| Owns | Rewriting the `channels` and `phrases` portion of a 4/4 BGM file. |
| Does not own | Runtime playback, track selection, or the shape consumed by `AudioEngine`. |

## Invocation

`package.json` declares the script that the tool prints, so the printed usage is the working invocation:

```sh
bun run format-4-beat-music <path-to-json>
```

`bun` with the tool path as the first argument also runs it:

```sh
bun src/engine/audio/format-4-beat-music.ts <path-to-json>
```

Both forms forward the path as the first argument. The script is indexed in [README.md](README.md#commands).

## Arguments

| Position | Name | Required | Meaning |
| --- | --- | --- | --- |
| 1 | `path-to-json` | Yes | Path to one BGM JSON file. The tool has no options or flags. |

With no argument, the tool prints its usage string and exits with code `1`.

## Input shape

The input is one object accepted by the runtime BGM reader.

| Key | Required by the tool | Shape |
| --- | --- | --- |
| `time-signature` | Yes, for any processing | Array equal to `[4, 4]`. Any other value, including a missing key, makes the tool exit silently. |
| `channels` | Yes | Object keyed by channel name. Each channel requires a `notes` array. |
| `notes` (per channel) | Yes | Array whose entries are either `[noteName, duration]` tuples or string references into `phrases`. |
| `phrases` | Only when a `notes` entry is a string reference | Object mapping phrase names to arrays of tuples or nested string references. |

Every other key (`description`, `bpm`, `wave`, `volume`, and so on) is preserved as data. Only serialization formatting changes.

Entry-level shape:

```json
{
  "bpm": 120,
  "time-signature": [4, 4],
  "channels": {
    "lead": { "wave": "sine", "volume": 0.5, "notes": ["lead-l2-i1"] }
  },
  "phrases": {
    "lead-ce-1abc": [[ "c5", 1 ], [ "e5", 1 ]],
    "lead-gc-2def": [[ "g5", 1 ], [ "c6", 1 ]],
    "lead-l1-i1": ["lead-ce-1abc", "lead-gc-2def"],
    "lead-l2-i1": ["lead-l1-i1", "lead-l1-i1"]
  }
}
```

## Behavior

1. Reads and parses the file. A missing file or invalid JSON exits with code `0` and no output.
2. Exits with code `0` and no output when `time-signature` is not exactly `[4, 4]`.
3. Recursively expands each channel's `notes` through `phrases` into a flat tuple sequence.
4. Groups the flat sequence into cells that stop accumulating once their duration reaches `2`, then groups cells into bars that stop once their duration reaches `4`. A cell or bar can exceed the target when its last note crosses the boundary.
5. Deduplicates cells and bars. Each generated key is `<track>-<note letters>-<hash>`, where the hash is the first four base-36 characters of the CRC32 of the cell or bar content.
6. Builds higher levels until one key remains. The first generated level (`l1`) groups the bar sequence; each next level splits the previous level into groups whose size is the smallest prime divisor of the previous level's length. Keys are `<track>-l<level>-i<index>`.
7. Inlines chains whose phrase value is a single reference to another phrase, then removes phrases unreachable from the root.
8. Re-expands the new root and compares the result with the original flat sequence. A mismatch prints `Expansion mismatch for track "<name>"` and exits with code `1`.
9. Replaces each channel's `notes` with `[rootKey]`, replaces `phrases` with the generated dictionary, and writes the result.

The tool is idempotent on an already formatted file: running it on a copy of `data/audio/bgm/title-screen.json` produced a byte-identical `title-screen-formatted.json`.

## Output location

The output is written next to the input, never over it:

| Input | Output |
| --- | --- |
| `<path>/<name>.json` | `<path>/<name>-formatted.json` |

The output is serialized with two-space indentation, notes inside each phrase on one line, and a trailing newline.

The tool does not update `data/index.json` and does not replace the input. To adopt an output under `data/`, move it into place manually and run `bun run data:index`, because the generated index only lists files that exist on disk.

## Exit codes

| Situation | Exit code | Output |
| --- | --- | --- |
| Successful rewrite | `0` | `Wrote <output path>` |
| Input not `[4, 4]` | `0` | None |
| Input missing or invalid JSON | `0` | None |
| No argument | `1` | Usage string |
| Re-expansion mismatch | `1` | `Expansion mismatch for track "<name>"` |
| `[4, 4]` input without `channels` | `1` | Uncaught `TypeError` from `Object.entries(channels)` |

The silent `0` exits for missing and malformed files make the tool unsafe as a validation step. Use `bun run validate` to check BGM structure; use this tool only to reformat a file you already know is a 4/4 channel definition.

## Warning

This is a developer tool, not part of the browser runtime. Pointing it at a file under `data/` writes a new `-formatted.json` sibling inside the data tree. That sibling becomes part of the data set as soon as `data/index.json` is regenerated, and `DataDriven` then loads it at boot. Run it against a copy unless the formatted output is the file you intend to ship.
