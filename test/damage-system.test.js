import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { DamageSystem } from '../src/game/systems/damage-system.js';

const BASE_CONFIG = {
  'hazard-damage': 1.0,
  'shield-damage-multiplier': 0.1,
  'enemy-shape-damage': {
    '3': 1.0,
    '4': 1.5,
    '5': 2.0,
    '6': 2.5,
    '7': 3.0
  }
};

function realGameConfig() {
  return JSON.parse(readFileSync(new URL('../data/game-config.json', import.meta.url), 'utf8'));
}

function strictProxy(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  return new Proxy(value, {
    get(target, prop) {
      if (typeof prop === 'symbol') {
        return Reflect.get(target, prop, target);
      }
      if (!Object.hasOwn(target, prop)) {
        throw new Error(`Key not found: ${String(prop)}`);
      }
      return strictProxy(target[prop]);
    }
  });
}

function playerWith({ shield = false, applied = true } = {}) {
  const received = [];
  return {
    received,
    ability: (name) => (name === 'shoot' ? { isShielding: shield } : null),
    takeDamage(amount) {
      received.push(amount);
      return applied;
    }
  };
}

describe('DamageSystem enemy damage', () => {
  test('derives damage from the enemy shape using the configured table', () => {
    const damage = new DamageSystem(BASE_CONFIG);

    expect(damage.enemyDamageToPlayer({ shape: 3 })).toBe(1.0);
    expect(damage.enemyDamageToPlayer({ shape: 4 })).toBe(1.5);
    expect(damage.enemyDamageToPlayer({ shape: 5 })).toBe(2.0);
    expect(damage.enemyDamageToPlayer({ shape: 9 })).toBe(1.0);
  });

  test('prefers an explicit enemy damage output over the shape table', () => {
    const damage = new DamageSystem(BASE_CONFIG);

    expect(damage.enemyDamageToPlayer({ shape: 5, damageOutput: 4 })).toBe(4);
    expect(damage.enemyDamageToPlayer({ shape: 5, damageOutput: null })).toBe(2.0);
  });

  test('applies enemy damage to the player exactly once', () => {
    const player = playerWith();
    const damage = new DamageSystem(BASE_CONFIG);

    const applied = damage.applyEnemyDamage(player, { shape: 3 });

    expect(applied).toBe(true);
    expect(player.received).toEqual([1.0]);
  });

  test('reduces enemy damage while the shoot shield is active', () => {
    const player = playerWith({ shield: true });
    const damage = new DamageSystem(BASE_CONFIG);

    damage.applyEnemyDamage(player, { shape: 5 });

    expect(player.received).toEqual([0.2]);
  });

  test('reports whether the player accepted the damage', () => {
    const player = playerWith({ applied: false });
    const damage = new DamageSystem(BASE_CONFIG);

    expect(damage.applyEnemyDamage(player, { shape: 3 })).toBe(false);
    expect(player.received).toEqual([1.0]);
  });
});

describe('DamageSystem hazard damage', () => {
  test('uses the hazard value when one is declared', () => {
    const damage = new DamageSystem(BASE_CONFIG);

    expect(damage.hazardDamage(2.5)).toBe(2.5);
  });

  test('falls back to the configured hazard damage', () => {
    const damage = new DamageSystem({ ...BASE_CONFIG, 'hazard-damage': 3 });

    expect(damage.hazardDamage(undefined)).toBe(3);
    expect(damage.hazardDamage(null)).toBe(3);
  });

  test('applies hazard damage through the player damage surface', () => {
    const player = playerWith();
    const damage = new DamageSystem(BASE_CONFIG);

    damage.applyHazardDamage(player, 1.5);

    expect(player.received).toEqual([1.5]);
  });

  test('detects a fatal hit from the current life', () => {
    const damage = new DamageSystem(BASE_CONFIG);

    expect(damage.isFatalHit(2, 2)).toBe(true);
    expect(damage.isFatalHit(2, 5)).toBe(false);
  });
});

describe('DamageSystem against the real game configuration', () => {
  test('declares every key the system reads under damage', () => {
    const { damage } = realGameConfig();

    expect(damage['hazard-damage']).toBe(1.0);
    expect(damage['shield-damage-multiplier']).toBe(0.1);
    expect(Object.keys(damage['enemy-shape-damage'])).toEqual(['3', '4', '5', '6', '7']);
  });

  test('resolves every configuration access through a strict proxy', () => {
    const damage = new DamageSystem(strictProxy(realGameConfig().damage));

    expect(damage.hazardDamage(undefined)).toBe(1.0);
    expect(damage.hazardDamage(null)).toBe(1.0);
    for (const shape of [3, 4, 5, 6, 7]) {
      expect(damage.enemyDamageToPlayer({ shape })).toBeGreaterThan(0);
    }

    const player = playerWith({ shield: true });
    damage.applyEnemyDamage(player, { shape: 3 });
    expect(player.received).toEqual([0.1]);
  });
});
