import { describe, expect, test } from 'bun:test';

import { Tile } from '../src/game/entities/tile.js';
import { createPhysicsEngine, createStage } from './support/stage-fixture.js';

function tileConfig(overrides = {}) {
  return {
    type: 'platform',
    solid: true,
    deadly: false,
    'damage-value': null,
    liquid: false,
    climbable: false,
    inverted: false,
    'slope-angle': null,
    friction: 0.75,
    rendered: true,
    'fill-color': '#FFFFFF',
    'border-color': '#000000',
    'border-width': 0.1,
    'corner-radius': 0.1,
    ...overrides
  };
}

function createPlayer() {
  return {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    hitbox: { x: 0, y: 0, width: 1, height: 1 },
    onGround: false,
    isClimbing: false,
    isAlive: true,
    update() {},
    stage: null
  };
}

function createRecordingSolver() {
  const calls = [];

  return {
    calls,
    checkAABB: () => true,
    getOverlap: () => null,
    resolveCollision(movable, solid, dt) {
      calls.push({ kind: 'solid', dt });
      return {
        position: { x: movable.position.x, y: movable.position.y },
        velocity: { x: movable.velocity.x, y: movable.velocity.y },
        collided: true,
        onGround: true
      };
    },
    resolveSlopeCollision(movable, slope, dt) {
      calls.push({ kind: 'slope', dt });
      return {
        position: { x: movable.position.x, y: movable.position.y },
        velocity: { x: movable.velocity.x, y: movable.velocity.y },
        collided: true,
        onGround: true
      };
    }
  };
}

describe('stage player collision dt', () => {
  test('passes the frame dt to solid tile collision resolution', () => {
    const player = createPlayer();
    const solver = createRecordingSolver();
    const { stage } = createStage({
      player,
      physicsEngine: createPhysicsEngine(),
      collisionSolver: solver
    });

    stage.addEntity(new Tile(1, 1, 1, 1, tileConfig()));

    stage.update(0.25, null);

    expect(solver.calls).toEqual([{ kind: 'solid', dt: 0.25 }]);
  });

  test('passes the same dt to slope and solid tile collision resolution', () => {
    const player = createPlayer();
    const solver = createRecordingSolver();
    const { stage } = createStage({
      player,
      physicsEngine: createPhysicsEngine(),
      collisionSolver: solver
    });

    stage.addEntity(new Tile(1, 1, 1, 1, tileConfig({ type: 'slope', 'slope-angle': 30 })));
    stage.addEntity(new Tile(3, 1, 1, 1, tileConfig()));

    stage.update(0.125, null);

    expect(solver.calls).toEqual([
      { kind: 'slope', dt: 0.125 },
      { kind: 'solid', dt: 0.125 }
    ]);
  });
});
