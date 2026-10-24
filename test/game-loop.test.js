import { describe, expect, test } from 'bun:test';

import {
  GameLoop,
  DEFAULT_UPDATE_RATE,
  MAX_FRAME_DELTA_MS,
  MAX_STEPS_PER_FRAME
} from '../src/engine/core/game-loop.js';

function createScene() {
  return {
    isPaused: false,
    updates: [],
    renderCalls: 0,
    update(dt, inputManager) {
      this.updates.push({ dt, inputManager });
    },
    render() {
      this.renderCalls += 1;
    }
  };
}

function createInputManager() {
  const events = [];
  return {
    events,
    updateCalls: 0,
    finalizeCalls: 0,
    update() {
      this.updateCalls += 1;
      events.push('input.update');
    },
    finalize() {
      this.finalizeCalls += 1;
      events.push('input.finalize');
    }
  };
}

function createRenderer() {
  return {
    clearCalls: 0,
    clear() {
      this.clearCalls += 1;
    }
  };
}

function createHarness(updateRate = 60) {
  const scene = createScene();
  const sceneManager = { currentScene: scene };
  const inputManager = createInputManager();
  const renderer = createRenderer();
  const loop = new GameLoop(updateRate, sceneManager, inputManager, renderer);

  return { loop, scene, sceneManager, inputManager, renderer };
}

describe('GameLoop fixed timestep', () => {
  test('runs one update per configured interval and renders once per frame', () => {
    const { loop, scene, renderer } = createHarness(20);

    loop.tick(0);
    expect(scene.updates).toHaveLength(0);

    const steps = loop.tick(100);

    expect(steps).toBe(2);
    expect(scene.updates).toHaveLength(2);
    expect(scene.updates[0].dt).toBe(0.05);
    expect(scene.updates[1].dt).toBe(0.05);
    expect(scene.renderCalls).toBe(1);
    expect(renderer.clearCalls).toBe(1);
  });

  test('carries the accumulator remainder into the next frame', () => {
    const { loop, scene } = createHarness(20);

    loop.tick(0);
    expect(loop.tick(70)).toBe(1);

    expect(loop.tick(90)).toBe(0);
    expect(loop.tick(110)).toBe(1);
    expect(loop.tick(150)).toBe(1);

    expect(scene.updates).toHaveLength(3);
  });

  test('clamps a late frame delta instead of catching up with all elapsed time', () => {
    const { loop, scene } = createHarness(10);

    loop.tick(0);
    const steps = loop.tick(MAX_FRAME_DELTA_MS * 50);

    expect(steps).toBe(1);
    expect(scene.updates).toHaveLength(1);
  });

  test('never runs more than the step cap and drops the remaining backlog', () => {
    const { loop, scene } = createHarness(60);

    loop.tick(0);
    const steps = loop.tick(120);

    expect(steps).toBe(MAX_STEPS_PER_FRAME);
    expect(scene.updates).toHaveLength(MAX_STEPS_PER_FRAME);

    expect(loop.tick(136)).toBe(0);
    expect(scene.updates).toHaveLength(MAX_STEPS_PER_FRAME);
  });

  test('a paused scene gets one fixed step per frame without accumulating time', () => {
    const { loop, scene } = createHarness(10);

    loop.tick(0);
    scene.isPaused = true;

    expect(loop.tick(1000)).toBe(1);
    expect(scene.updates).toHaveLength(1);
    expect(scene.updates[0].dt).toBe(0.1);

    scene.isPaused = false;

    expect(loop.tick(1010)).toBe(0);
    expect(loop.tick(1110)).toBe(1);
    expect(scene.updates).toHaveLength(2);
  });

  test('advances input once per fixed step so an edge is not repeated by a later step', () => {
    const { loop, scene, inputManager } = createHarness(20);

    loop.tick(0);
    loop.tick(100);

    expect(inputManager.updateCalls).toBe(2);
    expect(inputManager.finalizeCalls).toBe(2);
    expect(inputManager.events).toEqual([
      'input.update',
      'input.finalize',
      'input.update',
      'input.finalize'
    ]);
    expect(scene.updates[0].inputManager).toBe(inputManager);
    expect(scene.updates[1].inputManager).toBe(inputManager);
  });

  test('renders once per frame even when no update is due', () => {
    const { loop, scene, renderer } = createHarness(10);

    loop.tick(0);
    const steps = loop.tick(16);

    expect(steps).toBe(0);
    expect(scene.updates).toHaveLength(0);
    expect(scene.renderCalls).toBe(1);
    expect(renderer.clearCalls).toBe(1);
  });

  test('does not update or render while no scene is available', () => {
    const { loop, scene, sceneManager, renderer } = createHarness(10);

    sceneManager.currentScene = null;

    loop.tick(0);
    expect(loop.tick(100)).toBe(0);
    expect(scene.updates).toHaveLength(0);
    expect(scene.renderCalls).toBe(0);
    expect(renderer.clearCalls).toBe(0);

    sceneManager.currentScene = scene;

    expect(loop.tick(200)).toBe(1);
    expect(scene.updates).toHaveLength(1);
    expect(scene.renderCalls).toBe(1);
  });

  test('ignores a non-numeric or non-finite timestamp', () => {
    const { loop, scene } = createHarness(10);

    loop.tick(0);
    expect(loop.tick(undefined)).toBe(0);
    expect(loop.tick(NaN)).toBe(0);
    expect(loop.tick(Infinity)).toBe(0);
    expect(scene.updates).toHaveLength(0);
  });
});

describe('GameLoop update rate', () => {
  test('exposes the resolved rate and step duration', () => {
    const { loop } = createHarness(30);

    expect(loop.updateRate).toBe(30);
    expect(loop.stepSeconds).toBe(1 / 30);
  });

  test('falls back to the documented default for every unusable rate', () => {
    const unusableRates = [undefined, null, 0, -1, NaN, Infinity, '60'];

    for (const rate of unusableRates) {
      const { loop } = createHarness(rate);

      expect(loop.updateRate).toBe(DEFAULT_UPDATE_RATE);
      expect(loop.stepSeconds).toBe(1 / DEFAULT_UPDATE_RATE);
    }
  });

  test('the fallback rate drives the simulation at the default step', () => {
    const { loop, scene } = createHarness(null);

    loop.tick(0);
    const steps = loop.tick(50);

    expect(steps).toBe(3);
    expect(scene.updates).toHaveLength(3);
    expect(scene.updates[0].dt).toBe(1 / DEFAULT_UPDATE_RATE);
  });
});

describe('GameLoop scheduling lifecycle', () => {
  function withFakeAnimationFrame(callback) {
    const originalRequest = globalThis.requestAnimationFrame;
    const originalCancel = globalThis.cancelAnimationFrame;
    const scheduled = [];
    const cancelled = [];
    let nextId = 1;

    globalThis.requestAnimationFrame = (frame) => {
      const id = nextId;
      nextId += 1;
      scheduled.push({ id, frame });
      return id;
    };
    globalThis.cancelAnimationFrame = (id) => {
      cancelled.push(id);
    };

    try {
      return callback({ scheduled, cancelled });
    } finally {
      globalThis.requestAnimationFrame = originalRequest;
      globalThis.cancelAnimationFrame = originalCancel;
    }
  }

  test('start schedules one frame and guards against a second start', () => {
    withFakeAnimationFrame(({ scheduled }) => {
      const { loop } = createHarness(60);

      expect(loop.isRunning).toBe(false);
      loop.start();
      expect(loop.isRunning).toBe(true);
      expect(scheduled).toHaveLength(1);

      loop.start();
      expect(scheduled).toHaveLength(1);
    });
  });

  test('stop cancels the pending frame and resets the running state', () => {
    withFakeAnimationFrame(({ scheduled, cancelled }) => {
      const { loop } = createHarness(60);

      loop.start();
      loop.stop();

      expect(loop.isRunning).toBe(false);
      expect(loop.isPaused).toBe(false);
      expect(cancelled).toEqual([scheduled[0].id]);

      loop.stop();
      expect(cancelled).toEqual([scheduled[0].id]);
    });
  });

  test('a scheduled frame reschedules while running and not after stop', () => {
    withFakeAnimationFrame(({ scheduled }) => {
      const { loop } = createHarness(60);
      loop.start();

      scheduled[0].frame(performance.now() + 50);
      expect(scheduled).toHaveLength(2);

      loop.stop();
      scheduled[1].frame(performance.now() + 100);
      expect(scheduled).toHaveLength(2);
    });
  });

  test('pause and resume only change state while running', () => {
    withFakeAnimationFrame(() => {
      const { loop } = createHarness(60);

      loop.pause();
      expect(loop.isPaused).toBe(false);
      loop.resume();
      expect(loop.isPaused).toBe(false);

      loop.start();
      loop.pause();
      expect(loop.isPaused).toBe(true);

      loop.pause();
      expect(loop.isPaused).toBe(true);

      loop.resume();
      expect(loop.isPaused).toBe(false);

      loop.resume();
      expect(loop.isPaused).toBe(false);

      loop.stop();
    });
  });

  function captureConsoleError(callback) {
    const original = console.error;
    const reports = [];
    console.error = (...args) => {
      reports.push(args.map((value) => String(value)).join(' '));
    };
    try {
      callback();
    } finally {
      console.error = original;
    }
    return reports;
  }

  test('contains an update exception, reports it once and keeps rendering', () => {
    withFakeAnimationFrame(({ scheduled }) => {
      const { loop, scene, inputManager } = createHarness(20);
      const reports = captureConsoleError(() => {
        scene.update = () => { throw new Error('update boom'); };
        loop.start();
        scheduled[0].frame(0);
        scheduled[1].frame(100);
        scheduled[2].frame(200);
      });

      expect(scene.renderCalls).toBe(2);
      expect(inputManager.finalizeCalls).toBe(4);
      expect(reports).toHaveLength(1);
      expect(reports[0]).toContain('scene.update');
      expect(scheduled).toHaveLength(4);
    });
  });

  test('schedules the next frame when render throws and reports it once', () => {
    withFakeAnimationFrame(({ scheduled }) => {
      const { loop, scene, renderer } = createHarness(20);
      const reports = captureConsoleError(() => {
        scene.render = () => { throw new Error('render boom'); };
        loop.start();
        scheduled[0].frame(0);
        scheduled[1].frame(100);
        scheduled[2].frame(200);
      });

      expect(renderer.clearCalls).toBe(2);
      expect(reports).toHaveLength(1);
      expect(reports[0]).toContain('scene.render');
      expect(scheduled).toHaveLength(4);
    });
  });
});
