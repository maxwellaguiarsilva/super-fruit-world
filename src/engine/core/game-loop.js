// Default simulation rate used when the configured rate is not a positive finite number.
const DEFAULT_UPDATE_RATE = 60;

// Upper bound for the wall-clock delta of a single animation frame, in milliseconds.
// A frame that arrives later than this (a stalled tab, a long task) advances the
// simulation by at most this much time instead of trying to catch up with everything.
const MAX_FRAME_DELTA_MS = 100;

// Upper bound for the fixed steps consumed in a single animation frame.
// Together with MAX_FRAME_DELTA_MS this keeps a late frame from starting an
// unbounded catch-up spiral: any remaining backlog is dropped.
const MAX_STEPS_PER_FRAME = 5;

// Tolerance used when comparing the accumulator with the step size, so that an
// elapsed time that is mathematically an exact multiple of the step still yields
// the expected number of steps despite floating-point subtraction.
const STEP_EPSILON_MS = 1e-9;

function resolveUpdateRate(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  return DEFAULT_UPDATE_RATE;
}

class GameLoop {
  #sceneManager;
  #inputManager;
  #renderer;
  #updateRate;
  #stepMilliseconds;
  #stepSeconds;
  #accumulator;
  #lastFrameTime;
  #isRunning;
  #isPaused;
  #rafId;
  #reportedErrors;

  constructor(updateRate, sceneManager, inputManager, renderer) {
    this.#sceneManager = sceneManager;
    this.#inputManager = inputManager;
    this.#renderer = renderer;
    this.#updateRate = resolveUpdateRate(updateRate);
    this.#stepMilliseconds = 1000 / this.#updateRate;
    this.#stepSeconds = 1 / this.#updateRate;
    this.#accumulator = 0;
    this.#lastFrameTime = null;
    this.#isRunning = false;
    this.#isPaused = false;
    this.#rafId = null;
    this.#reportedErrors = new Set();
  }

  get isRunning() {
    return this.#isRunning;
  }

  get isPaused() {
    return this.#isPaused;
  }

  get updateRate() {
    return this.#updateRate;
  }

  get stepSeconds() {
    return this.#stepSeconds;
  }

  start() {
    if (this.#isRunning) {
      return;
    }
    this.#isRunning = true;
    this.#isPaused = false;
    this.#accumulator = 0;
    this.#lastFrameTime = this.#now();
    this.#rafId = requestAnimationFrame(this.#loop);
  }

  stop() {
    if (!this.#isRunning) {
      return;
    }
    this.#isRunning = false;
    this.#isPaused = false;
    this.#accumulator = 0;
    this.#lastFrameTime = null;
    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId);
    }
    this.#rafId = null;
  }

  pause() {
    if (!this.#isRunning || this.#isPaused) {
      return;
    }
    this.#isPaused = true;
    this.#accumulator = 0;
  }

  resume() {
    if (!this.#isRunning || !this.#isPaused) {
      return;
    }
    this.#isPaused = false;
    this.#accumulator = 0;
    this.#lastFrameTime = this.#now();
  }

  // Advances one animation frame for the supplied timestamp, in milliseconds.
  // Returns the number of fixed steps consumed. This is the deterministic entry
  // point: it performs no scheduling, so tests can drive it without real time.
  tick(timestamp) {
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
      return 0;
    }

    if (this.#lastFrameTime === null) {
      this.#lastFrameTime = timestamp;
      return 0;
    }

    let elapsed = timestamp - this.#lastFrameTime;
    this.#lastFrameTime = timestamp;

    if (this.#isPaused) {
      this.#accumulator = 0;
      return 0;
    }

    const scene = this.#sceneManager.currentScene;
    if (!scene) {
      this.#accumulator = 0;
      return 0;
    }

    if (elapsed <= 0) {
      return 0;
    }

    if (elapsed > MAX_FRAME_DELTA_MS) {
      elapsed = MAX_FRAME_DELTA_MS;
    }

    // A paused scene still owns its pause menu, so it gets one fixed step per
    // frame to stay responsive. No elapsed time is kept, so resuming cannot
    // fast-forward the game.
    if (scene.isPaused === true) {
      this.#accumulator = 0;
      this.#advance(scene);
      this.#render(scene);
      return 1;
    }

    this.#accumulator += elapsed;

    let steps = 0;
    while (this.#accumulator + STEP_EPSILON_MS >= this.#stepMilliseconds
      && steps < MAX_STEPS_PER_FRAME) {
      this.#advance(scene);
      this.#accumulator -= this.#stepMilliseconds;
      steps += 1;
    }

    if (this.#accumulator < 0) {
      this.#accumulator = 0;
    }

    if (steps === MAX_STEPS_PER_FRAME) {
      this.#accumulator = 0;
    }

    this.#render(scene);

    return steps;
  }

  #loop = (timestamp) => {
    if (!this.#isRunning) {
      return;
    }

    // Scheduling happens in a finally block so that a failure anywhere in the
    // frame cannot strand the loop without a next animation frame.
    try {
      this.tick(timestamp);
    } catch (error) {
      this.#reportOnce('loop.tick', error);
    } finally {
      this.#rafId = requestAnimationFrame(this.#loop);
    }
  };

  // Reports each failing source exactly once for the lifetime of the loop, so a
  // scene that throws on every frame does not flood the console.
  #reportOnce(source, error) {
    if (this.#reportedErrors.has(source)) {
      return;
    }
    this.#reportedErrors.add(source);
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[game-loop] ${source} failed: ${message}`, error);
  }

  // One fixed simulation step. Input is advanced per step so that a press edge
  // is seen by exactly one step even when a frame runs several steps. Input is
  // finalized even when the scene throws, so the next step starts from a clean
  // edge state.
  #advance(scene) {
    this.#inputManager.update();
    try {
      scene.update(this.#stepSeconds, this.#inputManager);
    } catch (error) {
      this.#reportOnce('scene.update', error);
    } finally {
      this.#inputManager.finalize();
    }
  }

  #render(scene) {
    try {
      this.#renderer.clear();
    } catch (error) {
      this.#reportOnce('renderer.clear', error);
    }

    try {
      scene.render(this.#renderer);
    } catch (error) {
      this.#reportOnce('scene.render', error);
    }
  }

  #now() {
    return typeof performance !== 'undefined' ? performance.now() : 0;
  }
}

export { GameLoop, DEFAULT_UPDATE_RATE, MAX_FRAME_DELTA_MS, MAX_STEPS_PER_FRAME };
