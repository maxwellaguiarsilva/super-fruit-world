class GameLoop {
  #sceneManager;
  #inputManager;
  #renderer;
  #targetFPS;
  #targetFrameTime;
  #lastFrameTime;
  #isRunning;
  #isPaused;
  #rafId;

  constructor(targetFPS, sceneManager, inputManager, renderer) {
    this.#sceneManager = sceneManager;
    this.#inputManager = inputManager;
    this.#renderer = renderer;
    this.#targetFPS = targetFPS;
    this.#targetFrameTime = 1000 / targetFPS;
    this.#lastFrameTime = 0;
    this.#isRunning = false;
    this.#isPaused = false;
    this.#rafId = null;
  }

  get isRunning() {
    return this.#isRunning;
  }

  get isPaused() {
    return this.#isPaused;
  }

  start() {
    if (this.#isRunning) {
      return;
    }
    this.#isRunning = true;
    this.#isPaused = false;
    this.#lastFrameTime = performance.now();
    this.#rafId = requestAnimationFrame(this.#loop);
  }

  stop() {
    if (!this.#isRunning) {
      return;
    }
    this.#isRunning = false;
    this.#isPaused = false;
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
  }

  resume() {
    if (!this.#isRunning || !this.#isPaused) {
      return;
    }
    this.#isPaused = false;
    this.#lastFrameTime = performance.now();
  }

  #loop = (timestamp) => {
    if (!this.#isRunning) {
      return;
    }

    if (this.#isPaused) {
      this.#rafId = requestAnimationFrame(this.#loop);
      return;
    }

    const scene = this.#sceneManager.currentScene;
    if (!scene) {
      this.#rafId = requestAnimationFrame(this.#loop);
      return;
    }

    let elapsed = timestamp - this.#lastFrameTime;
    this.#lastFrameTime = timestamp;

    if (elapsed <= 0) {
      this.#rafId = requestAnimationFrame(this.#loop);
      return;
    }

    if (elapsed > 100) {
      elapsed = 100;
    }

    this.#inputManager.update();

    const dt = elapsed / 1000;

    scene.update(dt, this.#inputManager);

    this.#renderer.clear();
    scene.render(this.#renderer);

    this.#inputManager.finalize();

    this.#rafId = requestAnimationFrame(this.#loop);
  };
}

export { GameLoop };
