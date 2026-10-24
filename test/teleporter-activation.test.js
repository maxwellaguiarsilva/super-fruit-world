import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { CollisionSolver } from '../src/engine/physics/collision-solver.js';
import { ObjectDispatcher } from '../src/app/content/object-dispatcher.js';
import { createCollectibleFactory } from '../src/app/factories/collectible-factory.js';
import { Stage } from '../src/game/stages/stage.js';
import { unlockedByCompletion } from '../src/game/systems/progression-system.js';
import {
  InnerTeleporter,
  KeyDoor,
  MapTeleporter,
  SpecialTeleporter,
  TeleporterMarker
} from '../src/game/stages/teleporters.js';

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8'));
}

function createInventory(keys = []) {
  const items = new Map(keys.map((key) => [key, 1]));

  return {
    items,
    has: (name) => items.has(name),
    count: (name) => items.get(name) ?? 0,
    remove(name) {
      items.delete(name);
    }
  };
}

function createPlayer(inventory = createInventory()) {
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
    audioEngine: null,
    stage: null,
    inventory,
    update() {},
    healthSystem: { respawn() {} }
  };
}

function createContext(overrides = {}) {
  const player = overrides.player ?? createPlayer();

  return {
    player,
    overlaps: overrides.overlaps ?? (() => true),
    markerFor: overrides.markerFor ?? (() => null),
    navigate: overrides.navigate ?? (() => true),
    inventory: overrides.inventory ?? player.inventory,
    report: overrides.report ?? (() => {})
  };
}

function createStage(navigation = null, inventory = createInventory()) {
  const player = createPlayer(inventory);

  const stage = new Stage({ name: 'teleporter-fixture' }, {
    player,
    physicsEngine: { applyGravity() {}, applyFriction() {}, integratePosition() {} },
    collisionSolver: new CollisionSolver(),
    collectibleFactory: createCollectibleFactory(),
    noteCollection: null,
    projectileFactory: () => null,
    damageSystem: { applyHazardDamage() {}, applyEnemyDamage() {} },
    navigation
  });

  return { stage, player };
}

function dispatch(stage, player, objects) {
  const dispatcher = new ObjectDispatcher({
    dataDriven: { all: new Map() },
    gameConfig: { 'tile-types': [] },
    tileDataMap: {},
    enemyConfigData: { 'shape-map': {} },
    colorsConfig: { colors: {}, 'color-order': [] },
    bordersConfig: { borders: {} },
    enemyFactory: () => { throw new Error('enemy factory not configured'); },
    collectibleFactory: createCollectibleFactory(),
    player
  });

  dispatcher.dispatchSection({
    name: 'teleporter-section',
    'parent-section': 'root',
    position: { x: 0, y: 0 },
    objects
  }, stage);

  stage.recomputeBounds();
}

function createInput(up) {
  return {
    isPressed: (action) => action === 'up' && up.pressed,
    isDown: () => false
  };
}

describe('teleporter activation contract', () => {
  test('inner teleporter moves the player to the marker resolved by name', () => {
    const player = createPlayer();
    const marker = new TeleporterMarker('surface-return', 10, -1);
    const teleporter = new InnerTeleporter('entry', 2, 3, 'surface-return');
    const context = createContext({
      player,
      markerFor: (name) => (name === 'surface-return' ? marker : null)
    });

    expect(teleporter.isActive).toBe(true);
    expect(teleporter.isLocked).toBe(false);
    expect(teleporter.canActivate(context)).toBe(true);
    expect(teleporter.activate(context)).toBe(true);
    expect(player.x).toBe(10);
    expect(player.y).toBe(-1);
  });

  test('inner teleporter is blocked when the player does not overlap it', () => {
    const player = createPlayer();
    const marker = new TeleporterMarker('surface-return', 10, -1);
    const teleporter = new InnerTeleporter('entry', 2, 3, 'surface-return');
    const context = createContext({
      player,
      overlaps: () => false,
      markerFor: () => marker
    });

    expect(teleporter.canActivate(context)).toBe(false);
    expect(teleporter.activate(context)).toBe(false);
    expect(player.x).toBe(0);
    expect(player.y).toBe(0);
  });

  test('a missing marker is reported once and leaves the teleporter inert', () => {
    const reports = [];
    const teleporter = new InnerTeleporter('entry', 2, 3, 'missing-marker');
    const context = createContext({
      markerFor: () => null,
      report: (message) => reports.push(message)
    });

    expect(() => teleporter.canActivate(context)).not.toThrow();
    expect(teleporter.canActivate(context)).toBe(false);
    expect(teleporter.activate(context)).toBe(false);

    expect(reports.length).toBe(1);
    expect(reports[0]).toContain('missing-marker');
  });

  test('map teleporter shares the same marker contract', () => {
    const player = createPlayer();
    const marker = new TeleporterMarker('continent-2-arrival', 20, 1);
    const teleporter = new MapTeleporter('path-green-to-azure', 10, 0, 'continent-2-arrival');
    const context = createContext({
      player,
      markerFor: (name) => (name === 'continent-2-arrival' ? marker : null)
    });

    expect(teleporter.isActive).toBe(true);
    expect(teleporter.activate(context)).toBe(true);
    expect(player.x).toBe(20);
    expect(player.y).toBe(1);
  });

  test('map teleporter is blocked when it declares no target marker', () => {
    const player = createPlayer();
    const teleporter = new MapTeleporter('unconfigured', 10, 0, '');
    const context = createContext({ player });

    expect(teleporter.isActive).toBe(false);
    expect(teleporter.isLocked).toBe(true);
    expect(teleporter.canActivate(context)).toBe(false);
    expect(teleporter.activate(context)).toBe(false);
    expect(player.x).toBe(0);
    expect(player.y).toBe(0);
  });

  test('special teleporter navigates to a declared scene', () => {
    const visited = [];
    const teleporter = new SpecialTeleporter('to-world-map', 13, -1, '', 'map');
    const context = createContext({
      navigate: (sceneName) => {
        visited.push(sceneName);
        return true;
      }
    });

    expect(teleporter.isActive).toBe(true);
    expect(teleporter.canActivate(context)).toBe(true);
    expect(teleporter.activate(context)).toBe(true);
    expect(visited).toEqual(['map']);
  });

  test('special teleporter falls back to its marker when no scene is declared', () => {
    const player = createPlayer();
    const marker = new TeleporterMarker('exit-marker', 4, -1);
    const teleporter = new SpecialTeleporter('fallback', 2, 3, 'exit-marker', null);
    const context = createContext({
      player,
      markerFor: (name) => (name === 'exit-marker' ? marker : null)
    });

    expect(teleporter.isActive).toBe(true);
    expect(teleporter.activate(context)).toBe(true);
    expect(player.x).toBe(4);
    expect(player.y).toBe(-1);
  });

  test('special teleporter without any target is locked and inert', () => {
    const teleporter = new SpecialTeleporter('unconfigured', 2, 3, '', null);
    const context = createContext({ navigate: () => true });
    const player = context.player;

    expect(teleporter.isActive).toBe(false);
    expect(teleporter.isLocked).toBe(true);
    expect(teleporter.canActivate(context)).toBe(false);
    expect(teleporter.activate(context)).toBe(false);
    expect(player.x).toBe(0);
    expect(player.y).toBe(0);
  });

  test('key door stays locked without the required key', () => {
    const inventory = createInventory();
    const teleporter = new KeyDoor('door', 2, 3, '', 'secret-grove', 'silver', { inventory });
    const context = createContext({ inventory, navigate: () => true });

    expect(teleporter.hasKey).toBe(false);
    expect(teleporter.isActive).toBe(false);
    expect(teleporter.isLocked).toBe(true);
    expect(teleporter.canActivate(context)).toBe(false);
    expect(teleporter.activate(context)).toBe(false);
    expect(inventory.has('key:silver')).toBe(false);
  });

  test('key door unlocks, keeps the key in the inventory and navigates', () => {
    const inventory = createInventory(['key:silver']);
    const visited = [];
    const teleporter = new KeyDoor('door', 2, 3, '', 'secret-grove', 'silver', { inventory });
    const context = createContext({
      inventory,
      navigate: (sceneName) => {
        visited.push(sceneName);
        return true;
      }
    });

    expect(teleporter.hasKey).toBe(true);
    expect(teleporter.isActive).toBe(true);
    expect(teleporter.canActivate(context)).toBe(true);
    expect(teleporter.activate(context)).toBe(true);

    expect(visited).toEqual(['secret-grove']);
    expect(inventory.has('key:silver')).toBe(true);
    expect(teleporter.isUnlocked).toBe(true);
    expect(teleporter.isActive).toBe(true);
  });

  test('a key-required map node stays available after the key door opens', () => {
    const inventory = createInventory(['key:silver']);
    const teleporter = new KeyDoor('door', 2, 3, '', 'secret-grove', 'silver', { inventory });
    const context = createContext({ inventory, navigate: () => true });
    const mapConfig = {
      sections: [
        {
          name: 'continent-1',
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

    expect(unlockedByCompletion(mapConfig, [], [...inventory.items.keys()])).toEqual(['secret-grove']);
    expect(teleporter.activate(context)).toBe(true);
    expect(unlockedByCompletion(mapConfig, [], [...inventory.items.keys()])).toEqual(['secret-grove']);
  });
});

describe('stage teleporter routing', () => {
  test('resolves marker targets by name through the stage marker lookup', () => {
    const { stage, player } = createStage();
    dispatch(stage, player, [
      { type: 'teleporter-marker', name: 'surface-return', position: { x: 12, y: -1 } },
      { type: 'teleporter-marker', name: 'underground-departure', position: { x: 0, y: -1 } }
    ]);

    const marker = stage.getTeleporterMarker('surface-return');

    expect(marker).toBeInstanceOf(TeleporterMarker);
    expect(marker.x).toBe(12);
    expect(marker.y).toBe(-1);
    expect(stage.getTeleporterMarker('missing-marker')).toBe(null);
  });

  test('an overlapping inner teleporter moves the player to the target marker', () => {
    const { stage, player } = createStage();
    dispatch(stage, player, [
      { type: 'teleporter-marker', name: 'surface-return', position: { x: 20, y: -1 } },
      { type: 'inner-teleporter', name: 'entry', position: { x: 10, y: -1 }, 'target-marker': 'surface-return' }
    ]);

    const up = { pressed: true };
    player.x = 10;
    player.y = -1;

    stage.update(1 / 60, createInput(up));

    expect(player.x).toBe(20);
    expect(player.y).toBe(-1);
  });

  test('a map teleporter declared in stage data is dispatched by the stage loop', () => {
    const { stage, player } = createStage();
    dispatch(stage, player, [
      { type: 'teleporter-marker', name: 'arrival', position: { x: 15, y: -1 } },
      { type: 'map-teleporter', name: 'pad', position: { x: 5, y: -1 }, 'target-marker': 'arrival' }
    ]);

    const up = { pressed: true };
    player.x = 5;
    player.y = -1;

    stage.update(1 / 60, createInput(up));

    expect(player.x).toBe(15);
    expect(player.y).toBe(-1);
  });

  test('a teleporter activates once per overlap', () => {
    const visited = [];
    const { stage, player } = createStage({
      navigate: (sceneName) => {
        visited.push(sceneName);
        return true;
      }
    });

    dispatch(stage, player, [
      { type: 'special-teleporter', name: 'exit', position: { x: 10, y: -1 }, 'target-stage': 'map' }
    ]);

    const up = { pressed: true };
    player.x = 10;
    player.y = -1;

    stage.update(1 / 60, createInput(up));
    stage.update(1 / 60, createInput(up));

    expect(visited).toEqual(['map']);

    up.pressed = false;
    stage.update(1 / 60, createInput(up));

    up.pressed = true;
    stage.update(1 / 60, createInput(up));
    expect(visited).toEqual(['map']);

    player.x = 0;
    stage.update(1 / 60, createInput(up));
    player.x = 10;
    stage.update(1 / 60, createInput(up));

    expect(visited).toEqual(['map', 'map']);
  });

  test('a missing teleporter target warns and does not move the player', () => {
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));

    try {
      const { stage, player } = createStage();
      dispatch(stage, player, [
        { type: 'inner-teleporter', name: 'broken', position: { x: 10, y: -1 }, 'target-marker': 'missing' }
      ]);

      const up = { pressed: true };
      player.x = 10;
      player.y = -1;

      expect(() => stage.update(1 / 60, createInput(up))).not.toThrow();
      expect(player.x).toBe(10);
      expect(player.y).toBe(-1);
      expect(warnings.some((message) => message.includes('missing'))).toBe(true);
    } finally {
      console.warn = originalWarn;
    }
  });
});

describe('teleporter data decision', () => {
  test('the world map no longer declares map teleporters or markers', () => {
    const mapData = readJson('data/map/fruit-world.json');
    const objects = (mapData.sections ?? []).flatMap((section) => section.objects ?? []);
    const types = objects.map((object) => object.type);

    expect(types).not.toContain('map-teleporter');
    expect(types).not.toContain('teleporter-marker');
  });

  test('the Strawberry Fields exit teleporter navigates to the world map', () => {
    const stageData = readJson('data/stages/strawberry-fields.json');
    const objects = (stageData.sections ?? []).flatMap((section) => section.objects ?? []);
    const exitTeleporter = objects.find((object) => object.type === 'special-teleporter');

    expect(exitTeleporter['target-stage']).toBe('map');
  });
});
