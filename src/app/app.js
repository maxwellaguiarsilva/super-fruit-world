import {
  GameLoop,
  Renderer,
  Camera,
  InputManager,
  PhysicsEngine,
  CollisionSolver,
  AudioEngine,
  NoteFrequencyCalculator,
  DataDriven,
  TextResolver,
  SaveSystem,
  SettingsStore,
  restoreAudioSettings
} from '../engine/index.js';

import {
  ProgressionSystem,
  ProgressStore,
  applyProgressToMapConfig,
  withUnlockedStages
} from '../game/systems/progression-system.js';
import { ScoreSystem } from '../game/systems/score-system.js';
import { HealthSystem } from '../game/systems/health-system.js';
import { DamageSystem } from '../game/systems/damage-system.js';
import { Inventory } from '../game/systems/inventory.js';
import { ItemEffects } from '../game/systems/item-effects.js';

import { Player } from '../game/entities/player.js';

import { TitleScene, SettingsScene, InfoScene, MapScene } from '../game/scenes/scenes.js';
import { MapStage } from '../game/map/map-stage.js';

import { resolveColor, resolveConfig } from '../game/utils/color-utils.js';

import { SceneRouter } from './navigation/scene-router.js';
import { ProgressWriter } from './state/progress-writer.js';
import { StageLoader, stageDataPath } from './content/stage-loader.js';
import { ObjectDispatcher } from './content/object-dispatcher.js';
import { collectItemUsage } from './content/item-usage.js';
import { UiBuilder } from './factories/ui-builder.js';
import { createEnemyFactory } from './factories/enemy-factory.js';
import { createCollectibleFactory } from './factories/collectible-factory.js';
import { createAbilities } from './factories/ability-factory.js';
import { createProjectileFactory } from './factories/projectile-factory.js';

export class App {
  async start() {
    const dataDriven = DataDriven.create('/', '/data/index.json');
    await dataDriven.load();

    const gameConfig = dataDriven['game-config'];
    const colorsConfig = dataDriven['colors'];
    const bordersConfig = dataDriven['borders'];
    const enemyConfigData = dataDriven['enemies.config'];
    const levelsConfig = DataDriven.toPlain(dataDriven['player.levels']);
    const fruitsConfig = DataDriven.toPlain(dataDriven['player.fruits']);
    const abilitiesConfig = dataDriven['player.abilities'];
    const audioConfig = DataDriven.toPlain(dataDriven['audio.config']);
    const audioSfxConfig = DataDriven.toPlain(dataDriven['audio.sfx']);
    const audioBgmIndex = dataDriven['audio.bgm'];
    const audioBgmConfig = {};
    for (const [trackName, filePath] of Object.entries(audioBgmIndex.tracks)) {
      audioBgmConfig[trackName] = DataDriven.toPlain(dataDriven[DataDriven.keyForDataPath(filePath)]);
    }
    const audioTuningConfig = DataDriven.toPlain(dataDriven['audio.synthesis']);
    const inputBindings = DataDriven.toPlain(dataDriven['input.bindings']);
    const menuConfig = DataDriven.toPlain(dataDriven['ui.menus']);

    const tileTypes = gameConfig['tile-types'] ?? [];
    const tileDataMap = {};
    for (const tileType of tileTypes) {
      const tileData = dataDriven['tiles.' + tileType];
      if (tileData) {
        tileDataMap[tileType] = DataDriven.toPlain(tileData);
      }
    }

    const textResolver = new TextResolver((key) => dataDriven['i18n.default.' + key]);

    const noteCalculator = new NoteFrequencyCalculator(audioTuningConfig.tuning);
    const audioEngine = new AudioEngine(audioConfig, audioSfxConfig, audioBgmConfig, noteCalculator, audioTuningConfig['default-envelope']);

    ['click', 'keydown'].forEach((evt) => {
      document.addEventListener(evt, () => { audioEngine.init(); }, { once: true });
    });

    const unitHeight = gameConfig['visual-unit'].value;
    const viewportPercent = gameConfig.canvas['viewport-percent'];
    const updateRate = gameConfig.loop?.['update-rate'];

    const renderer = new Renderer('#game-canvas', { unitHeight, viewportPercent });
    const camera = new Camera();
    camera.setSize(renderer.viewportWidth, renderer.viewportHeight);

    const inputManager = new InputManager(inputBindings);

    const physicsConfig = gameConfig.physics;
    const physicsEngine = new PhysicsEngine(physicsConfig);

    const collisionSolver = new CollisionSolver();
    const saveSystem = new SaveSystem(gameConfig['save-namespace'] ?? 'save');

    const settingsMenuConfig = UiBuilder.buildMenuSubConfig(menuConfig, 'settings', colorsConfig);
    const settingKeys = settingsMenuConfig.sliders
      .map((slider) => slider['setting-key'])
      .filter((settingKey) => typeof settingKey === 'string' && settingKey.length > 0);
    const settingsStore = new SettingsStore(saveSystem);
    const audioSettings = restoreAudioSettings({
      engine: audioEngine,
      store: settingsStore,
      settingKeys
    });

    const progressStore = new ProgressStore(saveSystem);
    const savedProgress = progressStore.load();
    const progress = savedProgress ?? {
      completedStageIds: [],
      unlockedStageIds: [],
      lastStageId: null
    };

    const progressionSystem = new ProgressionSystem(levelsConfig, fruitsConfig, colorsConfig);
    const scoreSystem = new ScoreSystem();

    const healthConfig = gameConfig.health;
    const healthSystem = new HealthSystem(healthConfig);

    const damageSystem = new DamageSystem(gameConfig.damage ?? {});

    const noteScale = audioTuningConfig['musical-note-scale'];
    const noteRangeConfig = {
      lowest: noteScale[0],
      count: noteScale.length,
      notes: noteScale
    };

    const inventoryConfig = gameConfig.inventory;
    let player = null;
    const itemEffects = new ItemEffects({
      healthSystem,
      getPlayer: () => player
    });
    const inventory = new Inventory(inventoryConfig, {
      audioEngine,
      usage: collectItemUsage(dataDriven),
      effects: itemEffects
    });

    const playerCfg = gameConfig.player ?? {};
    const playerConfig = {
      size: playerCfg.size ?? 1.0,
      'starting-level': playerCfg['starting-level'] ?? 0,
      'starting-color': resolveColor(playerCfg['starting-color'] ?? 'black', colorsConfig) ?? '#000000',
      'walk-speed': physicsConfig['walk-speed'],
      'walk-acceleration': physicsConfig['walk-acceleration'],
      'jump-velocity': physicsConfig['jump-velocity']
    };

    const projectileConfig = resolveConfig(gameConfig.projectile, colorsConfig);
    const projectileFactory = createProjectileFactory(projectileConfig);
    const abilities = createAbilities(abilitiesConfig, { projectileFactory });

    player = new Player({
      playerConfig,
      abilities,
      inventory,
      healthSystem,
      scoreSystem,
      progressionSystem,
      audioEngine,
      stage: null
    });

    if (savedProgress) {
      scoreSystem.addScore(savedProgress.score);
      player.level = Math.min(savedProgress.level, progressionSystem.maxLevel);
      const restoredColor = resolveColor(progressionSystem.getColorForLevel(player.level), colorsConfig);
      if (restoredColor) {
        player.color = restoredColor;
      }
      for (const item of savedProgress.inventory.items) {
        inventory.add(item.name, item.count);
      }
      inventory.defaultSelected = savedProgress.inventory.defaultSelected;
    }

    const dialogueConfig = resolveConfig(DataDriven.toPlain(dataDriven['ui.dialogue']), colorsConfig);
    const uiBuilder = new UiBuilder({
      textResolver,
      menuConfig,
      hudConfig: dataDriven['ui.hud'],
      inventoryConfig: dataDriven['ui.inventory'],
      colorsConfig,
      bordersConfig,
      inventory,
      player,
      scoreSystem,
      progressionSystem,
      healthSystem
    });

    const hud = uiBuilder.hud(player);

    const progressWriter = new ProgressWriter({
      store: progressStore,
      buildSnapshot: (value) => ({
        completedStageIds: value.completedStageIds,
        unlockedStageIds: value.unlockedStageIds,
        lastStageId: value.lastStageId,
        score: scoreSystem.score,
        level: player.level,
        inventory: {
          items: inventory.slots.map((slot) => ({ name: slot.name, count: slot.count })),
          defaultSelected: inventory.defaultSelected
        }
      })
    });

    const sceneRouter = new SceneRouter();
    const gameLoop = new GameLoop(updateRate, sceneRouter, inputManager, renderer);

    const titleMenu = uiBuilder.titleMenu();
    titleMenu.onConfirm = (action) => sceneRouter.dispatch(action);
    const titleScene = new TitleScene(titleMenu, audioEngine);

    const settingsMenu = uiBuilder.settingsMenu(audioSettings);
    settingsMenu.onConfirm = (action) => sceneRouter.dispatch(action);
    settingsMenu.onClose = () => sceneRouter.dispatch('back');
    const settingsScene = new SettingsScene(settingsMenu);

    for (const screenKey of ['tutorial', 'show-credits', 'open-controls']) {
      const infoScreen = uiBuilder.infoScreen(screenKey);
      infoScreen.onClose = () => sceneRouter.dispatch('back');
      sceneRouter.registerScene(screenKey, new InfoScene(screenKey, infoScreen));
    }

    const enemyFactory = createEnemyFactory({ projectileFactory });
    const collectibleFactory = createCollectibleFactory();

    const dispatcher = new ObjectDispatcher({
      dataDriven,
      gameConfig,
      tileDataMap,
      enemyConfigData,
      colorsConfig,
      bordersConfig,
      enemyFactory,
      collectibleFactory,
      player
    });

    const stageLoader = new StageLoader({
      dataDriven,
      textResolver,
      dialogueConfig,
      dispatcher,
      player,
      noteRangeConfig,
      physicsEngine,
      collisionSolver,
      collectibleFactory,
      projectileFactory,
      damageSystem,
      hud,
      camera,
      audioEngine,
      sceneRouter,
      uiBuilder,
      navigation: {
        navigate: (sceneName) => leaveTo(sceneName)
      }
    });

    let currentStageId = null;
    let inStage = false;

    const persistProgress = () => progressWriter.save(progress);

    const handleStageClear = (stageId) => {
      Object.assign(progress, progressWriter.completeStage(progress, stageId, mapConfig, inventory.slots));
      refreshMap();
    };

    const openStage = (stageDataId) => {
      currentStageId = stageDataId;
      const { scene, sceneKey } = stageLoader.load(stageDataId, { fresh: true });
      progress.lastStageId = sceneKey;
      inStage = true;
      scene.onStageClear = () => handleStageClear(sceneKey);
      sceneRouter.registerScene(sceneKey, scene);
      sceneRouter.switchTo(sceneKey);
      return sceneKey;
    };

    const resumeCurrentScene = () => {
      const scene = sceneRouter.currentScene;
      if (scene && typeof scene.isPaused === 'boolean') {
        scene.isPaused = false;
      }
    };

    const leaveTo = (target) => {
      if (inStage) {
        inStage = false;
        persistProgress();
      }
      if (sceneRouter.currentSceneName === target) {
        resumeCurrentScene();
        return;
      }
      resumeCurrentScene();
      if (target === 'map') {
        refreshMap();
      }
      sceneRouter.switchTo(target);
    };

    const resetHealth = () => {
      healthSystem.life = healthSystem.maxLife;
      if (healthSystem.lives <= 0) {
        healthSystem.lives = healthConfig['starting-lives'] ?? 1;
      }
    };

    const restartCurrentStage = () => {
      if (!currentStageId) {
        console.error('[menu] Cannot perform action "restart-stage": no stage has been loaded.');
        return;
      }
      resetHealth();
      openStage(currentStageId);
    };

    const continueAfterGameOver = () => {
      if (!currentStageId) {
        console.error('[menu] Cannot perform action "continue": no stage has been loaded.');
        return;
      }
      if (healthSystem.continues > 0) {
        healthSystem.useContinue();
      } else {
        resetHealth();
      }
      openStage(currentStageId);
    };

    const dataFiles = dataDriven.all;
    const hasStageData = (stageDataId) => dataFiles.has(stageDataPath(stageDataId));

    const mapConfig = DataDriven.toPlain(dataDriven['map.fruit-world']);
    const missingStageIds = [...new Set(
      (mapConfig.sections ?? [])
        .flatMap((section) => section.objects ?? [])
        .filter((object) => object.type === 'stage-node' && object['stage-id'])
        .map((object) => object['stage-id'])
        .filter((stageId) => !hasStageData(stageId))
    )];
    if (missingStageIds.length > 0) {
      console.warn(
        `[map] No stage data file for: ${missingStageIds.join(', ')}. The matching map nodes are not selectable.`
      );
    }

    progress.unlockedStageIds = withUnlockedStages(progress, mapConfig, inventory.slots).unlockedStageIds;

    const buildMapScene = () => {
      const mapProgress = {
        ...progress,
        inventory: { items: inventory.slots }
      };
      const mapStage = new MapStage(applyProgressToMapConfig(mapConfig, mapProgress), player, {
        hasStageData,
        resolveText: (textKey) => textResolver.text(textKey),
        preferredStageId: progress.lastStageId
      });
      const mapPauseMenu = uiBuilder.pauseMenu();
      mapPauseMenu.onConfirm = (action) => sceneRouter.dispatch(action);
      mapPauseMenu.onClose = () => sceneRouter.dispatch('resume');
      const mapCamera = new Camera();
      mapCamera.setSize(renderer.viewportWidth, renderer.viewportHeight);
      const mapScene = new MapScene(mapStage, mapPauseMenu, audioEngine, mapCamera);
      mapScene.onStageSelected = (stageId) => {
        openStage(stageId);
      };
      return mapScene;
    };

    const refreshMap = () => {
      sceneRouter.registerScene('map', buildMapScene());
    };

    const resolveStartStage = () => {
      if (progress.lastStageId && hasStageData(progress.lastStageId)) {
        return progress.lastStageId;
      }
      return gameConfig['initial-stage'] ?? '';
    };

    sceneRouter.registerActions({
      'start-game': () => openStage(resolveStartStage()),
      'tutorial': () => sceneRouter.openModal('tutorial'),
      'open-settings': () => sceneRouter.openModal('settings'),
      'show-credits': () => sceneRouter.openModal('show-credits'),
      'open-controls': () => sceneRouter.openModal('open-controls'),
      'back': () => sceneRouter.closeModal(),
      'resume': resumeCurrentScene,
      'restart-stage': restartCurrentStage,
      'quit-to-map': () => leaveTo('map'),
      'quit-to-menu': () => leaveTo('title'),
      'continue': continueAfterGameOver,
      'continue-to-map': () => leaveTo('map')
    });

    sceneRouter.registerScene('settings', settingsScene);
    refreshMap();
    sceneRouter.registerScene('title', titleScene);
    sceneRouter.switchTo(savedProgress ? 'map' : 'title');

    gameLoop.start();
  }
}
