import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'bun:test';

import { PROGRESS_SCHEMA_VERSION } from '../src/game/systems/progression-system.js';
import {
  buildProgressStorageEntry,
  collectKeyNames,
  discoverStageIds,
  introLine,
  resolveTextKey
} from '../scripts/verify-stages/catalog.js';

describe('stage verification catalog', () => {
  test('discovers only stage JSON files, sorted and without extensions', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'sfw-stages-'));

    try {
      await writeFile(path.join(root, 'banana-beach.json'), '{}\n', 'utf8');
      await writeFile(path.join(root, 'apple-grove.json'), '{}\n', 'utf8');
      await writeFile(path.join(root, 'notes.txt'), 'ignore\n', 'utf8');
      await mkdir(path.join(root, 'folder.json'));

      expect(await discoverStageIds(root)).toEqual(['apple-grove', 'banana-beach']);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('collects unique key-required names from stage nodes', () => {
    const mapConfig = {
      sections: [
        {
          objects: [
            { type: 'stage-node', 'stage-id': 'one', 'unlock-condition': { type: 'key-required', 'key-name': 'secret-key' } },
            { type: 'stage-node', 'stage-id': 'two', 'unlock-condition': { type: 'key-required', 'key-name': 'secret-key' } },
            { type: 'stage-node', 'stage-id': 'three', 'unlock-condition': { type: 'stage-complete', stage: 'two' } },
            { type: 'path', from: 'one', to: 'two' }
          ]
        },
        {
          objects: [
            { type: 'stage-node', 'stage-id': 'four', 'unlock-condition': { type: 'key-required', 'key-name': 'other-key' } },
            { type: 'stage-node', 'stage-id': 'five', 'unlock-condition': null }
          ]
        }
      ]
    };

    expect(collectKeyNames(mapConfig)).toEqual(['secret-key', 'other-key']);
    expect(collectKeyNames({})).toEqual([]);
  });

  test('builds a namespaced progress entry that unlocks every stage and prefers one', () => {
    const entry = buildProgressStorageEntry({
      namespace: 'super-fruit-world',
      stageId: 'secret-stage',
      stageIds: ['first-stage', 'secret-stage', 'first-stage'],
      keyNames: ['secret-key', 'secret-key']
    });
    const keys = Object.keys(entry);

    expect(keys).toEqual(['super-fruit-world:progress']);

    const progress = JSON.parse(entry[keys[0]]);
    expect(progress.version).toBe(PROGRESS_SCHEMA_VERSION);
    expect(progress['completed-stages']).toEqual([]);
    expect(progress['unlocked-stages']).toEqual(['first-stage', 'secret-stage']);
    expect(progress['last-stage']).toBe('secret-stage');
    expect(progress.inventory.items).toEqual([{ name: 'key:secret-key', count: 1 }]);
    expect(progress.inventory['default-selected']).toBeNull();
  });

  test('rejects a missing namespace or stage id', () => {
    expect(() => buildProgressStorageEntry({ namespace: '', stageId: 'stage', stageIds: [] })).toThrow(TypeError);
    expect(() => buildProgressStorageEntry({ namespace: 'save', stageId: '', stageIds: [] })).toThrow(TypeError);
  });

  test('resolves the first intro line and its first word', () => {
    const textConfig = {
      dialogue: {
        'fruit-fields': {
          'intro-1': 'Welcome to the fields.'
        }
      }
    };
    const stageConfig = {
      dialogue: {
        intro: [{ speaker: 'Fruit', text: 'dialogue.fruit-fields.intro-1' }]
      }
    };

    expect(resolveTextKey(textConfig, 'dialogue.fruit-fields.intro-1')).toBe('Welcome to the fields.');
    expect(resolveTextKey(textConfig, 'dialogue.missing.key')).toBe('');
    expect(introLine(stageConfig, textConfig)).toEqual({
      speaker: 'Fruit',
      text: 'Welcome to the fields.',
      word: 'Welcome'
    });
    expect(introLine({}, textConfig)).toEqual({ speaker: '', text: '', word: '' });
  });
});
