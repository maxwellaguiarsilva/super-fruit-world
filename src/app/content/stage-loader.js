import { DataDriven, DialogueEngine, requireDependencies } from '../../engine/index.js';
import { NoteCollectionTracker } from '../../game/systems/note-collection-tracker.js';
import { Stage } from '../../game/stages/stage.js';
import { StageScene } from '../../game/scenes/scenes.js';
import { validateTileOverlaps } from '../../game/utils/tile-overlap-validator.js';

const STAGE_DATA_DIRECTORY = 'data/stages/';

const STAGE_LOADER_DEPENDENCIES = [
  'dataDriven',
  'textResolver',
  'dialogueConfig',
  'dispatcher',
  'player',
  'noteRangeConfig',
  'physicsEngine',
  'collisionSolver',
  'collectibleFactory',
  'projectileFactory',
  'damageSystem',
  'hud',
  'camera',
  'audioEngine',
  'sceneRouter',
  'uiBuilder',
  'navigation'
];

export function stageDataPath(stageDataId) {
  const path = stageDataId.startsWith('data/') ? stageDataId : STAGE_DATA_DIRECTORY + stageDataId;
  return path.endsWith('.json') ? path : path + '.json';
}

function stageSceneKey(stageDataId) {
  const path = stageDataPath(stageDataId);
  const fileName = path.slice(path.lastIndexOf('/') + 1);
  return fileName.replace(/\.json$/, '');
}

export class StageLoader {
  #deps;
  #loadedScenes;

  constructor(dependencies) {
    this.#deps = requireDependencies('StageLoader', dependencies, STAGE_LOADER_DEPENDENCIES);
    this.#loadedScenes = new Map();
  }

  load(stageDataId, { fresh = false } = {}) {
    const sceneKey = stageSceneKey(stageDataId);
    if (fresh) {
      this.#loadedScenes.delete(sceneKey);
    }
    const cached = this.#loadedScenes.get(sceneKey);
    if (cached) {
      return cached;
    }

    const { dataDriven, textResolver, dialogueConfig, dispatcher, player, noteRangeConfig, physicsEngine, collisionSolver, collectibleFactory, projectileFactory, damageSystem, hud, camera, audioEngine, sceneRouter, uiBuilder, navigation } = this.#deps;

    const stageConfig = DataDriven.toPlain(dataDriven[DataDriven.keyForDataPath(stageDataPath(stageDataId))]);
    const nc = new NoteCollectionTracker(noteRangeConfig);

    const stage = new Stage(stageConfig, {
      player,
      physicsEngine,
      collisionSolver,
      collectibleFactory,
      noteCollection: nc,
      projectileFactory,
      damageSystem,
      navigation
    });

    for (const section of stageConfig.sections ?? []) {
      dispatcher.dispatchSection(section, stage);
    }

    validateTileOverlaps(stage.tilesList, collisionSolver);

    stage.recomputeBounds();

    const { clearScreen, gameOverScreen: gos, pauseMenu: pm, inventoryUI: invUI } = uiBuilder.stageScreens({
      stageName: stageConfig.name,
      stageNameKey: stageConfig['display-name-key'] ?? null,
      bigFruit: stageConfig['big-fruit'] ?? null
    });

    gos.onConfirm = (action) => sceneRouter.dispatch(action);
    clearScreen.onConfirm = (action) => sceneRouter.dispatch(action);

    const dialogueEngine = new DialogueEngine(
      { sequences: stageConfig.dialogue ?? {}, layout: dialogueConfig.dialogue },
      textResolver
    );
    const scene = new StageScene(stage, hud, pm, gos, clearScreen, invUI, audioEngine, dialogueEngine, camera);

    pm.onConfirm = (action) => sceneRouter.dispatch(action);
    pm.onClose = () => sceneRouter.dispatch('resume');

    const loaded = { stage, scene, sceneKey };
    this.#loadedScenes.set(sceneKey, loaded);
    return loaded;
  }
}
