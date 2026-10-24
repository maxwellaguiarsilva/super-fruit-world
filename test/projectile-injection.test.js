import { describe, expect, test } from 'bun:test';
import { Stage } from '../src/game/stages/stage.js';
import { Projectile } from '../src/game/entities/projectile.js';
import { createAbilities } from '../src/app/factories/ability-factory.js';
import { createEnemyFactory } from '../src/app/factories/enemy-factory.js';
import { createProjectileFactory } from '../src/app/factories/projectile-factory.js';
import { PROJECTILE_CONFIG, createProjectileFactory as fixtureProjectileFactory, createStage } from './support/stage-fixture.js';

function recordingFactory() {
  const base = fixtureProjectileFactory();
  const calls = [];
  const factory = (...args) => {
    calls.push(args);
    return base(...args);
  };
  return { factory, calls };
}

function shooterConfig(overrides = {}) {
  return {
    shape: 3,
    size: 1,
    behavior: 'shooter',
    'color-index': 1,
    'color-palette': ['#000000', '#BF4040'],
    'is-boss': false,
    'patrol-range': 3,
    'damage-output': null,
    'drop-table': [],
    'fire-rate': 2,
    'projectile-speed': 2,
    'detection-range': 10,
    'hover-amplitude': 0,
    'hover-frequency': 0,
    ...overrides
  };
}

describe('projectile injection', () => {
  test('Stage has no projectile class', () => {
    expect(Stage.projectileClass).toBeUndefined();
    expect('projectileClass' in Stage).toBe(false);
  });

  test('Stage receives the projectile factory explicitly', () => {
    const { factory } = recordingFactory();
    const { stage } = createStage({ projectileFactory: factory });

    expect(stage.projectileFactory).toBe(factory);
  });

  test('ShootAbility creates projectiles through its injected factory', () => {
    const { stage, player } = createStage();
    const { factory, calls } = recordingFactory();

    player.level = 10;
    player.inventory = { count: () => 1, remove() {} };

    const [ability] = createAbilities({
      abilities: { shoot: { type: 'shoot', 'required-level': 0, 'fire-rate': 2, 'projectile-speed': 1 } }
    }, { projectileFactory: factory });

    ability.update(player, 0.1, { isDown: (name) => name === 'shoot' });

    expect(calls.length).toBe(1);
    expect(calls[0][5]).toBe(player);

    const projectiles = new Set(stage.entities.filter((entity) => entity instanceof Projectile));
    expect(projectiles.size).toBe(1);
    expect([...projectiles][0].velocity.x).toBeGreaterThan(0);
  });

  test('ShootAbility does not use the projectile factory held by the stage', () => {
    const stageRecorder = recordingFactory();
    const abilityRecorder = recordingFactory();
    const { player } = createStage({ projectileFactory: stageRecorder.factory });

    player.level = 10;
    player.inventory = { count: () => 1, remove() {} };

    const [ability] = createAbilities({
      abilities: { shoot: { type: 'shoot', 'required-level': 0, 'fire-rate': 2, 'projectile-speed': 1 } }
    }, { projectileFactory: abilityRecorder.factory });

    ability.update(player, 0.1, { isDown: (name) => name === 'shoot' });

    expect(abilityRecorder.calls.length).toBe(1);
    expect(stageRecorder.calls.length).toBe(0);
  });

  test('a shooter enemy creates projectiles through the factory passed by the enemy factory', () => {
    const { factory: stageFactory, calls: stageCalls } = recordingFactory();
    const enemyRecorder = recordingFactory();
    const { stage } = createStage({ projectileFactory: stageFactory });
    stage.player.x = 1;

    const createEnemy = createEnemyFactory({ projectileFactory: enemyRecorder.factory });
    const shooter = createEnemy(shooterConfig(), stage);
    shooter.x = 0;
    shooter.y = 0;
    shooter.update(0.1, stage);

    expect(enemyRecorder.calls.length).toBe(1);
    expect(enemyRecorder.calls[0][5]).toBe(shooter);
    expect(stageCalls.length).toBe(0);

    const projectiles = new Set(stage.entities.filter((entity) => entity instanceof Projectile));
    expect(projectiles.size).toBe(1);
    expect([...projectiles][0].velocity.x).toBeGreaterThan(0);
  });

  test('the projectile factory receives the configured projectile settings', () => {
    const { stage, player } = createStage({
      projectileFactory: createProjectileFactory(PROJECTILE_CONFIG)
    });
    player.level = 10;
    player.inventory = { count: () => 1, remove() {} };

    const [ability] = createAbilities({
      abilities: { shoot: { type: 'shoot', 'required-level': 0, 'fire-rate': 2, 'projectile-speed': 1 } }
    }, { projectileFactory: createProjectileFactory(PROJECTILE_CONFIG) });

    ability.update(player, 0.1, { isDown: (name) => name === 'shoot' });

    const [projectile] = new Set(stage.entities.filter((entity) => entity instanceof Projectile));
    expect(projectile.maxTravel).toBe(PROJECTILE_CONFIG['max-travel']);
    expect(projectile.width).toBe(PROJECTILE_CONFIG.size);
  });

  test('constructing a shooter without a projectile factory fails', () => {
    const createEnemy = createEnemyFactory();

    expect(() => createEnemy(shooterConfig(), null)).toThrow('ShooterEnemy requires a projectile factory');
  });

  test('constructing a shoot ability without a projectile factory fails', () => {
    expect(() => createAbilities({
      abilities: { shoot: { type: 'shoot' } }
    })).toThrow('ShootAbility requires a projectile factory');
  });
});
