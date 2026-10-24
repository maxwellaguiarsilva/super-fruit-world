import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

import { parseEnemyConfig } from '../src/app/content/enemy-config.js';
import { createProjectileFactory } from '../src/app/factories/projectile-factory.js';
import { Player } from '../src/game/entities/player.js';
import { ShooterEnemy } from '../src/game/entities/enemy-types.js';
import { HealthSystem } from '../src/game/systems/health-system.js';
import { Projectile } from '../src/game/entities/projectile.js';
import { resolveConfig } from '../src/game/utils/color-utils.js';

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8'));
}

function shooterObjects(stage) {
  return stage.sections
    .flatMap((section) => section.objects)
    .filter((object) => object.type.endsWith('-shooter'));
}

function createPlayer(healthSystem) {
  return new Player({
    playerConfig: {
      size: 1,
      'starting-level': 0,
      'starting-color': '#000000',
      'walk-speed': 5,
      'walk-acceleration': 15,
      'jump-velocity': 10
    },
    abilities: [],
    inventory: { count: () => 0, remove() {} },
    healthSystem,
    scoreSystem: { addScore() {}, addCoins() { return 0; } },
    progressionSystem: null,
    audioEngine: null,
    stage: null
  });
}

function createStage(player) {
  return {
    player,
    entities: [],
    addEntity(entity) {
      this.entities.push(entity);
    }
  };
}

describe('shooter enemy data', () => {
  const colorsConfig = readJson('data/colors.json');
  const enemyConfigData = readJson('data/enemies/config.json');
  const gameConfig = readJson('data/game-config.json');
  const stageFiles = [
    readJson('data/stages/strawberry-fields.json'),
    readJson('data/stages/avocado-grove.json')
  ];

  test('every shipped shooter object declares its firing parameters', () => {
    const shooters = stageFiles.flatMap((stage) => shooterObjects(stage));

    expect(shooters.length).toBe(2);

    for (const shooter of shooters) {
      expect(Number.isFinite(shooter['detection-range'])).toBe(true);
      expect(shooter['detection-range']).toBeGreaterThan(0);
      expect(Number.isFinite(shooter['fire-rate'])).toBe(true);
      expect(shooter['fire-rate']).toBeGreaterThan(0);
      expect(Number.isFinite(shooter['projectile-speed'])).toBe(true);
      expect(shooter['projectile-speed']).toBeGreaterThan(0);
    }
  });

  test('parseEnemyConfig resolves the firing parameters from the stage object', () => {
    const [shooterObject] = shooterObjects(stageFiles[0]);
    const config = parseEnemyConfig(shooterObject, enemyConfigData, colorsConfig);

    expect(config.behavior).toBe('shooter');
    expect(config['detection-range']).toBe(shooterObject['detection-range']);
    expect(config['fire-rate']).toBe(shooterObject['fire-rate']);
    expect(config['projectile-speed']).toBe(shooterObject['projectile-speed']);
  });

  test('a shooter fires at an in-range player and the shot damages the player', () => {
    const [shooterObject] = shooterObjects(stageFiles[0]);
    const config = parseEnemyConfig(shooterObject, enemyConfigData, colorsConfig);
    const projectileConfig = resolveConfig(gameConfig.projectile, colorsConfig);
    const projectileFactory = createProjectileFactory(projectileConfig);

    const healthSystem = new HealthSystem(gameConfig.health);
    const player = createPlayer(healthSystem);
    const stage = createStage(player);

    player.x = 3;
    player.y = 0;

    const shooter = new ShooterEnemy(config, null, { projectileFactory });
    shooter.x = 0;
    shooter.y = 0;

    shooter.update(0.1, stage);

    const projectiles = stage.entities.filter((entity) => entity instanceof Projectile);
    expect(projectiles.length).toBe(1);
    expect(projectiles[0].velocity.x).toBeGreaterThan(0);

    for (let frame = 0; frame < 120; frame++) {
      for (const projectile of projectiles) {
        projectile.update(1 / 60, stage);
      }
    }

    expect(healthSystem.life).toBe(gameConfig.health['max-life'] - 1);
    expect(projectiles[0].isAlive).toBe(false);
  });

  test('a shooter does not fire at an out-of-range player', () => {
    const [shooterObject] = shooterObjects(stageFiles[0]);
    const config = parseEnemyConfig(shooterObject, enemyConfigData, colorsConfig);
    const projectileFactory = createProjectileFactory(
      resolveConfig(gameConfig.projectile, colorsConfig)
    );

    const player = createPlayer(new HealthSystem(gameConfig.health));
    const stage = createStage(player);

    player.x = config['detection-range'] + 1;
    player.y = 0;

    const shooter = new ShooterEnemy(config, null, { projectileFactory });
    shooter.x = 0;
    shooter.y = 0;

    shooter.update(0.1, stage);

    expect(stage.entities).toEqual([]);
  });

  test('a shooter respects its configured fire rate', () => {
    const [shooterObject] = shooterObjects(stageFiles[0]);
    const config = parseEnemyConfig(shooterObject, enemyConfigData, colorsConfig);
    const projectileFactory = createProjectileFactory(
      resolveConfig(gameConfig.projectile, colorsConfig)
    );

    const player = createPlayer(new HealthSystem(gameConfig.health));
    const stage = createStage(player);

    player.x = 3;
    player.y = 0;

    const shooter = new ShooterEnemy(config, null, { projectileFactory });
    shooter.x = 0;
    shooter.y = 0;

    shooter.update(0.1, stage);
    shooter.update(0.1, stage);

    expect(stage.entities.length).toBe(1);
  });
});
