import { DataDriven, requireDependencies } from '../../engine/index.js';
import { Tile } from '../../game/entities/tile.js';
import { Checkpoint } from '../../game/stages/stage.js';
import { TeleporterMarker, InnerTeleporter, MapTeleporter, SpecialTeleporter, KeyDoor } from '../../game/stages/teleporters.js';
import { resolveColor } from '../../game/utils/color-utils.js';
import { resolveTileType } from './tile-config.js';
import { parseEnemyConfig } from './enemy-config.js';
import { createKindRegistry } from './kind-registry.js';
import { collectibleTypeFromPath } from './collectible-type.js';

function createTile(deps, stage, obj, x, y) {
  const { tileDataMap, colorsConfig, bordersConfig } = deps;
  const tileConfig = resolveTileType(obj, tileDataMap, colorsConfig, bordersConfig);
  const width = obj.size?.width ?? 1;
  const height = obj.size?.height ?? 1;
  stage.addEntity(new Tile(x, y, width, height, tileConfig));
}

function createEnemy(deps, stage, obj, x, y) {
  const { enemyConfigData, colorsConfig, enemyFactory } = deps;
  const enemyConfig = parseEnemyConfig(obj, enemyConfigData, colorsConfig);
  const enemy = enemyFactory(enemyConfig, stage);
  enemy.x = x;
  enemy.y = y;
  stage.addEntity(enemy);
}

function createPlayerSpawn(deps, stage, obj, x, y) {
  const { player } = deps;
  stage.spawnPoint = { x, y };
  player.x = x;
  player.y = y - 1;
}

function createCheckpoint(deps, stage, obj, x, y) {
  const index = stage.checkpointCount + 1;
  stage.addEntity(new Checkpoint(x, y, 1, 1, index, {}));
}

function createTeleporterMarker(deps, stage, obj, x, y) {
  stage.addEntity(new TeleporterMarker(obj.name ?? 'unnamed', x, y));
}

function createInnerTeleporter(deps, stage, obj, x, y) {
  stage.addTeleporter(new InnerTeleporter(obj.name ?? 'unnamed', x, y, obj['target-marker'] ?? ''));
}

function createSpecialTeleporter(deps, stage, obj, x, y) {
  const teleporter = new SpecialTeleporter(
    obj.name ?? 'unnamed',
    x,
    y,
    obj['target-marker'] ?? '',
    obj['target-stage'] ?? null
  );
  stage.addTeleporter(teleporter);
}

function createMapTeleporter(deps, stage, obj, x, y) {
  stage.addTeleporter(new MapTeleporter(obj.name ?? 'unnamed', x, y, obj['target-marker'] ?? ''));
}

function createKeyDoor(deps, stage, obj, x, y) {
  const requiredKey = obj['required-key'] ?? obj.effect?.['required-key'] ?? null;
  const door = new KeyDoor(
    obj.name ?? 'unnamed',
    x,
    y,
    obj['target-marker'] ?? '',
    obj['target-stage'] ?? null,
    requiredKey,
    { inventory: deps.player.inventory }
  );
  stage.addTeleporter(door);
}

function createCollectible(deps, stage, obj, x, y) {
  const { dataDriven, collectibleFactory, colorsConfig } = deps;
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
  stage.addEntity(col);
}

const OBJECT_KIND_ENTRIES = [
  ['tile', { family: 'tile-types', create: createTile }],
  ['enemy', { family: 'enemy-shapes', create: createEnemy }],
  ['collectible', { family: 'collectible-types', create: createCollectible }],
  ['player-spawn', { create: createPlayerSpawn }],
  ['checkpoint', { create: createCheckpoint }],
  ['teleporter-marker', { create: createTeleporterMarker }],
  ['inner-teleporter', { create: createInnerTeleporter }],
  ['special-teleporter', { create: createSpecialTeleporter }],
  ['map-teleporter', { create: createMapTeleporter }],
  ['key-door', { create: createKeyDoor }]
];

const FAMILY_TYPES = {
  'tile-types': (deps) => deps.gameConfig['tile-types'] ?? [],
  'enemy-shapes': (deps) => Object.keys(deps.enemyConfigData['shape-map'] ?? {}),
  'collectible-types': (deps) => {
    const types = [];
    for (const path of deps.dataDriven.all.keys()) {
      const type = collectibleTypeFromPath(path);
      if (type !== null) {
        types.push(type);
      }
    }
    return types;
  }
};

const OBJECT_DISPATCHER_DEPENDENCIES = [
  'dataDriven',
  'gameConfig',
  'tileDataMap',
  'enemyConfigData',
  'colorsConfig',
  'bordersConfig',
  'enemyFactory',
  'collectibleFactory',
  'player'
];

export class ObjectDispatcher {
  #deps;
  #handlers;
  #typeKinds;

  constructor(dependencies) {
    this.#deps = requireDependencies('ObjectDispatcher', dependencies, OBJECT_DISPATCHER_DEPENDENCIES);
    this.#handlers = createKindRegistry('stage object kind', OBJECT_KIND_ENTRIES);
    this.#typeKinds = this.#buildTypeKinds();
  }

  #buildTypeKinds() {
    const typeKinds = new Map();

    for (const [kind, entry] of this.#handlers.entries()) {
      if (!entry.family) {
        typeKinds.set(kind, kind);
      }
    }

    for (const [kind, entry] of this.#handlers.entries()) {
      if (!entry.family) {
        continue;
      }
      const resolveTypes = FAMILY_TYPES[entry.family];
      if (!resolveTypes) {
        throw new Error(`Unknown stage object family "${entry.family}" for kind "${kind}".`);
      }
      for (const type of resolveTypes(this.#deps)) {
        if (!typeKinds.has(type)) {
          typeKinds.set(type, kind);
        }
      }
    }

    return typeKinds;
  }

  #resolveKind(type) {
    const kind = this.#typeKinds.get(type) ?? this.#typeKinds.get(type.split('-')[0]);
    if (kind === undefined) {
      throw new Error(
        `Unknown stage object type "${type}". Registered types: ${[...this.#typeKinds.keys()].join(', ')}.`
      );
    }
    return kind;
  }

  dispatchSection(section, stage) {
    const worldPos = stage.resolveWorldPosition(section.name, { x: 0, y: 0 });

    for (const obj of section.objects ?? []) {
      const type = obj.type ?? '';
      const handler = this.#handlers.resolve(this.#resolveKind(type));
      const x = worldPos.x + (obj.position?.x ?? 0);
      const y = worldPos.y + (obj.position?.y ?? 0);
      handler.create(this.#deps, stage, obj, x, y);
    }
  }
}
