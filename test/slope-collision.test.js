import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

import { SlopeSurface } from '../src/engine/physics/slope-surface.js';
import { PhysicsEngine } from '../src/engine/physics/physics-engine.js';
import { CollisionSolver } from '../src/engine/physics/collision-solver.js';
import { Tile } from '../src/game/entities/tile.js';
import { Player } from '../src/game/entities/player.js';
import { Stage } from '../src/game/stages/stage.js';
import { createAbilities } from '../src/app/factories/ability-factory.js';

const GAME_CONFIG = readJson('data/game-config.json');
const ABILITIES_CONFIG = readJson('data/player/abilities.json');

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8'));
}

function input({ down = [], pressed = [] } = {}) {
  const held = new Set(down);
  const tapped = new Set(pressed);
  return {
    isDown: (action) => held.has(action),
    isPressed: (action) => tapped.has(action),
    isReleased: () => false
  };
}

function tileConfig(overrides) {
  return {
    type: 'platform',
    solid: true,
    deadly: false,
    'damage-value': null,
    liquid: false,
    climbable: false,
    inverted: false,
    'slope-angle': null,
    friction: 0.75,
    rendered: true,
    'fill-color': '#FFFFFF',
    'border-color': '#000000',
    'border-width': 0.1,
    'corner-radius': 0.1,
    ...overrides
  };
}

function platform(x, y, width = 1, height = 1) {
  return new Tile(x, y, width, height, tileConfig({ type: 'platform' }));
}

function slope(x, y, width, height, { angle = 30, inverted = false } = {}) {
  return new Tile(x, y, width, height, tileConfig({
    type: 'slope',
    'slope-angle': angle,
    inverted
  }));
}

function movementConfig(names) {
  const abilities = {};
  for (const name of names) {
    abilities[name] = ABILITIES_CONFIG.abilities[name];
  }
  return { abilities };
}

function createPlayer({ level = 0, abilities = [] } = {}) {
  const physics = GAME_CONFIG.physics;

  return new Player({
    playerConfig: {
      size: GAME_CONFIG.player.size,
      'starting-level': level,
      'starting-color': '#000000',
      'walk-speed': physics['walk-speed'],
      'walk-acceleration': physics['walk-acceleration'],
      'jump-velocity': physics['jump-velocity']
    },
    abilities: createAbilities(movementConfig(abilities)),
    inventory: { count: () => 0, has: () => false, remove() {} },
    healthSystem: {
      invincibilityTimer: 0,
      isDead: false,
      takeDamage: () => true,
      heal() {},
      respawn() {},
      update() {}
    },
    scoreSystem: { score: 0, coins: 0 },
    progressionSystem: { maxLevel: 7 },
    audioEngine: { playSFX() {} },
    stage: null
  });
}

function createStage(player, tiles) {
  const stage = new Stage({ name: 'slope-fixture', sections: [] }, {
    player,
    physicsEngine: new PhysicsEngine(GAME_CONFIG.physics),
    collisionSolver: new CollisionSolver(),
    collectibleFactory: () => null,
    noteCollection: null,
    projectileFactory: () => null,
    damageSystem: { applyHazardDamage() {}, applyEnemyDamage() {} }
  });

  for (const tile of tiles) {
    stage.addEntity(tile);
  }
  stage.recomputeBounds();
  return stage;
}

function placePlayer(player, x, y) {
  player.x = x;
  player.y = y;
  player.velocity = { x: 0, y: 0 };
  player.onGround = false;
}

function supportSurfaceY(tile, player) {
  const left = Math.max(player.x, tile.x);
  const right = Math.min(player.x + player.width, tile.x + tile.width);
  const localX = tile.slopeSurface.inverted ? left : right;
  return tile.surfaceYAt(localX);
}

describe('slope surface model', () => {
  test('a configured angle that matches the tile box is used verbatim', () => {
    const surface = new SlopeSurface({ width: 2, height: 2, angle: 45, inverted: false });

    expect(surface.derived).toBe(false);
    expect(surface.angle).toBeCloseTo(45);
    expect(surface.surfaceY(0)).toBeCloseTo(2);
    expect(surface.surfaceY(1)).toBeCloseTo(1);
    expect(surface.surfaceY(2)).toBeCloseTo(0);
  });

  test('the non-inverted surface rises from left to right', () => {
    const surface = new SlopeSurface({ width: 5, height: 3, angle: 30, inverted: false });

    expect(surface.surfaceY(0)).toBeCloseTo(3);
    expect(surface.surfaceY(2.5)).toBeCloseTo(1.5);
    expect(surface.surfaceY(5)).toBeCloseTo(0);
  });

  test('the inverted surface mirrors the same heights', () => {
    const plain = new SlopeSurface({ width: 5, height: 3, angle: 30, inverted: false });
    const inverted = new SlopeSurface({ width: 5, height: 3, angle: 30, inverted: true });

    expect(inverted.surfaceY(0)).toBeCloseTo(plain.surfaceY(5));
    expect(inverted.surfaceY(2.5)).toBeCloseTo(plain.surfaceY(2.5));
    expect(inverted.surfaceY(5)).toBeCloseTo(plain.surfaceY(0));
  });

  test('the inverse returns the same local x for a surface height', () => {
    const plain = new SlopeSurface({ width: 5, height: 3, angle: 30, inverted: false });
    const inverted = new SlopeSurface({ width: 5, height: 3, angle: 30, inverted: true });

    for (const localX of [0, 1.25, 2.5, 3.75, 5]) {
      expect(plain.surfaceX(plain.surfaceY(localX))).toBeCloseTo(localX);
      expect(inverted.surfaceX(inverted.surfaceY(localX))).toBeCloseTo(localX);
    }
  });

  test('an angle that does not fit the tile box is derived from the tile size', () => {
    const surface = new SlopeSurface({ width: 5, height: 3, angle: 45, inverted: false });

    expect(surface.derived).toBe(true);
    expect(surface.declaredAngle).toBe(45);
    expect(surface.angle).toBeCloseTo((Math.atan2(3, 5) * 180) / Math.PI);
    expect(surface.surfaceY(0)).toBeCloseTo(3);
    expect(surface.surfaceY(5)).toBeCloseTo(0);
  });

  test('a slope without a declared angle derives the surface from its size', () => {
    const surface = new SlopeSurface({ width: 4, height: 2, angle: null, inverted: false });

    expect(surface.declaredAngle).toBe(null);
    expect(surface.derived).toBe(true);
    expect(surface.surfaceY(0)).toBeCloseTo(2);
    expect(surface.surfaceY(4)).toBeCloseTo(0);
  });

  test('a slope requires a positive size', () => {
    expect(() => new SlopeSurface({ width: 0, height: 3, angle: 30 })).toThrow('positive width and height');
    expect(() => new SlopeSurface({ width: 5, height: -1, angle: 30 })).toThrow('positive width and height');
  });
});

describe('slope collision', () => {
  test('the player walks up a slope and stays on its surface', () => {
    const player = createPlayer();
    const leftGround = platform(0, 3, 2, 1);
    const slopeTile = slope(2, 0, 5, 3, { angle: 30, inverted: false });
    const rightGround = platform(7, 0, 5, 1);
    const stage = createStage(player, [leftGround, slopeTile, rightGround]);

    placePlayer(player, 1, 2);
    stage.update(1 / 60, input());
    expect(player.onGround).toBe(true);

    const startY = player.y;
    const samples = [];

    for (let frame = 0; frame < 90; frame++) {
      stage.update(1 / 60, input({ down: ['right'] }));

      if (player.x >= 3 && player.x + player.width <= 7) {
        samples.push({
          onGround: player.onGround,
          bottom: player.y + player.height,
          surface: supportSurfaceY(slopeTile, player)
        });
      }
    }

    expect(samples.length).toBeGreaterThan(10);
    for (const sample of samples) {
      expect(sample.onGround).toBe(true);
      expect(sample.bottom).toBeCloseTo(sample.surface, 6);
    }
    expect(player.y).toBeLessThan(startY - 2);
  });

  test('the player walks down a slope and stays on its surface', () => {
    const player = createPlayer();
    const leftGround = platform(0, 3, 2, 1);
    const slopeTile = slope(2, 0, 5, 3, { angle: 30, inverted: false });
    const rightGround = platform(7, 0, 5, 1);
    const stage = createStage(player, [leftGround, slopeTile, rightGround]);

    placePlayer(player, 8, -1);
    stage.update(1 / 60, input());
    expect(player.onGround).toBe(true);

    const samples = [];

    for (let frame = 0; frame < 90; frame++) {
      stage.update(1 / 60, input({ down: ['left'] }));

      if (player.x >= 2 && player.x + player.width <= 7) {
        samples.push({
          onGround: player.onGround,
          bottom: player.y + player.height,
          surface: supportSurfaceY(slopeTile, player)
        });
      }
    }

    expect(samples.length).toBeGreaterThan(10);
    for (const sample of samples) {
      expect(sample.onGround).toBe(true);
      expect(sample.bottom).toBeCloseTo(sample.surface, 6);
    }
    expect(player.y).toBeGreaterThan(1.5);
  });

  test('the player lands on the slope surface and stays grounded', () => {
    const player = createPlayer();
    const slopeTile = slope(2, 0, 5, 3, { angle: 30, inverted: false });
    const stage = createStage(player, [slopeTile]);

    placePlayer(player, 4, -4);

    let landed = false;
    for (let frame = 0; frame < 120; frame++) {
      stage.update(1 / 60, input());
      if (player.onGround) {
        landed = true;
        break;
      }
    }

    expect(landed).toBe(true);
    expect(player.y + player.height).toBeCloseTo(supportSurfaceY(slopeTile, player), 6);

    const settledY = player.y;
    stage.update(1 / 60, input());
    expect(player.onGround).toBe(true);
    expect(player.y).toBeCloseTo(settledY, 6);
  });

  test('a player is blocked by the tall vertical face of a non-inverted slope', () => {
    const player = createPlayer();
    const slopeTile = slope(2, 0, 5, 3, { angle: 30, inverted: false });
    const ground = platform(7, 3, 5, 1);
    const stage = createStage(player, [slopeTile, ground]);

    placePlayer(player, 9, 2);
    stage.update(1 / 60, input());
    expect(player.onGround).toBe(true);

    for (let frame = 0; frame < 120; frame++) {
      stage.update(1 / 60, input({ down: ['left'] }));
    }

    expect(player.x).toBeCloseTo(slopeTile.x + slopeTile.width, 6);
    expect(player.y).toBeCloseTo(2, 2);
  });

  test('a player is blocked by the tall vertical face of an inverted slope', () => {
    const player = createPlayer();
    const slopeTile = slope(2, 0, 5, 3, { angle: 30, inverted: true });
    const ground = platform(-3, 3, 5, 1);
    const stage = createStage(player, [slopeTile, ground]);

    placePlayer(player, 0, 2);
    stage.update(1 / 60, input());
    expect(player.onGround).toBe(true);

    for (let frame = 0; frame < 120; frame++) {
      stage.update(1 / 60, input({ down: ['right'] }));
    }

    expect(player.x + player.width).toBeCloseTo(slopeTile.x, 6);
    expect(player.y).toBeCloseTo(2, 2);
  });

  test('jumping and crouching use the slope surface as ground', () => {
    const player = createPlayer({ level: 4, abilities: ['crouch', 'double-jump'] });
    const slopeTile = slope(2, 0, 5, 3, { angle: 30, inverted: false });
    const stage = createStage(player, [slopeTile]);

    placePlayer(player, 4, -4);

    for (let frame = 0; frame < 120 && !player.onGround; frame++) {
      stage.update(1 / 60, input());
    }
    expect(player.onGround).toBe(true);

    stage.update(1 / 60, input({ down: ['crouch'] }));
    expect(player.onGround).toBe(true);
    expect(player.isCrouching).toBe(true);

    const doubleJump = player.ability('double-jump');
    const maxJumps = doubleJump.maxJumps;
    stage.update(1 / 60, input({ down: ['crouch'], pressed: ['jump'] }));

    expect(player.onGround).toBe(false);
    expect(player.velocity.y).toBe(-GAME_CONFIG.physics['jump-velocity']);
    expect(doubleJump.jumpsRemaining).toBe(maxJumps - 1);
  });
});

describe('slope rendering', () => {
  function renderSlope(tile) {
    const polygons = [];
    const rects = [];
    const renderer = {
      drawPolygonPath(points, fillColor, borderColor, borderWidth) {
        polygons.push({ points, fillColor, borderColor, borderWidth });
      },
      drawRect(...args) {
        rects.push(args);
      }
    };

    tile.render(renderer);
    return { polygons, rects };
  }

  test('a non-inverted slope renders a diagonal polygon with the configured colors', () => {
    const slopeTile = slope(1, 2, 5, 3, { angle: 30, inverted: false });
    const { polygons, rects } = renderSlope(slopeTile);

    expect(rects).toHaveLength(0);
    expect(polygons).toHaveLength(1);
    expect(polygons[0].fillColor).toBe('#FFFFFF');
    expect(polygons[0].borderColor).toBe('#000000');
    expect(polygons[0].borderWidth).toBe(0.1);
    expect(polygons[0].points).toEqual([
      { x: 1, y: 5 },
      { x: 6, y: 2 },
      { x: 6, y: 5 }
    ]);
  });

  test('an inverted slope renders the mirrored diagonal polygon', () => {
    const slopeTile = slope(1, 2, 5, 3, { angle: 30, inverted: true });
    const { polygons, rects } = renderSlope(slopeTile);

    expect(rects).toHaveLength(0);
    expect(polygons).toHaveLength(1);
    expect(polygons[0].points).toEqual([
      { x: 1, y: 2 },
      { x: 6, y: 5 },
      { x: 1, y: 5 }
    ]);
  });

  test('a non-slope tile keeps the rectangle path', () => {
    const platformTile = platform(3, 4, 2, 1);
    const { polygons, rects } = renderSlope(platformTile);

    expect(polygons).toHaveLength(0);
    expect(rects).toHaveLength(1);
    expect(rects[0].slice(0, 4)).toEqual([3, 4, 2, 1]);
  });
});
