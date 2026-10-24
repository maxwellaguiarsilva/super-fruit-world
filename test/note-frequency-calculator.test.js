import { describe, expect, test } from 'bun:test';
import {
  NoteFrequencyCalculator,
  NoteFrequencyError
} from '../src/engine/audio/note-frequency-calculator.js';

function tuning(overrides = {}) {
  return {
    'reference-frequency': 440,
    'reference-note': 'a4',
    'note-range': { lowest: 'c4', highest: 'a5' },
    ...overrides
  };
}

describe('NoteFrequencyCalculator', () => {
  test('computes MIDI numbers for natural notes', () => {
    const calculator = new NoteFrequencyCalculator(tuning());

    expect(calculator.midiNumber('c4')).toBe(60);
    expect(calculator.midiNumber('a4')).toBe(69);
    expect(calculator.midiNumber('a5')).toBe(81);
  });

  test('parses sharps, flats and double sharps', () => {
    const calculator = new NoteFrequencyCalculator(tuning());

    expect(calculator.midiNumber('c#4')).toBe(61);
    expect(calculator.midiNumber('db4')).toBe(61);
    expect(calculator.midiNumber('cx4')).toBe(62);
    expect(calculator.parseNote('EB5')).toEqual({
      letter: 'e',
      accidentalStr: 'b',
      octave: 5,
      semitoneBase: 4,
      accidentalOffset: -1
    });
  });

  test('derives frequency from the configured reference note', () => {
    const calculator = new NoteFrequencyCalculator(tuning());

    expect(calculator.frequency('a4')).toBeCloseTo(440, 6);
    expect(calculator.frequency('a5')).toBeCloseTo(880, 6);
    expect(calculator.frequency('c4')).toBeCloseTo(261.625565, 5);
  });

  test('rejects malformed note names', () => {
    const calculator = new NoteFrequencyCalculator(tuning());

    expect(() => calculator.parseNote('')).toThrow(NoteFrequencyError);
    expect(() => calculator.parseNote('h4')).toThrow(NoteFrequencyError);
    expect(() => calculator.parseNote('a')).toThrow(NoteFrequencyError);
  });

  test('rejects notes outside the configured range', () => {
    const calculator = new NoteFrequencyCalculator(tuning());

    expect(() => calculator.validate('b5')).toThrow(NoteFrequencyError);
    expect(() => calculator.validate('c3')).toThrow(NoteFrequencyError);
    expect(calculator.isInRange('b5')).toBe(false);
    expect(calculator.isInRange('a5')).toBe(true);
  });

  test('rejects an inverted note range at construction time', () => {
    expect(
      () => new NoteFrequencyCalculator(tuning({ 'note-range': { lowest: 'a5', highest: 'c4' } }))
    ).toThrow(NoteFrequencyError);
  });

  test('builds a memoized frequency dictionary for the configured range', () => {
    const calculator = new NoteFrequencyCalculator(tuning());
    const dictionary = calculator.generateDictionary();

    expect(dictionary).toBeInstanceOf(Map);
    expect(calculator.generateDictionary()).toBe(dictionary);
    expect(dictionary.has('a4')).toBe(true);

    for (const frequency of dictionary.values()) {
      expect(Number.isFinite(frequency)).toBe(true);
      expect(frequency).toBeGreaterThan(0);
    }
  });
});
