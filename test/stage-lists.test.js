import { describe, expect, test } from 'bun:test';
import { Stage, Checkpoint } from '../src/game/stages/stage.js';
import { Tile } from '../src/game/entities/tile.js';
import { Enemy } from '../src/game/entities/enemy.js';
import { Collectible } from '../src/game/entities/collectible.js';
import { Projectile } from '../src/game/entities/projectile.js';
import { PROJECTILE_CONFIG, createStage } from './support/stage-fixture.js';

function tile(x) {
  return new Tile(x, 0, 1, 1, {
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
    'border-color': '#FFFFFF',
    'border-width': 0.2,
    'corner-radius': 0.1
  });
}

function enemy(x, dropTable = []) {
  return new Enemy({
    shape: 3,
    size: 1,
    'color-index': 1,
    'color-palette': ['#000000', '#BF4040'],
    'is-boss': false,
    'drop-table': dropTable
  }, null);
}

function collectible(x) {
  return new Collectible(x, 0, 0.5, 0.5, { type: 'coin', size: { width: 0.5, height: 0.5 } });
}

function projectile() {
  return new Projectile(0, 0, 1, 0, 1, null, PROJECTILE_CONFIG);
}

describe('stage per-type lists', () => {
  test('addEntity alone places each entity in its per-type list', () => {
    const { stage } = createStage();

    const firstTile = tile(1);
    const secondTile = tile(2);
    const firstEnemy = enemy(3);
    const firstCollectible = collectible(4);
    const firstCheckpoint = new Checkpoint(5, 0, 1, 1, 1, {});
    const firstProjectile = projectile();

    stage.addEntity(firstTile);
    stage.addEntity(secondTile);
    stage.addEntity(firstEnemy);
    stage.addEntity(firstCollectible);
    stage.addEntity(firstCheckpoint);
    stage.addEntity(firstProjectile);

    expect(stage.tilesList).toEqual([firstTile, secondTile]);
    expect(stage.enemiesList).toEqual([firstEnemy]);
    expect(stage.collectiblesList).toEqual([firstCollectible]);
    expect(stage.checkpointsList).toEqual([firstCheckpoint]);
    expect(stage.checkpointCount).toBe(1);
    const projectiles = new Set(stage.entities.filter((entity) => entity instanceof Projectile));
    expect([...projectiles]).toEqual([firstProjectile]);
  });

  test('keep iteration order equal to the addEntity order per list', () => {
    const { stage } = createStage();
    const entities = [tile(1), tile(2), tile(3)];

    for (const entity of entities) {
      stage.addEntity(entity);
    }

    expect(stage.tilesList.map((entity) => entity.x)).toEqual([1, 2, 3]);
  });

  test('removeEntity prunes the entity collection and the per-type lists', () => {
    const { stage } = createStage();
    const firstTile = tile(1);
    const secondTile = tile(2);
    const cp = new Checkpoint(0, 0, 1, 1, 1, {});

    stage.addEntity(firstTile);
    stage.addEntity(secondTile);
    stage.addEntity(cp);
    stage.removeEntity(firstTile);
    stage.removeEntity(cp);

    expect(stage.tilesList).toEqual([secondTile]);
    expect(stage.checkpointsList).toEqual([]);
    expect(stage.checkpointCount).toBe(0);
    expect(stage.entities.includes(firstTile)).toBe(false);
    expect(stage.entities.includes(cp)).toBe(false);
  });

  test('assigning a list is no longer possible from outside the stage', () => {
    const { stage } = createStage();

    expect(() => { stage.tilesList = []; }).toThrow();
    expect(() => { stage.enemiesList = []; }).toThrow();
    expect(() => { stage.collectiblesList = []; }).toThrow();
    expect(() => { stage.checkpointsList = []; }).toThrow();
  });

  test('requires a projectile factory at construction', () => {
    expect(() => new Stage({ name: 'no-factory' }, {
      player: { set stage(value) {}, x: 0, y: 0 },
      physicsEngine: {},
      collisionSolver: {},
      collectibleFactory: () => {},
      noteCollection: null,
      projectileFactory: undefined,
      damageSystem: {}
    })).toThrow('Stage requires a projectile factory');
  });

  test('spawns an enemy drop through the injected collectible factory', () => {
    const calls = [];
    const factory = (config) => {
      calls.push(config);
      return collectible(0);
    };
    const { stage } = createStage({ collectibleFactory: factory });
    const dropSource = enemy(3, [{ type: 'coin', weight: 1 }]);
    dropSource.x = 3;
    dropSource.y = 4;
    dropSource.takeDamage(1);
    stage.addEntity(dropSource);

    stage.update(1 / 60, null);

    expect(dropSource.isAlive).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0].type).toBe('coin');
    expect(stage.collectiblesList).toHaveLength(1);
    expect(stage.collectiblesList[0].x).toBe(dropSource.x);
    expect(stage.collectiblesList[0].y).toBe(dropSource.y);
  });
});
