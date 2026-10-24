class SceneManager {
  #scenes;
  #currentScene;
  #currentSceneKey;

  constructor() {
    this.#scenes = new Map();
    this.#currentScene = null;
    this.#currentSceneKey = null;
  }

  registerScene(name, scene) {
    this.#scenes.set(name, scene);
  }

  unregisterScene(name) {
    this.#scenes.delete(name);
    if (this.#currentSceneKey === name) {
      this.#currentScene = null;
      this.#currentSceneKey = null;
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
    this.#currentSceneKey = name;
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
