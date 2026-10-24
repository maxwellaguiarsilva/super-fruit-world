import { describe, expect, test } from 'bun:test';
import { StageBase } from '../src/engine/entities/stage-base.js';
import { Checkpoint } from '../src/game/stages/stage.js';
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

function enemy(x, colorIndex = 3) {
  return new Enemy({
    shape: 3,
    size: 1,
    'color-index': colorIndex,
    'color-palette': ['#000000', '#BF4040', '#40BF40', '#BFBF40'],
    'is-boss': false,
    'drop-table': []
  }, null);
}

function collectible(x) {
  return new Collectible(x, 0, 0.5, 0.5, { type: 'coin', size: { width: 0.5, height: 0.5 } });
}

function projectile() {
  return new Projectile(0, 0, 1, 0, 1, null, PROJECTILE_CONFIG);
}

function countOccurrences(entities) {
  const occurrences = new Map();

  for (const entity of entities) {
    occurrences.set(entity, (occurrences.get(entity) ?? 0) + 1);
  }

  return occurrences;
}

describe('stage entity views', () => {
  test('entities returns every added entity exactly once', () => {
    const { stage } = createStage();
    const added = [
      tile(1),
      tile(2),
      enemy(3),
      enemy(4),
      collectible(5),
      collectible(6),
      new Checkpoint(7, 0, 1, 1, 1, {}),
      new Checkpoint(8, 0, 1, 1, 2, {}),
      projectile()
    ];

    for (const entity of added) {
      stage.addEntity(entity);
    }

    const entities = stage.entities;

    expect(entities.length).toBe(added.length);
    expect(new Set(entities).size).toBe(added.length);
    expect(countOccurrences(entities).size).toBe(added.length);
    expect(new Set(entities)).toEqual(new Set(added));
  });

  test('checkpoints returns every checkpoint exactly once', () => {
    const { stage } = createStage();
    const first = new Checkpoint(1, 0, 1, 1, 1, {});
    const second = new Checkpoint(2, 0, 1, 1, 2, {});

    stage.addEntity(first);
    stage.addEntity(second);

    expect(stage.checkpoints).toEqual([first, second]);
    expect(stage.checkpoints.length).toBe(2);
    expect(stage.checkpointCount).toBe(2);
  });

  test('a screen-clear style loop over entities visits each enemy once', () => {
    const { stage } = createStage();
    const enemies = [enemy(1), enemy(2), enemy(3)];

    for (const entity of [enemies[0], tile(4), enemies[1], collectible(5), enemies[2]]) {
      stage.addEntity(entity);
    }

    const damageCalls = new Map();

    for (const entity of stage.entities) {
      if (entity.isEnemy && entity.takeDamage) {
        damageCalls.set(entity, (damageCalls.get(entity) ?? 0) + 1);
        entity.takeDamage(1);
      }
    }

    for (const current of enemies) {
      expect(damageCalls.get(current)).toBe(1);
    }
    expect(damageCalls.size).toBe(enemies.length);
  });

  test('a projectile style loop over entities considers each entity once', () => {
    const { stage } = createStage();
    const shooter = enemy(1);
    const target = enemy(2);
    const shot = projectile();

    stage.addEntity(shooter);
    stage.addEntity(target);
    stage.addEntity(shot);

    const visited = new Map();

    for (const entity of stage.entities) {
      if (entity === shooter || entity === shot) {
        continue;
      }
      visited.set(entity, (visited.get(entity) ?? 0) + 1);
    }

    expect([...visited.keys()]).toEqual([target]);
    expect(visited.get(target)).toBe(1);
  });

  test('entities returns a copy that external code cannot mutate', () => {
    const { stage } = createStage();
    const entity = tile(1);
    stage.addEntity(entity);

    const view = stage.entities;
    view.push(tile(2));
    view.length = 0;

    expect(stage.entities).toEqual([entity]);
    expect(stage.entities).not.toBe(stage.entities);

    const base = new StageBase({ name: 'base' });
    base.addEntity(entity);
    const baseView = base.entities;
    baseView.push(tile(3));
    baseView.length = 0;

    expect(base.entities).toEqual([entity]);
    expect(base.entities).not.toBe(base.entities);
  });
});
