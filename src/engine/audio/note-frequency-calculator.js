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
        'note-range lowest must be <= highest',
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

  midiNumber(noteName) {
    this.validate(noteName);
    return this.#midiNumberInternal(noteName);
  }

  #midiNumberInternal(noteName) {
    const { octave, semitoneBase, accidentalOffset } = this.parseNote(noteName);
    return (octave + 1) * 12 + semitoneBase + accidentalOffset;
  }

  frequency(noteName) {
    this.validate(noteName);
    const midi = this.#midiNumberInternal(noteName);
    return this.#referenceFrequency * Math.pow(2, (midi - this.#referenceMidi) / 12);
  }

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

  generateDictionary() {
    if (this.#dictionary) {
      return this.#dictionary;
    }

    const map = new Map();

    for (let midi = this.#lowestMidi; midi <= this.#highestMidi; midi++) {
      const frequency = this.#referenceFrequency * Math.pow(2, (midi - this.#referenceMidi) / 12);
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

export { NoteFrequencyCalculator, NoteFrequencyError };
