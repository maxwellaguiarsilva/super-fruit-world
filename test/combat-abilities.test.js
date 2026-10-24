import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

import { createAbilities } from '../src/app/factories/ability-factory.js';
import { Player } from '../src/game/entities/player.js';
import { Enemy } from '../src/game/entities/enemy.js';
import { PhysicsEngine } from '../src/engine/physics/physics-engine.js';
import { CollisionSolver } from '../src/engine/physics/collision-solver.js';
import { DamageSystem } from '../src/game/systems/damage-system.js';
import { HealthSystem } from '../src/game/systems/health-system.js';
import { createStage } from './support/stage-fixture.js';

const GAME_CONFIG = readJson('data/game-config.json');
const ABILITIES_CONFIG = readJson('data/player/abilities.json');
const LEVELS_CONFIG = readJson('data/player/levels.json');

const FRAME = 1 / 60;

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8'));
}

function abilityConfig(names) {
  const abilities = {};
  for (const name of names) {
    abilities[name] = ABILITIES_CONFIG.abilities[name];
  }
  return { abilities };
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

function createCombatPlayer({
  level,
  abilities = [],
  stage = null,
  healthSystem = new HealthSystem(GAME_CONFIG.health)
}) {
  const physics = GAME_CONFIG.physics;
  const sfx = [];
  const inventory = {
    items: {},
    count(type) { return this.items[type] ?? 0; },
    has(type) { return this.count(type) > 0; },
    remove(type, amount = 1) {
      this.items[type] = Math.max(0, this.count(type) - amount);
    }
  };

  const player = new Player({
    playerConfig: {
      size: GAME_CONFIG.player.size,
      'starting-level': level,
      'starting-color': '#000000',
      'walk-speed': physics['walk-speed'],
      'walk-acceleration': physics['walk-acceleration'],
      'jump-velocity': physics['jump-velocity']
    },
    abilities: createAbilities(abilityConfig(abilities), { projectileFactory: () => null }),
    inventory,
    healthSystem,
    scoreSystem: { score: 0, coins: 0 },
    progressionSystem: { maxLevel: 7 },
    audioEngine: { playSFX(name) { sfx.push(name); } },
    stage
  });

  return {
    player,
    sfx,
    inventory,
    healthSystem,
    damageSystem: new DamageSystem(GAME_CONFIG.damage)
  };
}

function createEnemy(colorIndex = 5) {
  return new Enemy({
    shape: 3,
    size: 1,
    'color-index': colorIndex,
    'color-palette': ['#000000', '#202020', '#404040', '#606060', '#808080', '#A0A0A0', '#C0C0C0', '#FFFFFF'],
    'damage-output': null,
    'is-boss': false,
    'drop-table': []
  }, null);
}

describe('combat ability data', () => {
  test('the level table advertises the combat abilities that have a real effect', () => {
    expect(LEVELS_CONFIG.levels.black.abilities).toContain('stomp');
    expect(LEVELS_CONFIG.levels.green.abilities).toContain('shoot');
    expect(LEVELS_CONFIG.levels.green.abilities).toContain('shield');
    expect(LEVELS_CONFIG.levels.magenta.abilities).toContain('screen-clear');
    expect(LEVELS_CONFIG.levels.white.abilities).toContain('invincibility');
  });

  test('the combat ability configurations declare their levels and timing fields', () => {
    expect(ABILITIES_CONFIG.abilities['screen-clear']['required-level']).toBe(6);
    expect(ABILITIES_CONFIG.abilities['screen-clear'].damage).toBe(4);
    expect(ABILITIES_CONFIG.abilities['screen-clear']['hold-time']).toBeGreaterThan(0);
    expect(ABILITIES_CONFIG.abilities['screen-clear']['flash-duration']).toBeGreaterThan(0);
    expect(ABILITIES_CONFIG.abilities['screen-clear'].cooldown).toBeGreaterThan(0);

    expect(ABILITIES_CONFIG.abilities.invincibility['required-level']).toBe(7);
    expect(ABILITIES_CONFIG.abilities.invincibility.duration).toBe(60);
    expect(ABILITIES_CONFIG.abilities.invincibility.uses).toBe(1);

    const reduction = ABILITIES_CONFIG.abilities.shoot['shield-damage-reduction'];
    expect(1 - reduction).toBeCloseTo(GAME_CONFIG.damage['shield-damage-multiplier'], 5);
  });
});

describe('shield ability', () => {
  test('holding shoot raises the shield and reduces enemy damage to the game-config multiplier', () => {
    const shielded = createCombatPlayer({ level: 2, abilities: ['shoot'] });
    const enemy = { shape: 5 };
    const baseDamage = shielded.damageSystem.enemyDamageToPlayer(enemy);

    shielded.player.onGround = true;
    shielded.player.update(FRAME, input({ down: ['shoot'] }));

    expect(shielded.player.ability('shoot').isShielding).toBe(true);
    expect(shielded.damageSystem.applyEnemyDamage(shielded.player, enemy)).toBe(true);
    expect(shielded.healthSystem.life).toBeCloseTo(
      GAME_CONFIG.health['max-life'] - baseDamage * GAME_CONFIG.damage['shield-damage-multiplier'],
      10
    );

    const unshielded = createCombatPlayer({ level: 2, abilities: ['shoot'] });
    expect(unshielded.player.ability('shoot').isShielding).toBe(false);
    expect(unshielded.damageSystem.applyEnemyDamage(unshielded.player, enemy)).toBe(true);
    expect(unshielded.healthSystem.life).toBeCloseTo(
      GAME_CONFIG.health['max-life'] - baseDamage,
      10
    );
  });

  test('the shield follows the shoot input and drops when the button is released', () => {
    const { player, healthSystem, damageSystem } = createCombatPlayer({
      level: 2,
      abilities: ['shoot']
    });
    const shoot = player.ability('shoot');

    player.onGround = true;
    player.update(FRAME, input({ down: ['shoot'] }));
    expect(shoot.isShielding).toBe(true);

    player.update(FRAME, input());
    expect(shoot.isShielding).toBe(false);

    damageSystem.applyEnemyDamage(player, { shape: 3 });
    expect(healthSystem.life).toBe(GAME_CONFIG.health['max-life'] - 1);
  });

  test('holding shoot below the required level does not raise the shield', () => {
    const { player, healthSystem, damageSystem } = createCombatPlayer({
      level: 1,
      abilities: ['shoot']
    });

    player.onGround = true;
    player.update(FRAME, input({ down: ['shoot'] }));

    expect(player.ability('shoot').isShielding).toBe(false);
    damageSystem.applyEnemyDamage(player, { shape: 3 });
    expect(healthSystem.life).toBe(GAME_CONFIG.health['max-life'] - 1);
  });
});

describe('stomp ability', () => {
  test('landing on an enemy deals one hit per contact and bounces the player', () => {
    const { player, sfx } = createCombatPlayer({ level: 0, abilities: [] });
    const { stage } = createStage({
      player,
      physicsEngine: new PhysicsEngine(GAME_CONFIG.physics),
      collisionSolver: new CollisionSolver()
    });
    const enemy = createEnemy(5);
    stage.addEntity(enemy);
    stage.recomputeBounds();

    player.x = 0;
    player.y = -0.95;
    player.velocity = { x: 0, y: 5 };

    stage.update(FRAME, input());

    expect(enemy.colorIndex).toBe(4);
    expect(player.velocity.y).toBeLessThan(0);
    expect(sfx).toContain('attack');

    // The player is still overlapping the enemy while the rebound resolves.
    for (let frame = 0; frame < 10; frame++) {
      stage.update(FRAME, input());
    }
    expect(enemy.colorIndex).toBe(4);

    // Leaving contact clears the latch, so the next landing is a new hit.
    player.x = 20;
    stage.update(FRAME, input());
    enemy.position = { x: 0, y: 0 };
    enemy.velocity = { x: 0, y: 0 };
    player.x = 0;
    player.y = -0.95;
    player.velocity = { x: 0, y: 5 };

    stage.update(FRAME, input());

    expect(enemy.colorIndex).toBe(3);
  });
});

describe('screen-clear ability', () => {
  test('holding Down plus Special damages every enemy once and flashes the screen', () => {
    const { player, sfx } = createCombatPlayer({ level: 6, abilities: ['screen-clear'] });
    const { stage } = createStage({ player });
    const first = createEnemy(5);
    const second = createEnemy(5);
    stage.addEntity(first);
    stage.addEntity(second);

    const screenClear = player.ability('screen-clear');
    const hold = input({ down: ['down', 'special'] });

    for (let frame = 0; frame < 120 && !screenClear.isFlashing; frame++) {
      stage.update(FRAME, hold);
    }

    expect(screenClear.isFlashing).toBe(true);
    expect(screenClear.flashAlpha).toBeGreaterThan(0);
    expect(screenClear.cooldownRemaining).toBeGreaterThan(0);
    expect(first.colorIndex).toBe(1);
    expect(second.colorIndex).toBe(1);
    expect(sfx).toContain('attack');
  });

  test('respects the flash duration and cannot trigger again during its cooldown', () => {
    const { player } = createCombatPlayer({ level: 6, abilities: ['screen-clear'] });
    const { stage } = createStage({ player });
    const enemy = createEnemy(5);
    stage.addEntity(enemy);

    const screenClear = player.ability('screen-clear');
    const hold = input({ down: ['down', 'special'] });

    for (let frame = 0; frame < 120 && !screenClear.isFlashing; frame++) {
      stage.update(FRAME, hold);
    }
    expect(enemy.colorIndex).toBe(1);

    stage.update(screenClear.flashDuration, input());
    expect(screenClear.isFlashing).toBe(false);

    for (let frame = 0; frame < 120; frame++) {
      stage.update(FRAME, hold);
    }
    expect(enemy.colorIndex).toBe(1);

    stage.update(screenClear.cooldownRemaining + 0.01, input());
    expect(screenClear.cooldownRemaining).toBe(0);

    for (let frame = 0; frame < 120 && !screenClear.isFlashing; frame++) {
      stage.update(FRAME, hold);
    }
    expect(screenClear.isFlashing).toBe(true);
    expect(enemy.colorIndex).toBe(0);
  });

  test('does nothing below the required level', () => {
    const { player } = createCombatPlayer({ level: 5, abilities: ['screen-clear'] });
    const { stage } = createStage({ player });
    const enemy = createEnemy(5);
    stage.addEntity(enemy);

    const screenClear = player.ability('screen-clear');
    const hold = input({ down: ['down', 'special'] });

    for (let frame = 0; frame < 120; frame++) {
      stage.update(FRAME, hold);
    }

    expect(screenClear.isFlashing).toBe(false);
    expect(enemy.colorIndex).toBe(5);
  });
});

describe('invincibility ability', () => {
  test('activating with Up plus Special blocks damage until the configured duration expires', () => {
    const { player, healthSystem, damageSystem } = createCombatPlayer({
      level: 7,
      abilities: ['invincibility']
    });
    const invincibility = player.ability('invincibility');
    const hold = input({ down: ['up', 'special'] });

    for (let frame = 0; frame < 120 && healthSystem.invincibilityTimer <= 0; frame++) {
      player.update(FRAME, hold);
    }

    expect(healthSystem.invincibilityTimer).toBeGreaterThan(0);
    expect(player.isInvincible).toBe(true);
    expect(damageSystem.applyEnemyDamage(player, { shape: 5 })).toBe(false);
    expect(healthSystem.life).toBe(GAME_CONFIG.health['max-life']);

    player.update(invincibility.duration, input());

    expect(healthSystem.invincibilityTimer).toBe(0);
    expect(player.isInvincible).toBe(false);
    expect(damageSystem.applyEnemyDamage(player, { shape: 3 })).toBe(true);
    expect(healthSystem.life).toBe(GAME_CONFIG.health['max-life'] - 1);
  });

  test('is limited to the configured uses and does not reactivate afterwards', () => {
    const { player, healthSystem } = createCombatPlayer({
      level: 7,
      abilities: ['invincibility']
    });
    const invincibility = player.ability('invincibility');
    const hold = input({ down: ['up', 'special'] });

    for (let frame = 0; frame < 120 && healthSystem.invincibilityTimer <= 0; frame++) {
      player.update(FRAME, hold);
    }
    expect(invincibility.usesRemaining).toBe(0);

    player.update(invincibility.duration, input());
    expect(healthSystem.invincibilityTimer).toBe(0);

    for (let frame = 0; frame < 120; frame++) {
      player.update(FRAME, hold);
    }
    expect(healthSystem.invincibilityTimer).toBe(0);
  });

  test('does nothing below the required level', () => {
    const { player, healthSystem } = createCombatPlayer({
      level: 6,
      abilities: ['invincibility']
    });
    const hold = input({ down: ['up', 'special'] });

    for (let frame = 0; frame < 120; frame++) {
      player.update(FRAME, hold);
    }

    expect(healthSystem.invincibilityTimer).toBe(0);
  });
});
