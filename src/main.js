import {
  GameLoop,
  SceneManager,
  Renderer,
  Camera,
  InputManager,
  PhysicsEngine,
  CollisionSolver,
  AudioEngine,
  NoteFrequencyCalculator,
  DataDriven,
  SaveSystem
} from './engine/index.js';

import { ProgressionSystem } from './game/systems/progression-system.js';
import { ScoreSystem } from './game/systems/score-system.js';
import { HealthSystem } from './game/systems/health-system.js';
import { DamageSystem } from './game/systems/damage-system.js';
import { NoteCollectionTracker } from './game/systems/note-collection-tracker.js';
import { Inventory } from './game/systems/inventory.js';

import { Player } from './game/entities/player.js';
import { PatrolEnemy, ShooterEnemy, FlyerEnemy, BossEnemy } from './game/entities/enemy-types.js';
import { Collectible } from './game/entities/collectible.js';
import { Tile } from './game/entities/tile.js';
import { Projectile } from './game/entities/projectile.js';

import { DashAbility } from './game/abilities/dash-ability.js';
import { ShootAbility } from './game/abilities/shoot-ability.js';
import { FlightAbility } from './game/abilities/flight-ability.js';
import { DoubleJumpAbility } from './game/abilities/double-jump-ability.js';
import { AirSlideAbility } from './game/abilities/air-slide-ability.js';
import { ScreenClearAbility } from './game/abilities/screen-clear-ability.js';
import { InvincibilityAbility } from './game/abilities/invincibility-ability.js';

import { Stage, Checkpoint } from './game/stages/stage.js';
import { InnerTeleporter, MapTeleporter, SpecialTeleporter, KeyDoor } from './game/stages/teleporters.js';
import { MapStage } from './game/map/map-stage.js';

import { TitleMenu, PauseMenu, SettingsMenu, GameOverScreen, StageClearScreen, InventoryUI, HUD } from './game/ui/ui-components.js';

import { TitleScene, StageScene, MapScene } from './game/scenes/scenes.js';

import { resolveColor, resolveConfig } from './game/utils/color-utils.js';

function accessorForDataPath(path) {
  return path.replace(/^data\//, '').replace(/\.json$/, '').replaceAll('/', '.');
}

function resolveTileType(obj, tileDataMap, colorsConfig, bordersConfig) {
  const type = obj.type ?? '';
  const tileData = tileDataMap[type] ?? {};
  const visual = obj.visual ?? {};
  const tileVisual = tileData.visual ?? {};

  const fillName = visual['fill-color'] ?? tileVisual['fill-color'] ?? null;
  const borderName = visual['border-color'] ?? tileVisual['border-color'] ?? null;
  const borderStyle = visual.border ?? tileVisual.border ?? null;
  const borderWidth = borderStyle && bordersConfig?.borders?.[borderStyle]
    ? bordersConfig.borders[borderStyle].width
    : (visual['border-width'] ?? 0);

  const collision = tileData.collision ?? {};
  const physics = tileData.physics ?? {};
  const damageData = tileData.damage ?? {};
  const tileVariant = obj.variant ?? null;
  const variantData = tileVariant ? (tileData.variants?.[tileVariant] ?? {}) : {};
  const slopeTypes = physics['slope-types'] ?? {};
  const slopeAngle = tileVariant ? (slopeTypes[tileVariant] ?? null) : null;

  return {
    type,
    solid: obj.solid ?? (tileData.type ? collision.solid !== false : (type !== 'decorative' && type !== 'pit' && type !== 'teleporter-marker')),
    deadly: obj.deadly ?? (damageData['on-contact'] === true || tileData.effect?.action === 'death'),
    'damage-value': obj['damage-value'] ?? variantData.damage ?? damageData.value ?? null,
    liquid: obj.liquid ?? (physics['gravity-multiplier'] !== undefined && physics['gravity-multiplier'] < 1 && physics['gravity-multiplier'] !== 0),
    climbable: obj.climbable ?? (collision.climbable === true),
    variant: tileVariant,
    inverted: obj.inverted ?? tileData.inverted ?? false,
    'slope-angle': slopeAngle,
    rendered: visual.rendered ?? tileVisual.rendered ?? true,
    'fill-color': resolveColor(fillName, colorsConfig) ?? resolveColor(tileVisual['fill-color'], colorsConfig) ?? '#404040',
    'border-color': resolveColor(borderName, colorsConfig) ?? resolveColor(tileVisual['border-color'], colorsConfig) ?? null,
    'border-width': borderWidth,
    'corner-radius': visual['corner-radius'] ?? tileVisual['corner-radius'] ?? 0.1,
    friction: obj.friction ?? physics.friction ?? null
  };
}

function resolveTileConfig(obj, colorsConfig) {
  const visual = obj.visual ?? {};
  const fillName = visual['fill-color'] ?? null;
  const borderName = visual['border-color'] ?? null;

  return {
    type: obj.type ?? '',
    solid: obj.solid ?? (obj.type !== 'decorative' && obj.type !== 'pit' && obj.type !== 'teleporter-marker'),
    deadly: obj.deadly ?? (obj.type === 'spike' || obj.type === 'pit'),
    liquid: obj.liquid ?? (obj.type === 'water'),
    climbable: obj.climbable ?? (obj.type === 'ladder'),
    variant: obj.variant ?? null,
    inverted: obj.inverted ?? false,
    'slope-angle': null,
    rendered: visual.rendered ?? true,
    'fill-color': resolveColor(fillName, colorsConfig) ?? '#404040',
    'border-color': resolveColor(borderName, colorsConfig) ?? null,
    'border-width': visual['border-width'] ?? 0,
    'corner-radius': visual['corner-radius'] ?? 0.1,
    friction: obj.friction ?? null
  };
}

function parseEnemyConfig(obj, enemyConfigData, colorsConfigData) {
  const typeName = obj.type ?? '';
  const parts = typeName.split('-');
  const shapeName = parts[0];
  const behavior = parts[1] ?? 'patrol';

  const shapeMap = enemyConfigData['shape-map'] ?? {};
  const shape = shapeMap[shapeName] ?? 3;

  const colorOrder = colorsConfigData['color-order'] ?? [];
  const colorIndex = colorOrder.indexOf(obj.color);
  const finalColorIndex = colorIndex !== -1 ? colorIndex : 1;

  const colorPalette = colorOrder.map((name) => resolveColor(name, colorsConfigData));

  return {
    shape,
    behavior,
    'color-index': finalColorIndex,
    'color-palette': colorPalette,
    'is-boss': obj['is-boss'] ?? false,
    'patrol-range': obj['patrol-range'] ?? 3,
    'damage-output': obj['damage-output'] ?? null,
    'drop-table': obj['drop-table'] ?? [],
    'fire-rate': obj['fire-rate'] ?? null,
    'projectile-speed': obj['projectile-speed'] ?? null,
    'detection-range': obj['detection-range'] ?? null
  };
}

function createEnemyFactory() {
  return function (config, stage) {
    const behavior = config.behavior ?? 'patrol';

    if (config['is-boss']) {
      return new BossEnemy(config, stage);
    }

    switch (behavior) {
      case 'shooter':
        return new ShooterEnemy(config, stage);
      case 'flyer':
        return new FlyerEnemy(config, stage);
      default:
        return new PatrolEnemy(config, stage);
    }
  };
}

function createCollectibleFactory() {
  return function (config) {
    const w = config.size?.width ?? 0.5;
    const h = config.size?.height ?? 0.5;
    return new Collectible(0, 0, w, h, config);
  };
}

function buildMenuSubConfig(menuConfig, screenKey, colorsConfig) {
  const defaults = menuConfig['menu-defaults'] ?? {};
  const screen = menuConfig.menus?.[screenKey] ?? {};

  const titleDefaults = defaults.title ?? {};
  const titleOverrides = screen.title ?? {};
  const titleConfig = { ...titleDefaults, ...titleOverrides };

  const buttons = screen.buttons ?? [];
  const buttonDefaults = defaults.button ?? {};

  const subtitleDefaults = defaults.subtitle ?? {};
  const hintDefaults = defaults.hint ?? {};

  return {
    items: buttons.map((b) => ({
      label: b['label-key'] ?? b.label ?? '',
      action: b.action ?? ''
    })),
    visible: screen.visible !== false,
    'title-key': screen['title-key'] ?? null,
    'start-offset': screen['start-offset'] ?? { x: 0, y: 0 },
    'title-color': resolveColor(titleConfig.color, colorsConfig) ?? '#FFFFFF',
    'title-font-size': titleConfig['font-size'] ?? 0.6,
    'title-anchor': titleConfig.anchor ?? 'top-center',
    'font-family': defaults['font-family'] ?? 'monospace',
    button: resolveConfig(buttonDefaults, colorsConfig)
  };
}

function resolveHudConfig(hudConfig, colorsConfig) {
  return resolveConfig(hudConfig, colorsConfig);
}

function resolveInventoryUIConfig(invUIConfig, colorsConfig) {
  return resolveConfig(invUIConfig, colorsConfig);
}

async function bootstrap() {
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
    audioBgmConfig[trackName] = DataDriven.toPlain(dataDriven[accessorForDataPath(filePath)]);
  }
  const audioTuningConfig = DataDriven.toPlain(dataDriven['audio.synthesis']);
  const inputBindings = DataDriven.toPlain(dataDriven['input.bindings']);

  const tileTypes = gameConfig['tile-types'] ?? [];
  const tileDataMap = {};
  for (const tileType of tileTypes) {
    const tileData = dataDriven['tiles.' + tileType];
    if (tileData) {
      tileDataMap[tileType] = DataDriven.toPlain(tileData);
    }
  }

  const noteCalculator = new NoteFrequencyCalculator(audioTuningConfig.tuning);
  const audioEngine = new AudioEngine(audioConfig, audioSfxConfig, audioBgmConfig, noteCalculator);

  ['click', 'keydown'].forEach((evt) => {
    document.addEventListener(evt, () => { audioEngine.init(); }, { once: true });
  });

  const renderer = new Renderer('#game-canvas', { unitHeight: 10 });
  const camera = new Camera();
  camera.setSize(renderer.viewportWidth, renderer.viewportHeight);

  const inputManager = new InputManager(inputBindings);

  const physicsConfig = gameConfig.physics ?? {
    gravity: 15.0,
    'max-fall-speed': 20.0,
    friction: 0.75,
    'walk-speed': 5.0,
    'walk-acceleration': 15.0,
    'jump-velocity': 10.0
  };
  const physicsEngine = new PhysicsEngine(physicsConfig);

  const collisionSolver = new CollisionSolver();
  const saveSystem = new SaveSystem(gameConfig['save-namespace'] ?? 'save');

  const progressionSystem = new ProgressionSystem(levelsConfig, fruitsConfig, colorsConfig);
  const scoreSystem = new ScoreSystem();

  const healthConfig = gameConfig.health ?? {};
  const healthSystem = new HealthSystem(healthConfig);

  const damageSystem = new DamageSystem(gameConfig.damage ?? {});

  const noteScale = audioTuningConfig['musical-note-scale'] ?? [];
  const noteRangeConfig = {
    lowest: noteScale.length > 0 ? noteScale[0] : (audioTuningConfig.tuning?.['note-range']?.lowest ?? 'c4'),
    count: noteScale.length > 0 ? noteScale.length : 8
  };
  const noteCollection = new NoteCollectionTracker(noteRangeConfig);

  const inventoryConfig = gameConfig.inventory ?? { 'max-slots': 8 };
  const inventory = new Inventory(inventoryConfig);

  const playerCfg = gameConfig.player ?? {};
  const playerConfig = {
    size: playerCfg.size ?? 1.0,
    'starting-level': playerCfg['starting-level'] ?? 0,
    'starting-color': resolveColor(playerCfg['starting-color'] ?? 'black', colorsConfig) ?? '#000000',
    'walk-speed': physicsConfig['walk-speed'],
    'walk-acceleration': physicsConfig['walk-acceleration'],
    'jump-velocity': physicsConfig['jump-velocity']
  };

  const abilities = [];
  const abilitiesData = abilitiesConfig.abilities ?? {};
  for (const [name, config] of Object.entries(abilitiesData)) {
    const type = config.type ?? name;
    const fullConfig = { name, ...config };
    switch (type) {
      case 'dash': abilities.push(new DashAbility(fullConfig)); break;
      case 'shoot': abilities.push(new ShootAbility(fullConfig)); break;
      case 'flight': abilities.push(new FlightAbility(fullConfig)); break;
      case 'double-jump': abilities.push(new DoubleJumpAbility(fullConfig)); break;
      case 'air-slide': abilities.push(new AirSlideAbility(fullConfig)); break;
      case 'screen-clear': abilities.push(new ScreenClearAbility(fullConfig)); break;
      case 'invincibility': abilities.push(new InvincibilityAbility(fullConfig)); break;
    }
  }

  const player = new Player(playerConfig, inputManager, physicsEngine, abilities, inventory, healthSystem);
  player.scoreSystem = scoreSystem;
  player.progressionSystem = progressionSystem;
  player.noteCollection = noteCollection;

  const menuConfig = DataDriven.toPlain(dataDriven['ui.menus']);
  const hudConfig = resolveHudConfig(dataDriven['ui.hud'], colorsConfig);
  const inventoryUIConfig = resolveInventoryUIConfig(dataDriven['ui.inventory'], colorsConfig);

  const titleMenu = new TitleMenu(buildMenuSubConfig(menuConfig, 'title-screen', colorsConfig), dataDriven);
  const pauseMenu = new PauseMenu(buildMenuSubConfig(menuConfig, 'pause-menu', colorsConfig), dataDriven, null);
  const settingsMenu = new SettingsMenu(buildMenuSubConfig(menuConfig, 'settings', colorsConfig), dataDriven, audioEngine);
  const gameOverScreen = new GameOverScreen(buildMenuSubConfig(menuConfig, 'game-over', colorsConfig), dataDriven, healthSystem.continues, healthSystem.lives);
  const stageClearScreen = new StageClearScreen(buildMenuSubConfig(menuConfig, 'stage-clear', colorsConfig), dataDriven, '', '', '', 0);
  const inventoryUI = new InventoryUI(inventoryUIConfig, inventory, dataDriven);
  const hud = new HUD(hudConfig, player, noteCollection, dataDriven);

  const sceneManager = new SceneManager();
  const gameLoop = new GameLoop(60, sceneManager, inputManager, renderer);

  const titleScene = new TitleScene(titleMenu, audioEngine);

  const enemyFactory = createEnemyFactory();
  const collectibleFactory = createCollectibleFactory();

  const projectileConfig = gameConfig.projectile ?? {
    size: 0.25,
    'max-travel': 20,
    'enemy-color': resolveColor('red', colorsConfig),
    'player-color': resolveColor('green', colorsConfig)
  };
  projectileConfig['enemy-color'] = projectileConfig['enemy-color'] ?? resolveColor('red', colorsConfig) ?? '#BF4040';
  projectileConfig['player-color'] = projectileConfig['player-color'] ?? resolveColor('green', colorsConfig) ?? '#40BF40';

  function createStageFromData(stageDataId) {
    const stageConfig = DataDriven.toPlain(dataDriven[accessorForDataPath(stageDataId)]);
    const nc = new NoteCollectionTracker(noteRangeConfig);
    player.noteCollection = nc;

    const stage = new Stage(stageConfig, player, physicsEngine, collisionSolver, collectibleFactory, enemyFactory, nc, projectileConfig);

    for (const section of stageConfig.sections ?? []) {
      const worldPos = stage.resolveWorldPosition(section.name, { x: 0, y: 0 });

      for (const obj of section.objects ?? []) {
        let x = worldPos.x + (obj.position?.x ?? 0);
        let y = worldPos.y + (obj.position?.y ?? 0);

        const shapeMap = enemyConfigData['shape-map'] ?? {};
        const isEnemy = obj.type && Object.keys(shapeMap).some(shape => obj.type.startsWith(shape + '-'));
        const tileTypesSet = new Set(gameConfig['tile-types'] ?? []);
        const isTile = tileTypesSet.has(obj.type);

        if (isTile) {
          const tileConfig = tileDataMap[obj.type]
            ? resolveTileType(obj, tileDataMap, colorsConfig, bordersConfig)
            : resolveTileConfig(obj, colorsConfig);
          const w = obj.size?.width ?? 1;
          const h = obj.size?.height ?? 1;
          const tile = new Tile(x, y, w, h, tileConfig);
          stage.addEntity(tile);
          stage.tilesList = stage.tilesList ?? [];
          stage.tilesList.push(tile);
        } else if (isEnemy) {
          const enemyConfig = parseEnemyConfig(obj, enemyConfigData, colorsConfig);
          const enemy = enemyFactory(enemyConfig, stage);
          enemy.x = x;
          enemy.y = y;
          stage.addEntity(enemy);
          stage.enemiesList = stage.enemiesList ?? [];
          stage.enemiesList.push(enemy);
        } else if (obj.type === 'player-spawn') {
          stage.spawnPoint = { x, y };
          player.x = x;
          player.y = y - 1;
        } else if (obj.type === 'checkpoint') {
          const cpIndex = stage.checkpointCount ?? 0;
          stage.checkpointCount = cpIndex + 1;
          const cp = new Checkpoint(x, y, 1, 1, cpIndex + 1, {});
          stage.addEntity(cp);
          stage.checkpointsList = stage.checkpointsList ?? [];
          stage.checkpointsList.push(cp);
        } else if (obj.type === 'teleporter-marker' || obj.type === 'inner-teleporter' || obj.type === 'special-teleporter') {
          const marker = new InnerTeleporter(obj.name ?? 'unnamed', x, y, obj['target-marker'] ?? '');
          if (obj.type === 'inner-teleporter' || obj.type === 'special-teleporter') {
            stage.addTeleporter(marker);
          }
        } else {
          const baseConfig = DataDriven.toPlain(dataDriven['collectibles.' + (obj.type ?? '')]);
          const colConfig = {
            ...baseConfig,
            ...obj,
            size: obj.size ?? baseConfig.visual?.size ?? { width: 0.5, height: 0.5 },
            'fill-color': resolveColor(obj.visual?.['fill-color'] ?? baseConfig.visual?.['fill-color'] ?? obj.fruit, colorsConfig) ?? '#BFBF40',
            'note-order': obj['note-order'] ?? null,
            'auto-use': obj['auto-use'] ?? baseConfig.effect?.['auto-activate'] ?? baseConfig['auto-use'] ?? true
          };
          const col = collectibleFactory(colConfig);
          col.x = x;
          col.y = y;
          col.stage = stage;
          stage.addEntity(col);
          stage.collectiblesList = stage.collectiblesList ?? [];
          stage.collectiblesList.push(col);
        }
      }
    }

    let minX = 0;
    let minY = 0;
    let maxX = 0;
    let maxY = 0;
    for (const entity of stage.entities) {
      const left = entity.x;
      const top = entity.y;
      const right = entity.x + (entity.width || 1);
      const bottom = entity.y + (entity.height || 1);
      if (left < minX) { minX = left; }
      if (top < minY) { minY = top; }
      if (right > maxX) { maxX = right; }
      if (bottom > maxY) { maxY = bottom; }
    }
    stage.reconfigureBounds(minX, minY, maxX - minX, maxY - minY);

    const clearScreen = new StageClearScreen(buildMenuSubConfig(menuConfig, 'stage-clear', colorsConfig), dataDriven, stageConfig.name ?? '', '', '', 0);
    const gos = new GameOverScreen(buildMenuSubConfig(menuConfig, 'game-over', colorsConfig), dataDriven, healthSystem.continues, healthSystem.lives);
    const pm = new PauseMenu(buildMenuSubConfig(menuConfig, 'pause-menu', colorsConfig), dataDriven, stage);
    const invUI = new InventoryUI(inventoryUIConfig, inventory, dataDriven);

    const scene = new StageScene(stage, hud, pm, gos, clearScreen, invUI, audioEngine);
    scene.camera = camera;

    pm.onConfirm = (action) => {
      if (action === 'resume') {
        scene.isPaused = false;
      } else if (action === 'quit-to-menu') {
        scene.isPaused = false;
        sceneManager.switchTo('title');
      }
    };
    pm.onClose = () => {
      scene.isPaused = false;
    };

    return { stage, scene };
  }

  titleMenu.onConfirm = (action) => {
    if (action === 'start-game') {
      const initialStage = gameConfig['initial-stage'] ?? '';
      const { scene } = createStageFromData(initialStage);
      sceneManager.registerScene('stage-01', scene);
      sceneManager.switchTo('stage-01');
    }
  };

  window.__sceneManager = sceneManager;
  sceneManager.registerScene('title', titleScene);
  sceneManager.switchTo('title');

  gameLoop.start();
}

bootstrap().catch((err) => {
  document.body.innerHTML = `<pre style="color:#BF4040;font-family:'Comic Sans MS','Comic Sans',monospace;padding:20px;">BOOT ERROR:\n${err.message}\n\n${err.stack}</pre>`;
});
