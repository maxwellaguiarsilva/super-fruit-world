class NoteCollectionTracker {
  #collected;
  #noteNames;
  #totalNotes;
  #lastCollected;
  #rewardTriggered;

  constructor(noteRangeConfig) {
    const lowest = noteRangeConfig.lowest ?? 'c4';
    const count = noteRangeConfig.count ?? 8;

    this.#totalNotes = count;
    this.#collected = [];
    this.#noteNames = [];
    this.#lastCollected = null;
    this.#rewardTriggered = false;

    const semitones = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
    const lowestMatch = /^([a-g])([#bx]*)(-?\d+)$/i.exec(lowest);
    let octave = 4;

    if (lowestMatch) {
      const letter = lowestMatch[1].toLowerCase();
      const idx = semitones.indexOf(letter);
      octave = parseInt(lowestMatch[3], 10);
      for (let i = 0; i < count; i++) {
        const semiIdx = (idx + i * 2) % 12;
        const noteOctave = octave + Math.floor((idx + i * 2) / 12);
        this.#noteNames.push(`${semitones[semiIdx]}${noteOctave}`);
      }
    }
  }

  get collectedCount() { return this.#collected.length; }
  get totalNotes() { return this.#totalNotes; }
  get isAllCollected() { return this.#collected.length >= this.#totalNotes; }
  get collected() { return [...this.#collected].sort((a, b) => a - b); }
  get lastCollectedNote() { return this.#lastCollected; }
  get noteNames() { return [...this.#noteNames]; }

  collect(noteOrder) {
    if (this.#collected.includes(noteOrder)) {
      return false;
    }

    if (noteOrder < 1 || noteOrder > this.#totalNotes) {
      return false;
    }

    this.#collected.push(noteOrder);
    this.#lastCollected = this.#noteNames[noteOrder - 1] ?? null;
    return true;
  }

  noteForOrder(order) {
    if (order < 1 || order > this.#totalNotes) {
      return null;
    }
    return this.#noteNames[order - 1] ?? null;
  }

  isCollected(noteOrder) {
    return this.#collected.includes(noteOrder);
  }

  reset() {
    this.#collected = [];
    this.#lastCollected = null;
    this.#rewardTriggered = false;
  }
}

export { NoteCollectionTracker };
