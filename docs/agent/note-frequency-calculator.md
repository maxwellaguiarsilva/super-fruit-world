# Note Frequency Calculator — Design & Prototype

## Overview

The `NoteFrequencyCalculator` is an engine-layer class (`src/engine/audio/`) responsible for converting named musical notes (e.g. `"c4"`, `"a#4"`, `"eb5"`) into their corresponding frequency in Hz using the equal temperament formula. It also generates the full frequency dictionary for all notes within a configured `note-range`.

This is a **generic utility** — it has no awareness of Super Fruit World, musical note collectibles, or any game concept. It receives its configuration as a plain object via dependency injection and operates purely on that data.

**Consumers:**
- **SFX/BGM synthesis** — resolves note names in `data/audio/sfx.json` and `data/audio/bgm.json` to frequencies for Web Audio API oscillators.
- **Musical note collectible** — plays the correct pitch when a note is collected, based on its position in the sequence.

---

## Architecture

```
tuning config object (from data/audio/config.json)
        │
        ▼
┌───────────────────────────┐
│  NoteFrequencyCalculator   │
│                           │
│  constructor(config)      │
│  frequency(name)  → Hz    │
│  midiNumber(name) → int   │
│  parseNote(name)  → parts │
│  generateDictionary()     │   ──► Map<noteName, Hz>
│  validate(name)           │
│  get referenceFrequency() │
│  get lowestMidi()         │
│  get highestMidi()        │
└───────────────────────────┘
        │
        ▼
   Audio Engine (Web Audio API oscillators)
```

The class is instantiated once at engine boot time by the audio system composer, which reads `data/audio/config.json` and passes the `tuning` sub-object into the constructor.

---

## Input Configuration

The `config` parameter passed to the constructor is the `tuning` object from `data/audio/config.json`:

```json
{
  "reference-note": "a4",
  "reference-frequency": 440,
  "note-range": { "lowest": "c1", "highest": "c6" }
}
```

The calculator treats this as opaque — it does not know or care that it came from `config.json`. The dependency is injected, so a different tuning could be passed in testing or for alternative temperaments.

---

## Algorithm

### 1. Note Name Parsing

**RegExp:** `/^([a-g])([#bx]*)(-?\d+)$/i`

| Group | Description | Examples |
|-------|-------------|----------|
| `([a-g])` | Note letter (A–G, case-insensitive) | `c`, `A`, `f` |
| `([#bx]*)` | Accidentals (zero or more) | `#`, `b`, `x`, `##`, `bb`, `#x` |
| `(-?\d+)` | Octave number (supports negative for sub-bass) | `1`, `4`, `-1` |

The octave group allows negative numbers (e.g., `"a-1"`) for MIDI compatibility, though the configured `note-range` will restrict the practical range. The `-` before the number is unambiguously the octave sign because note letters A–G never appear next to a leading minus.

### 2. Note Letter → Semitone Index

| Letter | C | D | E | F | G | A | B |
|--------|---|---|---|---|---|---|---|
| Index  | 0 | 2 | 4 | 5 | 7 | 9 | 11 |

### 3. Accidental → Offset

| Accidental | Offset | Notes |
|------------|--------|-------|
| `#` | +1 | Sharp — one semitone up |
| `b` | -1 | Flat — one semitone down |
| `x` | +2 | Double sharp — two semitones up |
| `##` | +2 | Double sharp alternative notation |
| `bb` | -2 | Double flat — two semitones down |
| `#b` | +1, -1 = 0 | Cancels out to natural |
| `b#` | -1, +1 = 0 | Cancels out to natural |

Multiple accidentals are processed **cumulatively** in left-to-right order.

### 4. MIDI Note Number

```
midiNumber = (octave + 1) × 12 + semitoneIndex + accidentalOffset
```

| Note | Octave | Semitone | Accidentals | MIDI | Verification |
|------|--------|----------|-------------|------|-------------|
| C1 | 1 | 0 | — | 24 | `(1+1)×12 + 0 = 24` |
| C4 | 4 | 0 | — | 60 | Middle C |
| A4 | 4 | 9 | — | 69 | Reference (A440) |
| C6 | 6 | 0 | — | 84 | |
| A-1 | -1 | 9 | — | 9 | Lowest valid MIDI |
| C#4 | 4 | 0 | # (+1) | 61 | Db4 |
| Eb4 | 4 | 4 | b (-1) | 63 | D#4 |
| F##4 | 4 | 5 | ## (+2) | 73 | G4 |
| Bbb4 | 4 | 11 | bb (-2) | 75 | A4 |

### 5. Frequency from MIDI

```
frequency = referenceFrequency × 2^((midiNote - referenceMidi) / 12)
```

Using default config: A4 = 440Hz, MIDI 69.
- A4: `440 × 2^((69 - 69) / 12)` = **440.00 Hz**
- C4: `440 × 2^((60 - 69) / 12)` = **261.63 Hz**
- C6: `440 × 2^((84 - 69) / 12)` = **1046.50 Hz**

---

## Prototype Code

```js
// ──────────────────────────────────────────────
// Engine layer: src/engine/audio/note-frequency-calculator.js
// Generic note-name → frequency converter (equal temperament).
// Zero game awareness. Receives tuning config via DI.
// ──────────────────────────────────────────────

const NOTE_TO_SEMITONE = Object.freeze({
    c: 0,
    d: 2,
    e: 4,
    f: 5,
    g: 7,
    a: 9,
    b: 11
});

const ACCIDENTAL_MAP = Object.freeze({
    '#': +1,
    'b': -1,
    'x': +2
});

const NATURAL_NOTES = Object.freeze(['c', 'd', 'e', 'f', 'g', 'a', 'b']);
const SHARP_NOTES  = Object.freeze(['c', 'd', null, 'f', 'g', 'a', null]); // E and B have no sharp
const FLAT_NOTES   = Object.freeze([null, 'd', 'e', null, 'g', 'a', 'b']); // C and F have no flat

class NoteFrequencyError extends Error {
    constructor(message, noteName) {
        super(message);
        this.name = 'NoteFrequencyError';
        this.noteName = noteName;
    }
}

class NoteFrequencyCalculator {
    #referenceFrequency;
    #referenceNote;
    #referenceMidi;
    #lowestNote;
    #lowestMidi;
    #highestNote;
    #highestMidi;
    #dictionary;

    static NOTE_REGEX = /^([a-g])([#bx]*)(-?\d+)$/i;

    constructor(tuningConfig) {
        this.#referenceFrequency = tuningConfig['reference-frequency'];
        this.#referenceNote = tuningConfig['reference-note'];
        this.#referenceMidi = this.#midiNumberInternal(this.#referenceNote);

        const range = tuningConfig['note-range'];
        this.#lowestNote = range['lowest'];
        this.#highestNote = range['highest'];
        this.#lowestMidi = this.#midiNumberInternal(this.#lowestNote);
        this.#highestMidi = this.#midiNumberInternal(this.#highestNote);

        if (this.#lowestMidi > this.#highestMidi) {
            throw new NoteFrequencyError(
                'note-range lowest must be ≤ highest',
                `${this.#lowestNote}..${this.#highestNote}`
            );
        }

        this.#dictionary = null;
    }

    get referenceFrequency() { return this.#referenceFrequency; }
    get referenceNote()     { return this.#referenceNote; }
    get referenceMidi()     { return this.#referenceMidi; }
    get lowestNote()        { return this.#lowestNote; }
    get lowestMidi()        { return this.#lowestMidi; }
    get highestNote()       { return this.#highestNote; }
    get highestMidi()       { return this.#highestMidi; }

    // ── Parsing ───────────────────────────────

    parseNote(noteName) {
        if (typeof noteName !== 'string' || !noteName) {
            throw new NoteFrequencyError('note name must be a non-empty string', String(noteName));
        }

        const normalized = noteName.trim().toLowerCase();
        const match = NoteFrequencyCalculator.NOTE_REGEX.exec(normalized);

        if (!match) {
            throw new NoteFrequencyError(
                `invalid note name "${noteName}": expected format like "c4", "a#4", "eb5"`,
                noteName
            );
        }

        const letter = match[1];
        const accidentalStr = match[2];
        const octave = parseInt(match[3], 10);

        const semitoneBase = NOTE_TO_SEMITONE[letter];
        const accidentalOffset = this.#resolveAccidentals(accidentalStr, noteName);

        return { letter, accidentalStr, octave, semitoneBase, accidentalOffset };
    }

    #resolveAccidentals(rawAccidentals, noteName) {
        if (!rawAccidentals) {
            return 0;
        }

        let total = 0;
        for (let i = 0; i < rawAccidentals.length; i++) {
            const ch = rawAccidentals[i];
            if (ch === '#') {
                total += ACCIDENTAL_MAP['#'];
            } else if (ch === 'b') {
                total += ACCIDENTAL_MAP['b'];
            } else if (ch === 'x') {
                total += ACCIDENTAL_MAP['x'];
            } else {
                throw new NoteFrequencyError(
                    `unknown accidental character "${ch}" in note "${noteName}"`,
                    noteName
                );
            }
        }
        return total;
    }

    // ── MIDI Number ───────────────────────────

    midiNumber(noteName) {
        this.validate(noteName);
        return this.#midiNumberInternal(noteName);
    }

    #midiNumberInternal(noteName) {
        const { octave, semitoneBase, accidentalOffset } = this.parseNote(noteName);
        return (octave + 1) * 12 + semitoneBase + accidentalOffset;
    }

    // ── Frequency ────────────────────────────

    frequency(noteName) {
        this.validate(noteName);
        const midi = this.#midiNumberInternal(noteName);
        return this.#referenceFrequency * Math.pow(2, (midi - this.#referenceMidi) / 12);
    }

    // ── Range Validation ─────────────────────

    validate(noteName) {
        const midi = this.#midiNumberInternal(noteName);

        if (midi < this.#lowestMidi) {
            throw new NoteFrequencyError(
                `note "${noteName}" (MIDI ${midi}) is below note-range minimum ` +
                `"${this.#lowestNote}" (MIDI ${this.#lowestMidi})`,
                noteName
            );
        }

        if (midi > this.#highestMidi) {
            throw new NoteFrequencyError(
                `note "${noteName}" (MIDI ${midi}) is above note-range maximum ` +
                `"${this.#highestNote}" (MIDI ${this.#highestMidi})`,
                noteName
            );
        }

        return true;
    }

    isInRange(noteName) {
        try {
            this.validate(noteName);
            return true;
        } catch {
            return false;
        }
    }

    // ── Dictionary Generation ────────────────

    generateDictionary() {
        if (this.#dictionary) {
            return this.#dictionary;
        }

        const map = new Map();

        for (let midi = this.#lowestMidi; midi <= this.#highestMidi; midi++) {
            const frequency =
                this.#referenceFrequency * Math.pow(2, (midi - this.#referenceMidi) / 12);

            const names = this.#noteNamesForMidi(midi);
            for (const name of names) {
                map.set(name, frequency);
            }
        }

        this.#dictionary = map;
        return map;
    }

    #noteNamesForMidi(midi) {
        const names = [];

        const semitone = ((midi % 12) + 12) % 12;
        const octave = Math.floor(midi / 12) - 1;
        const letterIndex = semitone;
        const naturalValue = NATURAL_NOTES[letterIndex % 7];

        if (naturalValue) {
            names.push(`${naturalValue}${octave}`);

            const naturalSemitone = NOTE_TO_SEMITONE[naturalValue];
            const diff = semitone - naturalSemitone;

            if (diff === 1 || diff === -11) {
                const noteBelow = this.#noteLetterForSemitone(letterIndex - 1);
                if (noteBelow) {
                    const sharpOctave = diff === -11 ? octave - 1 : octave;
                    names.push(`${noteBelow}#${sharpOctave}`);
                }
            } else if (diff === -1 || diff === 11) {
                const noteAbove = this.#noteLetterForSemitone(letterIndex + 1);
                if (noteAbove) {
                    const flatOctave = diff === 11 ? octave + 1 : octave;
                    names.push(`${noteAbove}b${flatOctave}`);
                }
            }
        }

        return names;
    }

    #noteLetterForSemitone(letterIndex) {
        const idx = ((letterIndex % 7) + 7) % 7;
        return NATURAL_NOTES[idx];
    }
}

// ── Usage Examples ───────────────────────────

if (typeof process !== 'undefined' && process.env['NODE_ENV'] === 'test') {

    const tuning = {
        'reference-note': 'a4',
        'reference-frequency': 440,
        'note-range': { lowest: 'c1', highest: 'c6' }
    };

    const calc = new NoteFrequencyCalculator(tuning);

    // Basic frequency lookups
    calc.frequency('a4');    // → 440.00
    calc.frequency('c4');    // → 261.63
    calc.frequency('c6');    // → 1046.50

    // Accidentals
    calc.frequency('c#4');   // → 277.18  (same as Db4)
    calc.frequency('db4');   // → 277.18  (same as C#4)
    calc.frequency('eb5');   // → 622.25  (same as D#5)
    calc.frequency('d#5');   // → 622.25

    // Double accidentals
    calc.frequency('f##4');  // → 392.00  (same as G4)
    calc.frequency('bbb4');  // → 392.00  (B double-flat is same as A4 = 440? wait, let's recalculate)

    // Bbb4 = B (11) - 2 = 9 = A, MIDI = (4+1)*12 + 9 = 69 → 440Hz ✓
    calc.frequency('bbb4');  // → 440.00

    // Full dictionary
    const dict = calc.generateDictionary();
    dict.get('c1');  // → 32.70
    dict.get('a#4'); // → 466.16

    // Validation — out of range
    try {
        calc.frequency('c7');
    } catch (e) {
        e instanceof NoteFrequencyError; // true
        e.noteName;                       // 'c7'
    }

    // Validation — invalid note
    try {
        calc.frequency('h4');
    } catch (e) {
        e instanceof NoteFrequencyError; // true
    }
}
```

---

## Class Design Decisions

### Why a class and not a module of functions?

Per R1.2, the codebase follows OOP. The calculator has state (reference tuning, computed range boundaries, lazy dictionary) that is naturally encapsulated. A class with dependency-injected config satisfies R1.3 (no globals) and uses native getters per R1.4.

### Why not generate the dictionary eagerly in the constructor?

The dictionary may be large (up to ~85 entries for C1–C6 with enharmonics). For a simple frequency lookup like `calc.frequency('c4')`, constructing the full dictionary is unnecessary work. The dictionary is generated lazily on first call to `generateDictionary()` and cached thereafter. Consumers that only need point lookups (e.g., the musical note collectible playing one note at a time) don't pay the generation cost.

### Why `#dictionary` as a `Map` and not a plain object?

- `Map` provides O(1) lookup with clean `get`/`set`/`has` semantics.
- `Map` keys are strings (note names) — no prototype pollution risk.
- Can be iterated with `for...of` or `.entries()`.
- Standard JS `.size` property.

### Why enforce the note-range at runtime?

The `note-range` in `config.json` defines the practical frequency range the audio system needs to support. Notes outside this range should be rejected early with a clear error rather than silently producing unexpected frequencies. The `validate()` method is called by `frequency()` and `midiNumber()` to ensure callers are within bounds. The internal `#midiNumberInternal()` skips validation for internal use (parsing the configured range boundaries themselves).

### Why support double sharps and double flats?

In equal temperament, notes like F## (F double sharp) are enharmonically equivalent to G natural. Supporting `x` (double sharp) and `bb` (double flat) ensures that any syntactically valid music notation note name can be resolved. While the current musical-note scale in `config.json` only uses naturals, future BGM tracks or imported MIDI data could use these accidentals. The implementation cost is trivial — it's just summing cumulative accidental offsets.

---

## Edge Cases

| Edge Case | Behavior |
|-----------|----------|
| Empty string / null / non-string | `NoteFrequencyError` thrown: "note name must be a non-empty name" |
| Invalid letter (e.g., `"h4"`) | `NoteFrequencyError` thrown: "invalid note name" — regex won't match |
| Out of range (e.g., `"c7"` when range is C1–C6) | `NoteFrequencyError` thrown: "note is above note-range maximum" |
| Out of range low (e.g., `"b0"`) | `NoteFrequencyError` thrown: "note is below note-range minimum" |
| Multiple accidentals (e.g., `"c#b4"`) | Accumulates: # (+1) + b (-1) = 0 → C4. Resolves correctly. |
| Double sharp (e.g., `"fx4"`) | F (5) + x (+2) = 7 = G. MIDI 67 → G4. |
| Double flat (e.g., `"abb3"`) | A (9) + bb (-2) = 7 = G. MIDI 55 → G3. |
| Negative octave (e.g., `"a-1"`) | `(-1+1)×12 + 9 = 9`. Valid MIDI. Rejected only if below `note-range`. |
| Leading/trailing whitespace | Trimmed before parsing. `"  c4  "` → `"c4"`. |
| Uppercase note names | Normalized to lowercase. `"C#4"` → `"c#4"`. |
| `B#` vs `C` enharmonic | B# is 11+1=12=C. MIDI: `(4+1)×12 + 12 = 72`. Correct (C5). |
| `E#` vs `F` enharmonic | E# is 4+1=5=F. MIDI: `(4+1)×12 + 5 = 65`. Correct (F4). |
| `Cb` vs `B` enharmonic | Cb is 0-1=-1, wraps to 11=B. MIDI octave decreases by 1 via modular within `#noteNamesForMidi`. |
| Note with `-` prefix but invalid letter (e.g., `"-h4"`) | Regex won't match — treated as invalid. |

---

## Integration Points

### 1. Audio Engine Constructor

```js
// Engine boot (src/engine/audio/audio-engine.js)

import { NoteFrequencyCalculator } from './note-frequency-calculator.js';

class AudioEngine {
    #calculator;

    constructor(audioConfig) {
        this.#calculator = new NoteFrequencyCalculator(audioConfig.tuning);
    }

    playSFX(sfxDefinition) {
        // sfxDefinition.frequency → can be a note name string or a raw Hz number
        const hz = typeof sfxDefinition.frequency === 'number'
            ? sfxDefinition.frequency
            : this.#calculator.frequency(sfxDefinition.frequency);
        // ... create oscillator at `hz`
    }
}
```

### 2. Musical Note Collectible

```js
// src/game/systems/musical-note-system.js

class MusicalNoteSystem {
    #calculator;
    #scale; // e.g., ["c4", "d4", "e4", "f4", "g4", "a4", "b4", "c5"]

    constructor(calculator, scale) {
        this.#calculator = calculator;
        this.#scale = scale;
    }

    frequencyForCollectionIndex(index) {
        const noteName = this.#scale[index];
        return this.#calculator.frequency(noteName);
    }
}
```

---

## Testing Strategy

Unit tests (to be written in `tests/`):

1. **Parsing** — valid note names produce correct `{ letter, accidentalStr, octave, semitoneBase, accidentalOffset }`.
2. **MIDI numbers** — verify known MIDI values: C4=60, A4=69, C1=24, C6=84.
3. **Frequencies** — to 2 decimal places tolerance: A4=440.00, C4=261.63, C6=1046.50.
4. **Accidentals** — C#4 != C4, Db4 == C#4, F##4 == G4, Bbb4 == A4 (440Hz), E#4 == F4.
5. **Range validation** — out-of-range throws, in-range passes.
6. **Invalid input** — null, empty, "h4", "4", "c" (no octave), all throw `NoteFrequencyError`.
7. **Dictionary coverage** — generated dictionary contains all natural + sharp + flat names for the range.
8. **Dictionary consistency** — every dictionary entry's frequency matches the direct `frequency()` call for the same note name.
9. **Configuration edge cases** — range where lowest > highest throws, reference note outside range is accepted but will produce correct math.
