import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

import { StageScene } from '../src/game/scenes/scenes.js';
import { HealthSystem } from '../src/game/systems/health-system.js';

function readGameConfig() {
  return JSON.parse(readFileSync(new URL('../data/game-config.json', import.meta.url), 'utf8'));
}

const NO_INPUT = {
  isPressed: () => false,
  isDown: () => false
};

function createScene(healthSystem) {
  const stage = {
    isCompleted: false,
    player: {
      healthSystem,
      ability: () => null
    },
    updateCalls: 0,
    update() {
      this.updateCalls++;
    },
    activate() {},
    deactivate() {},
    render() {}
  };

  const gameOverScreen = {
    updateCalls: 0,
    render() {},
    update() {
      this.updateCalls++;
    }
  };

  const scene = new StageScene(
    stage,
    { render() {} },
    { update() {}, render() {} },
    gameOverScreen,
    { update() {}, render() {} },
    { handleInput() {}, render() {}, inventory: { isOpen: false } },
    null,
    null
  );

  return { scene, stage, gameOverScreen };
}

describe('stage scene game over state', () => {
  test('a player with lives remaining keeps playing the stage', () => {
    const healthSystem = new HealthSystem(readGameConfig().health);
    const { scene, stage, gameOverScreen } = createScene(healthSystem);

    scene.update(1 / 60, NO_INPUT);

    expect(scene.isGameOver).toBe(false);
    expect(stage.updateCalls).toBe(1);
    expect(gameOverScreen.updateCalls).toBe(0);
  });

  test('exhausted lives show the end screen even when a continue is available', () => {
    const healthSystem = new HealthSystem(readGameConfig().health);
    while (healthSystem.lives > 0) {
      healthSystem.respawn();
    }
    expect(healthSystem.canContinue).toBe(true);

    const { scene, stage, gameOverScreen } = createScene(healthSystem);

    scene.update(1 / 60, NO_INPUT);

    expect(scene.isGameOver).toBe(true);
    expect(stage.updateCalls).toBe(0);
    expect(gameOverScreen.updateCalls).toBe(1);
  });

  test('spending the continue restores play on the next stage scene', () => {
    const healthSystem = new HealthSystem(readGameConfig().health);
    while (healthSystem.lives > 0) {
      healthSystem.respawn();
    }

    const first = createScene(healthSystem);
    first.scene.update(1 / 60, NO_INPUT);
    expect(first.scene.isGameOver).toBe(true);

    healthSystem.useContinue();

    const second = createScene(healthSystem);
    second.scene.update(1 / 60, NO_INPUT);

    expect(second.scene.isGameOver).toBe(false);
    expect(second.stage.updateCalls).toBe(1);
  });

  test('the end screen is also shown when no continues remain', () => {
    const healthSystem = new HealthSystem(readGameConfig().health);
    healthSystem.useContinue();
    while (healthSystem.lives > 0) {
      healthSystem.respawn();
    }
    expect(healthSystem.isGameOver).toBe(true);

    const { scene, stage, gameOverScreen } = createScene(healthSystem);

    scene.update(1 / 60, NO_INPUT);

    expect(scene.isGameOver).toBe(true);
    expect(stage.updateCalls).toBe(0);
    expect(gameOverScreen.updateCalls).toBe(1);
  });
});
