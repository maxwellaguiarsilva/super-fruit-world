import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'bun:test';

import { analyzeStage } from '../scripts/stage-analysis/checks.js';
import {
  classifyTileObject,
  loadStageLayouts,
  resolveWorldPosition,
  spawnPlayerBox,
  unionBoxes
} from '../scripts/stage-analysis/model.js';
import { parseArguments } from '../scripts/validate-playability.js';

async function withFixture(files, callback) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sfw-playability-'));

  try {
    for (const [relativePath, value] of Object.entries(files)) {
      const filePath = path.join(root, relativePath);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    }

    await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function makeLayout(overrides = {}) {
  const tiles = overrides.tiles ?? [];

  return {
    id: 'fixture-stage',
    file: 'data/stages/fixture-stage.json',
    playerSize: 1,
    sections: [
      {
        name: 'main',
        parent: 'root',
        position: { x: 0, y: 0 },
        localPosition: { x: 0, y: 0 },
        size: { width: 0, height: 0 },
        objects: []
      }
    ],
    tiles,
    collectibles: [],
    enemies: [],
    spawns: [],
    checkpoints: [],
    teleporters: [],
    markers: [],
    other: [],
    tileBounds: unionBoxes(tiles),
    sectionBounds: { x: 0, y: 0, width: 0, height: 0 },
    ...overrides
  };
}

function tile(overrides = {}) {
  return {
    kind: 'tile',
    type: 'platform',
    section: 'main',
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    solid: true,
    deadly: false,
    liquid: false,
    climbable: false,
    slope: false,
    ...overrides
  };
}

function floor(overrides = {}) {
  return tile({ x: 0, y: 0, width: 20, height: 1, ...overrides });
}

function collectible(x, y, overrides = {}) {
  return {
    kind: 'collectible',
    type: 'coin',
    section: 'main',
    x,
    y,
    width: 0.5,
    height: 0.5,
    collectible: null,
    'key-name': null,
    'note-order': null,
    ...overrides
  };
}

function spawn(x = 2, y = 0) {
  return { kind: 'spawn', type: 'player-spawn', section: 'main', x, y, width: 1, height: 1 };
}

function checkpoint(x, y) {
  return { kind: 'checkpoint', type: 'checkpoint', section: 'main', x, y, width: 1, height: 1 };
}

function teleporter(x, y, overrides = {}) {
  return {
    kind: 'teleporter',
    type: 'inner-teleporter',
    section: 'main',
    x,
    y,
    width: 1,
    height: 1,
    name: 'gate',
    'target-marker': 'arrival',
    'target-stage': null,
    'required-key': null,
    ...overrides
  };
}

function marker(x, y) {
  return { kind: 'marker', type: 'teleporter-marker', section: 'main', x, y, width: 1, height: 1, name: 'arrival' };
}

function enemy(x, y, overrides = {}) {
  return {
    kind: 'enemy',
    type: 'triangle-patrol',
    section: 'main',
    x,
    y,
    width: 1,
    height: 1,
    boss: false,
    behavior: 'patrol',
    ...overrides
  };
}

function slopeTile(overrides = {}) {
  return tile({
    type: 'slope',
    variant: 'slope-30',
    x: 0,
    y: 0,
    width: 5,
    height: 3,
    slope: true,
    inverted: false,
    ...overrides
  });
}

function codesFor(layout) {
  return analyzeStage(layout).map((finding) => finding.code);
}

describe('stage layout model', () => {
  test('resolves nested section positions and normalizes every object kind', async () => {
    const stage = {
      name: 'nested',
      sections: [
        { name: 'base', 'parent-section': 'root', position: { x: 10, y: 20 }, size: { width: 40, height: 20 }, objects: [] },
        { name: 'middle', 'parent-section': 'base', position: { x: 2, y: 3 }, objects: [] },
        {
          name: 'leaf',
          'parent-section': 'middle',
          position: { x: 1, y: 1 },
          size: { width: 10, height: 5 },
          objects: [
            { type: 'platform', position: { x: 0.5, y: -1 }, size: { width: 3, height: 1 } },
            { type: 'coin', position: { x: 1, y: -2 } },
            { type: 'triangle-patrol', position: { x: 2, y: -1 } },
            { type: 'pentagon-patrol', 'is-boss': true, position: { x: 4, y: -1 } },
            { type: 'player-spawn', position: { x: 0, y: 0 } },
            { type: 'checkpoint', position: { x: 5, y: 0 } },
            { type: 'inner-teleporter', name: 'gate', position: { x: 6, y: 0 } },
            { type: 'teleporter-marker', name: 'arrival', position: { x: 7, y: 0 } },
            { type: 'mystery-object', position: { x: 8, y: 0 } }
          ]
        }
      ]
    };

    await withFixture({
      'data/tiles/platform.json': { type: 'platform', collision: { solid: true } },
      'data/collectibles/coin.json': { type: 'coin', visual: { size: 0.5 } },
      'data/enemies/config.json': {
        size: 1,
        'boss-size': 3,
        'shape-map': { triangle: 3, pentagon: 5 }
      },
      'data/stages/nested.json': stage
    }, async (root) => {
      const layouts = await loadStageLayouts({ root });

      expect(layouts).toHaveLength(1);
      const [layout] = layouts;
      expect(layout.id).toBe('nested');
      expect(layout.file).toBe('data/stages/nested.json');

      const leaf = layout.sections.find((section) => section.name === 'leaf');
      expect(leaf.position).toEqual({ x: 13, y: 24 });
      expect(leaf.localPosition).toEqual({ x: 1, y: 1 });
      expect(leaf.size).toEqual({ width: 10, height: 5 });

      expect(layout.tiles[0]).toMatchObject({ type: 'platform', x: 13.5, y: 23, width: 3, height: 1, solid: true });
      expect(layout.collectibles[0]).toMatchObject({ type: 'coin', x: 14, y: 22, width: 0.5, height: 0.5 });
      expect(layout.enemies[0]).toMatchObject({ type: 'triangle-patrol', x: 15, y: 23, boss: false, behavior: 'patrol', width: 1 });
      expect(layout.enemies[1]).toMatchObject({ type: 'pentagon-patrol', boss: true, width: 3, height: 3 });
      expect(layout.spawns[0]).toMatchObject({ type: 'player-spawn', x: 13, y: 24 });
      expect(layout.checkpoints[0]).toMatchObject({ x: 18, y: 24, width: 1, height: 1 });
      expect(layout.teleporters[0]).toMatchObject({ name: 'gate', 'target-marker': null });
      expect(layout.markers[0]).toMatchObject({ name: 'arrival' });
      expect(layout.other[0]).toMatchObject({ kind: 'other', type: 'mystery-object' });
      expect(layout.tileBounds).toEqual({ x: 13.5, y: 23, width: 3, height: 1 });

      expect(resolveWorldPosition(stage.sections, 'leaf')).toEqual({ x: 13, y: 24 });
      expect(resolveWorldPosition(stage.sections, 'base')).toEqual({ x: 10, y: 20 });
      expect(resolveWorldPosition(stage.sections, 'missing')).toEqual({ x: 0, y: 0 });
    });
  });

  test('classifies tile collision flags from tile data and object overrides', () => {
    const tileDataMap = {
      platform: { type: 'platform', collision: { solid: true } },
      decorative: { type: 'decorative', collision: { solid: false } },
      spike: { type: 'spike', collision: { solid: true }, damage: { 'on-contact': true } },
      pit: { type: 'pit', collision: { solid: false }, effect: { action: 'death' } },
      water: { type: 'water', collision: { solid: false }, physics: { 'gravity-multiplier': 0.3 } },
      ladder: { type: 'ladder', collision: { solid: false, climbable: true }, physics: { 'gravity-multiplier': 0 } },
      slope: { type: 'slope', collision: { solid: true } }
    };

    expect(classifyTileObject(tileDataMap, { type: 'platform' })).toEqual({
      solid: true,
      deadly: false,
      liquid: false,
      climbable: false,
      slope: false
    });
    expect(classifyTileObject(tileDataMap, { type: 'spike' })).toEqual({
      solid: true,
      deadly: true,
      liquid: false,
      climbable: false,
      slope: false
    });
    expect(classifyTileObject(tileDataMap, { type: 'decorative' })).toEqual({
      solid: false,
      deadly: false,
      liquid: false,
      climbable: false,
      slope: false
    });
    expect(classifyTileObject(tileDataMap, { type: 'pit' })).toEqual({
      solid: false,
      deadly: true,
      liquid: false,
      climbable: false,
      slope: false
    });
    expect(classifyTileObject(tileDataMap, { type: 'water' })).toEqual({
      solid: false,
      deadly: false,
      liquid: true,
      climbable: false,
      slope: false
    });
    expect(classifyTileObject(tileDataMap, { type: 'ladder' })).toEqual({
      solid: false,
      deadly: false,
      liquid: false,
      climbable: true,
      slope: false
    });
    expect(classifyTileObject(tileDataMap, { type: 'slope' })).toEqual({
      solid: true,
      deadly: false,
      liquid: false,
      climbable: false,
      slope: true
    });
    expect(classifyTileObject(tileDataMap, { type: 'platform', solid: false, deadly: true })).toMatchObject({
      solid: false,
      deadly: true
    });
  });

  test('discovers the shipped stages and normalizes them with runtime collectible hitboxes', async () => {
    const layouts = await loadStageLayouts();
    const ids = layouts.map((layout) => layout.id);

    expect(ids).toEqual([
      'avocado-grove',
      'banana-beach',
      'blueberry-peaks',
      'fruit-basket-citadel',
      'pitaya-canyon',
      'starfruit-caverns',
      'starfruit-caverns-branch',
      'strawberry-fields'
    ]);

    for (const layout of layouts) {
      expect(layout.file).toBe(`data/stages/${layout.id}.json`);
      expect(layout.sections.length).toBeGreaterThan(0);
      expect(layout.tiles.length).toBeGreaterThan(0);
      expect(layout.spawns).toHaveLength(1);
      expect(Number.isFinite(layout.tileBounds.x)).toBe(true);
      expect(Number.isFinite(layout.tileBounds.y)).toBe(true);
      expect(Number.isFinite(layout.tileBounds.width)).toBe(true);
      expect(Number.isFinite(layout.tileBounds.height)).toBe(true);
    }

    const strawberry = layouts.find((layout) => layout.id === 'strawberry-fields');
    const bigFruit = strawberry.collectibles.find((item) => item.type === 'big-fruit');
    expect(bigFruit.width).toBe(0.5);
    expect(bigFruit.height).toBe(0.5);
    expect(strawberry.enemies.length).toBeGreaterThan(0);
  });

  test('reads the player size from game config for every shipped stage', async () => {
    const layouts = await loadStageLayouts();

    expect(layouts.length).toBeGreaterThan(0);
    for (const layout of layouts) {
      expect(layout.playerSize).toBe(1);
    }
  });

  test('builds the runtime player box one unit above the spawn origin', () => {
    const origin = { x: 5, y: 10 };

    expect(spawnPlayerBox(origin, 1)).toEqual({ x: 5, y: 9, width: 1, height: 1 });
    expect(spawnPlayerBox(origin, 2)).toEqual({ x: 5, y: 9, width: 2, height: 2 });
  });

  test('falls back to tile data when a slope object omits inverted', async () => {
    await withFixture({
      'data/tiles/slope.json': {
        type: 'slope',
        collision: { solid: true },
        physics: { 'slope-types': { 'slope-45': 45 } },
        inverted: true
      },
      'data/stages/inverted.json': {
        sections: [
          {
            name: 'main',
            'parent-section': 'root',
            position: { x: 0, y: 0 },
            objects: [
              { type: 'slope', variant: 'slope-45', position: { x: 0, y: 0 }, size: { width: 2, height: 2 } },
              { type: 'slope', variant: 'slope-45', inverted: false, position: { x: 3, y: 0 }, size: { width: 2, height: 2 } }
            ]
          }
        ]
      }
    }, async (root) => {
      const [layout] = await loadStageLayouts({ root });

      expect(layout.tiles[0].inverted).toBe(true);
      expect(layout.tiles[1].inverted).toBe(false);
    });
  });
});

describe('playability checks', () => {
  test('flags a collectible embedded in a solid tile', () => {
    const layout = makeLayout({
      tiles: [floor()],
      spawns: [spawn()],
      collectibles: [collectible(5, 0.25)]
    });
    const findings = analyzeStage(layout);
    const embedded = findings.find((finding) => finding.code === 'collectible-embedded-in-solid');

    expect(embedded).toBeDefined();
    expect(embedded.severity).toBe('error');
    expect(embedded.message).toContain('collectible "coin" at (5, 0.25)');
    expect(embedded.message).toContain('solid tile "platform"');
    expect(embedded.evidence.tileBox).toEqual({ x: 0, y: 0, width: 20, height: 1 });
  });

  test('does not flag a collectible above a non-inverted slope diagonal', () => {
    const layout = makeLayout({
      tiles: [slopeTile()],
      spawns: [spawn(2, -1)],
      collectibles: [collectible(2, 1)]
    });

    expect(codesFor(layout)).not.toContain('collectible-embedded-in-solid');
  });

  test('flags a collectible below a non-inverted slope diagonal as inside the wedge', () => {
    const layout = makeLayout({
      tiles: [slopeTile()],
      spawns: [spawn(2, -1)],
      collectibles: [collectible(2, 2.5)]
    });
    const findings = analyzeStage(layout);
    const embedded = findings.find((finding) => finding.code === 'collectible-embedded-in-solid');

    expect(embedded).toBeDefined();
    expect(embedded.message).toContain('solid wedge of slope "slope-30"');
    expect(embedded.message).not.toContain('solid tile "slope"');
  });

  test('does not flag a collectible above an inverted slope diagonal', () => {
    const layout = makeLayout({
      tiles: [slopeTile({ inverted: true })],
      spawns: [spawn(2, -1)],
      collectibles: [collectible(2.5, 1)]
    });

    expect(codesFor(layout)).not.toContain('collectible-embedded-in-solid');
  });

  test('flags a collectible below an inverted slope diagonal as inside the wedge', () => {
    const layout = makeLayout({
      tiles: [slopeTile({ inverted: true })],
      spawns: [spawn(2, -1)],
      collectibles: [collectible(2.5, 2.5)]
    });

    expect(codesFor(layout)).toContain('collectible-embedded-in-solid');
  });

  test('does not let a slope disconnect an otherwise connected free region', () => {
    const layout = makeLayout({
      tiles: [
        floor({ width: 20 }),
        tile({ x: 5, y: -4, width: 1, height: 4 }),
        tile({ x: 5, y: -5, width: 6, height: 1 }),
        slopeTile({ x: 10, y: -4, width: 1, height: 4 })
      ],
      spawns: [spawn(2, 0)],
      collectibles: [collectible(7, -2)]
    });

    expect(codesFor(layout)).not.toContain('collectible-unreachable-region');
  });

  test('flags a collectible inside a pit tile', () => {
    const layout = makeLayout({
      tiles: [tile({ type: 'pit', x: 0, y: 0, width: 10, height: 2, solid: false, deadly: true })],
      spawns: [spawn()],
      collectibles: [collectible(4, 1)]
    });

    expect(codesFor(layout)).toContain('collectible-in-deadly-tile');
  });

  test('flags a collectible below and outside tile geometry but not above it', () => {
    const below = makeLayout({
      tiles: [floor({ width: 10 })],
      spawns: [spawn()],
      collectibles: [collectible(4, 4)]
    });
    expect(codesFor(below)).toContain('collectible-below-geometry');

    const outside = makeLayout({
      tiles: [floor({ width: 10 })],
      spawns: [spawn()],
      collectibles: [collectible(14, -1)]
    });
    expect(codesFor(outside)).toContain('collectible-outside-geometry');

    const above = makeLayout({
      tiles: [floor({ width: 10 })],
      spawns: [spawn()],
      collectibles: [collectible(4, -5)]
    });
    const aboveCodes = codesFor(above);
    expect(aboveCodes).not.toContain('collectible-below-geometry');
    expect(aboveCodes).not.toContain('collectible-outside-geometry');
  });

  test('flags a sealed collectible as unreachable', () => {
    const layout = makeLayout({
      tiles: [
        floor(),
        tile({ x: 5, y: -4, width: 1, height: 4 }),
        tile({ x: 9, y: -4, width: 1, height: 4 }),
        tile({ x: 5, y: -5, width: 5, height: 1 })
      ],
      spawns: [spawn()],
      collectibles: [collectible(6.5, -2)]
    });

    expect(codesFor(layout)).toEqual(['collectible-unreachable-region']);
  });

  test('does not flag a collectible that the player can reach', () => {
    const layout = makeLayout({
      tiles: [floor()],
      spawns: [spawn()],
      collectibles: [collectible(17, -1)]
    });

    expect(analyzeStage(layout)).toEqual([]);
  });

  test('uses a custom collectible size when checking reachability', () => {
    const layout = makeLayout({
      tiles: [floor({ width: 10 })],
      spawns: [spawn()],
      collectibles: [collectible(4, -5, { width: 2, height: 2 })]
    });

    expect(codesFor(layout)).not.toContain('collectible-unreachable-region');
  });

  test('includes collectibles above tile bounds in the reachability grid', () => {
    const layout = makeLayout({
      tiles: [floor({ width: 10 })],
      spawns: [spawn()],
      collectibles: [collectible(8, -4)]
    });

    expect(codesFor(layout)).not.toContain('collectible-unreachable-region');
  });

  test('flags a player spawn inside solid and deadly tiles', () => {
    const solid = makeLayout({
      tiles: [floor(), tile({ x: 3, y: -1, width: 1, height: 1 })],
      spawns: [spawn(3, 0)]
    });
    expect(codesFor(solid)).toContain('spawn-in-solid');

    const deadly = makeLayout({
      tiles: [floor(), tile({ type: 'pit', x: 3, y: -1, width: 1, height: 1, solid: false, deadly: true })],
      spawns: [spawn(3, 0)]
    });
    expect(codesFor(deadly)).toContain('spawn-in-deadly');
  });

  test('flags a missing spawn without attempting reachability', () => {
    const layout = makeLayout({
      tiles: [floor()],
      spawns: [],
      collectibles: [collectible(5, -1)]
    });
    const findings = analyzeStage(layout);
    const codes = findings.map((finding) => finding.code);

    expect(codes).toEqual(['spawn-missing']);
    expect(findings[0].severity).toBe('error');
    expect(codes).not.toContain('reachability-skipped');
    expect(codes).not.toContain('collectible-unreachable-region');
  });

  test('skips reachability with one warning when the grid exceeds the cell cap', () => {
    const layout = makeLayout({
      tiles: [tile({ x: 0, y: 0, width: 3000, height: 3000 })],
      spawns: [spawn(10, -2)],
      collectibles: [collectible(10, -3)]
    });
    const findings = analyzeStage(layout);

    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe('reachability-skipped');
    expect(findings[0].severity).toBe('warning');
  });

  test('flags an unusable checkpoint activation cell', () => {
    const layout = makeLayout({
      tiles: [floor(), tile({ x: 8, y: -1, width: 1, height: 1 })],
      spawns: [spawn()],
      checkpoints: [checkpoint(8, 0)]
    });

    expect(codesFor(layout)).toContain('checkpoint-unusable');
  });

  test('flags teleporters and markers inside solid geometry', () => {
    const layout = makeLayout({
      tiles: [
        floor(),
        tile({ x: 10, y: -1, width: 1, height: 1 }),
        tile({ x: 12, y: -1, width: 1, height: 1 })
      ],
      spawns: [spawn()],
      teleporters: [teleporter(10, -1)],
      markers: [marker(12, -1)]
    });
    const codes = codesFor(layout);

    expect(codes).toContain('teleporter-in-solid');
    expect(codes).toContain('teleporter-marker-in-solid');
  });

  test('flags an enemy inside solid geometry', () => {
    const layout = makeLayout({
      tiles: [floor(), tile({ x: 6, y: -1, width: 1, height: 1 })],
      spawns: [spawn()],
      enemies: [enemy(6, -1)]
    });

    expect(codesFor(layout)).toContain('enemy-in-solid');
  });

  test('clean stage produces no findings', () => {
    const layout = makeLayout({
      tiles: [floor()],
      spawns: [spawn()],
      collectibles: [collectible(5, -1), collectible(12, -1)],
      checkpoints: [checkpoint(8, 0)],
      teleporters: [teleporter(10, -1)],
      markers: [marker(14, -1)],
      enemies: [enemy(16, -1)]
    });

    expect(analyzeStage(layout)).toEqual([]);
  });
});

describe('playability CLI arguments', () => {
  test('returns defaults when no arguments are given', () => {
    expect(parseArguments([])).toEqual({ help: false, stageIds: [] });
  });

  test('collects repeated --stage flags', () => {
    expect(parseArguments(['--stage', 'alpha', '--stage', 'beta'])).toEqual({
      help: false,
      stageIds: ['alpha', 'beta']
    });
  });

  test('accepts --stage=<id>', () => {
    expect(parseArguments(['--stage=alpha', '--stage', 'beta'])).toEqual({
      help: false,
      stageIds: ['alpha', 'beta']
    });
  });

  test('returns help for --help', () => {
    expect(parseArguments(['--help'])).toEqual({ help: true, stageIds: [] });
  });

  test('rejects unknown options', () => {
    expect(() => parseArguments(['--nope'])).toThrow('unknown argument "--nope"');
  });

  test('rejects a missing stage id', () => {
    expect(() => parseArguments(['--stage'])).toThrow('--stage requires a stage id');
    expect(() => parseArguments(['--stage='])).toThrow('--stage requires a stage id');
  });
});
