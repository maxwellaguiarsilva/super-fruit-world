import { describe, expect, test } from 'bun:test';

import { Collectible } from '../src/game/entities/collectible.js';
import { KeyDoor } from '../src/game/stages/teleporters.js';
import { Inventory } from '../src/game/systems/inventory.js';
import { applyProgressToMapConfig } from '../src/game/systems/progression-system.js';
import { keyItemName } from '../src/game/utils/key-item-name.js';

const mapConfig = {
  sections: [
    {
      name: 'area',
      objects: [
        {
          type: 'stage-node',
          'stage-id': 'secret-grove',
          state: 'locked',
          'unlock-condition': { type: 'key-required', 'key-name': 'silver' }
        }
      ]
    }
  ]
};

function createInventory() {
  return new Inventory({ 'max-slots': 8 }, {
    audioEngine: null,
    usage: {},
    effects: null
  });
}

describe('key inventory naming', () => {
  test('prefixes a key name exactly once', () => {
    expect(keyItemName('silver')).toBe('key:silver');
  });

  test('collect, door and map unlock agree on the shared key name', () => {
    const inventory = createInventory();
    const collectible = new Collectible(0, 0, 0.5, 0.5, {
      type: 'key',
      effect: { action: 'add-to-inventory', 'key-name': 'silver' }
    });

    collectible.collect({ inventory, audioEngine: null });

    const itemName = keyItemName('silver');
    expect(inventory.has(itemName)).toBe(true);

    const door = new KeyDoor('door', 0, 0, '', null, 'silver', { inventory });
    expect(door.hasKey).toBe(true);

    const applied = applyProgressToMapConfig(mapConfig, { inventory: { items: inventory.slots } });
    expect(applied.sections[0].objects[0].state).toBe('available');
  });
});
