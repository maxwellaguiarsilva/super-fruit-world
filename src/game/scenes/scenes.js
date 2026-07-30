import { Scene } from '../../engine/core/scene.js';

class TitleScene extends Scene {
  #titleMenu;
  #audioEngine;

  constructor(titleMenu, audioEngine) {
    super('title');
    this.#titleMenu = titleMenu;
    this.#audioEngine = audioEngine;
  }

  enter(previousScene) {
    if (this.#audioEngine) {
      this.#audioEngine.playBGM('title-screen');
    }
  }

  exit(nextScene) {
    if (this.#audioEngine) {
      this.#audioEngine.stopBGM();
    }
  }

  update(dt, inputManager) {
    this.#titleMenu.update(dt, inputManager);
  }

  render(renderer) {
    renderer.clear();

    const titleKey = this.#titleMenu.titleKey || 'menu.main.title';
    const title = this.#titleMenu.localeManager ? this.#titleMenu.localeManager.get(titleKey) : titleKey;
    const titleFont = `${this.#titleMenu.titleFontSize}px ${this.#titleMenu.fontFamily}`;
    renderer.drawText(title, renderer.viewportWidth / 2, 2.0, titleFont, this.#titleMenu.titleColor, 'center');

    this.#titleMenu.render(renderer);
  }
}

class StageScene extends Scene {
  #stage;
  #hud;
  #pauseMenu;
  #gameOverScreen;
  #stageClearScreen;
  #inventoryUI;
  #audioEngine;
  #camera;
  #isPaused;
  #isInventoryOpen;
  #isGameOver;
  #isStageClear;

  constructor(stage, hud, pauseMenu, gameOverScreen, stageClearScreen, inventoryUI, audioEngine) {
    super('stage');
    this.#stage = stage;
    this.#hud = hud;
    this.#pauseMenu = pauseMenu;
    this.#gameOverScreen = gameOverScreen;
    this.#stageClearScreen = stageClearScreen;
    this.#inventoryUI = inventoryUI;
    this.#audioEngine = audioEngine;
    this.#camera = null;
    this.#isPaused = false;
    this.#isInventoryOpen = false;
    this.#isGameOver = false;
    this.#isStageClear = false;
  }

  get isPaused() { return this.#isPaused; }
  set isPaused(v) {
    if (v && !this.#isPaused) {
      this.#audioEngine?.pauseBGM();
    } else if (!v && this.#isPaused) {
      this.#audioEngine?.resumeBGM();
    }
    this.#isPaused = v;
  }
  get isInventoryOpen() { return this.#isInventoryOpen; }
  get isGameOver() { return this.#isGameOver; }
  set isGameOver(v) { this.#isGameOver = v; }
  get isStageClear() { return this.#isStageClear; }
  set isStageClear(v) { this.#isStageClear = v; }
  get stage() { return this.#stage; }
  get player() { return this.#stage?.player; }

  set camera(c) { this.#camera = c; }

  enter(previousScene) {
    if (this.#audioEngine) {
      this.#audioEngine.playBGM('stage');
    }
    this.#stage.activate();
  }

  exit(nextScene) {
    if (this.#audioEngine) {
      this.#audioEngine.stopBGM();
    }
    this.#stage.deactivate();
  }

  update(dt, inputManager) {
    if (this.#stage.isCompleted) {
      this.#isStageClear = true;
    }

    if (this.#stage.player.healthSystem.isGameOver) {
      this.#isGameOver = true;
    }

    if (inputManager) {
      if (inputManager.isPressed('pause')) {
        if (this.#isInventoryOpen) {
          this.#isInventoryOpen = false;
          this.#inventoryUI.inventory.isOpen = false;
        } else {
          this.isPaused = !this.isPaused;
        }
      }

      if (inputManager.isPressed('select') && !this.#isPaused) {
        this.#isInventoryOpen = !this.#isInventoryOpen;
        this.#inventoryUI.inventory.isOpen = this.#isInventoryOpen;
      }

      if (inputManager.isPressed('select') && inputManager.isPressed('shoot')) {
        const defaultItem = this.#inventoryUI.inventory.defaultSelected;
        if (defaultItem) {
          this.#inventoryUI.inventory.use(defaultItem);
        }
      }
    }

    if (this.#isPaused) {
      this.#pauseMenu.update(dt, inputManager);
    } else if (this.#isInventoryOpen) {
      this.#inventoryUI.handleInput(inputManager);
    } else if (this.#isGameOver) {
      this.#gameOverScreen.update(dt, inputManager);
    } else if (this.#isStageClear) {
      this.#stageClearScreen.update(dt, inputManager);
    } else {
      this.#stage.update(dt, inputManager);

      if (this.#camera) {
        this.#camera.follow(this.#stage.player, 0.1);
        this.#camera.constrainToBounds(this.#stage.bounds);
      }
    }
  }

  render(renderer) {
    renderer.clear();

    if (this.#camera) {
      renderer.cameraTransform = this.#camera;
    }

    this.#stage.render(renderer);

    if (this.#camera) {
      renderer.restoreCameraTransform();
    }

    const screenClear = this.#stage.player.ability('screen-clear');
    if (screenClear && screenClear.isFlashing) {
      renderer.applyFlash(screenClear.flashAlpha);
    }

    this.#hud.render(renderer);

    if (this.#isPaused) {
      this.#pauseMenu.render(renderer);
    } else if (this.#isInventoryOpen) {
      this.#inventoryUI.render(renderer);
    } else if (this.#isGameOver) {
      this.#gameOverScreen.render(renderer);
    } else if (this.#isStageClear) {
      this.#stageClearScreen.render(renderer);
    }
  }
}

class MapScene extends Scene {
  #mapStage;
  #pauseMenu;
  #audioEngine;
  #isPaused;

  constructor(mapStage, pauseMenu, audioEngine) {
    super('map');
    this.#mapStage = mapStage;
    this.#pauseMenu = pauseMenu;
    this.#audioEngine = audioEngine;
    this.#isPaused = false;
  }

  get isPaused() { return this.#isPaused; }
  set isPaused(v) {
    if (v && !this.#isPaused) {
      this.#audioEngine?.pauseBGM();
    } else if (!v && this.#isPaused) {
      this.#audioEngine?.resumeBGM();
    }
    this.#isPaused = v;
  }

  enter(previousScene) {
    if (this.#audioEngine) {
      this.#audioEngine.playBGM('world-map');
    }
  }

  exit(nextScene) {
    if (this.#audioEngine) {
      this.#audioEngine.stopBGM();
    }
  }

  update(dt, inputManager) {
    if (inputManager && inputManager.isPressed('pause')) {
      this.isPaused = !this.isPaused;
    }

    if (this.#isPaused) {
      this.#pauseMenu.update(dt, inputManager);
    } else {
      this.#mapStage.update(dt, inputManager);

      if (inputManager && inputManager.isPressed('confirm')) {
        const selected = this.#mapStage.selectNode();
        if (selected && this.onStageSelected) {
          this.onStageSelected(this.#mapStage.activeNode);
        }
      }
    }
  }

  render(renderer) {
    renderer.clear();

    this.#mapStage.render(renderer);

    if (this.#isPaused) {
      this.#pauseMenu.render(renderer);
    }
  }
}

export { TitleScene, StageScene, MapScene };
