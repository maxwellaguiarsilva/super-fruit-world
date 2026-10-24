import { describe, expect, test } from 'bun:test';
import { validateTileOverlaps } from '../src/game/utils/tile-overlap-validator.js';

function tile(tileType, options = {}) {
  return {
    tileType,
    x: options.x ?? 0,
    y: options.y ?? 0,
    width: options.width ?? 16,
    height: options.height ?? 16,
    isSolid: options.isSolid ?? false,
    isClimbable: options.isClimbable ?? false
  };
}

function overlappingSolver(overlap = { x: 4, y: 8 }) {
  return {
    checkAABB: () => true,
    getOverlap: () => overlap
  };
}

function separatedSolver() {
  return {
    checkAABB: () => false,
    getOverlap: () => null
  };
}

describe('validateTileOverlaps', () => {
  test('accepts tiles whose boxes do not intersect', () => {
    const tiles = [tile('wall', { isSolid: true }), tile('wall', { isSolid: true })];

    expect(() => validateTileOverlaps(tiles, separatedSolver())).not.toThrow();
  });

  test('rejects two solid tiles that share the same space', () => {
    const tiles = [
      tile('wall', { isSolid: true, x: 10, y: 20 }),
      tile('platform', { isSolid: true, x: 12, y: 24 })
    ];

    expect(() => validateTileOverlaps(tiles, overlappingSolver())).toThrow(
      'both tiles are solid and share the same space'
    );
    expect(() => validateTileOverlaps(tiles, overlappingSolver())).toThrow(
      'wall[x:10, y:20, width:16, height:16]'
    );
    expect(() => validateTileOverlaps(tiles, overlappingSolver())).toThrow(
      'platform[x:12, y:24, width:16, height:16]'
    );
  });

  test('rejects a solid tile embedded in a climbable tile', () => {
    const tiles = [
      tile('wall', { isSolid: true }),
      tile('ladder', { isClimbable: true })
    ];

    expect(() => validateTileOverlaps(tiles, overlappingSolver())).toThrow(
      'a solid tile is embedded in a climbable surface'
    );
  });

  test('does not report overlaps between non-solid tiles', () => {
    const tiles = [
      tile('water', { isClimbable: true }),
      tile('decorative')
    ];

    expect(() => validateTileOverlaps(tiles, overlappingSolver())).not.toThrow();
  });

  test('reports the overlap dimensions and an indeterminate size when unknown', () => {
    const tiles = [
      tile('wall', { isSolid: true }),
      tile('wall', { isSolid: true })
    ];

    expect(() => validateTileOverlaps(tiles, overlappingSolver({ x: 4, y: 8 }))).toThrow(
      'overlap by 4 x 8'
    );
    expect(() => validateTileOverlaps(tiles, overlappingSolver(null))).toThrow(
      'overlap by indeterminate'
    );
  });
});
