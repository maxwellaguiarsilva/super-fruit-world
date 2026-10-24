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
    const title = this.#titleMenu.textResolver.text(titleKey);
    const titleFont = `${this.#titleMenu.titleFontSize}px ${this.#titleMenu.fontFamily}`;
    renderer.drawText(title, renderer.viewportWidth / 2, 2.0, titleFont, this.#titleMenu.titleColor, 'center');

    this.#titleMenu.render(renderer);
  }
}

class SettingsScene extends Scene {
  #settingsMenu;

  constructor(settingsMenu) {
    super('settings');
    this.#settingsMenu = settingsMenu;
  }

  update(dt, inputManager) {
    this.#settingsMenu.update(dt, inputManager);
  }

  render(renderer) {
    renderer.clear();
    this.#settingsMenu.render(renderer);
  }
}

class InfoScene extends Scene {
  #infoScreen;

  constructor(name, infoScreen) {
    super(name);
    this.#infoScreen = infoScreen;
  }

  update(dt, inputManager) {
    this.#infoScreen.update(dt, inputManager);
  }

  render(renderer) {
    renderer.clear();
    this.#infoScreen.render(renderer);
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
  #dialogueEngine;
  #isPaused;
  #isInventoryOpen;
  #isGameOver;
  #isStageClear;
  #introPlayed;
  #stageClearNotified;

  constructor(stage, hud, pauseMenu, gameOverScreen, stageClearScreen, inventoryUI, audioEngine, dialogueEngine = null, camera = null) {
    super('stage');
    this.#stage = stage;
    this.#hud = hud;
    this.#pauseMenu = pauseMenu;
    this.#gameOverScreen = gameOverScreen;
    this.#stageClearScreen = stageClearScreen;
    this.#inventoryUI = inventoryUI;
    this.#audioEngine = audioEngine;
    this.#camera = camera;
    this.#dialogueEngine = dialogueEngine;
    this.#isPaused = false;
    this.#isInventoryOpen = false;
    this.#isGameOver = false;
    this.#isStageClear = false;
    this.#introPlayed = false;
    this.#stageClearNotified = false;
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

  enter(previousScene) {
    if (this.#audioEngine) {
      this.#audioEngine.playBGM(this.#stage.bgm ?? this.#stage.name);
    }
    this.#stage.activate();

    if (!this.#introPlayed && this.#dialogueEngine) {
      this.#introPlayed = true;
      this.#snapCameraToPlayer();
      this.#dialogueEngine.playSequence('intro');
    }
  }

  exit(nextScene) {
    if (this.#audioEngine) {
      this.#audioEngine.stopBGM();
    }
    this.#stage.deactivate();
  }

  #followPlayerCamera() {
    if (!this.#camera) {
      return;
    }

    this.#camera.follow(this.#stage.player, 0.1);
    this.#camera.constrainToBounds(this.#stage.bounds);
  }

  #snapCameraToPlayer() {
    if (!this.#camera) {
      return;
    }

    this.#camera.follow(this.#stage.player, 1);
    this.#camera.constrainToBounds(this.#stage.bounds);
  }

  update(dt, inputManager) {
    if (this.#stage.isCompleted) {
      this.#isStageClear = true;
      if (!this.#stageClearNotified) {
        this.#stageClearNotified = true;
        this.onStageClear?.();
      }
    }

    if (this.#stage.player.healthSystem.isLivesExhausted) {
      this.#isGameOver = true;
    }

    if (this.#dialogueEngine?.isActive) {
      this.#dialogueEngine.update(dt, inputManager);
      this.#followPlayerCamera();
      return;
    }

    if (this.#isGameOver || this.#isStageClear) {
      if (this.#isGameOver) {
        this.#gameOverScreen.update(dt, inputManager);
      } else {
        this.#stageClearScreen.update(dt, inputManager);
      }
      return;
    }

    if (inputManager) {
      const usesDefaultItem = inputManager.isPressed('select') && inputManager.isPressed('shoot');

      if (inputManager.isPressed('pause')) {
        if (this.#isInventoryOpen) {
          this.#isInventoryOpen = false;
          this.#inventoryUI.inventory.isOpen = false;
        } else {
          this.isPaused = !this.isPaused;
        }
      }

      if (inputManager.isPressed('select') && !usesDefaultItem && !this.#isPaused) {
        this.#isInventoryOpen = !this.#isInventoryOpen;
        this.#inventoryUI.inventory.isOpen = this.#isInventoryOpen;
        if (this.#isInventoryOpen) {
          this.#audioEngine?.playSFX('inventory-open');
        }
      }

      if (usesDefaultItem && !this.#isPaused && !this.#isInventoryOpen) {
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
    } else {
      this.#stage.update(dt, inputManager);
      this.#followPlayerCamera();
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

    if (this.#isGameOver) {
      this.#gameOverScreen.render(renderer);
    } else if (this.#isStageClear) {
      this.#stageClearScreen.render(renderer);
    } else if (this.#isPaused) {
      this.#pauseMenu.render(renderer);
    } else if (this.#isInventoryOpen) {
      this.#inventoryUI.render(renderer);
    }

    this.#dialogueEngine?.render(renderer);
  }
}

class MapScene extends Scene {
  #mapStage;
  #pauseMenu;
  #audioEngine;
  #camera;
  #isPaused;

  constructor(mapStage, pauseMenu, audioEngine, camera = null) {
    super('map');
    this.#mapStage = mapStage;
    this.#pauseMenu = pauseMenu;
    this.#audioEngine = audioEngine;
    this.#camera = camera;
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

  #centerCamera() {
    if (!this.#camera) {
      return;
    }

    const position = this.#mapStage.activeNodePosition;
    if (!position) {
      return;
    }

    this.#camera.x = position.x - this.#camera.width / 2;
    this.#camera.y = position.y - this.#camera.height / 2;
  }

  enter(previousScene) {
    this.#centerCamera();
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

    this.#centerCamera();
  }

  render(renderer) {
    renderer.clear();

    if (this.#camera) {
      renderer.cameraTransform = this.#camera;
    }

    this.#mapStage.render(renderer, this.#camera);

    if (this.#camera) {
      renderer.restoreCameraTransform();
    }

    if (this.#isPaused) {
      this.#pauseMenu.render(renderer);
    }
  }
}

export { TitleScene, SettingsScene, InfoScene, StageScene, MapScene };
