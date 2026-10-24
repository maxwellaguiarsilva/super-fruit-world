import { describe, expect, test } from 'bun:test';

import { Collectible } from '../src/game/entities/collectible.js';
import { Projectile } from '../src/game/entities/projectile.js';
import { Tile } from '../src/game/entities/tile.js';
import { Checkpoint } from '../src/game/stages/stage.js';
import { TeleporterMarker } from '../src/game/stages/teleporters.js';

const PROJECTILE_CONFIG = {
  size: 0.25,
  'max-travel': 20,
  'enemy-color': '#BF4040',
  'player-color': '#40BF40'
};

function createProjectile(x, y, velocityX, velocityY, source) {
  return new Projectile(x, y, velocityX, velocityY, 1, source, PROJECTILE_CONFIG);
}

function createTile(type, solid, x = 0, y = 0) {
  return new Tile(x, y, 1, 1, { type, solid });
}

function createTarget({ x = 0, y = 0, isEnemy = true, isSolid = false } = {}) {
  return {
    x,
    y,
    width: 1,
    height: 1,
    isAlive: true,
    isEnemy,
    isSolid,
    hitbox: { x: 0, y: 0, width: 1, height: 1 },
    hits: [],
    takeDamage(amount) {
      this.hits.push(amount);
    }
  };
}

function createPlayer({ x = 0, y = 0 } = {}) {
  return {
    x,
    y,
    width: 1,
    height: 1,
    isAlive: true,
    hitbox: { x: 0, y: 0, width: 1, height: 1 },
    hits: [],
    takeDamage(amount) {
      this.hits.push(amount);
      return true;
    }
  };
}

function createStage(entities, player = null) {
  return { entities, player };
}

describe('projectile impact against world geometry', () => {
  test('a projectile passes through a decorative tile', () => {
    const projectile = createProjectile(0.1, 0.1, 1, 0, {});
    const stage = createStage([createTile('decorative', false)]);

    projectile.update(0.001, stage);

    expect(projectile.isAlive).toBe(true);
  });

  test('a projectile stops on a solid tile', () => {
    const projectile = createProjectile(0.1, 0.1, 1, 0, {});
    const stage = createStage([createTile('platform', true)]);

    projectile.update(0.001, stage);

    expect(projectile.isAlive).toBe(false);
  });

  test('a projectile passes through collectibles, checkpoints and markers', () => {
    const projectile = createProjectile(0.1, 0.1, 1, 0, {});
    const stage = createStage([
      new Collectible(0, 0, 1, 1, { type: 'coin' }),
      new Checkpoint(0, 0, 1, 1, 1, {}),
      new TeleporterMarker('marker', 0, 0)
    ]);

    projectile.update(0.001, stage);

    expect(projectile.isAlive).toBe(true);
  });

  test('an enemy projectile passes through its shooter', () => {
    const shooter = createTarget();
    const projectile = createProjectile(0.1, 0.1, 1, 0, shooter);
    const stage = createStage([shooter]);

    projectile.update(0.001, stage);

    expect(shooter.hits).toEqual([]);
    expect(projectile.isAlive).toBe(true);
  });
});

describe('projectile impact against valid targets', () => {
  test('a player projectile damages an enemy once and stops', () => {
    const source = createPlayer();
    const enemy = createTarget();
    const projectile = createProjectile(0.1, 0.1, 1, 0, source);
    const stage = createStage([enemy], source);

    projectile.update(0.001, stage);
    projectile.update(0.001, stage);

    expect(enemy.hits).toEqual([1]);
    expect(projectile.isAlive).toBe(false);
  });

  test('an enemy projectile passes through other enemies and damages the player', () => {
    const shooter = createTarget();
    const otherEnemy = createTarget();
    const player = createPlayer({ x: 0.1, y: 0.1 });
    const projectile = createProjectile(0.1, 0.1, 1, 0, shooter);
    const stage = createStage([shooter, otherEnemy], player);

    projectile.update(0.001, stage);

    expect(otherEnemy.hits).toEqual([]);
    expect(player.hits).toEqual([1]);
    expect(projectile.isAlive).toBe(false);
  });

  test('a player projectile ignores the player and non-target entities', () => {
    const player = createPlayer({ x: 0.1, y: 0.1 });
    const collectible = new Collectible(0.1, 0.1, 1, 1, { type: 'coin' });
    const projectile = createProjectile(0.1, 0.1, 1, 0, player);
    const stage = createStage([player, collectible], player);

    projectile.update(0.001, stage);

    expect(player.hits).toEqual([]);
    expect(collectible.isAlive).toBe(true);
    expect(projectile.isAlive).toBe(true);
  });
});
