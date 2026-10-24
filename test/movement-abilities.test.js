import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

import { createAbilities } from '../src/app/factories/ability-factory.js';
import { Player } from '../src/game/entities/player.js';
import { Stage } from '../src/game/stages/stage.js';
import { Tile } from '../src/game/entities/tile.js';
import { PhysicsEngine } from '../src/engine/physics/physics-engine.js';
import { CollisionSolver } from '../src/engine/physics/collision-solver.js';

const GAME_CONFIG = readJson('data/game-config.json');
const ABILITIES_CONFIG = readJson('data/player/abilities.json');
const LEVELS_CONFIG = readJson('data/player/levels.json');

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8'));
}

function movementConfig(names) {
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

function createPlayer({ level, abilities = [], stage = null }) {
  const physics = GAME_CONFIG.physics;
  const sfx = [];

  const player = new Player({
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
    audioEngine: { playSFX(name) { sfx.push(name); } },
    stage
  });

  return { player, sfx };
}

function fakeEnemy() {
  return {
    isAlive: true,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    hitbox: { x: 0, y: 0, width: 1, height: 1 },
    hits: 0,
    lastDamage: null,
    takeDamage(amount) {
      this.hits++;
      this.lastDamage = amount;
    }
  };
}

function fakeStage(enemies) {
  return {
    overlappingEnemies() {
      return enemies.filter((enemy) => enemy.isAlive);
    }
  };
}

function solidTile(x, y, width, height) {
  return new Tile(x, y, width, height, {
    type: 'platform',
    solid: true,
    deadly: false,
    liquid: false,
    climbable: false,
    inverted: false,
    'damage-value': null,
    friction: null
  });
}

function createStageFor(player) {
  const stage = new Stage({ name: 'movement-fixture', sections: [] }, {
    player,
    physicsEngine: new PhysicsEngine(GAME_CONFIG.physics),
    collisionSolver: new CollisionSolver(),
    collectibleFactory: () => null,
    noteCollection: null,
    projectileFactory: () => null,
    damageSystem: { applyHazardDamage() {}, applyEnemyDamage() {} }
  });

  stage.addEntity(solidTile(0, 1, 20, 1));
  stage.recomputeBounds();
  return stage;
}

describe('movement ability data', () => {
  test('the level table and the ability configurations name the same movement abilities', () => {
    expect(LEVELS_CONFIG.levels.black.abilities).toContain('crouch');
    expect(LEVELS_CONFIG.levels.black.abilities).toContain('slide-attack');
    expect(LEVELS_CONFIG.levels.red.abilities).toContain('dash');
    expect(LEVELS_CONFIG.levels.yellow.abilities).toContain('flight');
    expect(LEVELS_CONFIG.levels.yellow.abilities).toContain('slow-fall');
    expect(LEVELS_CONFIG.levels.blue.abilities).toContain('double-jump');
    expect(LEVELS_CONFIG.levels.cyan.abilities).toContain('air-slide');
  });

  test('every movement ability is configured at its documented level', () => {
    const expected = {
      crouch: 0,
      'slide-attack': 0,
      dash: 1,
      flight: 3,
      'double-jump': 4,
      'air-slide': 5
    };

    for (const [name, level] of Object.entries(expected)) {
      expect(ABILITIES_CONFIG.abilities[name]).toBeDefined();
      expect(ABILITIES_CONFIG.abilities[name]['required-level']).toBe(level);
    }

    // Slow fall is part of the flight configuration at the same level.
    expect(ABILITIES_CONFIG.abilities.flight['slow-fall-speed']).toBeGreaterThan(0);
  });

  test('the ability factory builds a class for every movement configuration', () => {
    const abilities = createAbilities(movementConfig([
      'crouch',
      'slide-attack',
      'dash',
      'flight',
      'double-jump',
      'air-slide'
    ]));

    expect(abilities.map((ability) => ability.name)).toEqual([
      'crouch',
      'slide-attack',
      'dash',
      'flight',
      'double-jump',
      'air-slide'
    ]);
  });
});

describe('dash ability', () => {
  test('does nothing below the required level', () => {
    const { player } = createPlayer({ level: 0, abilities: ['dash'] });
    player.onGround = true;

    player.update(1 / 60, input({ down: ['dash'], pressed: ['dash'] }));

    expect(player.ability('dash').isActive).toBe(false);
    expect(player.velocity.x).toBe(0);
  });

  test('activates a timed burst at the configured speed multiplier', () => {
    const { player } = createPlayer({ level: 1, abilities: ['dash'] });
    const dash = player.ability('dash');
    const configured = ABILITIES_CONFIG.abilities.dash;

    player.onGround = true;
    const startX = player.x;

    player.update(1 / 60, input({ down: ['dash'], pressed: ['dash'] }));

    expect(dash.isActive).toBe(true);
    expect(player.velocity.x).toBeCloseTo(player.walkSpeed * configured['speed-multiplier']);
    expect(player.x).toBe(startX);
    expect(dash.duration).toBe(configured.duration);
    expect(dash.cooldown).toBe(configured.cooldown);
  });

  test('cannot activate again until the configured cooldown expires', () => {
    const { player } = createPlayer({ level: 1, abilities: ['dash'] });
    const dash = player.ability('dash');

    player.onGround = true;
    player.update(1 / 60, input({ down: ['dash'], pressed: ['dash'] }));

    player.update(dash.duration, input({ down: ['dash'] }));
    expect(dash.isActive).toBe(false);
    expect(dash.cooldownRemaining).toBeGreaterThan(0);

    player.update(1 / 60, input({ down: ['dash'], pressed: ['dash'] }));
    expect(dash.isActive).toBe(false);

    player.update(dash.cooldown, input({}));
    player.update(1 / 60, input({ down: ['dash'], pressed: ['dash'] }));
    expect(dash.isActive).toBe(true);
  });
});

describe('double jump ability', () => {
  test('allows exactly max-jumps jumps and resets on landing', () => {
    const { player, sfx } = createPlayer({ level: 4, abilities: ['double-jump'] });
    const doubleJump = player.ability('double-jump');
    const maxJumps = ABILITIES_CONFIG.abilities['double-jump']['max-jumps'];

    player.onGround = true;
    player.update(0.016, input({ pressed: ['jump'] }));
    expect(player.onGround).toBe(false);
    expect(doubleJump.jumpsRemaining).toBe(maxJumps - 1);

    player.update(0.016, input({ pressed: ['jump'] }));
    expect(doubleJump.jumpsRemaining).toBe(maxJumps - 2);
    expect(player.velocity.y).toBe(-GAME_CONFIG.physics['jump-velocity']);

    player.update(0.016, input({ pressed: ['jump'] }));
    expect(doubleJump.jumpsRemaining).toBe(0);
    expect(sfx.filter((name) => name === 'jump')).toHaveLength(maxJumps);

    player.onGround = true;
    player.update(0.016, input());
    expect(doubleJump.jumpsRemaining).toBe(maxJumps);
  });

  test('does not add an air jump below the required level', () => {
    const { player, sfx } = createPlayer({ level: 3, abilities: ['double-jump'] });
    player.onGround = false;

    player.update(0.016, input({ pressed: ['jump'] }));

    expect(player.velocity.y).toBe(0);
    expect(sfx).toHaveLength(0);
  });
});

describe('flight ability', () => {
  test('takes off after the ground dash charge and sustains upward movement', () => {
    const { player } = createPlayer({ level: 3, abilities: ['flight'] });
    const flight = player.ability('flight');
    const configured = ABILITIES_CONFIG.abilities.flight;

    player.onGround = true;
    player.update(configured['dash-charge-required'], input({ down: ['dash'] }));
    expect(flight.dashTimer).toBeGreaterThanOrEqual(configured['dash-charge-required']);

    // The jump press clears onGround inside Player.update; take-off must be
    // decided before that happens and still use the charge accumulated on ground.
    player.update(1 / 60, input({ down: ['dash', 'jump'], pressed: ['jump'] }));

    expect(player.onGround).toBe(false);
    expect(flight.isFlying).toBe(true);
    expect(player.velocity.y).toBe(-configured['flight-speed']);

    player.update(1 / 60, input({ down: ['dash'] }));
    expect(flight.isFlying).toBe(false);
  });

  test('does not take off below the required level', () => {
    const { player } = createPlayer({ level: 2, abilities: ['flight'] });
    const flight = player.ability('flight');

    player.onGround = true;
    player.update(ABILITIES_CONFIG.abilities.flight['dash-charge-required'], input({ down: ['dash'] }));
    player.update(1 / 60, input({ down: ['dash', 'jump'], pressed: ['jump'] }));

    expect(flight.isFlying).toBe(false);
    expect(player.velocity.y).toBe(-GAME_CONFIG.physics['jump-velocity']);
  });

  test('ends flight when the timer runs out', () => {
    const { player } = createPlayer({ level: 3, abilities: ['flight'] });
    const flight = player.ability('flight');
    const configured = ABILITIES_CONFIG.abilities.flight;

    player.onGround = true;
    player.update(configured['dash-charge-required'], input({ down: ['dash'] }));
    player.update(1 / 60, input({ down: ['dash', 'jump'], pressed: ['jump'] }));
    expect(flight.isFlying).toBe(true);

    player.update(configured['flight-duration'], input({ down: ['dash', 'jump'] }));

    expect(flight.isFlying).toBe(false);
  });

  test('slow fall caps downward velocity while jump is held', () => {
    const { player } = createPlayer({ level: 3, abilities: ['flight'] });
    const flight = player.ability('flight');
    const slowFallSpeed = ABILITIES_CONFIG.abilities.flight['slow-fall-speed'];

    player.onGround = false;
    player.velocity = { x: 0, y: 10 };

    player.update(0.016, input({ down: ['jump'] }));

    expect(flight.isSlowFalling).toBe(true);
    expect(player.velocity.y).toBe(slowFallSpeed);
  });

  test('slow fall does nothing below the required level or without the jump held', () => {
    const belowLevel = createPlayer({ level: 2, abilities: ['flight'] });
    belowLevel.player.onGround = false;
    belowLevel.player.velocity = { x: 0, y: 10 };
    belowLevel.player.update(0.016, input({ down: ['jump'] }));
    expect(belowLevel.player.velocity.y).toBe(10);
    expect(belowLevel.player.ability('flight').isSlowFalling).toBe(false);

    const released = createPlayer({ level: 3, abilities: ['flight'] });
    released.player.onGround = false;
    released.player.velocity = { x: 0, y: 10 };
    released.player.update(0.016, input());
    expect(released.player.velocity.y).toBe(10);
    expect(released.player.ability('flight').isSlowFalling).toBe(false);
  });
});

describe('air slide ability', () => {
  test('applies the midair distance once and then enters cooldown', () => {
    const { player } = createPlayer({ level: 5, abilities: ['air-slide'] });
    const slide = player.ability('air-slide');
    const configured = ABILITIES_CONFIG.abilities['air-slide'];
    const dt = 1 / 60;

    player.onGround = false;

    player.update(dt, input({ pressed: ['air-slide'] }));

    expect(slide.isSliding).toBe(true);
    expect(player.velocity.x).toBeCloseTo(configured['slide-speed'] * player.width);

    const slideSeconds = configured['midair-distance'] / configured['slide-speed'];
    const slideFrames = Math.ceil(slideSeconds / dt) + 2;
    let travelled = player.velocity.x * dt;

    for (let frame = 1; frame < slideFrames; frame++) {
      player.update(dt, input());
      travelled += player.velocity.x * dt;
    }

    expect(travelled).toBeCloseTo(configured['midair-distance'] * player.width, 1);
    expect(slide.isSliding).toBe(false);
    expect(slide.cooldownRemaining).toBeGreaterThan(0);

    player.velocity = { x: 0, y: 0 };
    player.update(dt, input({ pressed: ['air-slide'] }));
    expect(slide.isSliding).toBe(false);
    expect(player.velocity.x).toBe(0);
  });

  test('resets its cooldown on landing and can slide again in a later jump', () => {
    const { player } = createPlayer({ level: 5, abilities: ['air-slide'] });
    const slide = player.ability('air-slide');
    const configured = ABILITIES_CONFIG.abilities['air-slide'];

    player.onGround = false;
    player.update(1 / 60, input({ pressed: ['air-slide'] }));
    player.update(configured['midair-distance'] / configured['slide-speed'], input());
    expect(slide.cooldownRemaining).toBeGreaterThan(0);

    player.onGround = true;
    player.update(1 / 60, input());
    expect(slide.cooldownRemaining).toBe(0);

    player.onGround = false;
    player.update(1 / 60, input({ pressed: ['air-slide'] }));
    expect(slide.isSliding).toBe(true);
  });

  test('does not slide on the ground or below the required level', () => {
    const onGround = createPlayer({ level: 5, abilities: ['air-slide'] });
    onGround.player.onGround = true;
    onGround.player.update(1 / 60, input({ pressed: ['air-slide'] }));
    expect(onGround.player.ability('air-slide').isSliding).toBe(false);

    const belowLevel = createPlayer({ level: 4, abilities: ['air-slide'] });
    belowLevel.player.onGround = false;
    belowLevel.player.update(1 / 60, input({ pressed: ['air-slide'] }));
    expect(belowLevel.player.ability('air-slide').isSliding).toBe(false);
  });
});

describe('crouch ability', () => {
  test('lowers movement speed on the ground and restores it on release', () => {
    const { player } = createPlayer({ level: 0, abilities: ['crouch'] });
    const crouch = player.ability('crouch');

    player.onGround = true;
    player.update(0.016, input({ down: ['crouch', 'right'] }));

    expect(player.isCrouching).toBe(true);
    expect(player.velocity.x).toBeCloseTo(player.walkSpeed * crouch.speedMultiplier);

    player.update(0.016, input({ down: ['right'] }));

    expect(player.isCrouching).toBe(false);
    expect(player.velocity.x).toBeCloseTo(player.walkSpeed);
  });

  test('does not crouch in the air', () => {
    const { player } = createPlayer({ level: 0, abilities: ['crouch'] });
    player.onGround = false;

    player.update(0.016, input({ down: ['crouch'] }));

    expect(player.isCrouching).toBe(false);
  });
});

describe('slide attack ability', () => {
  test('damages a single overlapping enemy once per dash activation', () => {
    const first = fakeEnemy();
    const second = fakeEnemy();
    const { player, sfx } = createPlayer({
      level: 1,
      abilities: ['dash', 'slide-attack'],
      stage: fakeStage([first, second])
    });
    const dash = player.ability('dash');
    const slide = player.ability('slide-attack');
    const configured = ABILITIES_CONFIG.abilities['slide-attack'];

    player.onGround = true;
    player.update(1 / 60, input({ down: ['dash'], pressed: ['dash'] }));

    expect(slide.isAttacking).toBe(true);
    expect(first.hits).toBe(1);
    expect(first.lastDamage).toBe(configured.damage);
    expect(second.hits).toBe(0);
    expect(sfx).toContain('attack');

    player.update(1 / 60, input({ down: ['dash'] }));
    expect(first.hits).toBe(1);

    player.update(dash.duration, input({}));
    expect(slide.isAttacking).toBe(false);

    player.update(dash.cooldown + 0.01, input({}));
    player.update(1 / 60, input({ down: ['dash'], pressed: ['dash'] }));
    expect(first.hits).toBe(2);
  });

  test('does nothing without an active dash', () => {
    const enemy = fakeEnemy();
    const { player } = createPlayer({
      level: 0,
      abilities: ['slide-attack'],
      stage: fakeStage([enemy])
    });

    player.onGround = true;
    player.update(1 / 60, input({ down: ['dash'], pressed: ['dash'] }));

    expect(player.ability('slide-attack').isAttacking).toBe(false);
    expect(enemy.hits).toBe(0);
  });
});

describe('movement integration with the stage update order', () => {
  test('the dash route stops at a solid tile instead of tunnelling', () => {
    const { player } = createPlayer({ level: 1, abilities: ['dash'] });
    const stage = createStageFor(player);
    const wall = solidTile(2, 0, 1, 1);
    stage.addEntity(wall);
    stage.recomputeBounds();

    player.x = 0;
    player.y = 0;

    stage.update(1 / 60, input({ down: ['dash'], pressed: ['dash'] }));
    for (let frame = 0; frame < 60; frame++) {
      stage.update(1 / 60, input({ down: ['dash'] }));
    }

    expect(player.x + player.width).toBeLessThanOrEqual(wall.x + 0.0001);
  });

  test('flight takes off from the ground that the previous collision pass established', () => {
    const { player } = createPlayer({ level: 3, abilities: ['flight'] });
    const stage = createStageFor(player);
    const flight = player.ability('flight');

    player.x = 0;
    player.y = 0;

    // One frame lands the player, so the charge starts from the collision state.
    stage.update(1 / 60, input());
    expect(player.onGround).toBe(true);

    const charge = ABILITIES_CONFIG.abilities.flight['dash-charge-required'];
    const chargeFrames = Math.ceil(charge * 60) + 1;
    for (let frame = 0; frame < chargeFrames; frame++) {
      stage.update(1 / 60, input({ down: ['dash'] }));
    }

    stage.update(1 / 60, input({ down: ['dash', 'jump'], pressed: ['jump'] }));

    expect(flight.isFlying).toBe(true);
    expect(player.velocity.y).toBe(-ABILITIES_CONFIG.abilities.flight['flight-speed']);
  });
});
