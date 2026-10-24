import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { StageScene } from '../src/game/scenes/scenes.js';
import { HealthSystem } from '../src/game/systems/health-system.js';
import { Inventory } from '../src/game/systems/inventory.js';
import { ItemEffects } from '../src/game/systems/item-effects.js';
import { InventoryUI } from '../src/game/ui/ui-components.js';

const GAME_CONFIG = readJson('data/game-config.json');
const INVENTORY_CONFIG = readJson('data/ui/inventory.json');

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8'));
}

function input({ pressed = [], down = [] } = {}) {
  const pressedSet = new Set(pressed);
  const downSet = new Set(down);
  return {
    isPressed: (action) => pressedSet.has(action),
    isDown: (action) => downSet.has(action)
  };
}

function createScene({ usage = {}, items = [], life = null } = {}) {
  const healthSystem = new HealthSystem(GAME_CONFIG.health);
  if (life !== null) {
    healthSystem.life = life;
  }

  const sfx = [];
  let player = null;
  const effects = new ItemEffects({ healthSystem, getPlayer: () => player });
  const inventory = new Inventory(GAME_CONFIG.inventory, {
    audioEngine: { playSFX: (name) => sfx.push(name) },
    usage,
    effects
  });

  for (const [name, count] of items) {
    inventory.add(name, count);
  }

  const inventoryUI = new InventoryUI(INVENTORY_CONFIG, inventory, { text: (key) => key });
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
  const noopScreen = { update() {}, render() {} };
  const scene = new StageScene(stage, { render() {} }, noopScreen, noopScreen, noopScreen, inventoryUI, null, null);

  return { scene, stage, inventory, healthSystem, effects, sfx };
}

describe('inventory use path in the stage scene', () => {
  test('select opens the inventory and confirm uses the selected item', () => {
    const { scene, stage, inventory, healthSystem } = createScene({
      usage: { heart: { action: 'restore-health', value: 'full' } },
      items: [['heart', 1]],
      life: 4
    });

    scene.update(1 / 60, input({ pressed: ['select'] }));
    expect(inventory.isOpen).toBe(true);
    expect(stage.updateCalls).toBe(0);
    expect(healthSystem.life).toBe(4);

    scene.update(1 / 60, input({ pressed: ['confirm'] }));

    expect(inventory.count('heart')).toBe(0);
    expect(healthSystem.life).toBe(healthSystem.maxLife);
    expect(stage.updateCalls).toBe(0);
  });

  test('the select+shoot shortcut uses the default selection without opening the inventory', () => {
    const { scene, inventory, healthSystem, effects, stage } = createScene({
      usage: { sun: { action: 'fire-shield', duration: 30 } },
      items: [['sun', 1]]
    });
    inventory.defaultSelected = 'sun';

    scene.update(1 / 60, input({ pressed: ['select', 'shoot'] }));

    expect(inventory.isOpen).toBe(false);
    expect(inventory.count('sun')).toBe(0);
    expect(effects.isFireShieldActive).toBe(true);
    expect(healthSystem.takeDamage(5)).toBe(false);
    expect(stage.updateCalls).toBe(1);
  });

  test('opening the inventory does not use the selected item', () => {
    const { scene, inventory, healthSystem } = createScene({
      usage: { heart: { action: 'restore-health', value: 'full' } },
      items: [['heart', 1]],
      life: 4
    });

    scene.update(1 / 60, input({ pressed: ['select'] }));

    expect(inventory.isOpen).toBe(true);
    expect(inventory.count('heart')).toBe(1);
    expect(healthSystem.life).toBe(4);
  });

  test('confirm on a key slot keeps the key and plays no use sound', () => {
    const { scene, inventory, sfx } = createScene({
      items: [['key:secret-grove-key', 1]]
    });

    scene.update(1 / 60, input({ pressed: ['select'] }));
    scene.update(1 / 60, input({ pressed: ['confirm'] }));

    expect(inventory.count('key:secret-grove-key')).toBe(1);
    expect(sfx).not.toContain('inventory-use');
  });

  test('the select+shoot shortcut leaves an item without usage untouched', () => {
    const { scene, inventory, sfx } = createScene({
      items: [['apple', 1]]
    });
    inventory.defaultSelected = 'apple';

    scene.update(1 / 60, input({ pressed: ['select', 'shoot'] }));

    expect(inventory.count('apple')).toBe(1);
    expect(sfx).toEqual([]);
  });
});
