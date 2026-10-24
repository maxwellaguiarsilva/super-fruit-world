import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

import { NoteCollectionTracker } from '../src/game/systems/note-collection-tracker.js';

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8'));
}

const SYNTHESIS = readJson('data/audio/synthesis.json');
const DECLARED_SCALE = SYNTHESIS['musical-note-scale'];

describe('NoteCollectionTracker', () => {
  test('plays the declared musical-note scale in order', () => {
    const tracker = new NoteCollectionTracker({ notes: DECLARED_SCALE });

    expect(tracker.noteNames).toEqual(DECLARED_SCALE);
    expect(tracker.totalNotes).toBe(DECLARED_SCALE.length);
    expect(tracker.noteForOrder(4)).toBe('f4');
    expect(tracker.noteForOrder(8)).toBe('c5');
  });

  test('records the declared note for the collected order', () => {
    const tracker = new NoteCollectionTracker({ notes: DECLARED_SCALE });

    expect(tracker.collect(6)).toBe(true);
    expect(tracker.lastCollectedNote).toBe('a4');
    expect(tracker.isCollected(6)).toBe(true);
    expect(tracker.collectedCount).toBe(1);
  });

  test('the declared scale wins over the range fields', () => {
    const tracker = new NoteCollectionTracker({ lowest: 'c4', count: 8, notes: ['a4', 'b4', 'c5'] });

    expect(tracker.totalNotes).toBe(3);
    expect(tracker.noteNames).toEqual(['a4', 'b4', 'c5']);
  });

  test('falls back to whole-tone steps from lowest and count without a declared scale', () => {
    const tracker = new NoteCollectionTracker({ lowest: 'c4', count: 4 });

    expect(tracker.totalNotes).toBe(4);
    expect(tracker.noteNames).toEqual(['c4', 'd4', 'e4', 'f#4']);
  });

  test('rejects duplicate, out-of-range and invalid orders', () => {
    const tracker = new NoteCollectionTracker({ notes: DECLARED_SCALE });

    expect(tracker.collect(0)).toBe(false);
    expect(tracker.collect(9)).toBe(false);
    expect(tracker.collect(1)).toBe(true);
    expect(tracker.collect(1)).toBe(false);
    expect(tracker.collected).toEqual([1]);
    expect(tracker.noteForOrder(0)).toBeNull();
    expect(tracker.noteForOrder(9)).toBeNull();
  });

  test('reports completion and resets the collected state', () => {
    const tracker = new NoteCollectionTracker({ notes: ['c4', 'd4'] });

    tracker.collect(1);
    expect(tracker.isAllCollected).toBe(false);

    tracker.collect(2);
    expect(tracker.isAllCollected).toBe(true);

    tracker.reset();
    expect(tracker.collected).toEqual([]);
    expect(tracker.collectedCount).toBe(0);
    expect(tracker.lastCollectedNote).toBeNull();
    expect(tracker.isAllCollected).toBe(false);
  });

  test('the shipped scale is the C-major scale declared by the audio data', () => {
    expect(DECLARED_SCALE).toEqual(['c4', 'd4', 'e4', 'f4', 'g4', 'a4', 'b4', 'c5']);
  });
});
