import { resolveColor } from '../utils/color-utils.js';
import { keyItemName } from '../utils/key-item-name.js';

class ProgressionSystem {
  #levelsConfig;
  #fruitsConfig;
  #colorOrder;
  #colorsConfig;

  constructor(levelsConfig, fruitsConfig, colorsConfig) {
    this.#levelsConfig = levelsConfig;
    this.#fruitsConfig = fruitsConfig;
    this.#colorOrder = colorsConfig?.['color-order'] ?? [];
    this.#colorsConfig = colorsConfig;
  }

  getLevelForCollectible(collectibleType) {
    const fruitConfig = this.#fruitsConfig?.fruits?.[collectibleType];
    if (fruitConfig && fruitConfig.color) {
      return this.getLevelForColor(fruitConfig.color);
    }
    return -1;
  }

  getAbilitiesForLevel(level) {
    const color = this.getColorForLevel(level);
    if (color && this.#levelsConfig?.levels?.[color]) {
      return this.#levelsConfig.levels[color].abilities ?? [];
    }
    return [];
  }

  getColorForLevel(level) {
    if (level >= 0 && level < this.#colorOrder.length) {
      return this.#colorOrder[level];
    }
    return '';
  }

  resolveColorForLevel(level) {
    return resolveColor(this.getColorForLevel(level), this.#colorsConfig);
  }

  getCollectibleForLevel(level) {
    const color = this.getColorForLevel(level);
    const fruits = this.#fruitsConfig?.fruits ?? {};
    for (const [fruitName, fruitData] of Object.entries(fruits)) {
      if (fruitData.color === color) {
        return fruitName;
      }
    }
    return null;
  }

  getLevelForColor(colorName) {
    const index = this.#colorOrder.indexOf(colorName);
    return index !== -1 ? index : 0;
  }

  get maxLevel() {
    return this.#colorOrder.length - 1;
  }

  hasLevelUp(collectibleName, currentLevel) {
    const levelForCollectible = this.getLevelForCollectible(collectibleName);
    return levelForCollectible > currentLevel;
  }

  applyLevelUp(player, collectibleName) {
    const newLevel = this.getLevelForCollectible(collectibleName);
    if (newLevel <= player.level) {
      return false;
    }

    player.level = newLevel;

    const levelColor = this.resolveColorForLevel(newLevel);
    if (levelColor) {
      player.color = levelColor;
    }

    // The abilities are already instantiated and added to the player.
    // Their requiredLevel should be set correctly.
    // We can update them here just in case.
    for (let i = 0; i <= newLevel; i++) {
      const abilities = this.getAbilitiesForLevel(i);
      for (const abilityName of abilities) {
        const ability = player.ability(abilityName);
        if (ability) {
          ability.requiredLevel = i;
        }
      }
    }

    return true;
  }
}

const PROGRESS_SCHEMA_VERSION = 1;
const PROGRESS_STORAGE_KEY = 'progress';

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function uniqueStrings(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  const result = [];
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0 && !result.includes(value)) {
      result.push(value);
    }
  }
  return result;
}

function nonNegativeInteger(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function normalizeInventory(raw) {
  if (!isPlainObject(raw)) {
    return { items: [], defaultSelected: null };
  }

  const items = [];
  for (const entry of Array.isArray(raw.items) ? raw.items : []) {
    if (!isPlainObject(entry) || typeof entry.name !== 'string' || entry.name.length === 0) {
      continue;
    }
    const count = nonNegativeInteger(entry.count);
    if (count > 0) {
      items.push({ name: entry.name, count });
    }
  }

  return {
    items,
    defaultSelected: typeof raw['default-selected'] === 'string' ? raw['default-selected'] : null
  };
}

function normalizeProgress(raw) {
  return {
    completedStageIds: uniqueStrings(raw['completed-stages']),
    unlockedStageIds: uniqueStrings(raw['unlocked-stages']),
    lastStageId: typeof raw['last-stage'] === 'string' && raw['last-stage'].length > 0 ? raw['last-stage'] : null,
    score: nonNegativeInteger(raw.score),
    level: nonNegativeInteger(raw.level),
    inventory: normalizeInventory(raw.inventory)
  };
}

function serializeProgress(progress = {}) {
  const inventory = normalizeInventory({
    items: progress.inventory?.items,
    'default-selected': progress.inventory?.defaultSelected
  });

  return {
    version: PROGRESS_SCHEMA_VERSION,
    'completed-stages': uniqueStrings(progress.completedStageIds),
    'unlocked-stages': uniqueStrings(progress.unlockedStageIds),
    'last-stage': typeof progress.lastStageId === 'string' && progress.lastStageId.length > 0 ? progress.lastStageId : null,
    score: nonNegativeInteger(progress.score),
    level: nonNegativeInteger(progress.level),
    inventory: {
      items: inventory.items,
      'default-selected': inventory.defaultSelected
    }
  };
}

class ProgressStore {
  #saves;
  #storageKey;

  constructor(saveSystem, storageKey = PROGRESS_STORAGE_KEY) {
    if (!saveSystem || typeof saveSystem.load !== 'function' || typeof saveSystem.save !== 'function') {
      throw new TypeError('ProgressStore requires a SaveSystem-compatible instance.');
    }

    this.#saves = saveSystem;
    this.#storageKey = storageKey;
  }

  get storageKey() { return this.#storageKey; }

  load() {
    const entry = this.#saves.load(this.#storageKey);
    if (!isPlainObject(entry)) {
      return null;
    }

    if (entry.version !== PROGRESS_SCHEMA_VERSION) {
      this.#saves.delete(this.#storageKey);
      return null;
    }

    return normalizeProgress(entry);
  }

  save(progress) {
    this.#saves.save(this.#storageKey, serializeProgress(progress));
  }

  clear() {
    this.#saves.delete(this.#storageKey);
  }
}

function forEachStageNode(mapConfig, callback) {
  for (const section of mapConfig?.sections ?? []) {
    for (const object of section.objects ?? []) {
      if (object?.type === 'stage-node' && typeof object['stage-id'] === 'string') {
        callback(object);
      }
    }
  }
}

function defaultUnlockedStages(mapConfig) {
  const result = [];
  forEachStageNode(mapConfig, (node) => {
    if ((node.state ?? 'available') !== 'locked') {
      result.push(node['stage-id']);
    }
  });
  return result;
}

function inventoryItemNames(inventory) {
  const entries = Array.isArray(inventory)
    ? inventory
    : (Array.isArray(inventory?.items) ? inventory.items : []);
  const result = [];

  for (const entry of entries) {
    const name = typeof entry === 'string' ? entry : entry?.name;
    const count = typeof entry === 'string' ? 1 : (entry?.count ?? 0);
    if (typeof name === 'string' && name.length > 0 && count > 0 && !result.includes(name)) {
      result.push(name);
    }
  }

  return result;
}

function unlockedByCompletion(mapConfig, completedStageIds, inventory) {
  const completed = new Set(completedStageIds ?? []);
  const keys = new Set(inventoryItemNames(inventory));
  const result = [];

  forEachStageNode(mapConfig, (node) => {
    const condition = node['unlock-condition'];
    if (!isPlainObject(condition)) {
      return;
    }
    if (condition.type === 'stage-complete' && completed.has(condition.stage)) {
      result.push(node['stage-id']);
    } else if (
      condition.type === 'key-required' &&
      typeof condition['key-name'] === 'string' &&
      keys.has(keyItemName(condition['key-name']))
    ) {
      result.push(node['stage-id']);
    }
  });

  return result;
}

function mergeUnlockedStages(progress, mapConfig, inventory) {
  return [...new Set([
    ...(progress?.unlockedStageIds ?? []),
    ...defaultUnlockedStages(mapConfig),
    ...unlockedByCompletion(mapConfig, progress?.completedStageIds ?? [], inventory)
  ])];
}

function withUnlockedStages(progress, mapConfig, inventory) {
  return {
    ...progress,
    unlockedStageIds: mergeUnlockedStages(progress, mapConfig, inventory)
  };
}

function completeStageProgress(progress, stageId, mapConfig, inventory) {
  const completedStageIds = [...new Set([...(progress?.completedStageIds ?? []), stageId])];

  return withUnlockedStages(
    {
      ...progress,
      completedStageIds,
      lastStageId: stageId
    },
    mapConfig,
    inventory
  );
}

function applyProgressToMapConfig(mapConfig, progress = {}) {
  const completed = new Set(progress.completedStageIds ?? []);
  const unlocked = new Set(mergeUnlockedStages(progress, mapConfig, progress.inventory));

  return {
    ...mapConfig,
    sections: (mapConfig?.sections ?? []).map((section) => ({
      ...section,
      objects: (section.objects ?? []).map((object) => {
        if (object?.type !== 'stage-node' || typeof object['stage-id'] !== 'string') {
          return { ...object };
        }

        const state = completed.has(object['stage-id'])
          ? 'completed'
          : unlocked.has(object['stage-id']) ? 'available' : 'locked';

        return { ...object, state };
      })
    }))
  };
}

export {
  ProgressionSystem,
  ProgressStore,
  PROGRESS_SCHEMA_VERSION,
  PROGRESS_STORAGE_KEY,
  applyProgressToMapConfig,
  completeStageProgress,
  defaultUnlockedStages,
  inventoryItemNames,
  serializeProgress,
  unlockedByCompletion,
  withUnlockedStages
};
