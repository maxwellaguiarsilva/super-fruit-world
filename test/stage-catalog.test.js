import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, test } from 'bun:test';

import { collectDataFiles } from '../scripts/generate-data-index.js';
import { SlopeSurface } from '../src/engine/physics/slope-surface.js';

const ROOT = path.resolve(import.meta.dir, '..');
const STAGE_PREFIX = 'data/stages/';
const SURFACE_EPSILON = 1e-6;
const REQUIRED_STAGE_FIELDS = [
  'name',
  'display-name-key',
  'description',
  'big-fruit',
  'type',
  'theme',
  'bgm',
  'dialogue',
  'sections'
];

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(ROOT, relativePath), 'utf8'));
}

function objectsOf(stage) {
  return stage.sections.flatMap((section) => section.objects ?? []);
}

function placementOf(object) {
  return {
    x: object.position?.x ?? 0,
    y: object.position?.y ?? 0,
    width: object.size?.width ?? 1,
    height: object.size?.height ?? 1
  };
}

function sidePlatform(platforms, slope, side) {
  const placement = placementOf(slope);
  const edge = side === 'left' ? placement.x : placement.x + placement.width;
  const platform = platforms.find((candidate) => {
    const candidatePlacement = placementOf(candidate);
    const candidateEdge = side === 'left'
      ? candidatePlacement.x + candidatePlacement.width
      : candidatePlacement.x;
    const sharesEdge = Math.abs(candidateEdge - edge) <= SURFACE_EPSILON;
    const overlapsVertically =
      candidatePlacement.y <= placement.y + placement.height + SURFACE_EPSILON &&
      placement.y <= candidatePlacement.y + candidatePlacement.height + SURFACE_EPSILON;

    return sharesEdge && overlapsVertically;
  });

  return platform ?? null;
}

function surfaceOf(slope, slopeTypes) {
  const placement = placementOf(slope);

  return new SlopeSurface({
    width: placement.width,
    height: placement.height,
    angle: slopeTypes[slope.variant] ?? null,
    inverted: slope.inverted === true
  });
}

function expectClose(actual, expected, context) {
  expect({ ...context, actual, expected, close: Math.abs(actual - expected) <= SURFACE_EPSILON })
    .toEqual({ ...context, actual, expected, close: true });
}

function stageIdOf(file) {
  return file.slice(STAGE_PREFIX.length, -'.json'.length);
}

async function loadCatalog() {
  const files = await collectDataFiles(ROOT);
  const stageFiles = files
    .filter((file) => file.startsWith(STAGE_PREFIX) && file.endsWith('.json'))
    .sort();
  const stages = [];

  for (const file of stageFiles) {
    stages.push({ file, id: stageIdOf(file), data: await readJson(file) });
  }

  return {
    stageFiles,
    stages,
    fruits: await readJson('data/player/fruits.json'),
    bgm: await readJson('data/audio/bgm.json'),
    slopeTile: await readJson('data/tiles/slope.json')
  };
}

const catalog = loadCatalog();

describe('stage catalog', () => {
  test('discovers every stage file under data/stages', async () => {
    const { stageFiles } = await catalog;

    expect(stageFiles).toContain('data/stages/strawberry-fields.json');
    expect(stageFiles).toContain('data/stages/avocado-grove.json');
    expect(stageFiles).toContain('data/stages/banana-beach.json');
    expect(stageFiles).toContain('data/stages/blueberry-peaks.json');
    expect(stageFiles).toContain('data/stages/starfruit-caverns.json');
    expect(stageFiles).toContain('data/stages/pitaya-canyon.json');
    expect(stageFiles).toContain('data/stages/fruit-basket-citadel.json');
    expect(stageFiles).toContain('data/stages/starfruit-caverns-branch.json');
  });

  test('every stage parses and declares the required top-level fields', async () => {
    const { stages } = await catalog;

    expect(stages.length).toBeGreaterThan(0);

    for (const { file, id, data } of stages) {
      for (const field of REQUIRED_STAGE_FIELDS) {
        expect({ file, field, value: data[field] }).not.toEqual({ file, field, value: undefined });
      }

      expect({ file, name: data.name }).toEqual({ file, name: id });
      expect({ file, type: data.type }).toEqual({ file, type: 'horizontal-scrolling' });
      expect({ file, sections: Array.isArray(data.sections) }).toEqual({ file, sections: true });
      expect({ file, sections: data.sections.length > 0 }).toEqual({ file, sections: true });
      expect({ file, intro: Array.isArray(data.dialogue.intro) }).toEqual({ file, intro: true });
      expect({ file, intro: data.dialogue.intro.length >= 2 && data.dialogue.intro.length <= 3 }).toEqual({ file, intro: true });
    }
  });

  test('every stage declares one player spawn, one exit door and a checkpoint', async () => {
    const { stages } = await catalog;

    for (const { file, data } of stages) {
      const objects = objectsOf(data);
      const spawns = objects.filter((object) => object.type === 'player-spawn');
      const exits = objects.filter((object) => object.type === 'exit-door');
      const checkpoints = objects.filter((object) => object.type === 'checkpoint');
      const spawnsInFirstSection = (data.sections[0].objects ?? [])
        .filter((object) => object.type === 'player-spawn');

      expect({ file, spawns: spawns.length }).toEqual({ file, spawns: 1 });
      expect({ file, exits: exits.length }).toEqual({ file, exits: 1 });
      expect({ file, checkpoints: checkpoints.length >= 1 }).toEqual({ file, checkpoints: true });
      expect({ file, spawnsInFirstSection: spawnsInFirstSection.length }).toEqual({ file, spawnsInFirstSection: 1 });
    }
  });

  test('every declared big fruit exists and matches one big-fruit object', async () => {
    const { stages, fruits } = await catalog;

    for (const { file, data } of stages) {
      const bigFruits = objectsOf(data).filter((object) => object.type === 'big-fruit');
      const declared = data['big-fruit'];

      expect({ file, declared, known: Boolean(fruits.fruits[declared]) }).toEqual({ file, declared, known: true });
      expect({ file, bigFruits: bigFruits.length }).toEqual({ file, bigFruits: 1 });
      expect({ file, collectible: bigFruits[0].collectible }).toEqual({ file, collectible: declared });
    }
  });

  test('every musical-note note-order is unique within its stage', async () => {
    const { stages } = await catalog;

    for (const { file, data } of stages) {
      const orders = objectsOf(data)
        .filter((object) => object.type === 'musical-note')
        .map((object) => object['note-order']);

      expect({ file, notes: orders.length > 0 }).toEqual({ file, notes: true });
      expect({ file, unique: new Set(orders).size }).toEqual({ file, unique: orders.length });

      for (const order of orders) {
        expect({ file, order, valid: Number.isInteger(order) && order > 0 }).toEqual({ file, order, valid: true });
      }
    }
  });

  test('every teleporter target-marker resolves to a marker in the same stage', async () => {
    const { stages } = await catalog;

    for (const { file, data } of stages) {
      const objects = objectsOf(data);
      const markers = new Set(
        objects
          .filter((object) => object.type === 'teleporter-marker')
          .map((object) => object.name)
      );
      const teleporters = objects.filter((object) =>
        ['inner-teleporter', 'special-teleporter', 'map-teleporter', 'key-door'].includes(object.type)
      );

      for (const teleporter of teleporters) {
        const target = teleporter['target-marker'];
        if (target === undefined) {
          continue;
        }

        expect({ file, target, resolved: markers.has(target) }).toEqual({ file, target, resolved: true });
      }
    }
  });

  test('every stage bgm is registered in data/audio/bgm.json', async () => {
    const { stages, bgm } = await catalog;

    for (const { file, data } of stages) {
      expect({ file, bgm: data.bgm, registered: Boolean(bgm.tracks[data.bgm]) }).toEqual({
        file,
        bgm: data.bgm,
        registered: true
      });
    }
  });

  test('every slope aligns with the platforms adjacent to its edges', async () => {
    const { stages, slopeTile } = await catalog;
    const slopeTypes = slopeTile.physics?.['slope-types'] ?? {};

    for (const { file, data } of stages) {
      for (const section of data.sections) {
        const objects = section.objects ?? [];
        const platforms = objects.filter((object) => object.type === 'platform');
        const slopes = objects.filter((object) => object.type === 'slope');

        for (const slope of slopes) {
          const placement = placementOf(slope);
          const surface = surfaceOf(slope, slopeTypes);
          const leftEdgeY = placement.y + surface.surfaceY(0);
          const rightEdgeY = placement.y + surface.surfaceY(placement.width);
          const leftPlatform = sidePlatform(platforms, slope, 'left');
          const rightPlatform = sidePlatform(platforms, slope, 'right');
          const context = { file, section: section.name, slopeX: placement.x };

          if (leftPlatform) {
            const leftTop = placementOf(leftPlatform).y;

            // y grows downward, so a leading edge above the platform is a tall face.
            expect({ ...context, wall: leftEdgeY < leftTop - SURFACE_EPSILON })
              .toEqual({ ...context, wall: false });
          }

          if (leftPlatform && rightPlatform) {
            const leftTop = placementOf(leftPlatform).y;
            const rightTop = placementOf(rightPlatform).y;

            expectClose(leftEdgeY, leftTop, { ...context, edge: 'left' });
            expectClose(rightEdgeY, rightTop, { ...context, edge: 'right' });
          }
        }
      }
    }
  });
});
