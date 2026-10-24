import { describe, expect, test } from 'bun:test';
import { createAbilities, ABILITY_KIND_ENTRIES } from '../src/app/factories/ability-factory.js';
import { createEnemyFactory, ENEMY_KIND_ENTRIES } from '../src/app/factories/enemy-factory.js';
import { DashAbility } from '../src/game/abilities/dash-ability.js';
import { CrouchAbility } from '../src/game/abilities/crouch-ability.js';
import { SlideAttackAbility } from '../src/game/abilities/slide-attack-ability.js';
import { ShootAbility } from '../src/game/abilities/shoot-ability.js';
import { FlightAbility } from '../src/game/abilities/flight-ability.js';
import { DoubleJumpAbility } from '../src/game/abilities/double-jump-ability.js';
import { AirSlideAbility } from '../src/game/abilities/air-slide-ability.js';
import { ScreenClearAbility } from '../src/game/abilities/screen-clear-ability.js';
import { InvincibilityAbility } from '../src/game/abilities/invincibility-ability.js';
import { PatrolEnemy, ShooterEnemy, FlyerEnemy, BossEnemy } from '../src/game/entities/enemy-types.js';
import { createProjectileFactory } from '../src/app/factories/projectile-factory.js';

const ABILITY_CONFIG = {
  abilities: {
    dash: { type: 'dash' },
    crouch: { type: 'crouch' },
    'slide-attack': { type: 'slide-attack' },
    shoot: { type: 'shoot' },
    flight: { type: 'flight' },
    'double-jump': { type: 'double-jump' },
    'air-slide': { type: 'air-slide' },
    'screen-clear': { type: 'screen-clear' },
    invincibility: { type: 'invincibility' }
  }
};

function enemyConfig(overrides = {}) {
  return {
    shape: 3,
    size: 1,
    behavior: 'patrol',
    'color-index': 1,
    'color-palette': ['#000000', '#BF4040'],
    'is-boss': false,
    'patrol-range': 3,
    'damage-output': null,
    'drop-table': [],
    'fire-rate': 2,
    'projectile-speed': 1,
    'detection-range': 4,
    'hover-amplitude': 0,
    'hover-frequency': 0,
    ...overrides
  };
}

describe('ability registry', () => {
  test('declares one entry per ability kind', () => {
    const kinds = ABILITY_KIND_ENTRIES.map(([kind]) => kind);

    expect(kinds).toEqual([
      'dash',
      'crouch',
      'slide-attack',
      'shoot',
      'flight',
      'double-jump',
      'air-slide',
      'screen-clear',
      'invincibility'
    ]);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  test('selects the class registered for each kind', () => {
    const projectileFactory = createProjectileFactory({ size: 0.25, 'max-travel': 20 });
    const abilities = createAbilities(ABILITY_CONFIG, { projectileFactory });
    const classes = abilities.map((ability) => ability.constructor);

    expect(classes).toEqual([
      DashAbility,
      CrouchAbility,
      SlideAttackAbility,
      ShootAbility,
      FlightAbility,
      DoubleJumpAbility,
      AirSlideAbility,
      ScreenClearAbility,
      InvincibilityAbility
    ]);
  });

  test('reports the ability kind when no entry exists', () => {
    const config = { abilities: { teleport: { type: 'teleport' } } };

    expect(() => createAbilities(config)).toThrow('Unknown ability kind "teleport"');
  });
});

describe('enemy registry', () => {
  const projectileFactory = () => ({});

  test('declares one entry per enemy kind', () => {
    const kinds = ENEMY_KIND_ENTRIES.map(([kind]) => kind);

    expect(kinds).toEqual(['patrol', 'shooter', 'flyer', 'boss']);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  test('selects the class registered for each behavior', () => {
    const createEnemy = createEnemyFactory({ projectileFactory });

    expect(createEnemy(enemyConfig(), null).constructor).toBe(PatrolEnemy);
    expect(createEnemy(enemyConfig({ behavior: 'shooter' }), null).constructor).toBe(ShooterEnemy);
    expect(createEnemy(enemyConfig({ behavior: 'flyer' }), null).constructor).toBe(FlyerEnemy);
  });

  test('selects the boss entry by the boss discriminator', () => {
    const createEnemy = createEnemyFactory({ projectileFactory });

    expect(createEnemy(enemyConfig({ behavior: 'shooter', 'is-boss': true }), null).constructor).toBe(BossEnemy);
  });

  test('reports the enemy kind when no entry exists', () => {
    const createEnemy = createEnemyFactory({ projectileFactory });

    expect(() => createEnemy(enemyConfig({ behavior: 'diver' }), null)).toThrow('Unknown enemy kind "diver"');
  });

  test('requires the projectile factory for a shooter', () => {
    const createEnemy = createEnemyFactory();

    expect(() => createEnemy(enemyConfig({ behavior: 'shooter' }), null)).toThrow('projectile factory');
  });
});
