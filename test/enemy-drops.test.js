import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

import { Enemy } from '../src/game/entities/enemy.js';

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8'));
}

function stageFiles() {
  const directory = new URL('../data/stages/', import.meta.url);
  return readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => ({ name, data: readJson(`data/stages/${name}`) }));
}

function stageEnemies(stageData) {
  return stageData.sections.flatMap((section) => section.objects ?? []);
}

function shippedDropTables() {
  const tables = [];

  for (const stage of stageFiles()) {
    for (const object of stageEnemies(stage.data)) {
      if (Array.isArray(object['drop-table']) && object['drop-table'].length > 0) {
        tables.push({ stage: stage.name, object });
      }
    }
  }

  return tables;
}

function createEnemy(dropTable, random) {
  return new Enemy({
    shape: 3,
    size: 1,
    'color-index': 1,
    'color-palette': ['#000000', '#BF4040'],
    'is-boss': false,
    'drop-table': dropTable
  }, null, { random });
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('enemy drops', () => {
  test('an empty drop table never rolls and never drops', () => {
    const enemy = createEnemy([], () => {
      throw new Error('an empty drop table must not roll');
    });

    expect(enemy.resolveDrop()).toBe(null);
  });

  test('resolveDrop selects by cumulative weight from the injected random source', () => {
    const rolls = [0, 0.5, 0.749, 0.751, 0.999];
    const enemy = createEnemy([{ type: 'coin', weight: 3 }, { type: 'ammo', weight: 1 }], () => rolls.shift());

    expect(['coin', 'coin', 'coin', 'ammo', 'ammo'].map(() => enemy.resolveDrop()))
      .toEqual(['coin', 'coin', 'coin', 'ammo', 'ammo']);
  });

  test('resolveDrop follows the configured weight distribution over a deterministic sequence', () => {
    const random = seededRandom(1337);
    const enemy = createEnemy([{ type: 'coin', weight: 3 }, { type: 'ammo', weight: 1 }], random);
    const samples = 4000;
    const counts = { coin: 0, ammo: 0 };

    for (let index = 0; index < samples; index++) {
      counts[enemy.resolveDrop()] += 1;
    }

    expect(counts.coin + counts.ammo).toBe(samples);
    expect(counts.coin / samples).toBeGreaterThan(0.72);
    expect(counts.coin / samples).toBeLessThan(0.78);
    expect(counts.ammo / samples).toBeGreaterThan(0.22);
    expect(counts.ammo / samples).toBeLessThan(0.28);
  });

  test('shipped drop tables name existing collectibles and use positive weights', () => {
    const tables = shippedDropTables();

    expect(tables.length).toBeGreaterThan(0);

    for (const { stage, object } of tables) {
      for (const entry of object['drop-table']) {
        const collectiblePath = `data/collectibles/${entry.type}.json`;
        const collectible = readJson(collectiblePath);

        expect(collectible.type).toBe(entry.type);
        expect(Number.isFinite(entry.weight)).toBe(true);
        expect(entry.weight).toBeGreaterThan(0);
      }
    }
  });

  test('early stages keep their enemies drop-free', () => {
    const tables = shippedDropTables();
    const earlyStages = new Set(['strawberry-fields.json', 'avocado-grove.json']);

    expect(tables.filter((table) => earlyStages.has(table.stage))).toEqual([]);
  });
});
