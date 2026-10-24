import { SceneManager } from '../../engine/index.js';

export class SceneRouter {
  #sceneManager;
  #scenes;
  #actions;
  #modalStack;

  constructor() {
    this.#sceneManager = new SceneManager();
    this.#scenes = new Map();
    this.#actions = new Map();
    this.#modalStack = [];
  }

  get currentScene() {
    return this.#sceneManager.currentScene;
  }

  get currentSceneName() {
    const current = this.#sceneManager.currentScene;
    for (const [name, scene] of this.#scenes) {
      if (scene === current) {
        return name;
      }
    }
    return null;
  }

  get sceneNames() {
    return [...this.#scenes.keys()];
  }

  get actionNames() {
    return [...this.#actions.keys()];
  }

  registerScene(name, scene) {
    this.#scenes.set(name, scene);
    this.#sceneManager.registerScene(name, scene);
  }

  hasScene(name) {
    return this.#scenes.has(name);
  }

  switchTo(name) {
    this.#sceneManager.switchTo(name);
  }

  registerAction(action, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError(`Handler for action "${action}" must be a function.`);
    }
    this.#actions.set(action, handler);
  }

  registerActions(handlers) {
    for (const [action, handler] of Object.entries(handlers)) {
      this.registerAction(action, handler);
    }
  }

  dispatch(action, ...args) {
    const handler = this.#actions.get(action);
    if (!handler) {
      console.error(`[menu] No handler is registered for action "${action}".`);
      return false;
    }
    return handler(...args);
  }

  openModal(name) {
    if (!this.hasScene(name)) {
      console.error(`[navigation] Cannot open modal scene "${name}": it is not registered.`);
      return false;
    }

    const current = this.#sceneManager.currentScene;
    this.#modalStack.push({
      sceneName: this.currentSceneName,
      paused: current && typeof current.isPaused === 'boolean' ? current.isPaused : undefined
    });
    this.switchTo(name);
    return true;
  }

  closeModal() {
    const entry = this.#modalStack.pop();
    if (!entry || !entry.sceneName) {
      console.error('[navigation] Cannot close a modal scene: no modal scene is open.');
      return false;
    }

    this.switchTo(entry.sceneName);

    if (entry.paused !== undefined) {
      const scene = this.#scenes.get(entry.sceneName);
      if (scene && typeof scene.isPaused === 'boolean') {
        scene.isPaused = entry.paused;
      }
    }

    return true;
  }
}
