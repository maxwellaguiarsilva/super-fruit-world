import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';

import { collectItemUsage } from '../src/app/content/item-usage.js';
import { DataDriven } from '../src/engine/data/data-driven.js';
import { PhysicsEngine } from '../src/engine/physics/physics-engine.js';
import { Player } from '../src/game/entities/player.js';
import { HealthSystem } from '../src/game/systems/health-system.js';
import { Inventory } from '../src/game/systems/inventory.js';
import { ItemEffects } from '../src/game/systems/item-effects.js';

const GAME_CONFIG = readJson('data/game-config.json');
const NO_INPUT = { isPressed: () => false, isDown: () => false };

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8'));
}

function readCollectible(name) {
  return readJson(`data/collectibles/${name}.json`);
}

function shippedUsage() {
  const usage = {};
  for (const name of ['heart', 'moon', 'sun', 'earth', 'apple', 'ammo']) {
    const collectible = readCollectible(name);
    if (collectible.effect?.usage) {
      usage[name] = collectible.effect.usage;
    }
  }
  return usage;
}

function createHarness({ usage = shippedUsage() } = {}) {
  const sfx = [];
  const audioEngine = { playSFX: (name) => sfx.push(name) };
  const healthSystem = new HealthSystem(GAME_CONFIG.health);
  let player = null;
  const effects = new ItemEffects({ healthSystem, getPlayer: () => player });
  const inventory = new Inventory({ 'max-slots': 8 }, { audioEngine, usage, effects });

  player = new Player({
    playerConfig: {
      size: GAME_CONFIG.player.size,
      'starting-level': GAME_CONFIG.player['starting-level'],
      'starting-color': '#000000',
      'walk-speed': GAME_CONFIG.physics['walk-speed'],
      'walk-acceleration': GAME_CONFIG.physics['walk-acceleration'],
      'jump-velocity': GAME_CONFIG.physics['jump-velocity']
    },
    abilities: [],
    inventory,
    healthSystem,
    scoreSystem: { score: 0, coins: 0 },
    progressionSystem: { maxLevel: 7 },
    audioEngine,
    stage: null
  });

  return { healthSystem, inventory, effects, player, sfx };
}

function fakeEnemy(id, { isFlyer = false, isAlive = true } = {}) {
  return {
    id,
    isFlyer,
    isAlive,
    hits: [],
    takeDamage(amount) {
      this.hits.push(amount);
    }
  };
}

function strictDeep(value, filePath) {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  return new Proxy(value, {
    get(target, prop) {
      if (typeof prop === 'symbol') {
        return Reflect.get(target, prop, target);
      }
      if (!Object.hasOwn(target, prop)) {
        throw new Error(`Key not found: ${prop} in ${filePath}`);
      }
      return strictDeep(target[prop], filePath);
    }
  });
}

function strictDataDriven(files) {
  const all = new Map(files);
  const dataDriven = { all };

  for (const [path, config] of all) {
    dataDriven[DataDriven.keyForDataPath(path)] = strictDeep(config, path);
  }

  return dataDriven;
}

describe('item usage table', () => {
  test('builds the table from collectible data and skips items without usage', () => {
    const dataDriven = strictDataDriven(new Map([
      ['data/collectibles/heart.json', {
        effect: { usage: { action: 'restore-health', value: 'full' } }
      }],
      ['data/collectibles/apple.json', {
        effect: { action: 'add-to-inventory', 'auto-activate': false }
      }],
      ['data/collectibles/ammo.json', {
        effect: { action: 'add-ammo', value: 10 }
      }]
    ]));

    expect(collectItemUsage(dataDriven)).toEqual({
      heart: { action: 'restore-health', value: 'full' }
    });
  });

  test('builds the usage table from every shipped collectible file without throwing', () => {
    const files = new Map();
    for (const fileName of readdirSync(new URL('../data/collectibles/', import.meta.url))) {
      if (!fileName.endsWith('.json')) {
        continue;
      }
      files.set(`data/collectibles/${fileName}`, readJson(`data/collectibles/${fileName}`));
    }

    const dataDriven = strictDataDriven(files);
    let usage = null;

    expect(() => {
      usage = collectItemUsage(dataDriven);
    }).not.toThrow();

    expect(Object.keys(usage).sort()).toEqual(['earth', 'heart', 'moon', 'sun']);
    for (const entry of Object.values(usage)) {
      expect(typeof entry.action).toBe('string');
    }
  });

  test('the shipped collectibles declare the four implemented usage actions', () => {
    const usage = shippedUsage();

    expect(usage.heart.action).toBe('restore-health');
    expect(usage.moon.action).toBe('moon-gravity');
    expect(usage.sun.action).toBe('fire-shield');
    expect(usage.earth.action).toBe('earthquake');
  });
});

describe('inventory use consumption', () => {
  test('consumes exactly one unit, plays the item sound and applies the effect once', () => {
    const { inventory, healthSystem, sfx } = createHarness();
    healthSystem.life = 3;
    inventory.add('heart', 2);

    expect(inventory.use('heart')).toBe(true);

    expect(inventory.count('heart')).toBe(1);
    expect(healthSystem.life).toBe(healthSystem.maxLife);
    expect(sfx).toEqual(['inventory-use']);
  });

  test('returns false for a missing item and applies no effect', () => {
    const { inventory, healthSystem, effects, sfx } = createHarness();
    healthSystem.life = 3;

    expect(inventory.use('heart')).toBe(false);

    expect(healthSystem.life).toBe(3);
    expect(effects.isMoonGravityActive).toBe(false);
    expect(effects.isFireShieldActive).toBe(false);
    expect(sfx).toEqual([]);
  });

  test('a key is not consumed and plays no sound', () => {
    const { inventory, sfx } = createHarness();
    inventory.add('key:secret-grove-key', 1);

    expect(inventory.use('key:secret-grove-key')).toBe(false);

    expect(inventory.count('key:secret-grove-key')).toBe(1);
    expect(sfx).toEqual([]);
  });

  test('an item without a declared usage is not consumed and plays no sound', () => {
    const { inventory, sfx } = createHarness();
    inventory.add('apple', 1);

    expect(inventory.use('apple')).toBe(false);

    expect(inventory.count('apple')).toBe(1);
    expect(sfx).toEqual([]);
  });

  test('holding an item does not activate its effect without a use', () => {
    const { inventory, healthSystem, effects } = createHarness();
    healthSystem.life = 3;
    inventory.add('heart', 1);
    inventory.add('moon', 1);
    inventory.add('sun', 1);

    expect(healthSystem.life).toBe(3);
    expect(effects.isMoonGravityActive).toBe(false);
    expect(effects.isFireShieldActive).toBe(false);
  });
});

describe('restore-health usage action', () => {
  test('"full" restores the health system maximum', () => {
    const { inventory, healthSystem } = createHarness();
    healthSystem.life = 2;
    inventory.add('heart', 1);

    inventory.use('heart');

    expect(healthSystem.life).toBe(healthSystem.maxLife);
  });

  test('a numeric value restores exactly the configured amount', () => {
    const { inventory, healthSystem } = createHarness({
      usage: { heart: { action: 'restore-health', value: 4 } }
    });
    healthSystem.life = 2;
    inventory.add('heart', 1);

    inventory.use('heart');

    expect(healthSystem.life).toBe(6);
  });
});

describe('moon-gravity usage action', () => {
  test('scales gravity through the player state and expires after the configured duration', () => {
    const { inventory, effects, player, sfx } = createHarness();
    const usage = readCollectible('moon').effect.usage;
    const physics = new PhysicsEngine(GAME_CONFIG.physics);
    inventory.add('moon', 1);

    inventory.use('moon');

    expect(sfx).toEqual(['moon-use']);
    expect(effects.isMoonGravityActive).toBe(true);
    expect(effects.moonGravityRemaining).toBe(usage.duration);
    expect(player.gravityMultiplier).toBe(usage.multiplier);
    expect(effects.gravityMultiplier).toBe(usage.multiplier);

    const body = { velocity: { x: 0, y: 0 }, gravityMultiplier: player.gravityMultiplier };
    physics.applyGravity(body, 0.1);

    expect(body.velocity.y).toBeCloseTo(GAME_CONFIG.physics.gravity * usage.multiplier * 0.1);
    expect(physics.getAppliedForce(body).y).toBeCloseTo(GAME_CONFIG.physics.gravity * usage.multiplier);

    player.update(usage.duration, NO_INPUT);

    expect(effects.isMoonGravityActive).toBe(false);
    expect(effects.moonGravityRemaining).toBe(0);
    expect(player.gravityMultiplier).toBe(1);

    const restored = { velocity: { x: 0, y: 0 }, gravityMultiplier: player.gravityMultiplier };
    physics.applyGravity(restored, 0.1);

    expect(restored.velocity.y).toBeCloseTo(GAME_CONFIG.physics.gravity * 0.1);
  });

  test('physics applies normal gravity to entities without an effect state', () => {
    const physics = new PhysicsEngine(GAME_CONFIG.physics);
    const body = { velocity: { x: 0, y: 0 } };

    physics.applyGravity(body, 0.1);

    expect(body.velocity.y).toBeCloseTo(GAME_CONFIG.physics.gravity * 0.1);
  });
});

describe('fire-shield usage action', () => {
  test('blocks damage for the configured duration without defeating enemies', () => {
    const { inventory, healthSystem, effects, player } = createHarness();
    const usage = readCollectible('sun').effect.usage;
    const enemy = fakeEnemy('ground');
    player.stage = { enemiesList: [enemy] };
    inventory.add('sun', 1);

    inventory.use('sun');

    expect(effects.isFireShieldActive).toBe(true);
    expect(effects.fireShieldRemaining).toBe(usage.duration);
    expect(player.takeDamage(4)).toBe(false);
    expect(healthSystem.life).toBe(healthSystem.maxLife);
    expect(enemy.hits).toEqual([]);

    player.update(usage.duration, NO_INPUT);

    expect(effects.isFireShieldActive).toBe(false);
    expect(player.takeDamage(4)).toBe(true);
    expect(healthSystem.life).toBe(healthSystem.maxLife - 4);
  });
});

describe('earthquake usage action', () => {
  test('damages every living ground enemy once per use and ignores flyers', () => {
    const { inventory, player, sfx } = createHarness();
    const usage = readCollectible('earth').effect.usage;
    const first = fakeEnemy('first');
    const second = fakeEnemy('second');
    const flyer = fakeEnemy('flyer', { isFlyer: true });
    const dead = fakeEnemy('dead', { isAlive: false });
    player.stage = { enemiesList: [first, second, flyer, dead] };
    inventory.add('earth', 2);

    inventory.use('earth');

    expect(first.hits).toEqual([usage.damage]);
    expect(second.hits).toEqual([usage.damage]);
    expect(flyer.hits).toEqual([]);
    expect(dead.hits).toEqual([]);
    expect(inventory.count('earth')).toBe(1);

    inventory.use('earth');

    expect(first.hits).toEqual([usage.damage, usage.damage]);
    expect(second.hits).toEqual([usage.damage, usage.damage]);
    expect(sfx).toEqual(['earth-use', 'earth-use']);
  });
});
