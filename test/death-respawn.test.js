import { describe, expect, test } from 'bun:test';

import { CollisionSolver } from '../src/engine/physics/collision-solver.js';
import { Enemy } from '../src/game/entities/enemy.js';
import { Tile } from '../src/game/entities/tile.js';
import { StageScene } from '../src/game/scenes/scenes.js';
import { DamageSystem } from '../src/game/systems/damage-system.js';
import { HealthSystem } from '../src/game/systems/health-system.js';
import { Checkpoint, Stage } from '../src/game/stages/stage.js';

const NO_INPUT = {
  isPressed: () => false,
  isDown: () => false
};

function createHealthSystem({ life = 3, lives = 3 } = {}) {
  const healthSystem = new HealthSystem({
    'max-life': 3,
    'starting-lives': lives,
    'starting-continues': 1,
    'iframe-timer': 1
  });
  healthSystem.life = life;
  return healthSystem;
}

function createPlayer(healthSystem) {
  return {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    hitbox: { x: 0, y: 0, width: 1, height: 1 },
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    onGround: false,
    isClimbing: false,
    isAlive: true,
    audioEngine: null,
    stage: null,
    healthSystem,
    update(dt) {
      healthSystem.update(dt);
    },
    takeDamage(amount) {
      const applied = healthSystem.takeDamage(amount);
      if (applied) {
        this.audioEngine?.playSFX(healthSystem.isDead ? 'death' : 'hit');
      }
      return applied;
    }
  };
}

function createStage({ life = 3, lives = 3 } = {}) {
  const healthSystem = createHealthSystem({ life, lives });
  const player = createPlayer(healthSystem);
  const noteCollection = {
    resets: 0,
    reset() {
      this.resets += 1;
    }
  };
  const damageSystem = new DamageSystem({
    'hazard-damage': 1,
    'shield-damage-multiplier': 0.1,
    'enemy-shape-damage': { '3': 1 }
  });
  const stage = new Stage({ name: 'death-fixture' }, {
    player,
    physicsEngine: { applyGravity() {}, applyFriction() {}, integratePosition() {} },
    collisionSolver: new CollisionSolver(),
    collectibleFactory: () => null,
    noteCollection,
    projectileFactory: () => null,
    damageSystem
  });

  // Keep the respawn point on the hazard tile so repeated frames stay in contact.
  stage.spawnPoint = { x: 0, y: 1 };

  return { stage, player, healthSystem, noteCollection };
}

function createEnemy(x, y, damageOutput) {
  const enemy = new Enemy({
    shape: 3,
    size: 1,
    'color-index': 3,
    'color-palette': ['#000000', '#404040', '#808080', '#BFBFBF'],
    'is-boss': false,
    'drop-table': [],
    'damage-output': damageOutput
  }, null);
  enemy.x = x;
  enemy.y = y;
  return enemy;
}

function createHazard(x, y, damage) {
  return new Tile(x, y, 1, 1, {
    type: 'spike',
    solid: false,
    deadly: true,
    'damage-value': damage,
    liquid: false,
    climbable: false,
    friction: 0.75,
    rendered: false
  });
}

function createScene(stage) {
  const gameOverScreen = {
    updateCalls: 0,
    update() {
      this.updateCalls += 1;
    },
    render() {}
  };
  const noopScreen = { update() {}, render() {} };
  const scene = new StageScene(
    stage,
    { render() {} },
    noopScreen,
    gameOverScreen,
    noopScreen,
    { handleInput() {}, render() {}, inventory: { isOpen: false } },
    null,
    null
  );

  return { scene, gameOverScreen };
}

describe('death by damage', () => {
  test('enemy damage at zero life spends one life and respawns the player', () => {
    const { stage, player, healthSystem } = createStage({ life: 3, lives: 3 });
    stage.addEntity(createEnemy(0, 0, 3));

    stage.update(1 / 60, null);

    expect(healthSystem.life).toBe(healthSystem.maxLife);
    expect(healthSystem.lives).toBe(2);
    expect(healthSystem.isDead).toBe(false);
    expect(player.x).toBe(0);
    expect(player.y).toBe(0);
  });

  test('hazard damage at zero life spends one life and restores life', () => {
    const { stage, healthSystem } = createStage({ life: 2, lives: 3 });
    stage.addEntity(createHazard(0, 0, 2));

    stage.update(1 / 60, null);

    expect(healthSystem.life).toBe(healthSystem.maxLife);
    expect(healthSystem.lives).toBe(2);
    expect(healthSystem.isDead).toBe(false);
  });

  test('a damage death returns the player to the active checkpoint', () => {
    const { stage, player, healthSystem, noteCollection } = createStage({ life: 2, lives: 3 });
    const first = new Checkpoint(10, 0, 1, 1, 1, {});
    const second = new Checkpoint(20, 0, 1, 1, 2, {});
    stage.addEntity(first);
    stage.addEntity(second);
    stage.activateCheckpoint(2);
    stage.addEntity(createHazard(0, 0, 2));

    stage.update(1 / 60, null);

    expect(player.x).toBe(second.x);
    expect(player.y).toBe(second.y - 1);
    expect(healthSystem.lives).toBe(2);
    expect(noteCollection.resets).toBe(1);
  });

  test('one lethal hit spends exactly one life across frames', () => {
    const { stage, healthSystem } = createStage({ life: 1, lives: 3 });
    stage.addEntity(createHazard(0, 0, 1));

    stage.update(1 / 60, null);
    expect(healthSystem.lives).toBe(2);

    stage.update(1 / 60, null);
    expect(healthSystem.lives).toBe(2);
  });

  test('the last life reaches the existing game-over state', () => {
    const { stage, healthSystem } = createStage({ life: 1, lives: 1 });
    stage.addEntity(createHazard(0, 0, 1));
    const { scene, gameOverScreen } = createScene(stage);

    stage.update(1 / 60, null);
    expect(healthSystem.lives).toBe(0);
    expect(healthSystem.isLivesExhausted).toBe(true);

    scene.update(1 / 60, NO_INPUT);

    expect(scene.isGameOver).toBe(true);
    expect(gameOverScreen.updateCalls).toBe(1);
  });

  test('invincibility blocks the lethal hazard hit', () => {
    const { stage, healthSystem } = createStage({ life: 1, lives: 3 });
    healthSystem.invincibilityTimer = 10;
    stage.addEntity(createHazard(0, 0, 1));

    stage.update(1 / 60, null);

    expect(healthSystem.life).toBe(1);
    expect(healthSystem.lives).toBe(3);
  });

  test('the fire shield blocks the lethal hazard hit', () => {
    const { stage, healthSystem } = createStage({ life: 1, lives: 3 });
    healthSystem.applyFireShield(10);
    stage.addEntity(createHazard(0, 0, 1));

    stage.update(1 / 60, null);

    expect(healthSystem.life).toBe(1);
    expect(healthSystem.lives).toBe(3);
  });
});
