class Scene {
  #name;

  constructor(name) {
    this.#name = name;
  }

  get name() {
    return this.#name;
  }

  enter(previousScene) {
  }

  exit(nextScene) {
  }

  update(dt, inputManager) {
  }

  render(renderer) {
  }
}

export { Scene };
