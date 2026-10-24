import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, test } from 'bun:test';
import { SaveSystem } from '../src/engine/data/save-system.js';
import { Collectible } from '../src/game/entities/collectible.js';
import { KeyDoor } from '../src/game/stages/teleporters.js';
import { Inventory } from '../src/game/systems/inventory.js';
import {
  ProgressStore,
  PROGRESS_SCHEMA_VERSION,
  applyProgressToMapConfig,
  defaultUnlockedStages,
  inventoryItemNames,
  unlockedByCompletion
} from '../src/game/systems/progression-system.js';

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

const mapConfig = {
  sections: [
    {
      name: 'continent-1',
      objects: [
        { type: 'stage-node', 'stage-id': 'strawberry-fields', state: 'available', 'unlock-condition': null },
        {
          type: 'stage-node',
          'stage-id': 'avocado-grove',
          state: 'locked',
          'unlock-condition': { type: 'stage-complete', stage: 'strawberry-fields' }
        },
        {
          type: 'stage-node',
          'stage-id': 'secret-grove',
          state: 'locked',
          'unlock-condition': { type: 'key-required', 'key-name': 'secret-grove-key' }
        }
      ]
    }
  ]
};

function progressFixture(overrides = {}) {
  return {
    completedStageIds: [],
    unlockedStageIds: [],
    lastStageId: null,
    score: 0,
    level: 0,
    inventory: { items: [], defaultSelected: null },
    ...overrides
  };
}

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
});

describe('ProgressStore persistence', () => {
  test('round-trips the persisted surface under the save namespace', () => {
    const store = new ProgressStore(new SaveSystem('game'));
    const progress = progressFixture({
      completedStageIds: ['strawberry-fields'],
      unlockedStageIds: ['strawberry-fields', 'avocado-grove'],
      lastStageId: 'strawberry-fields',
      score: 1250,
      level: 2,
      inventory: {
        items: [{ name: 'apple', count: 3 }, { name: 'moon', count: 1 }],
        defaultSelected: 'apple'
      }
    });

    store.save(progress);

    expect(store.load()).toEqual(progress);
  });

  test('writes a versioned schema with kebab-case keys', () => {
    const store = new ProgressStore(new SaveSystem('game'));
    store.save(progressFixture({
      completedStageIds: ['strawberry-fields'],
      lastStageId: 'strawberry-fields',
      score: 10,
      level: 1,
      inventory: { items: [{ name: 'apple', count: 2 }], defaultSelected: 'apple' }
    }));

    const raw = JSON.parse(localStorage.getItem('game:progress'));

    expect(raw).toEqual({
      version: PROGRESS_SCHEMA_VERSION,
      'completed-stages': ['strawberry-fields'],
      'unlocked-stages': [],
      'last-stage': 'strawberry-fields',
      score: 10,
      level: 1,
      inventory: {
        items: [{ name: 'apple', count: 2 }],
        'default-selected': 'apple'
      }
    });
  });

  test('returns null when no progress has been stored', () => {
    const store = new ProgressStore(new SaveSystem('game'));

    expect(store.load()).toBeNull();
  });

  test('resets the entry when the schema version does not match', () => {
    const store = new ProgressStore(new SaveSystem('game'));
    localStorage.setItem('game:progress', JSON.stringify({
      version: PROGRESS_SCHEMA_VERSION + 1,
      'completed-stages': ['strawberry-fields'],
      'last-stage': 'strawberry-fields'
    }));

    expect(store.load()).toBeNull();
    expect(localStorage.getItem('game:progress')).toBeNull();
  });

  test('drops malformed field values while keeping the valid surface', () => {
    const store = new ProgressStore(new SaveSystem('game'));
    localStorage.setItem('game:progress', JSON.stringify({
      version: PROGRESS_SCHEMA_VERSION,
      'completed-stages': ['strawberry-fields', 'strawberry-fields', 7, ''],
      'unlocked-stages': 'not-an-array',
      'last-stage': '',
      score: -5,
      level: 'two',
      inventory: { items: [{ name: 'apple', count: 2 }, { name: '', count: 1 }], 'default-selected': 'apple' }
    }));

    expect(store.load()).toEqual(progressFixture({
      completedStageIds: ['strawberry-fields'],
      inventory: { items: [{ name: 'apple', count: 2 }], defaultSelected: 'apple' }
    }));
  });

  test('keeps progress inside its own namespace', () => {
    const first = new ProgressStore(new SaveSystem('first'));
    const second = new ProgressStore(new SaveSystem('second'));

    first.save(progressFixture({ score: 100 }));
    second.save(progressFixture({ score: 200 }));

    expect(first.load().score).toBe(100);
    expect(second.load().score).toBe(200);
  });
});

describe('Map unlock derivation', () => {
  test('reports the stage nodes unlocked by their declared state', () => {
    expect(defaultUnlockedStages(mapConfig)).toEqual(['strawberry-fields']);
  });

  test('derives the next stage from a stage-complete unlock condition', () => {
    expect(unlockedByCompletion(mapConfig, ['strawberry-fields'])).toEqual(['avocado-grove']);
    expect(unlockedByCompletion(mapConfig, [])).toEqual([]);
  });

  test('applies completed and unlocked states to the map nodes', () => {
    const applied = applyProgressToMapConfig(mapConfig, {
      completedStageIds: ['strawberry-fields'],
      unlockedStageIds: ['avocado-grove']
    });

    const states = applied.sections[0].objects.map((node) => [node['stage-id'], node.state]);

    expect(states).toEqual([
      ['strawberry-fields', 'completed'],
      ['avocado-grove', 'available'],
      ['secret-grove', 'locked']
    ]);
    expect(mapConfig.sections[0].objects[0].state).toBe('available');
  });

  test('does not unlock a key-gated node from completion alone', () => {
    const applied = applyProgressToMapConfig(mapConfig, {
      completedStageIds: ['strawberry-fields', 'avocado-grove']
    });

    const secret = applied.sections[0].objects.find((node) => node['stage-id'] === 'secret-grove');

    expect(secret.state).toBe('locked');
  });

  test('reports the key-gated node only when the named key is in the inventory', () => {
    expect(unlockedByCompletion(mapConfig, [], [])).toEqual([]);
    expect(unlockedByCompletion(mapConfig, [], ['key:other-key'])).toEqual([]);
    expect(unlockedByCompletion(mapConfig, [], ['key:secret-grove-key'])).toEqual(['secret-grove']);
    expect(unlockedByCompletion(mapConfig, [], [{ name: 'key:secret-grove-key', count: 1 }]))
      .toEqual(['secret-grove']);
  });

  test('keeps the key-gated node locked when the key entry carries no quantity', () => {
    const applied = applyProgressToMapConfig(mapConfig, {
      completedStageIds: [],
      inventory: { items: [{ name: 'key:secret-grove-key', count: 0 }] }
    });

    const secret = applied.sections[0].objects.find((node) => node['stage-id'] === 'secret-grove');

    expect(secret.state).toBe('locked');
  });

  test('applies mixed stage-complete and key-required conditions in one pass', () => {
    const applied = applyProgressToMapConfig(mapConfig, {
      completedStageIds: ['strawberry-fields'],
      inventory: { items: [{ name: 'key:secret-grove-key', count: 1 }] }
    });

    const states = applied.sections[0].objects.map((node) => [node['stage-id'], node.state]);

    expect(states).toEqual([
      ['strawberry-fields', 'completed'],
      ['avocado-grove', 'available'],
      ['secret-grove', 'available']
    ]);
  });

  test('normalizes string and entry-shaped inventory inputs', () => {
    expect(inventoryItemNames(['apple', 'key:secret-grove-key', 'apple']))
      .toEqual(['apple', 'key:secret-grove-key']);
    expect(inventoryItemNames({ items: [{ name: 'apple', count: 2 }, { name: 'moon', count: 0 }] }))
      .toEqual(['apple']);
    expect(inventoryItemNames(null)).toEqual([]);
  });
});

describe('Key collectible contract', () => {
  const keyConfig = JSON.parse(
    readFileSync(new URL('../data/collectibles/key.json', import.meta.url), 'utf8')
  );

  test('declares the add-to-inventory action used to store a named key', () => {
    expect(keyConfig.type).toBe('key');
    expect(keyConfig.effect.action).toBe('add-to-inventory');
  });

  test('collecting a key object stores key:<key-name> for the map and the key door', () => {
    const inventory = new Inventory({ 'max-slots': 8 }, {
      audioEngine: null,
      usage: {},
      effects: null
    });
    const collectible = new Collectible(0, 0, 0.5, 0.5, {
      ...keyConfig,
      'key-name': 'secret-grove-key'
    });

    collectible.collect({ inventory, audioEngine: null });

    expect(inventory.has('key:secret-grove-key')).toBe(true);

    const door = new KeyDoor('door', 0, 0, '', null, 'secret-grove-key', { inventory });
    const applied = applyProgressToMapConfig(mapConfig, {
      inventory: { items: inventory.slots }
    });
    const secret = applied.sections[0].objects.find((node) => node['stage-id'] === 'secret-grove');

    expect(door.hasKey).toBe(true);
    expect(secret.state).toBe('available');
  });

  test('an unknown collectible action leaves the key ring untouched', () => {
    const inventory = new Inventory({ 'max-slots': 8 }, {
      audioEngine: null,
      usage: {},
      effects: null
    });
    inventory.add('key:secret-grove-key', 1);
    const collectible = new Collectible(0, 0, 0.5, 0.5, {
      type: 'mystery',
      effect: { action: 'unsupported-action', 'required-key': 'secret-grove-key' }
    });

    collectible.collect({ inventory, audioEngine: null });

    expect(inventory.count('key:secret-grove-key')).toBe(1);
  });
});

describe('Key inventory persistence', () => {
  test('persists a collected key and unlocks the map node from the loaded progress', () => {
    const store = new ProgressStore(new SaveSystem('game'));
    const inventory = new Inventory({ 'max-slots': 8 }, {
      audioEngine: null,
      usage: {},
      effects: null
    });

    inventory.add('key:secret-grove-key', 1);
    store.save(progressFixture({
      inventory: { items: inventory.slots, defaultSelected: null }
    }));

    const loaded = store.load();

    expect(loaded.inventory.items).toEqual([{ name: 'key:secret-grove-key', count: 1 }]);

    const applied = applyProgressToMapConfig(mapConfig, loaded);
    const secret = applied.sections[0].objects.find((node) => node['stage-id'] === 'secret-grove');

    expect(secret.state).toBe('available');
  });
});
