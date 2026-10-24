import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

import { HealthSystem } from '../src/game/systems/health-system.js';

function readGameConfig() {
  return JSON.parse(readFileSync(new URL('../data/game-config.json', import.meta.url), 'utf8'));
}

function exhaustLives(healthSystem) {
  while (healthSystem.lives > 0) {
    healthSystem.respawn();
  }
}

describe('lives, continues and game over', () => {
  const gameConfig = readGameConfig();
  const healthConfig = gameConfig.health;

  test('the shipped configuration starts with the configured lives and continues', () => {
    const healthSystem = new HealthSystem(healthConfig);

    expect(healthSystem.lives).toBe(healthConfig['starting-lives']);
    expect(healthSystem.continues).toBe(healthConfig['starting-continues']);
    expect(healthSystem.isLivesExhausted).toBe(false);
    expect(healthSystem.canContinue).toBe(true);
    expect(healthSystem.isGameOver).toBe(false);
  });

  test('exhausting lives with a continue available shows the continue prompt, not the final game over', () => {
    const healthSystem = new HealthSystem(healthConfig);

    exhaustLives(healthSystem);

    expect(healthSystem.lives).toBe(0);
    expect(healthSystem.isLivesExhausted).toBe(true);
    expect(healthSystem.canContinue).toBe(true);
    expect(healthSystem.isGameOver).toBe(false);
  });

  test('using a continue spends one continue and restores the configured starting lives', () => {
    const healthSystem = new HealthSystem(healthConfig);
    exhaustLives(healthSystem);

    const used = healthSystem.useContinue();

    expect(used).toBe(true);
    expect(healthSystem.continues).toBe(healthConfig['starting-continues'] - 1);
    expect(healthSystem.lives).toBe(healthConfig['starting-lives']);
    expect(healthSystem.life).toBe(healthSystem.maxLife);
    expect(healthSystem.isLivesExhausted).toBe(false);
  });

  test('exhausting lives with no continues left is the final game over', () => {
    const healthSystem = new HealthSystem(healthConfig);

    healthSystem.useContinue();
    exhaustLives(healthSystem);

    expect(healthSystem.continues).toBe(0);
    expect(healthSystem.isLivesExhausted).toBe(true);
    expect(healthSystem.canContinue).toBe(false);
    expect(healthSystem.isGameOver).toBe(true);
  });

  test('a continue cannot be used after the continue count reaches zero', () => {
    const healthSystem = new HealthSystem(healthConfig);

    healthSystem.useContinue();
    exhaustLives(healthSystem);

    const used = healthSystem.useContinue();

    expect(used).toBe(false);
    expect(healthSystem.continues).toBe(0);
    expect(healthSystem.lives).toBe(0);
    expect(healthSystem.isGameOver).toBe(true);
  });

  test('respawn does not decrement lives below zero', () => {
    const healthSystem = new HealthSystem(healthConfig);

    exhaustLives(healthSystem);
    healthSystem.respawn();

    expect(healthSystem.lives).toBe(0);
  });

  test('a continue restores the starting lives from the provided configuration', () => {
    const customConfig = {
      ...healthConfig,
      'starting-lives': 3,
      'starting-continues': 2
    };
    const healthSystem = new HealthSystem(customConfig);

    exhaustLives(healthSystem);
    healthSystem.useContinue();

    expect(healthSystem.lives).toBe(3);
    expect(healthSystem.continues).toBe(1);
  });
});
