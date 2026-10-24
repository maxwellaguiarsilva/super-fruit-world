import { describe, expect, test } from 'bun:test';

import { ProgressWriter } from '../src/app/state/progress-writer.js';
import {
  completeStageProgress,
  withUnlockedStages
} from '../src/game/systems/progression-system.js';

const mapConfig = {
  sections: [
    {
      name: 'continent-1',
      objects: [
        { type: 'stage-node', 'stage-id': 'strawberry-fields', state: 'available' },
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
        },
        { type: 'stage-node', 'stage-id': 'already-open', state: 'available' }
      ]
    }
  ]
};

function createProgress(overrides = {}) {
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

function createStore() {
  const writes = [];
  const events = [];

  return {
    writes,
    events,
    save(record) {
      events.push('save');
      writes.push(record);
    }
  };
}

function createWriter(store) {
  return new ProgressWriter({
    store,
    buildSnapshot: (progress) => {
      store.events.push('snapshot');
      return {
        completedStageIds: progress.completedStageIds,
        unlockedStageIds: progress.unlockedStageIds,
        lastStageId: progress.lastStageId
      };
    }
  });
}

describe('completeStageProgress', () => {
  test('adds the completed stage, sets it as the last stage and unlocks its dependants', () => {
    const progress = createProgress({ score: 120, level: 2 });

    const next = completeStageProgress(progress, 'strawberry-fields', mapConfig, []);

    expect(next.completedStageIds).toEqual(['strawberry-fields']);
    expect(next.lastStageId).toBe('strawberry-fields');
    expect(next.unlockedStageIds).toEqual([
      'strawberry-fields',
      'already-open',
      'avocado-grove'
    ]);
    expect(next.score).toBe(120);
    expect(next.level).toBe(2);
  });

  test('does not mutate the input record', () => {
    const progress = createProgress({ unlockedStageIds: ['already-open'] });
    const original = structuredClone(progress);

    completeStageProgress(progress, 'strawberry-fields', mapConfig, []);

    expect(progress).toEqual(original);
  });

  test('deduplicates a stage that was already completed', () => {
    const progress = createProgress({
      completedStageIds: ['strawberry-fields'],
      unlockedStageIds: ['strawberry-fields', 'avocado-grove']
    });

    const next = completeStageProgress(progress, 'strawberry-fields', mapConfig, []);

    expect(next.completedStageIds).toEqual(['strawberry-fields']);
    expect(next.unlockedStageIds).toEqual([
      'strawberry-fields',
      'avocado-grove',
      'already-open'
    ]);
  });

  test('keeps already unlocked stages in their existing order', () => {
    const progress = createProgress({ unlockedStageIds: ['already-open', 'strawberry-fields'] });

    const next = completeStageProgress(progress, 'strawberry-fields', mapConfig, []);

    expect(next.unlockedStageIds).toEqual([
      'already-open',
      'strawberry-fields',
      'avocado-grove'
    ]);
  });

  test('unlocks a key-gated stage when the inventory holds the key', () => {
    const progress = createProgress();

    const next = completeStageProgress(
      progress,
      'strawberry-fields',
      mapConfig,
      [{ name: 'key:secret-grove-key', count: 1 }]
    );

    expect(next.unlockedStageIds).toContain('secret-grove');
  });

  test('does not unlock a key-gated stage without the key', () => {
    const progress = createProgress();

    const next = completeStageProgress(progress, 'strawberry-fields', mapConfig, [
      { name: 'apple', count: 3 }
    ]);

    expect(next.unlockedStageIds).not.toContain('secret-grove');
  });
});

describe('withUnlockedStages', () => {
  test('merges default, completion and persisted unlocks without duplicates', () => {
    const progress = createProgress({
      completedStageIds: ['strawberry-fields'],
      unlockedStageIds: ['strawberry-fields']
    });

    const next = withUnlockedStages(progress, mapConfig, []);

    expect(next.unlockedStageIds).toEqual([
      'strawberry-fields',
      'already-open',
      'avocado-grove'
    ]);
  });

  test('preserves every other field and does not mutate the input', () => {
    const progress = createProgress({ lastStageId: 'avocado-grove', score: 9, level: 1 });
    const original = structuredClone(progress);

    const next = withUnlockedStages(progress, mapConfig, []);

    expect(progress).toEqual(original);
    expect(next.completedStageIds).toBe(progress.completedStageIds);
    expect(next.lastStageId).toBe('avocado-grove');
    expect(next.score).toBe(9);
    expect(next.level).toBe(1);
  });
});

describe('ProgressWriter', () => {
  test('requires a store with a save method', () => {
    expect(() => new ProgressWriter({ buildSnapshot: () => ({}) }))
      .toThrow('ProgressWriter requires a ProgressStore-compatible instance.');
    expect(() => new ProgressWriter({ store: {}, buildSnapshot: () => ({}) }))
      .toThrow('ProgressWriter requires a ProgressStore-compatible instance.');
  });

  test('requires a snapshot builder', () => {
    const store = createStore();

    expect(() => new ProgressWriter({ store }))
      .toThrow('ProgressWriter requires a buildSnapshot function.');
  });

  test('the plain save path writes exactly one snapshot of the current record', () => {
    const store = createStore();
    const writer = createWriter(store);
    const progress = createProgress({ lastStageId: 'strawberry-fields', score: 40 });

    const result = writer.save(progress);

    expect(result).toBe(progress);
    expect(store.events).toEqual(['snapshot', 'save']);
    expect(store.writes).toEqual([
      {
        completedStageIds: [],
        unlockedStageIds: [],
        lastStageId: 'strawberry-fields'
      }
    ]);
  });

  test('completing a stage writes the merged record before the call returns', () => {
    const store = createStore();
    const writer = createWriter(store);
    const progress = createProgress({ score: 75, level: 2 });

    const next = writer.completeStage(progress, 'strawberry-fields', mapConfig, []);
    store.events.push('after');

    expect(next.completedStageIds).toEqual(['strawberry-fields']);
    expect(next.lastStageId).toBe('strawberry-fields');
    expect(progress.completedStageIds).toEqual([]);
    expect(store.writes).toHaveLength(1);
    expect(store.writes[0]).toEqual({
      completedStageIds: ['strawberry-fields'],
      unlockedStageIds: ['strawberry-fields', 'already-open', 'avocado-grove'],
      lastStageId: 'strawberry-fields'
    });
    expect(store.events).toEqual(['snapshot', 'save', 'after']);
  });

  test('the snapshot sees the completed record rather than the previous one', () => {
    const store = createStore();
    const seen = [];
    const writer = new ProgressWriter({
      store,
      buildSnapshot: (progress) => {
        seen.push(progress.completedStageIds);
        return { completedStageIds: progress.completedStageIds };
      }
    });

    writer.completeStage(createProgress(), 'strawberry-fields', mapConfig, []);

    expect(seen).toEqual([['strawberry-fields']]);
  });
});
