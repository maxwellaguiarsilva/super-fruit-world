class TeleporterMarker {
  #name;
  #x;
  #y;

  constructor(name, x, y) {
    this.#name = name;
    this.#x = x;
    this.#y = y;
  }

  get name() { return this.#name; }
  get x() { return this.#x; }
  get y() { return this.#y; }
  get position() { return { x: this.#x, y: this.#y }; }
  get hitbox() { return { x: 0, y: 0, width: 1, height: 1 }; }

  render(renderer) {
    renderer.drawRect(this.#x, this.#y, 1, 1, 0.1, '#40BFBF', '#000000', 0.02);
  }
}

class InnerTeleporter extends TeleporterMarker {
  #targetMarker;
  #isActive;

  constructor(name, x, y, targetMarker) {
    super(name, x, y);
    this.#targetMarker = targetMarker;
    this.#isActive = true;
  }

  get targetMarker() { return this.#targetMarker; }
  get isActive() { return this.#isActive; }

  activate(player, stage) {
    if (!stage) {
      return;
    }

    const target = stage.getSection ? stage.getSection(this.#targetMarker) : null;
    if (target) {
      const worldPos = target.getWorldPosition(stage.sectionMap);
      player.x = worldPos.x;
      player.y = worldPos.y;
    }
  }

  deactivate() {
    this.#isActive = false;
  }

  render(renderer) {
    renderer.drawRect(this.x, this.y, 1, 1, 0.1, '#4040BF', '#000000', 0.02);
  }
}

class MapTeleporter extends TeleporterMarker {
  #targetMarker;

  constructor(name, x, y, targetMarker) {
    super(name, x, y);
    this.#targetMarker = targetMarker;
  }

  get targetMarker() { return this.#targetMarker; }

  activate(player, mapStage) {
    if (!mapStage) {
      return;
    }
    mapStage.navigateTo(this.#targetMarker);
  }
}

class SpecialTeleporter extends TeleporterMarker {
  #targetMarker;
  #targetScene;

  constructor(name, x, y, targetMarker, targetScene) {
    super(name, x, y);
    this.#targetMarker = targetMarker;
    this.#targetScene = targetScene;
  }

  get targetMarker() { return this.#targetMarker; }
  get targetScene() { return this.#targetScene; }

  activate(player, sceneManager) {
    if (sceneManager) {
      sceneManager.switchTo(this.#targetScene);
    }
  }
}

class KeyDoor extends SpecialTeleporter {
  #requiredKey;
  #isActive;

  constructor(name, x, y, targetMarker, targetScene, requiredKey) {
    super(name, x, y, targetMarker, targetScene);
    this.#requiredKey = requiredKey;
    this.#isActive = false;
  }

  get requiredKey() { return this.#requiredKey; }
  get isActive() { return this.#isActive; }

  activate(player, sceneManager) {
    if (!player.inventory.has(`key:${this.#requiredKey}`)) {
      return;
    }
    player.inventory.remove(`key:${this.#requiredKey}`, 1);
    super.activate(player, sceneManager);
  }

  update(dt) {
  }
}

export { TeleporterMarker, InnerTeleporter, MapTeleporter, SpecialTeleporter, KeyDoor };
