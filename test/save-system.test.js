import { beforeEach, describe, expect, test } from 'bun:test';
import { SaveSystem } from '../src/engine/data/save-system.js';

class MemoryStorage {
  #items = new Map();

  get length() {
    return this.#items.size;
  }

  key(index) {
    const keys = [...this.#items.keys()];
    return index >= 0 && index < keys.length ? keys[index] : null;
  }

  getItem(key) {
    return this.#items.has(key) ? this.#items.get(key) : null;
  }

  setItem(key, value) {
    this.#items.set(key, String(value));
  }

  removeItem(key) {
    this.#items.delete(key);
  }

  clear() {
    this.#items.clear();
  }
}

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
});

describe('SaveSystem', () => {
  test('round-trips a structured value under the namespace prefix', () => {
    const saves = new SaveSystem('game');
    const state = { stage: 'strawberry-fields', notes: 3, inventory: ['apple'] };

    saves.save('slot-1', state);

    expect(saves.load('slot-1')).toEqual(state);
    expect(localStorage.getItem('game:slot-1')).toBe(JSON.stringify(state));
  });

  test('keeps namespaces isolated from each other', () => {
    const first = new SaveSystem('slot-a');
    const second = new SaveSystem('slot-b');

    first.save('progress', { notes: 1 });
    second.save('progress', { notes: 2 });

    expect(first.load('progress')).toEqual({ notes: 1 });
    expect(second.load('progress')).toEqual({ notes: 2 });
  });

  test('returns null for a missing key', () => {
    const saves = new SaveSystem('game');

    expect(saves.load('missing')).toBeNull();
    expect(saves.has('missing')).toBe(false);
  });

  test('returns null for an entry that is not valid JSON', () => {
    const saves = new SaveSystem('game', { logger: () => {} });
    localStorage.setItem('game:slot-1', '{not-json');

    expect(saves.load('slot-1')).toBeNull();
  });

  test('reports a failure through console.warn when no logger is injected', () => {
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try {
      const saves = new SaveSystem('game');
      localStorage.setItem('game:slot-1', '{not-json');

      expect(saves.load('slot-1')).toBeNull();
    } finally {
      console.warn = originalWarn;
    }

    expect(warnings).toEqual([
      '[SaveSystem] load failed for key "game:slot-1".'
    ]);
  });

  test('reports and removes a saved key', () => {
    const saves = new SaveSystem('game');
    saves.save('slot-1', { notes: 5 });

    expect(saves.has('slot-1')).toBe(true);
    saves.delete('slot-1');
    expect(saves.has('slot-1')).toBe(false);
    expect(saves.load('slot-1')).toBeNull();
  });

  test('clears only the keys belonging to its namespace', () => {
    const saves = new SaveSystem('game');
    const other = new SaveSystem('settings');
    saves.save('slot-1', { notes: 1 });
    saves.save('slot-2', { notes: 2 });
    other.save('volume', { level: 4 });

    saves.clear();

    expect(saves.has('slot-1')).toBe(false);
    expect(saves.has('slot-2')).toBe(false);
    expect(other.load('volume')).toEqual({ level: 4 });
  });

  test('does not propagate a storage write failure', () => {
    const reports = [];
    const saves = new SaveSystem('game', { logger: (message) => reports.push(message) });
    localStorage.setItem = () => {
      throw new Error('quota exceeded');
    };

    expect(saves.save('slot-1', { notes: 1 })).toBe(false);
    expect(saves.load('slot-1')).toBeNull();
    expect(reports).toHaveLength(1);
  });

  test('returns true from a successful save without reporting', () => {
    const reports = [];
    const saves = new SaveSystem('game', { logger: (message) => reports.push(message) });

    expect(saves.save('slot-1', { notes: 1 })).toBe(true);
    expect(reports).toEqual([]);
  });

  test('returns false and reports a failed save once for the same key', () => {
    const reports = [];
    const saves = new SaveSystem('game', { logger: (message) => reports.push(message) });
    localStorage.setItem = () => {
      throw new Error('quota exceeded');
    };

    expect(saves.save('slot-1', { notes: 1 })).toBe(false);
    expect(saves.save('slot-1', { notes: 1 })).toBe(false);
    expect(reports).toEqual([
      '[SaveSystem] save failed for key "game:slot-1".'
    ]);
  });

  test('reports a failed save once for each key', () => {
    const reports = [];
    const saves = new SaveSystem('game', { logger: (message) => reports.push(message) });
    localStorage.setItem = () => {
      throw new Error('quota exceeded');
    };

    saves.save('slot-1', { notes: 1 });
    saves.save('slot-2', { notes: 2 });
    saves.save('slot-1', { notes: 1 });

    expect(reports).toEqual([
      '[SaveSystem] save failed for key "game:slot-1".',
      '[SaveSystem] save failed for key "game:slot-2".'
    ]);
  });

  test('does not report a missing load', () => {
    const reports = [];
    const saves = new SaveSystem('game', { logger: (message) => reports.push(message) });

    expect(saves.load('missing')).toBeNull();
    expect(reports).toEqual([]);
  });

  test('returns null and reports a parse failure once for the same key', () => {
    const reports = [];
    const saves = new SaveSystem('game', { logger: (message) => reports.push(message) });
    localStorage.setItem('game:slot-1', '{not-json');

    expect(saves.load('slot-1')).toBeNull();
    expect(saves.load('slot-1')).toBeNull();
    expect(reports).toEqual([
      '[SaveSystem] load failed for key "game:slot-1".'
    ]);
  });

  test('returns null and reports a storage read failure once for the same key', () => {
    const reports = [];
    const saves = new SaveSystem('game', { logger: (message) => reports.push(message) });
    localStorage.getItem = () => {
      throw new Error('storage unavailable');
    };

    expect(saves.load('slot-1')).toBeNull();
    expect(saves.load('slot-1')).toBeNull();
    expect(reports).toEqual([
      '[SaveSystem] load failed for key "game:slot-1".'
    ]);
  });

  test('returns true from a successful delete without reporting', () => {
    const reports = [];
    const saves = new SaveSystem('game', { logger: (message) => reports.push(message) });
    saves.save('slot-1', { notes: 1 });

    expect(saves.delete('slot-1')).toBe(true);
    expect(reports).toEqual([]);
  });

  test('returns false and reports a failed delete once for the same key', () => {
    const reports = [];
    const saves = new SaveSystem('game', { logger: (message) => reports.push(message) });
    localStorage.removeItem = () => {
      throw new Error('storage unavailable');
    };

    expect(saves.delete('slot-1')).toBe(false);
    expect(saves.delete('slot-1')).toBe(false);
    expect(reports).toEqual([
      '[SaveSystem] delete failed for key "game:slot-1".'
    ]);
  });

  test('reports a failed save without leaking the stored value', () => {
    const reports = [];
    const saves = new SaveSystem('game', { logger: (message) => reports.push(message) });
    localStorage.setItem = () => {
      throw new Error('quota exceeded');
    };

    saves.save('slot-1', { secret: 'do-not-leak' });

    expect(reports).toHaveLength(1);
    expect(reports[0]).not.toContain('do-not-leak');
  });
});
