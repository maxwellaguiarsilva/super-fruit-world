import { describe, expect, test } from 'bun:test';

import {
  InfoScene,
  MapScene,
  SettingsScene,
  StageScene,
  TitleScene
} from '../src/game/scenes/scenes.js';

function createRenderer(viewportWidth = 20) {
  const calls = [];

  return {
    calls,
    viewportWidth,
    set cameraTransform(camera) {
      calls.push(['cameraTransform', camera]);
    },
    clear() {
      calls.push(['clear']);
    },
    restoreCameraTransform() {
      calls.push(['restoreCameraTransform']);
    },
    applyFlash(alpha) {
      calls.push(['applyFlash', alpha]);
    },
    drawText(text, x, y, font, color, align) {
      calls.push(['drawText', text, x, y, font, color, align]);
    }
  };
}

function createAudioEngine() {
  const calls = [];

  return {
    calls,
    playBGM(name) { calls.push(['playBGM', name]); },
    stopBGM() { calls.push(['stopBGM']); },
    pauseBGM() { calls.push(['pauseBGM']); },
    resumeBGM() { calls.push(['resumeBGM']); },
    playSFX(name) { calls.push(['playSFX', name]); }
  };
}

function createInput(pressed = []) {
  const set = new Set(pressed);
  return { isPressed: (action) => set.has(action) };
}

function createInventoryUI() {
  const inventory = {
    isOpen: false,
    defaultSelected: null,
    useCalls: [],
    use(name) {
      this.useCalls.push(name);
    }
  };

  return {
    inventory,
    handleInputCalls: 0,
    renderCalls: 0,
    handleInput() {
      this.handleInputCalls += 1;
    },
    render() {
      this.renderCalls += 1;
    }
  };
}

function createCamera(width = 100, height = 50) {
  return {
    x: 0,
    y: 0,
    width,
    height,
    follows: [],
    constrainCalls: 0,
    follow(target, smoothing) {
      this.follows.push({ target, smoothing });
      this.x = target.x - this.width / 2;
      this.y = target.y - this.height / 2;
    },
    constrainToBounds() {
      this.constrainCalls += 1;
    }
  };
}

function createStage(options = {}) {
  const stage = {
    name: options.name ?? 'strawberry-fields',
    bgm: options.bgm ?? null,
    isCompleted: options.completed ?? false,
    bounds: { x: 0, y: 0, width: 100, height: 50 },
    player: {
      x: 10,
      y: 20,
      healthSystem: { isLivesExhausted: options.livesExhausted ?? false },
      ability: (name) => (name === 'screen-clear' ? options.screenClear ?? null : null)
    },
    updateCalls: [],
    renderCalls: 0,
    activateCalls: 0,
    deactivateCalls: 0,
    update(dt, inputManager) {
      this.updateCalls.push({ dt, inputManager });
    },
    render(renderer) {
      this.renderCalls += 1;
      this.lastRenderer = renderer;
    },
    activate() {
      this.activateCalls += 1;
    },
    deactivate() {
      this.deactivateCalls += 1;
    }
  };

  return stage;
}

function createDialogue() {
  return {
    isActive: false,
    playSequenceCalls: [],
    updateCalls: [],
    renderCalls: 0,
    playSequence(id) {
      this.playSequenceCalls.push(id);
    },
    update(dt, inputManager) {
      this.updateCalls.push({ dt, inputManager });
    },
    render() {
      this.renderCalls += 1;
    }
  };
}

function createStageScene(options = {}) {
  const stage = options.stage ?? createStage(options);
  const screens = {
    hud: { renderCalls: 0, render() { this.renderCalls += 1; } },
    pauseMenu: { updateCalls: 0, renderCalls: 0, update() { this.updateCalls += 1; }, render() { this.renderCalls += 1; } },
    gameOver: { updateCalls: 0, renderCalls: 0, update() { this.updateCalls += 1; }, render() { this.renderCalls += 1; } },
    stageClear: { updateCalls: 0, renderCalls: 0, update() { this.updateCalls += 1; }, render() { this.renderCalls += 1; } }
  };
  const inventoryUI = createInventoryUI();
  const audioEngine = options.audioEngine ?? createAudioEngine();
  const dialogue = options.dialogue ?? null;

  const scene = new StageScene(
    stage,
    screens.hud,
    screens.pauseMenu,
    screens.gameOver,
    screens.stageClear,
    inventoryUI,
    audioEngine,
    dialogue,
    options.camera ?? null
  );

  return { scene, stage, screens, inventoryUI, audioEngine, dialogue };
}

describe('TitleScene', () => {
  function createTitleScene() {
    const menu = {
      titleKey: 'title.key',
      titleFontSize: 1.5,
      fontFamily: 'Family',
      titleColor: '#ffffff',
      textResolver: { text: (key) => (key === 'title.key' ? 'Super Fruit World' : key) },
      updateCalls: 0,
      renderCalls: 0,
      update() {
        this.updateCalls += 1;
      },
      render() {
        this.renderCalls += 1;
      }
    };
    const audioEngine = createAudioEngine();
    const scene = new TitleScene(menu, audioEngine);
    return { scene, menu, audioEngine };
  }

  test('plays the title music on enter and stops it on exit', () => {
    const { scene, audioEngine } = createTitleScene();

    scene.enter();
    scene.exit();

    expect(audioEngine.calls).toEqual([['playBGM', 'title-screen'], ['stopBGM']]);
  });

  test('works without an audio engine', () => {
    const menu = { update() {}, render() {}, textResolver: { text: (key) => key } };
    const scene = new TitleScene(menu, null);

    expect(() => scene.enter()).not.toThrow();
    expect(() => scene.exit()).not.toThrow();
  });

  test('delegates update to the menu', () => {
    const { scene, menu } = createTitleScene();
    const input = createInput();

    scene.update(0.5, input);

    expect(menu.updateCalls).toBe(1);
  });

  test('draws the title and then the menu on render', () => {
    const { scene, menu } = createTitleScene();
    const renderer = createRenderer(40);

    scene.render(renderer);

    expect(renderer.calls).toEqual([
      ['clear'],
      ['drawText', 'Super Fruit World', 20, 2, '1.5px Family', '#ffffff', 'center']
    ]);
    expect(menu.renderCalls).toBe(1);
  });

  test('falls back to the default title key', () => {
    const calls = [];
    const menu = {
      titleFontSize: 1,
      fontFamily: 'Family',
      titleColor: '#ffffff',
      textResolver: { text: (key) => key },
      update() {},
      render() {}
    };
    const scene = new TitleScene(menu, null);
    const renderer = {
      viewportWidth: 10,
      drawText: (...args) => calls.push(args),
      clear() {}
    };

    scene.render(renderer);

    expect(calls[0][0]).toBe('menu.main.title');
  });
});

describe('SettingsScene and InfoScene', () => {
  test('SettingsScene delegates update and render', () => {
    let updates = 0;
    let renders = 0;
    const scene = new SettingsScene({
      update() { updates += 1; },
      render() { renders += 1; }
    });
    const renderer = { clearCalls: 0, clear() { this.clearCalls += 1; } };

    scene.update(0.1, createInput());
    scene.render(renderer);

    expect(scene.name).toBe('settings');
    expect(updates).toBe(1);
    expect(renders).toBe(1);
    expect(renderer.clearCalls).toBe(1);
  });

  test('InfoScene delegates update and render under the supplied name', () => {
    let updates = 0;
    let renders = 0;
    const scene = new InfoScene('tutorial', {
      update() { updates += 1; },
      render() { renders += 1; }
    });
    const renderer = { clear() {} };

    scene.update(0.1, createInput());
    scene.render(renderer);

    expect(scene.name).toBe('tutorial');
    expect(updates).toBe(1);
    expect(renders).toBe(1);
  });
});

describe('MapScene', () => {
  function createMapScene(options = {}) {
    let selected = options.selectable ?? true;
    const mapStage = {
      activeNode: options.activeNode ?? 'strawberry-fields',
      activeNodePosition: options.activeNodePosition ?? { x: 200, y: 100 },
      updateCalls: [],
      renderCalls: [],
      selectNodeCalls: 0,
      update(dt, inputManager) {
        this.updateCalls.push({ dt, inputManager });
      },
      selectNode() {
        this.selectNodeCalls += 1;
        return selected;
      },
      render(renderer, camera) {
        this.renderCalls.push({ renderer, camera });
      }
    };
    const pauseMenu = {
      updateCalls: 0,
      renderCalls: 0,
      update() { this.updateCalls += 1; },
      render() { this.renderCalls += 1; }
    };
    const audioEngine = createAudioEngine();
    const camera = options.camera === null
      ? null
      : (options.camera ?? createCamera(100, 50));
    const scene = new MapScene(mapStage, pauseMenu, audioEngine, camera);

    return {
      scene,
      mapStage,
      pauseMenu,
      audioEngine,
      camera,
      setSelectable: (value) => { selected = value; }
    };
  }

  test('centers the camera on the active node and plays the map music on enter', () => {
    const { scene, audioEngine, camera } = createMapScene();

    scene.enter();

    expect(scene.isPaused).toBe(false);
    expect(audioEngine.calls).toEqual([['playBGM', 'world-map']]);
    expect(camera.x).toBe(150);
    expect(camera.y).toBe(75);
  });

  test('centers the camera when one is assigned', () => {
    const camera = createCamera(100, 50);
    const { scene } = createMapScene({ camera });

    scene.enter();

    expect(camera.x).toBe(150);
    expect(camera.y).toBe(75);
  });

  test('enters without a camera or an active node position', () => {
    const { scene: withoutCamera } = createMapScene({ camera: null });
    expect(() => withoutCamera.enter()).not.toThrow();

    const { scene: withoutNode } = createMapScene({ activeNodePosition: null });
    expect(() => withoutNode.enter()).not.toThrow();
  });

  test('toggles pause and stops updating the map while paused', () => {
    const { scene, mapStage, pauseMenu, audioEngine } = createMapScene();
    scene.enter();

    scene.update(0.1, createInput(['pause']));

    expect(scene.isPaused).toBe(true);
    expect(audioEngine.calls).toContainEqual(['pauseBGM']);
    expect(pauseMenu.updateCalls).toBe(1);
    expect(mapStage.updateCalls).toHaveLength(0);

    scene.update(0.1, createInput(['pause']));

    expect(scene.isPaused).toBe(false);
    expect(audioEngine.calls).toContainEqual(['resumeBGM']);
    expect(mapStage.updateCalls).toHaveLength(1);
  });

  test('updates the map and recenters the camera while unpaused', () => {
    const camera = createCamera(100, 50);
    const { scene, mapStage } = createMapScene({ camera });
    const input = createInput();

    scene.update(0.25, input);

    expect(mapStage.updateCalls).toEqual([{ dt: 0.25, inputManager: input }]);
    expect(camera.x).toBe(150);
    expect(camera.y).toBe(75);
  });

  test('opens the map stage when confirm selects a node', () => {
    const { scene, mapStage } = createMapScene();
    const selected = [];
    scene.onStageSelected = (stageId) => selected.push(stageId);

    scene.update(0.1, createInput(['confirm']));

    expect(mapStage.selectNodeCalls).toBe(1);
    expect(selected).toEqual(['strawberry-fields']);
  });

  test('does not open a stage when confirm finds no selectable node', () => {
    const { scene, setSelectable } = createMapScene();
    const selected = [];
    scene.onStageSelected = (stageId) => selected.push(stageId);
    setSelectable(false);

    scene.update(0.1, createInput(['confirm']));

    expect(selected).toEqual([]);
  });

  test('does not open a stage when no callback is assigned', () => {
    const { scene } = createMapScene();

    expect(() => scene.update(0.1, createInput(['confirm']))).not.toThrow();
  });

  test('stops the map music on exit', () => {
    const { scene, audioEngine } = createMapScene();

    scene.exit();

    expect(audioEngine.calls).toEqual([['stopBGM']]);
  });

  test('renders the map through the camera and the pause menu only while paused', () => {
    const camera = createCamera(100, 50);
    const { scene, mapStage, pauseMenu } = createMapScene({ camera });
    const renderer = createRenderer();

    scene.render(renderer);

    expect(renderer.calls).toEqual([
      ['clear'],
      ['cameraTransform', camera],
      ['restoreCameraTransform']
    ]);
    expect(mapStage.renderCalls).toEqual([{ renderer, camera }]);
    expect(pauseMenu.renderCalls).toBe(0);

    scene.isPaused = true;
    renderer.calls.length = 0;
    scene.render(renderer);

    expect(pauseMenu.renderCalls).toBe(1);
  });

  test('renders without a camera', () => {
    const { scene, mapStage } = createMapScene({ camera: null });
    const renderer = createRenderer();

    scene.render(renderer);

    expect(renderer.calls).toEqual([['clear']]);
    expect(mapStage.renderCalls).toEqual([{ renderer, camera: null }]);
  });
});

describe('StageScene lifecycle', () => {
  test('activates the stage, plays its music and shows the intro once', () => {
    const camera = createCamera(100, 50);
    const dialogue = createDialogue();
    const { scene, stage, audioEngine } = createStageScene({ camera, dialogue });

    scene.enter();
    scene.exit();
    scene.enter();

    expect(audioEngine.calls).toEqual([
      ['playBGM', 'strawberry-fields'],
      ['stopBGM'],
      ['playBGM', 'strawberry-fields']
    ]);
    expect(stage.activateCalls).toBe(2);
    expect(stage.deactivateCalls).toBe(1);
    expect(dialogue.playSequenceCalls).toEqual(['intro']);
    expect(camera.follows).toEqual([{ target: stage.player, smoothing: 1 }]);
    expect(camera.constrainCalls).toBe(1);
  });

  test('plays the declared stage track when it differs from the stage name', () => {
    const { scene, audioEngine } = createStageScene({
      name: 'starfruit-caverns-branch',
      bgm: 'secret-waterfall'
    });

    scene.enter();

    expect(audioEngine.calls).toEqual([['playBGM', 'secret-waterfall']]);
  });

  test('works without audio, dialogue or camera', () => {
    const { scene } = createStageScene({ dialogue: null });

    expect(() => scene.enter()).not.toThrow();
    expect(() => scene.exit()).not.toThrow();
  });

  test('exposes the stage player', () => {
    const { scene, stage } = createStageScene();

    expect(scene.player).toBe(stage.player);
  });
});

describe('StageScene screen state', () => {
  test('notifies the stage-clear callback once', () => {
    const { scene, stage, screens } = createStageScene({ completed: true });
    const clears = [];
    scene.onStageClear = () => clears.push('clear');

    scene.update(0.1, createInput());
    scene.update(0.1, createInput());

    expect(scene.isStageClear).toBe(true);
    expect(clears).toEqual(['clear']);
    expect(screens.stageClear.updateCalls).toBe(2);
    expect(stage.updateCalls).toHaveLength(0);
  });

  test('does not notify stage clear before completion', () => {
    const { scene, screens } = createStageScene();
    const clears = [];
    scene.onStageClear = () => clears.push('clear');

    scene.update(0.1, createInput());

    expect(scene.isStageClear).toBe(false);
    expect(clears).toEqual([]);
    expect(screens.stageClear.updateCalls).toBe(0);
  });

  test('shows the game-over screen when lives are exhausted', () => {
    const { scene, stage, screens } = createStageScene({ livesExhausted: true });

    scene.update(0.1, createInput());

    expect(scene.isGameOver).toBe(true);
    expect(screens.gameOver.updateCalls).toBe(1);
    expect(stage.updateCalls).toHaveLength(0);
  });

  test('updates the stage and follows the player during play', () => {
    const camera = createCamera(100, 50);
    const { scene, stage } = createStageScene({ camera });
    const input = createInput();

    scene.update(0.25, input);

    expect(stage.updateCalls).toEqual([{ dt: 0.25, inputManager: input }]);
    expect(camera.follows).toEqual([{ target: stage.player, smoothing: 0.1 }]);
    expect(camera.constrainCalls).toBe(1);
  });

  test('blocks the stage while the dialogue plays', () => {
    const camera = createCamera(100, 50);
    const dialogue = createDialogue();
    dialogue.isActive = true;
    const { scene, stage } = createStageScene({ camera, dialogue });
    const input = createInput();

    scene.update(0.25, input);

    expect(dialogue.updateCalls).toEqual([{ dt: 0.25, inputManager: input }]);
    expect(stage.updateCalls).toHaveLength(0);
    expect(camera.follows).toEqual([{ target: stage.player, smoothing: 0.1 }]);
  });
});

describe('StageScene pause and inventory input', () => {
  test('toggles pause and pauses the music', () => {
    const { scene, stage, screens, audioEngine } = createStageScene();

    scene.update(0.1, createInput(['pause']));

    expect(scene.isPaused).toBe(true);
    expect(audioEngine.calls).toContainEqual(['pauseBGM']);
    expect(screens.pauseMenu.updateCalls).toBe(1);
    expect(stage.updateCalls).toHaveLength(0);

    scene.update(0.1, createInput(['pause']));

    expect(scene.isPaused).toBe(false);
    expect(audioEngine.calls).toContainEqual(['resumeBGM']);
    expect(stage.updateCalls).toHaveLength(1);
  });

  test('only toggles the music on a paused-state change', () => {
    const { scene, audioEngine } = createStageScene();

    scene.isPaused = true;
    scene.isPaused = true;
    scene.isPaused = false;
    scene.isPaused = false;

    expect(audioEngine.calls).toEqual([['pauseBGM'], ['resumeBGM']]);
  });

  test('opens and closes the inventory with select', () => {
    const { scene, inventoryUI, audioEngine } = createStageScene();

    scene.update(0.1, createInput(['select']));

    expect(scene.isInventoryOpen).toBe(true);
    expect(inventoryUI.inventory.isOpen).toBe(true);
    expect(audioEngine.calls).toContainEqual(['playSFX', 'inventory-open']);

    scene.update(0.1, createInput(['select']));

    expect(scene.isInventoryOpen).toBe(false);
    expect(inventoryUI.inventory.isOpen).toBe(false);
  });

  test('routes input to the inventory while it is open', () => {
    const { scene, inventoryUI, stage } = createStageScene();
    scene.update(0.1, createInput(['select']));

    scene.update(0.1, createInput());

    expect(inventoryUI.handleInputCalls).toBe(2);
    expect(stage.updateCalls).toHaveLength(0);
  });

  test('pause closes an open inventory instead of pausing the stage', () => {
    const { scene } = createStageScene();
    scene.update(0.1, createInput(['select']));

    scene.update(0.1, createInput(['pause']));

    expect(scene.isInventoryOpen).toBe(false);
    expect(scene.isPaused).toBe(false);
  });

  test('select and shoot use the default inventory item', () => {
    const { scene, inventoryUI, stage } = createStageScene();
    inventoryUI.inventory.defaultSelected = 'apple';

    scene.update(0.1, createInput(['select', 'shoot']));

    expect(inventoryUI.inventory.useCalls).toEqual(['apple']);
    expect(scene.isInventoryOpen).toBe(false);
    expect(stage.updateCalls).toHaveLength(1);
  });

  test('does not use an item when none is selected', () => {
    const { scene, inventoryUI } = createStageScene();

    scene.update(0.1, createInput(['select', 'shoot']));

    expect(inventoryUI.inventory.useCalls).toEqual([]);
  });

  test('does not use the default item while paused', () => {
    const { scene, inventoryUI } = createStageScene();
    inventoryUI.inventory.defaultSelected = 'apple';
    scene.isPaused = true;

    scene.update(0.1, createInput(['select', 'shoot']));

    expect(inventoryUI.inventory.useCalls).toEqual([]);
  });

  test('pause does not open the pause menu while the stage-clear screen is shown', () => {
    const { scene, stage, screens } = createStageScene({ completed: true });

    scene.update(0.1, createInput(['pause']));

    expect(scene.isPaused).toBe(false);
    expect(screens.pauseMenu.updateCalls).toBe(0);
    expect(screens.stageClear.updateCalls).toBe(1);
    expect(stage.updateCalls).toHaveLength(0);
  });

  test('select does not open the inventory while the stage-clear screen is shown', () => {
    const { scene, stage, screens, inventoryUI } = createStageScene({ completed: true });

    scene.update(0.1, createInput(['select']));

    expect(scene.isInventoryOpen).toBe(false);
    expect(inventoryUI.inventory.isOpen).toBe(false);
    expect(inventoryUI.handleInputCalls).toBe(0);
    expect(screens.stageClear.updateCalls).toBe(1);
    expect(stage.updateCalls).toHaveLength(0);
  });

  test('pause and select do not open overlays while the game-over screen is shown', () => {
    const { scene, stage, screens, inventoryUI } = createStageScene({ livesExhausted: true });

    scene.update(0.1, createInput(['pause', 'select']));

    expect(scene.isPaused).toBe(false);
    expect(scene.isInventoryOpen).toBe(false);
    expect(screens.pauseMenu.updateCalls).toBe(0);
    expect(inventoryUI.handleInputCalls).toBe(0);
    expect(screens.gameOver.updateCalls).toBe(1);
    expect(stage.updateCalls).toHaveLength(0);
  });

  test('confirm still reaches the stage-clear screen', () => {
    const { scene, screens } = createStageScene({ completed: true });

    scene.update(0.1, createInput(['confirm']));

    expect(screens.stageClear.updateCalls).toBe(1);
  });
});

describe('StageScene render', () => {
  test('renders the world through the camera, the flash and the HUD in order', () => {
    const camera = createCamera(100, 50);
    const screenClear = { isFlashing: true, flashAlpha: 0.4 };
    const dialogue = createDialogue();
    const { scene, stage, screens } = createStageScene({ camera, screenClear, dialogue });
    const renderer = createRenderer();

    scene.render(renderer);

    expect(renderer.calls).toEqual([
      ['clear'],
      ['cameraTransform', camera],
      ['restoreCameraTransform'],
      ['applyFlash', 0.4]
    ]);
    expect(stage.renderCalls).toBe(1);
    expect(stage.lastRenderer).toBe(renderer);
    expect(screens.hud.renderCalls).toBe(1);
    expect(dialogue.renderCalls).toBe(1);
  });

  test('renders without a camera or a flash', () => {
    const { scene, stage, screens } = createStageScene({ camera: null });
    const renderer = createRenderer();

    scene.render(renderer);

    expect(renderer.calls).toEqual([['clear']]);
    expect(stage.renderCalls).toBe(1);
    expect(screens.hud.renderCalls).toBe(1);
  });

  test('renders the end screens in preference to pause and inventory', () => {
    const { scene, screens } = createStageScene();
    const renderer = createRenderer();
    scene.isPaused = true;
    scene.isStageClear = true;

    scene.render(renderer);

    expect(screens.pauseMenu.renderCalls).toBe(0);
    expect(screens.stageClear.renderCalls).toBe(1);

    scene.isStageClear = false;
    scene.isGameOver = true;
    renderer.calls.length = 0;
    scene.render(renderer);

    expect(screens.pauseMenu.renderCalls).toBe(0);
    expect(screens.gameOver.renderCalls).toBe(1);
  });

  test('renders the end screen in preference to an open inventory', () => {
    const { scene, screens, inventoryUI } = createStageScene();
    const renderer = createRenderer();
    scene.update(0.1, createInput(['select']));
    scene.isStageClear = true;

    scene.render(renderer);

    expect(inventoryUI.renderCalls).toBe(0);
    expect(screens.stageClear.renderCalls).toBe(1);
  });

  test('renders the inventory overlay while it is open', () => {
    const { scene, screens, inventoryUI } = createStageScene();
    const renderer = createRenderer();
    scene.update(0.1, createInput(['select']));

    scene.render(renderer);

    expect(inventoryUI.renderCalls).toBe(1);
    expect(screens.pauseMenu.renderCalls).toBe(0);
  });

  test('renders the game-over screen', () => {
    const { scene, screens } = createStageScene({ livesExhausted: true });
    const renderer = createRenderer();
    scene.update(0.1, createInput());

    scene.render(renderer);

    expect(screens.gameOver.renderCalls).toBe(1);
    expect(screens.stageClear.renderCalls).toBe(0);
  });

  test('renders the stage-clear screen', () => {
    const { scene, screens } = createStageScene({ completed: true });
    const renderer = createRenderer();
    scene.update(0.1, createInput());

    scene.render(renderer);

    expect(screens.stageClear.renderCalls).toBe(1);
    expect(screens.gameOver.renderCalls).toBe(0);
  });
});
