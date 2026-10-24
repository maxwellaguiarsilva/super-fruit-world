import { describe, expect, test } from 'bun:test';
import { resolveTileType } from '../src/app/content/tile-config.js';
import { parseEnemyConfig } from '../src/app/content/enemy-config.js';
import { Tile } from '../src/game/entities/tile.js';
import { PatrolEnemy, BossEnemy } from '../src/game/entities/enemy-types.js';

const COLORS = {
  colors: {
    black: { dark: '#000000', light: '#404040' },
    red: { dark: '#800000', light: '#BF4040' },
    yellow: { dark: '#808000', light: '#BFBF40' },
    white: { dark: '#808080', light: '#FFFFFF' }
  },
  'color-order': ['black', 'red', 'yellow', 'white']
};

const BORDERS = { borders: { thin: { width: 0.1 }, medium: { width: 0.2 } } };

function tileData(overrides = {}) {
  return {
    type: 'platform',
    visual: { 'fill-color': 'white', 'border-color': 'white', border: 'medium' },
    collision: { solid: true },
    physics: { friction: 0.75 },
    ...overrides
  };
}

function resolveTile(data, object = {}) {
  return resolveTileType({ type: 'platform', ...object }, { platform: data }, COLORS, BORDERS);
}

function enemyData(overrides = {}) {
  return {
    size: 1,
    'boss-size': 3,
    'shape-map': { triangle: 3, pentagon: 5 },
    ...overrides
  };
}

describe('tile normalization ownership', () => {
  test('Tile consumes the resolved configuration verbatim', () => {
    const config = resolveTile(tileData());
    const tile = new Tile(0, 0, 1, 1, config);

    expect(tile.tileType).toBe('platform');
    expect(tile.isSolid).toBe(true);
    expect(tile.isDeadly).toBe(false);
    expect(tile.friction).toBe(0.75);
  });

  test('a changed application-layer default changes the Tile', () => {
    const original = new Tile(0, 0, 1, 1, resolveTile(tileData()));
    const changed = new Tile(0, 0, 1, 1, resolveTile(tileData({
      collision: { solid: true },
      physics: { friction: 0.25 }
    })));

    expect(original.friction).toBe(0.75);
    expect(changed.friction).toBe(0.25);
  });

  test('a changed solid default changes the Tile', () => {
    const solid = new Tile(0, 0, 1, 1, resolveTile(tileData()));
    const passable = new Tile(0, 0, 1, 1, resolveTile(tileData({ collision: { solid: false } })));

    expect(solid.isSolid).toBe(true);
    expect(passable.isSolid).toBe(false);
  });

  test('Tile adds no fallback for a missing configuration value', () => {
    const config = resolveTile(tileData({ physics: {} }), { friction: null });
    const tile = new Tile(0, 0, 1, 1, config);

    expect(tile.friction).toBe(null);
  });
});

describe('enemy normalization ownership', () => {
  test('the enemy size comes from the application-layer configuration', () => {
    const config = parseEnemyConfig({ type: 'triangle-patrol' }, enemyData(), COLORS);
    const enemy = new PatrolEnemy(config);

    expect(config.size).toBe(1);
    expect(enemy.width).toBe(1);
    expect(enemy.height).toBe(1);
  });

  test('a changed normal size changes the enemy dimensions', () => {
    const config = parseEnemyConfig({ type: 'triangle-patrol' }, enemyData({ size: 2 }), COLORS);
    const enemy = new PatrolEnemy(config);

    expect(enemy.width).toBe(2);
  });

  test('the boss size comes from the application-layer configuration', () => {
    const config = parseEnemyConfig({ type: 'pentagon-patrol', 'is-boss': true }, enemyData({ 'boss-size': 5 }), COLORS);
    const enemy = new BossEnemy(config);

    expect(config.size).toBe(5);
    expect(enemy.width).toBe(5);
  });

  test('Enemy rejects a configuration without a resolved size instead of deriving one', () => {
    expect(() => new PatrolEnemy({
      shape: 3,
      'color-index': 1,
      'color-palette': ['#000000'],
      'is-boss': false,
      'drop-table': [],
      'patrol-range': 3
    })).toThrow('numeric "size"');
  });

  test('parseEnemyConfig provides every key the enemy classes read', () => {
    const config = parseEnemyConfig({ type: 'triangle-flyer' }, enemyData(), COLORS);

    for (const key of [
      'shape',
      'size',
      'behavior',
      'color-index',
      'color-palette',
      'is-boss',
      'patrol-range',
      'damage-output',
      'drop-table',
      'fire-rate',
      'projectile-speed',
      'detection-range',
      'hover-amplitude',
      'hover-frequency'
    ]) {
      expect(Object.hasOwn(config, key)).toBe(true);
    }

    expect(Object.hasOwn(config, 'drop-rate')).toBe(false);
    expect(Object.hasOwn(config, 'drop-type')).toBe(false);
  });
});
