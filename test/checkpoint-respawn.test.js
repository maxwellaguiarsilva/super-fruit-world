import { describe, expect, test } from 'bun:test';

import { CollisionSolver } from '../src/engine/physics/collision-solver.js';
import { ObjectDispatcher } from '../src/app/content/object-dispatcher.js';
import { createCollectibleFactory } from '../src/app/factories/collectible-factory.js';
import { Stage } from '../src/game/stages/stage.js';

const STAGE_DATA = { name: 'checkpoint-fixture' };
const FALL_Y = 10;

function createPlayer() {
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
    update() {},
    healthSystem: { respawn() {} }
  };
}

function createStage() {
  const player = createPlayer();

  return new Stage(STAGE_DATA, {
    player,
    physicsEngine: { applyGravity() {}, applyFriction() {}, integratePosition() {} },
    collisionSolver: new CollisionSolver(),
    collectibleFactory: createCollectibleFactory(),
    noteCollection: null,
    projectileFactory: () => null,
    damageSystem: { applyHazardDamage() {}, applyEnemyDamage() {} }
  });
}

function dispatchCheckpoints(stage, player) {
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
    name: 'checkpoint-run',
    'parent-section': 'root',
    position: { x: 0, y: 0 },
    objects: [
      { type: 'checkpoint', position: { x: 5, y: 0 } },
      { type: 'checkpoint', position: { x: 9, y: 0 } }
    ]
  }, stage);

  stage.recomputeBounds();
}

function moveTo(player, x, y) {
  player.x = x;
  player.y = y;
}

function step(stage) {
  stage.update(1 / 60, null);
}

describe('checkpoint activation and respawn', () => {
  test('dispatched checkpoints keep their creation order and indices', () => {
    const stage = createStage();
    dispatchCheckpoints(stage, stage.player);

    expect(stage.checkpointCount).toBe(2);
    expect(stage.checkpointsList.map((checkpoint) => checkpoint.index)).toEqual([1, 2]);
    expect(stage.checkpointsList.map((checkpoint) => checkpoint.x)).toEqual([5, 9]);
    expect(stage.activeCheckpoint).toBe(0);
  });

  test('walking over checkpoint 1 records it as the respawn point', () => {
    const stage = createStage();
    dispatchCheckpoints(stage, stage.player);
    const [first, second] = stage.checkpointsList;

    moveTo(stage.player, 7, -1);
    step(stage);
    expect(stage.activeCheckpoint).toBe(0);

    moveTo(stage.player, first.x, -1);
    step(stage);

    expect(stage.activeCheckpoint).toBe(1);
    expect(first.isActive).toBe(true);
    expect(second.isActive).toBe(false);

    stage.respawnPlayer();

    expect(stage.player.x).toBe(first.x);
    expect(stage.player.y).toBe(first.y - 1);
  });

  test('checkpoint 2 takes precedence over checkpoint 1 after a death', () => {
    const stage = createStage();
    dispatchCheckpoints(stage, stage.player);
    const [first, second] = stage.checkpointsList;

    moveTo(stage.player, first.x, -1);
    step(stage);
    expect(stage.activeCheckpoint).toBe(1);

    moveTo(stage.player, second.x, -1);
    step(stage);
    expect(stage.activeCheckpoint).toBe(2);
    expect(second.isActive).toBe(true);

    moveTo(stage.player, first.x, -1);
    step(stage);
    expect(stage.activeCheckpoint).toBe(2);

    moveTo(stage.player, 5, FALL_Y);
    step(stage);

    expect(stage.player.x).toBe(second.x);
    expect(stage.player.y).toBe(second.y - 1);
  });

  test('dying before any checkpoint keeps the stage spawn point', () => {
    const stage = createStage();
    dispatchCheckpoints(stage, stage.player);
    const spawn = stage.spawnPoint;

    moveTo(stage.player, 7, -1);
    step(stage);
    expect(stage.activeCheckpoint).toBe(0);

    moveTo(stage.player, 7, FALL_Y);
    step(stage);

    expect(stage.player.x).toBe(spawn.x);
    expect(stage.player.y).toBe(spawn.y - 1);
  });
});
