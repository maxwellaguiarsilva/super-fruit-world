class SceneManager {
  #scenes;
  #currentScene;

  constructor() {
    this.#scenes = new Map();
    this.#currentScene = null;
  }

  registerScene(name, scene) {
    this.#scenes.set(name, scene);
  }

  unregisterScene(name) {
    this.#scenes.delete(name);
    if (this.#currentScene && this.#currentScene.name === name) {
      this.#currentScene = null;
    }
  }

  switchTo(name) {
    const nextScene = this.#scenes.get(name);
    if (!nextScene) {
      throw new Error(`Scene "${name}" is not registered.`);
    }

    const previousScene = this.#currentScene;

    if (previousScene) {
      previousScene.exit(nextScene);
    }

    this.#currentScene = nextScene;
    nextScene.enter(previousScene);
  }

  get currentScene() {
    return this.#currentScene;
  }

  get sceneNames() {
    return [...this.#scenes.keys()];
  }
}

export { SceneManager };
