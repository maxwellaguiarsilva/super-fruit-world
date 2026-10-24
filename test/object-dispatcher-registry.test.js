import { describe, expect, test } from 'bun:test';
import { ObjectDispatcher } from '../src/app/content/object-dispatcher.js';
import { createEnemyFactory } from '../src/app/factories/enemy-factory.js';
import { Tile } from '../src/game/entities/tile.js';
import { Collectible } from '../src/game/entities/collectible.js';
import { PatrolEnemy } from '../src/game/entities/enemy-types.js';
import { InnerTeleporter, MapTeleporter, SpecialTeleporter, KeyDoor, TeleporterMarker } from '../src/game/stages/teleporters.js';
import { Checkpoint } from '../src/game/stages/stage.js';
import { createCollectibleFactory, createPlayer, createStage } from './support/stage-fixture.js';

const COLORS = {
  colors: {
    black: { dark: '#000000', light: '#404040' },
    red: { dark: '#800000', light: '#BF4040' },
    yellow: { dark: '#808000', light: '#BFBF40' },
    white: { dark: '#808080', light: '#FFFFFF' }
  },
  'color-order': ['black', 'red', 'yellow', 'white']
};

const TILE_DATA = {
  platform: {
    type: 'platform',
    visual: { 'fill-color': 'white', 'border-color': 'white', border: 'medium' },
    collision: { solid: true },
    physics: { friction: 0.75 }
  },
  decorative: {
    type: 'decorative',
    visual: { 'fill-color': 'black' },
    collision: { solid: false },
    physics: {}
  }
};

const STAGE_DATA = {
  name: 'dispatcher-fixture',
  sections: [
    { name: 'alpha', 'parent-section': 'root', position: { x: 10, y: -5 } }
  ]
};

function fakeDataDriven(collectibles) {
  const data = { all: new Map() };

  for (const [type, config] of Object.entries(collectibles)) {
    data.all.set(`data/collectibles/${type}.json`, config);
    data[`collectibles.${type}`] = config;
  }

  return data;
}

function createDispatcher(options = {}) {
  const collectibles = options.collectibles ?? {
    coin: {
      type: 'coin',
      visual: { size: 0.5, 'fill-color': 'yellow' },
      effect: { action: 'add-coins', value: 1 }
    },
    checkpoint: {
      type: 'checkpoint',
      visual: { 'fill-color': 'white' },
      effect: { action: 'set-respawn' }
    }
  };

  return new ObjectDispatcher({
    dataDriven: fakeDataDriven(collectibles),
    gameConfig: options.gameConfig ?? { 'tile-types': ['platform', 'decorative'] },
    tileDataMap: options.tileDataMap ?? TILE_DATA,
    enemyConfigData: options.enemyConfigData ?? {
      size: 1,
      'boss-size': 3,
      'shape-map': { triangle: 3 }
    },
    colorsConfig: COLORS,
    bordersConfig: { borders: { thin: { width: 0.1 }, medium: { width: 0.2 } } },
    enemyFactory: createEnemyFactory({ projectileFactory: () => ({}) }),
    collectibleFactory: createCollectibleFactory(),
    player: options.player ?? createPlayer()
  });
}

function dispatch(stage, objects, dispatcher = createDispatcher({ player: stage.player })) {
  dispatcher.dispatchSection({ name: 'alpha', position: { x: 0, y: 0 }, objects }, stage);
}

describe('object dispatcher registry', () => {
  test('selects an entry for every existing stage object kind', () => {
    const { stage } = createStage({ stageData: STAGE_DATA });
    const dispatcher = createDispatcher({ player: stage.player });

    dispatch(stage, [
      { type: 'platform', position: { x: 1, y: 2 }, size: { width: 4, height: 1 } },
      { type: 'triangle-patrol', color: 'red', position: { x: 3, y: 4 } },
      { type: 'player-spawn', position: { x: 5, y: 6 } },
      { type: 'checkpoint', position: { x: 7, y: 8 } },
      { type: 'teleporter-marker', name: 'm1', position: { x: 9, y: 10 } },
      { type: 'inner-teleporter', name: 'tp', position: { x: 11, y: 12 }, 'target-marker': 'm1' },
      { type: 'coin', position: { x: 13, y: 14 } }
    ], dispatcher);

    expect(stage.tilesList.length).toBe(1);
    expect(stage.tilesList[0]).toBeInstanceOf(Tile);
    expect(stage.tilesList[0].x).toBe(11);
    expect(stage.tilesList[0].y).toBe(-3);

    expect(stage.enemiesList.length).toBe(1);
    expect(stage.enemiesList[0]).toBeInstanceOf(PatrolEnemy);
    expect(stage.enemiesList[0].x).toBe(13);

    expect(stage.spawnPoint).toEqual({ x: 15, y: 1 });
    expect(stage.player.x).toBe(15);
    expect(stage.player.y).toBe(0);

    expect(stage.checkpointsList.length).toBe(1);
    expect(stage.checkpointsList[0]).toBeInstanceOf(Checkpoint);
    expect(stage.checkpointsList[0].index).toBe(1);

    expect(stage.entitiesByType('teleporter-marker')[0]).toBeInstanceOf(TeleporterMarker);
    expect(stage.teleporters.length).toBe(1);
    expect(stage.teleporters[0]).toBeInstanceOf(InnerTeleporter);

    expect(stage.collectiblesList.length).toBe(1);
    expect(stage.collectiblesList[0]).toBeInstanceOf(Collectible);
    expect(stage.collectiblesList[0].type).toBe('coin');
  });

  test('selects the remaining teleporter entries from the same table', () => {
    const { stage } = createStage({ stageData: STAGE_DATA });

    dispatch(stage, [
      { type: 'special-teleporter', name: 'special', position: { x: 0, y: 0 }, 'target-stage': 'next' },
      { type: 'map-teleporter', name: 'map', position: { x: 1, y: 0 }, 'target-marker': 'node' },
      { type: 'key-door', name: 'door', position: { x: 2, y: 0 }, 'required-key': 'silver' }
    ]);

    const [special, map, door] = stage.teleporters;

    expect(special).toBeInstanceOf(SpecialTeleporter);
    expect(special.targetScene).toBe('next');
    expect(map).toBeInstanceOf(MapTeleporter);
    expect(door).toBeInstanceOf(KeyDoor);
    expect(door.requiredKey).toBe('silver');
  });

  test('gives a literal kind precedence over a collectible data file with the same name', () => {
    const { stage } = createStage({ stageData: STAGE_DATA });

    dispatch(stage, [{ type: 'checkpoint', position: { x: 0, y: 0 } }]);

    expect(stage.checkpointsList.length).toBe(1);
    expect(stage.checkpointsList[0]).toBeInstanceOf(Checkpoint);
    expect(stage.collectiblesList.length).toBe(0);
  });

  test('reports the unknown stage object type with the registered types', () => {
    const { stage } = createStage({ stageData: STAGE_DATA });

    expect(() => dispatch(stage, [{ type: 'mystery', position: { x: 0, y: 0 } }]))
      .toThrow('Unknown stage object type "mystery"');
    expect(() => dispatch(stage, [{ type: 'mystery', position: { x: 0, y: 0 } }]))
      .toThrow('platform, decorative');
  });

  test('accepts a new tile type declared in configuration without a dispatcher edit', () => {
    const tileDataMap = {
      ...TILE_DATA,
      swamp: { type: 'swamp', collision: { solid: false }, physics: {} }
    };
    const dispatcher = createDispatcher({
      gameConfig: { 'tile-types': ['platform', 'decorative', 'swamp'] },
      tileDataMap
    });
    const { stage } = createStage({ stageData: STAGE_DATA });

    dispatch(stage, [{ type: 'swamp', position: { x: 0, y: 0 } }], dispatcher);

    expect(stage.tilesList.length).toBe(1);
    expect(stage.tilesList[0].tileType).toBe('swamp');
  });

  test('accepts a new collectible data file without a dispatcher edit', () => {
    const dispatcher = createDispatcher({
      collectibles: {
        gem: {
          type: 'gem',
          visual: { size: 0.5, 'fill-color': 'white' },
          effect: { action: 'add-score', value: 50 }
        }
      }
    });
    const { stage } = createStage({ stageData: STAGE_DATA });

    dispatch(stage, [{ type: 'gem', position: { x: 0, y: 0 } }], dispatcher);

    expect(stage.collectiblesList.length).toBe(1);
    expect(stage.collectiblesList[0].type).toBe('gem');
  });
});
