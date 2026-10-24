import { describe, expect, test } from 'bun:test';

import { Camera } from '../src/engine/renderer/camera.js';

describe('Camera position and size', () => {
  test('starts at the origin with no size', () => {
    const camera = new Camera();

    expect(camera.x).toBe(0);
    expect(camera.y).toBe(0);
    expect(camera.width).toBe(0);
    expect(camera.height).toBe(0);
  });

  test('stores its position through the setters', () => {
    const camera = new Camera();

    camera.x = 12.5;
    camera.y = -4;

    expect(camera.x).toBe(12.5);
    expect(camera.y).toBe(-4);
  });

  test('stores its size', () => {
    const camera = new Camera();
    camera.setSize(20, 10);

    expect(camera.width).toBe(20);
    expect(camera.height).toBe(10);
  });
});

describe('Camera coordinates', () => {
  test('converts world to screen by subtracting the camera origin', () => {
    const camera = new Camera();
    camera.x = 5;
    camera.y = 3;

    expect(camera.worldToScreen(8, 10)).toEqual({ x: 3, y: 7 });
  });

  test('converts screen to world by adding the camera origin', () => {
    const camera = new Camera();
    camera.x = 5;
    camera.y = 3;

    expect(camera.screenToWorld(3, 7)).toEqual({ x: 8, y: 10 });
  });

  test('round-trips any point', () => {
    const camera = new Camera();
    camera.x = -2.5;
    camera.y = 7.25;

    const screen = camera.worldToScreen(10, -3);

    expect(camera.screenToWorld(screen.x, screen.y)).toEqual({ x: 10, y: -3 });
  });
});

describe('Camera follow', () => {
  test('centers the target and moves by the smoothing fraction', () => {
    const camera = new Camera();
    camera.setSize(100, 50);

    camera.follow({ x: 200, y: 100 }, 0.5);

    expect(camera.x).toBe(75);
    expect(camera.y).toBe(37.5);
  });

  test('keeps the current position when smoothing is zero', () => {
    const camera = new Camera();
    camera.setSize(100, 50);
    camera.x = 10;
    camera.y = 20;

    camera.follow({ x: 0, y: 0 }, 0);

    expect(camera.x).toBe(10);
    expect(camera.y).toBe(20);
  });

  test('snaps to the target when smoothing is one or higher', () => {
    const camera = new Camera();
    camera.setSize(100, 50);

    camera.follow({ x: 200, y: 100 }, 1);
    expect(camera.x).toBe(150);
    expect(camera.y).toBe(75);

    camera.follow({ x: 0, y: 0 }, 5);
    expect(camera.x).toBe(-50);
    expect(camera.y).toBe(-25);
  });

  test('approaches the target over repeated frames without overshooting', () => {
    const camera = new Camera();
    camera.setSize(100, 100);

    camera.follow({ x: 200, y: 200 }, 0.1);
    const first = camera.x;
    camera.follow({ x: 200, y: 200 }, 0.1);

    expect(first).toBe(15);
    expect(camera.x).toBeGreaterThan(first);
    expect(camera.x).toBeLessThan(150);
  });
});

describe('Camera visibility', () => {
  function cameraAt(x, y) {
    const camera = new Camera();
    camera.setSize(100, 50);
    camera.x = x;
    camera.y = y;
    return camera;
  }

  test('accepts a rectangle inside the view', () => {
    expect(cameraAt(0, 0).isVisible({ x: 10, y: 10, width: 20, height: 10 })).toBe(true);
  });

  test('accepts a rectangle that overlaps one edge', () => {
    expect(cameraAt(0, 0).isVisible({ x: -5, y: 10, width: 10, height: 10 })).toBe(true);
    expect(cameraAt(0, 0).isVisible({ x: 90, y: 10, width: 20, height: 10 })).toBe(true);
  });

  test('rejects a rectangle that only touches an edge', () => {
    expect(cameraAt(0, 0).isVisible({ x: -20, y: 10, width: 20, height: 10 })).toBe(false);
    expect(cameraAt(0, 0).isVisible({ x: 100, y: 10, width: 20, height: 10 })).toBe(false);
  });

  test('rejects a rectangle fully outside the view', () => {
    expect(cameraAt(0, 0).isVisible({ x: 200, y: 200, width: 10, height: 10 })).toBe(false);
  });

  test('accounts for a moved camera', () => {
    expect(cameraAt(50, 25).isVisible({ x: 60, y: 30, width: 10, height: 10 })).toBe(true);
    expect(cameraAt(50, 25).isVisible({ x: 0, y: 0, width: 10, height: 10 })).toBe(false);
  });
});

describe('Camera bounds constraint', () => {
  test('clamps the position inside the upper-left corner', () => {
    const camera = new Camera();
    camera.setSize(100, 50);
    camera.x = -20;
    camera.y = -10;

    camera.constrainToBounds({ x: 0, y: 0, width: 300, height: 200 });

    expect(camera.x).toBe(0);
    expect(camera.y).toBe(0);
  });

  test('clamps the position at the lower-right limit', () => {
    const camera = new Camera();
    camera.setSize(100, 50);
    camera.x = 500;
    camera.y = 500;

    camera.constrainToBounds({ x: 0, y: 0, width: 300, height: 200 });

    expect(camera.x).toBe(200);
    expect(camera.y).toBe(150);
  });

  test('clamps against a bounds rectangle with a nonzero origin', () => {
    const camera = new Camera();
    camera.setSize(100, 50);
    camera.x = -100;
    camera.y = 1000;

    camera.constrainToBounds({ x: 10, y: 20, width: 300, height: 200 });

    expect(camera.x).toBe(10);
    expect(camera.y).toBe(170);
  });

  test('keeps an in-range position unchanged', () => {
    const camera = new Camera();
    camera.setSize(100, 50);
    camera.x = 40;
    camera.y = 30;

    camera.constrainToBounds({ x: 0, y: 0, width: 300, height: 200 });

    expect(camera.x).toBe(40);
    expect(camera.y).toBe(30);
  });

  test('lets the maximum win when the bounds are smaller than the camera', () => {
    const camera = new Camera();
    camera.setSize(100, 50);
    camera.x = 0;
    camera.y = 0;

    camera.constrainToBounds({ x: 0, y: 0, width: 40, height: 20 });

    expect(camera.x).toBe(-60);
    expect(camera.y).toBe(-30);
  });
});
