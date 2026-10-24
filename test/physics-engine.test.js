import { describe, expect, test } from 'bun:test';

import { PhysicsEngine } from '../src/engine/physics/physics-engine.js';

const CONFIG = {
  gravity: 40,
  'max-fall-speed': 25,
  friction: 0.2
};

function createEngine(overrides = {}) {
  return new PhysicsEngine({ ...CONFIG, ...overrides });
}

function createEntity(overrides = {}) {
  return {
    x: 0,
    y: 0,
    velocity: { x: 0, y: 0 },
    onGround: false,
    ...overrides
  };
}

describe('PhysicsEngine configuration', () => {
  test('exposes the configured values', () => {
    const engine = createEngine();

    expect(engine.gravity).toBe(40);
    expect(engine.maxFallSpeed).toBe(25);
    expect(engine.friction).toBe(0.2);
  });

  test('allows gravity to be replaced after construction', () => {
    const engine = createEngine();
    engine.gravity = 10;

    expect(engine.gravity).toBe(10);
  });
});

describe('PhysicsEngine gravity', () => {
  test('adds gravity scaled by the delta time', () => {
    const engine = createEngine();
    const entity = createEntity();

    engine.applyGravity(entity, 0.5);

    expect(entity.velocity).toEqual({ x: 0, y: 20 });
  });

  test('preserves horizontal velocity', () => {
    const engine = createEngine();
    const entity = createEntity({ velocity: { x: 7, y: 1 } });

    engine.applyGravity(entity, 0.25);

    expect(entity.velocity).toEqual({ x: 7, y: 11 });
  });

  test('caps the fall speed', () => {
    const engine = createEngine();
    const entity = createEntity({ velocity: { x: 0, y: 24 } });

    engine.applyGravity(entity, 1);

    expect(entity.velocity.y).toBe(25);
  });

  test('uses the entity gravity multiplier when it is finite', () => {
    const engine = createEngine();
    const lowGravity = createEntity({ gravityMultiplier: 0.25 });
    const invertedGravity = createEntity({ gravityMultiplier: -1 });

    engine.applyGravity(lowGravity, 1);
    engine.applyGravity(invertedGravity, 1);

    expect(lowGravity.velocity.y).toBe(10);
    expect(invertedGravity.velocity.y).toBe(-40);
  });

  test('falls back to a multiplier of one when the value is not finite', () => {
    const engine = createEngine();

    for (const gravityMultiplier of [undefined, null, NaN, Infinity, '2']) {
      const entity = createEntity({ gravityMultiplier });

      engine.applyGravity(entity, 0.5);

      expect(entity.velocity.y).toBe(20);
    }
  });

  test('a zero multiplier suspends gravity', () => {
    const engine = createEngine();
    const entity = createEntity({ gravityMultiplier: 0, velocity: { x: 0, y: 4 } });

    engine.applyGravity(entity, 1);

    expect(entity.velocity.y).toBe(4);
  });
});

describe('PhysicsEngine friction', () => {
  test('scales horizontal velocity only while on the ground', () => {
    const engine = createEngine();
    const grounded = createEntity({ onGround: true, velocity: { x: 10, y: 3 } });
    const airborne = createEntity({ onGround: false, velocity: { x: 10, y: 3 } });

    engine.applyFriction(grounded, 0.5);
    engine.applyFriction(airborne, 0.5);

    expect(grounded.velocity).toEqual({ x: 10 * Math.pow(0.8, 30), y: 3 });
    expect(airborne.velocity).toEqual({ x: 10, y: 3 });
  });

  test('applies the configured rate per simulated sixtieth of a second', () => {
    const engine = createEngine();
    const entity = createEntity({ onGround: true, velocity: { x: 1, y: 0 } });

    engine.applyFriction(entity, 1 / 60);

    expect(entity.velocity.x).toBeCloseTo(0.8, 12);
  });

  test('keeps the velocity unchanged when friction is zero', () => {
    const engine = createEngine({ friction: 0 });
    const entity = createEntity({ onGround: true, velocity: { x: 9, y: 0 } });

    engine.applyFriction(entity, 1);

    expect(entity.velocity.x).toBe(9);
  });
});

describe('PhysicsEngine integration', () => {
  test('moves the entity by velocity times the delta time', () => {
    const engine = createEngine();
    const entity = createEntity({ x: 2, y: 5, velocity: { x: 4, y: -2 } });

    engine.integratePosition(entity, 0.5);

    expect(entity.x).toBe(4);
    expect(entity.y).toBe(4);
  });

  test('does not move an entity at rest', () => {
    const engine = createEngine();
    const entity = createEntity({ x: 2, y: 5 });

    engine.integratePosition(entity, 1);

    expect(entity.x).toBe(2);
    expect(entity.y).toBe(5);
  });
});

describe('PhysicsEngine applied force', () => {
  test('reports the vertical force applied by gravity', () => {
    const engine = createEngine();

    expect(engine.getAppliedForce(createEntity())).toEqual({ x: 0, y: 40 });
  });

  test('honors the entity gravity multiplier', () => {
    const engine = createEngine();

    expect(engine.getAppliedForce(createEntity({ gravityMultiplier: 0.5 }))).toEqual({ x: 0, y: 20 });
    expect(engine.getAppliedForce(createEntity({ gravityMultiplier: null }))).toEqual({ x: 0, y: 40 });
  });
});
