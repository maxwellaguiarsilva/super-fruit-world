import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { resolveTileType } from '../../src/app/content/tile-config.js';

const ROOT = path.resolve(import.meta.dir, '..', '..');
const STAGE_DIRECTORY = 'data/stages';
const TILE_DIRECTORY = 'data/tiles';
const COLLECTIBLE_DIRECTORY = 'data/collectibles';
const ENEMY_CONFIG_ENTRY = 'data/enemies/config.json';
const GAME_CONFIG_ENTRY = 'data/game-config.json';
const JSON_EXTENSION = '.json';

const DEGREES_TO_RADIANS = Math.PI / 180;
const SLOPE_RISE_EPSILON = 1e-6;

const DEFAULT_TILE_SIZE = 1;
const DEFAULT_COLLECTIBLE_SIZE = 0.5;
const DEFAULT_ENTITY_SIZE = 1;
const DEFAULT_BOSS_SIZE = 3;
const DEFAULT_PLAYER_SIZE = 1;

const TELEPORTER_TYPES = new Set([
  'inner-teleporter',
  'special-teleporter',
  'map-teleporter',
  'key-door'
]);

const EMBEDDED_KINDS = new Map([
  ['player-spawn', 'spawn'],
  ['checkpoint', 'checkpoint'],
  ['teleporter-marker', 'marker']
]);

function compare(a, b) {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function numberOr(value, fallback) {
  return isFiniteNumber(value) ? value : fallback;
}

function positiveNumberOr(value, fallback) {
  return isFiniteNumber(value) && value > 0 ? value : fallback;
}

function coordinate(value) {
  return numberOr(value, 0);
}

function sizeOr(size, fallback) {
  if (size === null || typeof size !== 'object' || Array.isArray(size)) {
    return { width: fallback, height: fallback };
  }

  return {
    width: numberOr(size.width, fallback),
    height: numberOr(size.height, fallback)
  };
}

function collectibleHitbox(size) {
  if (size !== null && typeof size === 'object' && !Array.isArray(size) && isFiniteNumber(size.width)) {
    return {
      width: size.width,
      height: numberOr(size.height, DEFAULT_COLLECTIBLE_SIZE)
    };
  }

  return { width: DEFAULT_COLLECTIBLE_SIZE, height: DEFAULT_COLLECTIBLE_SIZE };
}

function zeroBox() {
  return { x: 0, y: 0, width: 0, height: 0 };
}

export function boxesOverlap(a, b) {
  return (
    a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y
  );
}

export function boxAt(x, y, width = 1, height = 1) {
  return { x, y, width, height };
}

// The runtime places the player one unit above the spawn object's origin
// (player.y = y - 1 in src/app/dispatch/object-dispatcher.js). The offset is
// fixed and must not be derived from the player size.
export function spawnPlayerBox(spawn, playerSize = 1) {
  return boxAt(spawn.x, spawn.y - 1, playerSize, playerSize);
}

function slopeRise(tile) {
  const declared = Number(tile.angle);

  if (Number.isFinite(declared) && declared > 0 && declared < 90) {
    const declaredRise = Math.tan(declared * DEGREES_TO_RADIANS) * tile.width;
    if (Math.abs(declaredRise - tile.height) <= SLOPE_RISE_EPSILON) {
      return declaredRise;
    }
  }

  return tile.height;
}

// A slope is the solid wedge below the diagonal inside its tile box. A box that
// only overlaps the empty part above that diagonal is not intersecting the tile.
export function boxIntersectsSolidTile(box, tile) {
  if (!boxesOverlap(box, tile)) {
    return false;
  }

  if (!tile.slope) {
    return true;
  }

  const width = tile.width;
  const height = tile.height;

  if (!(width > 0) || !(height > 0)) {
    return true;
  }

  const rise = slopeRise(tile);
  const inverted = tile.inverted === true;
  const highEdgeLocalX = inverted
    ? box.x - tile.x
    : box.x + box.width - tile.x;
  const clampedLocalX = Math.min(Math.max(highEdgeLocalX, 0), width);
  const distanceFromLowEnd = inverted ? width - clampedLocalX : clampedLocalX;
  const surfaceY = height - rise * (distanceFromLowEnd / width);

  return box.y + box.height - tile.y > surfaceY;
}

export function unionBoxes(boxes) {
  const present = boxes.filter((box) => box !== null && box !== undefined);
  if (present.length === 0) {
    return zeroBox();
  }

  let minX = present[0].x;
  let minY = present[0].y;
  let maxX = present[0].x + present[0].width;
  let maxY = present[0].y + present[0].height;

  for (const box of present.slice(1)) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function boxIsEntirelyBelow(box, bounds) {
  return box.y >= bounds.y + bounds.height;
}

export function boxIsEntirelyHorizontallyOutside(box, bounds) {
  return box.x + box.width <= bounds.x || box.x >= bounds.x + bounds.width;
}

export async function discoverStageIds(stagesDirectory) {
  const entries = await readdir(stagesDirectory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(JSON_EXTENSION))
    .map((entry) => entry.name.slice(0, -JSON_EXTENSION.length))
    .sort(compare);
}

function buildSectionMap(sections) {
  const sectionMap = new Map();

  for (const section of Array.isArray(sections) ? sections : []) {
    if (section !== null && typeof section === 'object' && typeof section.name === 'string') {
      sectionMap.set(section.name, section);
    }
  }

  return sectionMap;
}

function resolveWorldPositionFromMap(sectionMap, sectionName) {
  const visited = new Set();
  let current = sectionMap.get(sectionName) ?? null;
  let x = 0;
  let y = 0;

  while (current !== null && !visited.has(current.name)) {
    visited.add(current.name);
    x += coordinate(current.position?.x);
    y += coordinate(current.position?.y);

    const parentName = current['parent-section'];
    if (parentName === 'root' || parentName === undefined || parentName === null) {
      break;
    }

    current = sectionMap.get(parentName) ?? null;
  }

  return { x, y };
}

export function resolveWorldPosition(sections, sectionName) {
  return resolveWorldPositionFromMap(buildSectionMap(sections), sectionName);
}

function tileFlags(resolved) {
  return {
    solid: Boolean(resolved.solid),
    deadly: Boolean(resolved.deadly),
    liquid: Boolean(resolved.liquid),
    climbable: Boolean(resolved.climbable),
    slope: resolved.type === 'slope'
  };
}

export function classifyTileObject(tileDataMap, object) {
  return tileFlags(resolveTileType(object ?? {}, tileDataMap ?? {}, {}, {}));
}

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function readJsonEntry(root, relativePath) {
  try {
    return await readJson(path.join(root, relativePath));
  } catch (error) {
    throw new Error(`${relativePath}: ${error.message}`);
  }
}

async function readJsonIfPresent(root, relativePath) {
  try {
    return await readJson(path.join(root, relativePath));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw new Error(`${relativePath}: ${error.message}`);
  }
}

async function listJsonNames(directory) {
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(JSON_EXTENSION))
    .map((entry) => entry.name.slice(0, -JSON_EXTENSION.length))
    .sort(compare);
}

async function loadTileDataMap(root) {
  const tileDataMap = {};

  for (const name of await listJsonNames(path.join(root, TILE_DIRECTORY))) {
    const tileData = await readJsonEntry(root, `${TILE_DIRECTORY}/${name}${JSON_EXTENSION}`);
    tileDataMap[name] = tileData;
    if (typeof tileData?.type === 'string') {
      tileDataMap[tileData.type] = tileData;
    }
  }

  return tileDataMap;
}

async function loadCollectibleConfigs(root) {
  const configs = new Map();

  for (const name of await listJsonNames(path.join(root, COLLECTIBLE_DIRECTORY))) {
    const collectibleData = await readJsonEntry(root, `${COLLECTIBLE_DIRECTORY}/${name}${JSON_EXTENSION}`);
    const type = typeof collectibleData?.type === 'string' ? collectibleData.type : name;
    configs.set(type, collectibleData);
  }

  return configs;
}

async function loadEnemyConfig(root) {
  return await readJsonIfPresent(root, ENEMY_CONFIG_ENTRY) ?? {};
}

async function loadGameConfig(root) {
  return await readJsonIfPresent(root, GAME_CONFIG_ENTRY) ?? {};
}

async function loadSupport(root) {
  const [tileDataMap, collectibleConfigs, enemyConfig, gameConfig] = await Promise.all([
    loadTileDataMap(root),
    loadCollectibleConfigs(root),
    loadEnemyConfig(root),
    loadGameConfig(root)
  ]);

  return {
    tileDataMap,
    collectibleTypes: new Set(collectibleConfigs.keys()),
    collectibleConfigs,
    enemyShapes: new Set(Object.keys(enemyConfig?.['shape-map'] ?? {})),
    enemyConfig,
    playerSize: positiveNumberOr(gameConfig?.player?.size, DEFAULT_PLAYER_SIZE)
  };
}

function classifyObjectKind(type, support) {
  if (Object.hasOwn(support.tileDataMap, type)) {
    return 'tile';
  }

  if (support.collectibleTypes.has(type)) {
    return 'collectible';
  }

  const shapeName = type.split('-')[0];
  if (support.enemyShapes.has(shapeName)) {
    return 'enemy';
  }

  if (EMBEDDED_KINDS.has(type)) {
    return EMBEDDED_KINDS.get(type);
  }

  if (TELEPORTER_TYPES.has(type)) {
    return 'teleporter';
  }

  return 'other';
}

function normalizeTileObject(raw, base, support) {
  const size = sizeOr(raw.size, DEFAULT_TILE_SIZE);
  const resolved = resolveTileType(raw, support.tileDataMap ?? {}, {}, {});
  const declaredAngle = resolved['slope-angle'];

  return {
    ...base,
    ...size,
    ...tileFlags(resolved),
    variant: typeof raw.variant === 'string' ? raw.variant : null,
    inverted: resolved.inverted === true,
    angle: isFiniteNumber(raw.angle)
      ? raw.angle
      : (isFiniteNumber(declaredAngle) ? declaredAngle : null)
  };
}

function normalizeCollectibleObject(raw, base, support) {
  const collectibleConfig = support.collectibleConfigs.get(base.type) ?? {};
  const declaredSize = raw.size ?? collectibleConfig.visual?.size;
  const hitbox = collectibleHitbox(declaredSize);

  return {
    ...base,
    ...hitbox,
    collectible: raw.collectible ?? null,
    'key-name': raw['key-name'] ?? null,
    'note-order': raw['note-order'] ?? null
  };
}

function normalizeEnemyObject(raw, base, support) {
  const behavior = base.type.split('-')[1] ?? 'patrol';
  const boss = Boolean(raw['is-boss'] ?? false);
  const size = boss
    ? numberOr(support.enemyConfig?.['boss-size'], DEFAULT_BOSS_SIZE)
    : numberOr(support.enemyConfig?.size, DEFAULT_ENTITY_SIZE);

  return {
    ...base,
    width: size,
    height: size,
    boss,
    behavior
  };
}

function normalizeTeleporterObject(raw, base) {
  return {
    ...base,
    name: raw.name ?? 'unnamed',
    'target-marker': raw['target-marker'] ?? null,
    'target-stage': raw['target-stage'] ?? null,
    'required-key': raw['required-key'] ?? raw.effect?.['required-key'] ?? null
  };
}

function normalizeOtherObject(raw, base) {
  const size = sizeOr(raw.size, DEFAULT_ENTITY_SIZE);

  return { ...base, ...size };
}

function normalizeObject(raw, section, sectionOrigin, support) {
  const source = raw !== null && typeof raw === 'object' ? raw : {};
  const type = typeof source.type === 'string' ? source.type : '';
  const kind = classifyObjectKind(type, support);
  const base = {
    kind,
    type,
    section,
    x: sectionOrigin.x + coordinate(source.position?.x),
    y: sectionOrigin.y + coordinate(source.position?.y),
    width: DEFAULT_ENTITY_SIZE,
    height: DEFAULT_ENTITY_SIZE
  };

  if (kind === 'tile') {
    return normalizeTileObject(source, base, support);
  }
  if (kind === 'collectible') {
    return normalizeCollectibleObject(source, base, support);
  }
  if (kind === 'enemy') {
    return normalizeEnemyObject(source, base, support);
  }
  if (kind === 'teleporter') {
    return normalizeTeleporterObject(source, base);
  }
  if (kind === 'marker') {
    return { ...base, name: source.name ?? 'unnamed' };
  }
  if (kind === 'spawn' || kind === 'checkpoint') {
    return { ...base };
  }

  return normalizeOtherObject(source, base);
}

function addObject(layout, object) {
  if (object.kind === 'tile') {
    layout.tiles.push(object);
  } else if (object.kind === 'collectible') {
    layout.collectibles.push(object);
  } else if (object.kind === 'enemy') {
    layout.enemies.push(object);
  } else if (object.kind === 'spawn') {
    layout.spawns.push(object);
  } else if (object.kind === 'checkpoint') {
    layout.checkpoints.push(object);
  } else if (object.kind === 'teleporter') {
    layout.teleporters.push(object);
  } else if (object.kind === 'marker') {
    layout.markers.push(object);
  } else {
    layout.other.push(object);
  }
}

function normalizeStage(id, file, stageData, support) {
  const rawSections = Array.isArray(stageData?.sections) ? stageData.sections : [];
  const sectionMap = buildSectionMap(rawSections);
  const layout = {
    id,
    file,
    playerSize: support.playerSize,
    sections: [],
    tiles: [],
    collectibles: [],
    enemies: [],
    spawns: [],
    checkpoints: [],
    teleporters: [],
    markers: [],
    other: [],
    tileBounds: zeroBox(),
    sectionBounds: zeroBox()
  };

  for (const rawSection of rawSections) {
    if (rawSection === null || typeof rawSection !== 'object') {
      continue;
    }

    const name = typeof rawSection.name === 'string' ? rawSection.name : '';
    const localPosition = {
      x: coordinate(rawSection.position?.x),
      y: coordinate(rawSection.position?.y)
    };
    const worldPosition = resolveWorldPositionFromMap(sectionMap, name);
    const size = sizeOr(rawSection.size, 0);
    const section = {
      name,
      parent: rawSection['parent-section'] ?? null,
      position: worldPosition,
      localPosition,
      size,
      objects: []
    };

    for (const rawObject of Array.isArray(rawSection.objects) ? rawSection.objects : []) {
      const object = normalizeObject(rawObject, name, worldPosition, support);
      section.objects.push(object);
      addObject(layout, object);
    }

    layout.sections.push(section);
  }

  layout.tileBounds = unionBoxes(layout.tiles);
  layout.sectionBounds = unionBoxes(layout.sections.map((section) => ({
    x: section.position.x,
    y: section.position.y,
    width: section.size.width,
    height: section.size.height
  })));

  return layout;
}

function normalizeStageId(stageId) {
  const base = path.basename(String(stageId ?? '')).replace(/\.json$/i, '');
  if (base.length === 0) {
    throw new TypeError('A stage id is required to load a stage layout.');
  }
  return base;
}

async function readStageLayout(root, stageId, support) {
  const id = normalizeStageId(stageId);
  const file = `${STAGE_DIRECTORY}/${id}${JSON_EXTENSION}`;
  const stageData = await readJsonEntry(root, file);

  return normalizeStage(id, file, stageData, support);
}

export async function loadStageLayouts({ root = ROOT } = {}) {
  const stageIds = await discoverStageIds(path.join(root, STAGE_DIRECTORY));
  const support = await loadSupport(root);
  const layouts = [];

  for (const stageId of stageIds) {
    layouts.push(await readStageLayout(root, stageId, support));
  }

  return layouts;
}

export async function loadStageLayout({ root = ROOT, stageId } = {}) {
  const support = await loadSupport(root);
  return await readStageLayout(root, stageId, support);
}
