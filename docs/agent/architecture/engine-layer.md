# Engine Layer

Subject: the reusable primitives at `src/engine/`, their contracts and the policies they enforce. No module here knows the game, its data layout or the application layer.

## Boundary

| Property | Rule |
| --- | --- |
| May import | Other `src/engine/**` modules only. |
| Must not import | `src/game/**`, `src/app/**`, `src/main.js`. |
| Exposed surface | The barrel `src/engine/index.js`. |
| Reached by | `src/app/**` through the barrel; `src/game/**` through concrete file paths. |
| Runtime assumption | A browser: `window`, `document`, `navigator`, `localStorage`, `fetch`, `performance`, `requestAnimationFrame`, Web Audio and a 2D canvas. |
| Enforced by | `bun run check:layers` and `test/check-layers.test.js`. |

Barrel exports: `GameLoop`, `SceneManager`, `Scene`, `requireDependencies`, `Renderer`, `Camera`, `InputManager`, `PhysicsEngine`, `CollisionSolver`, `SlopeSurface`, `AudioEngine`, `SettingsStore`, `SETTINGS_SCHEMA_VERSION`, `restoreAudioSettings`, `NoteFrequencyCalculator`, `NoteFrequencyError`, `DataDriven`, `TextResolver`, `SaveSystem`, `Entity`, `StageBase`, `Section`, `UIElement`, `DialogueEngine`.

Layer check rule:

| From | Allowed targets |
| --- | --- |
| `src/engine/**` | `engine` |
| `src/game/**` | `game`, `engine` |
| `src/app/**` | `app`, `game`, `engine` |
| `src/main.js` | `app` |
| Any file | Nothing may target `src/main.js`. |

The check resolves relative specifiers, ignores package imports, and inspects static imports, side-effect imports, re-exports and dynamic imports. It reports `file:line`, the specifier, the direction and the rule that failed. Current result: 73 source files, 0 violations.

## Modules

| Module | Responsibility |
| --- | --- |
| `core/dependency-contract.js` | Validates that a dependency object owns every declared key; throws with the owner name, the missing key and the full declared list. |
| `core/report-once.js` | `OnceReporter` delivers the first report for each key to an injectable logger and suppresses repeats. |
| `core/scene.js` | Base class with `name`, and no-op `enter`, `exit`, `update`, `render`. |
| `core/scene-manager.js` | Registry of scenes by key, one current scene, `switchTo` calls `exit` on the previous scene then `enter` on the next, and `unregisterScene` removes by registration key and clears the current scene when it matches. |
| `core/game-loop.js` | Fixed-timestep `requestAnimationFrame` loop with a deterministic `tick(timestamp)` seam. |
| `renderer/renderer.js` | Canvas sizing, unit scale, camera transform, primitive drawing, text scaling, text measurement and flash. |
| `renderer/camera.js` | Camera position and size, smoothing follow, visibility test and bounds constraint. |
| `input/input-manager.js` | Keyboard and gamepad state, action bindings, edge-latched presses, axes and combos. |
| `physics/aabb.js` | `entityBox` and `boxesOverlap`: the shared axis-aligned box helpers. |
| `physics/physics-engine.js` | Gravity with an optional per-entity multiplier, fall-speed cap, ground friction and position integration. |
| `physics/slope-surface.js` | `SlopeSurface`: the single owner of the slope diagonal, surface height for a local x, the inverse, the effective angle and the derived/declared distinction. |
| `physics/collision-solver.js` | AABB test, overlap extent, side resolution and a coarse normal, plus slope-surface resolution. |
| `audio/audio-engine.js` | Web Audio SFX and BGM synthesis, volume gating, crossfade, loop scheduling and finite-value resolution. |
| `audio/audio-settings.js` | Internal `AudioSettings`, exported `SettingsStore` and `restoreAudioSettings`, and the versioned settings record. |
| `audio/note-frequency-calculator.js` | Note parsing, MIDI numbering, range validation and equal-temperament frequency. |
| `data/data-driven.js` | Index-driven JSON loading, kebab-case validation, accessor proxy and path-to-key conversion. |
| `data/save-system.js` | Namespaced `localStorage` reads, writes, deletes, existence checks and namespace clearing, with boolean write results and once-per-key failure reports. |
| `data/text-resolver.js` | Non-throwing text lookup with a once-per-key missing-key report. |
| `dialog/dialogue-engine.js` | Dialogue sequence state, typewriter reveal, line wrapping, layout and rendering. |
| `entities/entity.js` | Position, dimensions, velocity, hitbox, center, alive and on-ground state. |
| `entities/section.js` | Named section with a parent, children, stored entities and recursive world position. |
| `entities/stage-base.js` | Section tree, entity collection, dimensions, bounds, type-filtered views and the stage-declared BGM track. |
| `ui/ui-element.js` | Base UI element with anchor math and child update/render; exports the shared `anchorPosition`. |
| `audio/format-4-beat-music.ts` | Developer CLI outside the runtime graph; documented in [../tooling/music-format-cli.md](../tooling/music-format-cli.md). |

## Rendering

- `Renderer` requires a canvas selector, a positive `unitHeight` and a positive `viewportPercent`.
- On construction and on every window resize, the canvas is sized to `window.innerWidth * percent/100` by `window.innerHeight * percent/100`; `unitScale = canvasHeight / unitHeight`; the viewport in visual units is `canvasSize / unitScale`.
- Current application values: `unitHeight` 10, `viewportPercent` 90.
- All drawing helpers take visual units and multiply by `unitScale`. `drawText` scales the first `<number>px` occurrence in the font string.
- `cameraTransform` saves the context and sets an integer-pixel translation of `-camera.x * unitScale`, `-camera.y * unitScale`; `restoreCameraTransform` restores it.
- `clear()` fills the whole canvas with `#000000`.
- Primitives: `drawCircle`, `drawRect` with optional corner radius, `drawPolygon(cx, cy, radius, sides, rotation, fillColor, borderColor, borderWidth)`, `drawPolygonPath` for an arbitrary point list, `drawText` with left/center/right alignment, `drawLine` and `applyFlash(alpha)`. `drawPolygon` has no corner-radius parameter; its vertices are sharp and only the stroke line join is rounded.
- `measureText(text, font)` applies `unitScale` to the font, measures with the canvas context and returns the width in visual units. An empty or non-string text measures `0`. The map uses it to clamp node labels to the camera band.
- `drawPolygonPath` ignores a point list shorter than three points, closes the path, fills it and strokes it with a rounded line join.
- There is no image, sprite-sheet or off-screen canvas support; every visual is a primitive.

Camera:

- `follow(target, smoothing)` moves by `(desired - current) * min(1, smoothing)`; application scenes use `0.1` per fixed step during play and `1` for the initial snap.
- `constrainToBounds` clamps position; when the bounds are smaller than the camera, the maximum wins and the result can be negative.
- `isVisible(rect)` is an AABB test against the camera rectangle. No shipped renderer path uses it; scenes draw the full stage.

## Input

Frame model:

1. `keydown` adds the key code to a pending set when the event is not an auto-repeat, and marks the key down.
2. `keyup` marks the key up.
3. `blur` clears held state, previous state, pending keys and latched presses.
4. `update()` copies the pending set into the frame-press latch, clears the pending set and samples gamepads.
5. `finalize()` copies the current key state into the previous-key state.

The fixed-step loop calls `update`, then the scene update, then `finalize` once per simulation step. A frame that runs several steps advances input several times, so a press edge is consumed by exactly one step.

Press detection combines two sources: a current-versus-previous action state difference, and the frame latch. This makes a press that starts and ends between two steps visible exactly once, and keeps a press held across steps visible once.

| Method | Meaning |
| --- | --- |
| `isDown(action)` | The action is active in the current state. |
| `isPressed(action)` | Edge since the previous state, or latched during the step. |
| `isReleased(action)` | Active in the previous state and inactive now. |
| `getAxis(action)` | `-1`/`1` from the left/right aliases, overridden by the binding's raw gamepad axis value when its magnitude exceeds `gamepad.dead-zone`. |
| `isComboHeld(actions, holdTime)` | All actions must be down; the timer starts on the first complete hold, `holdTime` is in seconds, and a release or a different action set resets it. A non-positive or invalid `holdTime` returns true immediately. The clock is injectable through the constructor option `now`; the default is `performance.now()` with `Date.now()` as fallback. |
| `reloadBindings(config)` | Replaces the bindings and rebuilds the action map. |

Action aliases:

| Requested action | Resolved binding |
| --- | --- |
| `left` | `move-left` |
| `right` | `move-right` |
| `up` | `move-up` |
| `down` | `move-down` |
| `air-slide` | `special` |
| Any other name | The action of the same name |

Gamepad sampling:

- Only the first connected gamepad is read.
- D-pad is read from fixed button indices 12, 13, 14 and 15 and recorded as `gp-dpad-<direction>`.
- Buttons `0..button-count-1` (current data: 16) are recorded as `gp-button-<index>`.
- Axes 0 to 3 are recorded as `axis-<index>`.
- A stick binding resolves against its own stick and axis: `left-stick-x` or `right-stick-x` for horizontal directions, and `left-stick-y` or `right-stick-y` for vertical directions. `up` and `left` project the negative sign; `down` and `right` project the positive sign.
- Directional activation requires a positive projection of at least `gamepad.axis-threshold`; an invalid threshold falls back to `gamepad.dead-zone`. `getAxis` uses `gamepad.dead-zone` for the raw analog magnitude. Current data: dead zone 0.15 and axis threshold 0.5.

## Physics and collision

`PhysicsEngine` reads `gravity`, `max-fall-speed` and `friction` from configuration at construction. `applyGravity` and `getAppliedForce` multiply gravity by `entity.gravityMultiplier` when that value is a finite number; otherwise the multiplier is `1`. The player exposes the multiplier from its moon-gravity timer.

| Operation | Behavior |
| --- | --- |
| `applyGravity(entity, dt)` | Adds `gravity * multiplier * dt` to vertical velocity, capped at `max-fall-speed`. |
| `applyFriction(entity, dt)` | Applies only when `entity.onGround`; multiplies horizontal velocity by `pow(1 - friction, dt * 60)`. |
| `integratePosition(entity, dt)` | Adds `velocity * dt` to position. |
| `getAppliedForce(entity)` | Reports `{ x: 0, y: gravity * multiplier }`. |

`CollisionSolver`:

| Method | Behavior |
| --- | --- |
| `checkAABB(a, b)` | Strict overlap on both axes, delegated to `boxesOverlap` from `physics/aabb.js`. |
| `getOverlap(a, b)` | Overlap extent or `null` when either axis does not overlap. |
| `resolveCollision(movable, solid, dt)` | Returns `{ position, velocity, collided, onGround }`. Side selection first tries a swept test using `dt` to reconstruct the previous box; when both axes overlapped before, it falls back to the smallest overlap. Top collision sets vertical velocity to `0` and `onGround` true; bottom and side collisions zero the corresponding velocity. |
| `resolveSlopeCollision(movable, slope, dt)` | Resolves against a `SlopeSurface`. Landing and step-up use the surface height at the downhill support edge; a grounded body sticks to a descending surface within the step tolerance; the flat underside and the tall vertical face block. Returns the same shape. |
| `getNormal(movable, solid)` | Axis of least penetration. |

Slope details:

- `SlopeSurface` requires a positive width and height. It accepts an optional declared angle and an `inverted` flag.
- The solid region is the wedge below the box diagonal. The surface runs from `topY` (the high edge) to `bottomY` (the tile bottom).
- A declared angle is used only when `width * tan(angle)` equals `height` within `1e-6`; otherwise the angle and rise are derived from the tile box. `derived` reports which case applies.
- `surfaceY(localX)` is clamped to the box and mirrors with `inverted`; `surfaceX(localY)` is its inverse.
- `resolveSlopeCollision` uses the downhill support edge for the floor height, a step tolerance of `max(0.5, rise * hitboxWidth / width + 0.05)`, a descending stick when the body was grounded, a flat underside check and a tall-face block.
- The stage passes the same frame `dt` to solid and slope collision for the player and for enemies, so the swept side test is active on every collision path.
- `entityBox` converts an entity and its hitbox into a world-space box; `Stage` and `Projectile` consume it, and `checkAABB` consumes `boxesOverlap`. Both helpers live in `physics/aabb.js`.

## Scenes and the loop

- `SceneManager.registerScene(key, scene)` overwrites an existing key.
- `switchTo(key)` throws when the key is unknown, calls `exit(next)` on the previous scene, then `enter(previous)` on the next.
- `unregisterScene(key)` removes the registration by key. When that key is the current scene, `currentScene` becomes `null`; a scene whose own `name` differs from its registration key is still cleared correctly.
- `currentScene` and `sceneNames` are read-only views.

`GameLoop` model:

| Property | Value |
| --- | --- |
| Simulation rate | `loop.update-rate` from configuration; current data `60`. |
| Invalid rate | Any value that is not a positive finite number falls back to `60`. |
| Step | `1000 / rate` milliseconds, passed to the scene as `1 / rate` seconds. |
| Frame clamp | At most `100` ms of elapsed real time per frame. |
| Step cap | At most `5` simulation steps per frame; any remaining backlog is dropped. |
| Render cadence | One clear and one scene render per frame, even when no step is due. |
| Pause | `pause()` clears the accumulator; a frame while paused clears the accumulator. |
| No scene | The accumulator is cleared and nothing updates or renders. |

`tick(timestamp)` is the testable frame seam. It accepts a finite numeric timestamp in milliseconds, returns the number of fixed steps consumed and performs no scheduling. The first call establishes the baseline and returns `0`. A non-finite timestamp returns `0`.

Per fixed step the loop calls `inputManager.update()`, `scene.update(stepSeconds, inputManager)` and `inputManager.finalize()`. Input is finalized in a `finally` block even when the scene update throws. A scene whose own `isPaused` flag is true receives exactly one step per frame with no accumulated time, so its pause menu stays responsive without fast-forwarding when play resumes. The scheduled loop calls `tick` and schedules the next animation frame in a `finally` block. `scene.update`, `renderer.clear` and `scene.render` are each wrapped: an error is reported once per source (`scene.update`, `renderer.clear`, `scene.render`, `loop.tick`) for the lifetime of the loop, and the next frame is still scheduled. A failing update does not stop the remaining fixed steps in the same frame.

`start`, `stop`, `pause` and `resume` guard against repeated transitions; `resume` resets the frame timestamp and the accumulator so the pause duration is not applied.

## Audio

Track shapes accepted by the BGM reader:

| Shape | Detection | Notes source |
| --- | --- | --- |
| Channel object | `channels` is an object | One channel per value, each with its own `notes`; `phrases` may be at track or channel level. |
| Channel array | `channels` is an array | One channel per array entry. |
| Legacy single channel | No `channels` | The track's own `wave`, `volume`, `phrases` and `notes`. |

Finite-value policy: `resolveBGMPlan` converts a track into finite playback parameters and records every malformed value. `AudioEngine` emits one warning per track listing all recorded problems, then plays with defaults. The policy applies at the point where values reach a Web Audio call.

| Value | Resolution order | Default |
| --- | --- | --- |
| Channel volume | channel `volume` → track `volume` → `audio.bgm-volume` → default | `0.5`, clamped to `0..1` |
| Waveform | channel `wave` → track `wave`, if one of `sine`, `square`, `sawtooth`, `triangle` | `sine` |
| Tempo | track `bpm`, positive | `120` (beat = 0.5 s) |
| Note duration | second tuple element, positive | `1` beat |
| Note name | first tuple element, string | `rest` |
| Unknown phrase reference | Not a phrase name | Treated as a note entry |
| Master volume | `audio.master-volume` | `1`, clamped |
| SFX volume | `audio.sfx-volume` | `1`, clamped |
| Crossfade | `audio.bgm-crossfade-duration` or the call argument | `0` |
| Frequency | override or SFX `freq`; invalid values | `440` Hz |
| SFX duration | SFX `duration` | `0.2` s |
| SFX envelope | `sfx.envelope` over `audio.synthesis.default-envelope` over engine defaults | attack `0.01`, decay `0.10`, sustain `0.5`, release `0.05` |

Other engine policies:

- Unknown note names inside a BGM sequence are caught per note and replaced with `261.63` Hz; the track keeps playing.
- If channel durations differ by more than `beatDuration * 0.001`, the engine warns with the beat delta and per-channel durations; playback continues.
- A looping track is rescheduled 0.1 s before its end; only while the same track is still current.
- A crossfade fades the BGM master gain to zero, waits, stops the old track and fades the new one in.
- `pauseBGM` and `resumeBGM` suspend and resume the whole audio context.
- SFX are synthesized with an attack-linear, decay-linear, sustain and release envelope; the oscillator is tracked and removed on end.
- `playSFX(name, freqOverride)` returns `false` when sound or SFX playback is disabled, when the name is not in `data/audio/sfx.json`, or when no frequency source resolves. It reports an unknown name once under `sfx-unknown:<name>` and a missing or unparseable frequency once under `sfx-frequency:<name>`, then returns without throwing. A numeric frequency is sanitized to the default `440` Hz. A valid sound returns `true` and schedules as before. `playBGM` is unchanged.

### Audio settings

`SettingsStore` is a namespaced record over `SaveSystem`. It normalizes the three known volume fields, but `AudioSettings` binds and writes only the `settingKeys` the caller supplies:

| Property | Value |
| --- | --- |
| Storage key | `settings` (written as `<namespace>:settings`). |
| Schema version | `1`. |
| Recognized record fields | `master-volume`, `bgm-volume`, `sfx-volume`; a field is stored only when a bound slider declares it as its `setting-key`. |
| Valid value | Finite number in `0..1`; other values are dropped on read and write. |
| Version mismatch | The entry is deleted and `load()` returns `null`. |

`AudioSettings` takes one dependency object with `engine`, `store` and `settingKeys`. For each supplied key it maps `master-volume`, `bgm-volume` or `sfx-volume` onto the matching engine property and replaces that property with an accessor pair. Reading forwards to the original accessor; writing forwards and then calls `save()`, so every bound engine change is written through. Keys not supplied are neither read nor saved. The current settings menu supplies `bgm-volume` and `sfx-volume`; `master-volume` is supported only if a slider declares that `setting-key`. `set(key, value)` uses the same path; an unknown setting key is a no-op and `get` returns `0` for it. `apply(values)` accepts only valid volumes.

`restoreAudioSettings({ engine, store, settingKeys })` constructs the wrapper and applies the stored record, which is how boot restores the saved volumes after the engine exists. The module is engine-only; the application supplies the engine and the slider keys.

`NoteFrequencyCalculator` parses `[a-g][#bx]*<octave>`, computes MIDI as `(octave + 1) * 12 + semitone + accidentals`, validates against `note-range`, and derives frequency from `reference-note` and `reference-frequency`. `generateDictionary` memoizes one entry per MIDI step with the natural spelling plus a sharp or flat spelling where one applies.

## Data layer

`DataDriven`:

- `DataDriven.create(basePath, indexSource)` returns a proxy: property access that is not a real member is treated as a data accessor.
- `load()` fetches the index, requires a `files` array of strings, then fetches every file in index order.
- Path validation rejects any directory or basename segment that is not `^[a-z0-9-]+$`.
- Key validation rejects any object key that is not `^[a-z0-9-]+$`; objects nested inside arrays are validated as well.
- Accessor resolution tries file prefixes from longest to shortest: for `a.b.c` it looks for `data/a/b/c.json`, then `data/a/b.json`, then `data/a.json`. At the first file that exists, the remaining segments are resolved as object keys.
- Every resolved object is wrapped in a proxy that throws on a missing key. `has` and own-key enumeration are forwarded.
- `DataDriven.toPlain(value)` deep-copies arrays and plain objects, removing proxies.
- `DataDriven.keyForDataPath(path)` strips a leading `data/`, strips `.json`, and replaces `/` with `.`.
- `all` returns a copy of the loaded file map keyed by repository-relative path.

`SaveSystem`:

- Prefixes every key with `<namespace>:`; the namespace is retained only as this prefix, with no separate namespace field.
- `save(key, data)` returns `true` after `localStorage.setItem` succeeds and `false` when storage throws. A failure is reported once per `save:<storage key>` through the injected logger; the message names the operation and key but never the stored value.
- `load(key)` returns the parsed value, or `null` when the key is missing, storage throws or the entry is not valid JSON. A read or parse failure is reported once per `load:<storage key>`.
- `delete(key)` returns `true` after `localStorage.removeItem` succeeds and `false` when storage throws, reported once per `delete:<storage key>`.
- `has` and `clear` operate only inside the namespace and do not add their own failure handling.
- The logger is injected through the constructor option `logger`; the default is `console.warn`.

`TextResolver`:

- Requires a lookup function.
- `text(key)` returns the looked-up string, or the key itself after reporting the key once through `onMissing` (default: a console warning).
- `has(key)` reports existence without reporting a miss.
- A lookup that throws is treated as a miss; non-string values are misses.

## Dialogue

`DialogueEngine` accepts a configuration object with `sequences` and `layout`, plus a `TextResolver`.

| Phase | Behavior |
| --- | --- |
| `playSequence(id)` | Unknown ids are ignored. Starts at line 0 with an empty buffer. |
| `update(dt, input)` | Reveals `characters-per-second` (default 30) of the resolved line. Confirm completes the current line when partially revealed, otherwise advances. After the last line the engine stops. |
| `stop()` | Clears state and invokes `onComplete` when set. |
| `render(renderer)` | Computes layout twice: once to measure the full wrapped text, once with the resulting line count. Draws box, speaker plate, revealed text and, when the line is fully revealed, the advance hint. |

Layout math: glyph width is `0.6 * fontSize`; wrapping breaks on spaces and hard-splits words longer than the line; the band is bottom-anchored, honors `margin`, `max-width`, `height` as a minimum, `max-height` and the available viewport height; `maxLines` is derived from the remaining vertical space.

Application use: one engine per stage scene, sequences from `stage.dialogue`, layout from `ui.dialogue.dialogue`. The intro sequence runs once per scene instance and blocks the stage update while active. The scene advances the dialogue with the loop's fixed step, so typewriter speed is independent of frame cadence.

## Dependency contract and UI base

- `requireDependencies(owner, dependencies, keys)` throws when the object is not an object, or when a declared key is not an own property. It returns the same object; it does not copy or validate values.
- `UIElement` stores position, anchor, visibility, size, fill color name and border name; supports children; `computeScreenPosition` delegates to `anchorPosition` and adds an optional camera offset; `render` draws children when visible; `handleInput` is a no-op.
- `anchorPosition(anchor, offset, width, height, viewportWidth, viewportHeight)` implements `top-left`, `top-right`, `top-center`, `center`, `bottom-left`, `bottom-right` and `bottom-center`. It is exported and shared: the HUD inventory indicator uses it, while the shipped components still draw in viewport coordinates rather than through `UIElement`'s child tree.

## Reporting policy

`OnceReporter` is the shared once-per-key reporter. It takes an optional logger, defaults to `console.warn`, and returns `true` only for the first report of a key. Keys are owned by the caller: `SaveSystem` uses `<operation>:<storage key>`, and `AudioEngine` uses `sfx-unknown:<name>` and `sfx-frequency:<name>`. Messages never include stored values. Both modules accept an injected logger in their constructor options, so tests can capture reports without touching the console.

## Known issues in this layer

No open defect is recorded for this layer. Failure paths in `SaveSystem` and `AudioEngine.playSFX` are reported once and do not throw into gameplay code.
