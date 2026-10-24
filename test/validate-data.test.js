import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'bun:test';

import { validateData } from '../scripts/validate-data.js';

describe('data validation', () => {
  test('the real data set has no validation errors', async () => {
    const result = await validateData();

    expect(result.errors).toEqual([]);
    expect(result.files.length).toBeGreaterThan(0);
  });

  test('a malformed file is reported with its path and the offending key', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'sfw-validate-'));

    try {
      await mkdir(path.join(root, 'data'), { recursive: true });
      await writeFile(path.join(root, 'data', 'broken.json'), '{ "unterminated": ', 'utf8');
      await writeFile(path.join(root, 'data', 'game-config.json'), '{}\n', 'utf8');
      await writeFile(
        path.join(root, 'data', 'index.json'),
        `${JSON.stringify({ files: ['data/broken.json', 'data/game-config.json'] }, null, 2)}\n`,
        'utf8'
      );

      const result = await validateData({ root });

      expect(result.errors.some((error) => error.startsWith('data/broken.json: expected valid JSON'))).toBe(true);
      expect(
        result.errors.some((error) => error === 'data/game-config.json: "visual-unit.value" is missing but is read at boot')
      ).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('malformed slope data is reported with its path and key', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'sfw-validate-slopes-'));

    try {
      await mkdir(path.join(root, 'data', 'tiles'), { recursive: true });
      await mkdir(path.join(root, 'data', 'stages'), { recursive: true });

      const files = {
        'data/game-config.json': {},
        'data/colors.json': {},
        'data/tiles/slope.json': {
          type: 'slope',
          collision: { 'slope-angle': 120 },
          physics: { 'slope-types': { 'slope-45': 45, 'slope-100': 100 } }
        },
        'data/stages/slopes.json': {
          name: 'slopes',
          sections: [
            {
              name: 'alpha',
              'parent-section': 'root',
              position: { x: 0, y: 0 },
              objects: [
                { type: 'slope', variant: 'slope-45', position: { x: 0, y: 0 } },
                { type: 'slope', variant: 'missing', position: { x: 1, y: 0 }, size: { width: 2, height: 2 } },
                {
                  type: 'slope',
                  variant: 'slope-45',
                  inverted: 'yes',
                  position: { x: 3, y: 0 },
                  size: { width: 2, height: 2 }
                }
              ]
            }
          ]
        }
      };

      for (const [relativePath, value] of Object.entries(files)) {
        await writeFile(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
      }

      await writeFile(
        path.join(root, 'data', 'index.json'),
        `${JSON.stringify({ files: Object.keys(files) }, null, 2)}\n`,
        'utf8'
      );

      const result = await validateData({ root });

      expect(result.errors).toContain(
        'data/tiles/slope.json: "collision.slope-angle" expected an angle between 0 and 90 degrees, found 120'
      );
      expect(result.errors).toContain(
        'data/tiles/slope.json: "physics.slope-types.slope-100" expected an angle between 0 and 90 degrees, found 100'
      );
      expect(result.errors).toContain(
        'data/stages/slopes.json: "sections[0].objects[0].size" expected positive width and height for a slope'
      );
      expect(result.errors).toContain(
        'data/stages/slopes.json: "sections[0].objects[1].variant" expected a slope type declared in data/tiles/slope.json "physics.slope-types", found "missing"'
      );
      expect(result.errors).toContain(
        'data/stages/slopes.json: "sections[0].objects[2].inverted" expected a boolean, found "yes"'
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('malformed enemy drop tables are reported with their path and key', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'sfw-validate-drops-'));

    try {
      await mkdir(path.join(root, 'data', 'collectibles'), { recursive: true });
      await mkdir(path.join(root, 'data', 'stages'), { recursive: true });

      const files = {
        'data/game-config.json': {},
        'data/colors.json': {},
        'data/collectibles/coin.json': { type: 'coin' },
        'data/stages/drops.json': {
          name: 'drops',
          sections: [
            {
              name: 'alpha',
              'parent-section': 'root',
              position: { x: 0, y: 0 },
              objects: [
                { type: 'triangle-patrol', position: { x: 0, y: 0 }, 'drop-table': 'coin' },
                {
                  type: 'triangle-patrol',
                  position: { x: 1, y: 0 },
                  'drop-table': [{ type: 'missing', weight: 1 }]
                },
                {
                  type: 'triangle-patrol',
                  position: { x: 2, y: 0 },
                  'drop-table': [{ type: 'coin', weight: 0 }]
                },
                {
                  type: 'triangle-patrol',
                  position: { x: 3, y: 0 },
                  'drop-table': [{ type: 'coin', weight: 'heavy' }]
                },
                {
                  type: 'triangle-patrol',
                  position: { x: 4, y: 0 },
                  'drop-table': ['coin']
                }
              ]
            }
          ]
        }
      };

      for (const [relativePath, value] of Object.entries(files)) {
        await writeFile(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
      }

      await writeFile(
        path.join(root, 'data', 'index.json'),
        `${JSON.stringify({ files: Object.keys(files) }, null, 2)}\n`,
        'utf8'
      );

      const result = await validateData({ root });

      expect(result.errors).toContain(
        'data/stages/drops.json: "sections[0].objects[0].drop-table" expected an array of drop entries, found "coin"'
      );
      expect(result.errors).toContain(
        'data/stages/drops.json: "sections[0].objects[1].drop-table[0].type" expected an existing data/collectibles/missing.json collectible file'
      );
      expect(result.errors).toContain(
        'data/stages/drops.json: "sections[0].objects[2].drop-table[0].weight" expected a positive finite number, found 0'
      );
      expect(result.errors).toContain(
        'data/stages/drops.json: "sections[0].objects[3].drop-table[0].weight" expected a positive finite number, found "heavy"'
      );
      expect(result.errors).toContain(
        'data/stages/drops.json: "sections[0].objects[4].drop-table[0]" expected an object with "type" and "weight"'
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
