import { describe, expect, test } from 'bun:test';
import { requireDependencies } from '../src/engine/core/dependency-contract.js';
import { Player } from '../src/game/entities/player.js';
import { StageLoader } from '../src/app/content/stage-loader.js';
import { ObjectDispatcher } from '../src/app/content/object-dispatcher.js';
import { UiBuilder } from '../src/app/factories/ui-builder.js';

const PLAYER_KEYS = [
  'playerConfig',
  'abilities',
  'inventory',
  'healthSystem',
  'scoreSystem',
  'progressionSystem',
  'audioEngine',
  'stage'
];

function playerDependencies() {
  return {
    playerConfig: {
      size: 1,
      'starting-level': 0,
      'starting-color': '#000000',
      'walk-speed': 5,
      'walk-acceleration': 15,
      'jump-velocity': 10
    },
    abilities: [],
    inventory: { slots: [], add() {}, remove() {} },
    healthSystem: { invincibilityTimer: 0, isDead: false, takeDamage: () => false, heal() {}, update() {} },
    scoreSystem: { score: 0, coins: 0 },
    progressionSystem: { maxLevel: 10 },
    audioEngine: { playSFX() {} },
    stage: null
  };
}

function dispatcherDependencies() {
  return {
    dataDriven: { all: new Map() },
    gameConfig: { 'tile-types': [] },
    tileDataMap: {},
    enemyConfigData: { 'shape-map': {} },
    colorsConfig: { colors: {}, 'color-order': [] },
    bordersConfig: { borders: {} },
    enemyFactory: () => ({}),
    collectibleFactory: () => ({}),
    player: playerDependencies()
  };
}

function stageLoaderDependencies() {
  return {
    dataDriven: {},
    textResolver: { text: (key) => key, has: () => false },
    dialogueConfig: { dialogue: {} },
    dispatcher: { dispatchSection() {} },
    player: playerDependencies(),
    noteRangeConfig: { lowest: 1, count: 8 },
    physicsEngine: {},
    collisionSolver: {},
    collectibleFactory: () => ({}),
    projectileFactory: () => ({}),
    damageSystem: {},
    hud: {},
    camera: {},
    audioEngine: {},
    sceneRouter: {},
    uiBuilder: {},
    navigation: { navigate: () => true }
  };
}

function uiBuilderDependencies() {
  return {
    textResolver: { text: (key) => key, has: () => false },
    menuConfig: {},
    hudConfig: {},
    inventoryConfig: {},
    colorsConfig: { colors: {}, 'color-order': [] },
    bordersConfig: { borders: {} },
    inventory: {},
    player: playerDependencies(),
    scoreSystem: { score: 0 },
    progressionSystem: { getLevelForCollectible: () => -1, getAbilitiesForLevel: () => [] },
    healthSystem: { continues: 1, lives: 1 }
  };
}

const CONTRACTS = [
  ['Player', Player, PLAYER_KEYS, playerDependencies],
  ['StageLoader', StageLoader, Object.keys(stageLoaderDependencies()), stageLoaderDependencies],
  ['ObjectDispatcher', ObjectDispatcher, Object.keys(dispatcherDependencies()), dispatcherDependencies],
  ['UiBuilder', UiBuilder, Object.keys(uiBuilderDependencies()), uiBuilderDependencies]
];

describe('dependency contracts', () => {
  test('requireDependencies reports the missing key and the declared key list', () => {
    expect(() => requireDependencies('Thing', {}, ['alpha', 'beta']))
      .toThrow('Thing is missing required dependency "alpha". Declared dependencies: alpha, beta.');
    expect(() => requireDependencies('Thing', { alpha: 1 }, ['alpha', 'beta']))
      .toThrow('"beta"');
  });

  test('requireDependencies rejects a missing dependency object', () => {
    expect(() => requireDependencies('Thing', undefined, ['alpha']))
      .toThrow('Thing requires a dependency object.');
  });

  for (const [name, Contract, keys, build] of CONTRACTS) {
    test(`${name} constructs with its full declared contract`, () => {
      expect(() => new Contract(build())).not.toThrow();
    });

    for (const key of keys) {
      test(`${name} fails at construction when "${key}" is absent`, () => {
        const dependencies = build();
        delete dependencies[key];
        expect(() => new Contract(dependencies)).toThrow(key);
      });
    }
  }
});

describe('Player dependency object', () => {
  test('declares the configured services as constructor keys', () => {
    const dependencies = playerDependencies();
    const player = new Player(dependencies);

    expect(player.abilities).toBe(dependencies.abilities);
    expect(player.inventory).toBe(dependencies.inventory);
    expect(player.healthSystem).toBe(dependencies.healthSystem);
    expect(player.scoreSystem).toBe(dependencies.scoreSystem);
    expect(player.progressionSystem).toBe(dependencies.progressionSystem);
    expect(player.audioEngine).toBe(dependencies.audioEngine);
    expect(player.stage).toBe(null);
  });

  test('derives the note collection from the bound stage', () => {
    const player = new Player(playerDependencies());
    const noteCollection = { totalNotes: 8 };

    player.stage = { noteCollection };

    expect(player.noteCollection).toBe(noteCollection);
  });
});
