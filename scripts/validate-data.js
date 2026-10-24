import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { collectDataFiles } from './generate-data-index.js';

const ROOT = path.resolve(import.meta.dir, '..');
const INDEX_ENTRY = 'data/index.json';
const I18N_ENTRY = 'data/i18n/default.json';
const COLORS_ENTRY = 'data/colors.json';
const GAME_CONFIG_ENTRY = 'data/game-config.json';
const BGM_INDEX_ENTRY = 'data/audio/bgm.json';
const MAP_ENTRY = 'data/map/fruit-world.json';
const SLOPE_TILE_ENTRY = 'data/tiles/slope.json';
const COLLECTIBLE_DATA_PREFIX = 'data/collectibles/';
const STAGE_DATA_PREFIX = 'data/stages/';

const TEXT_KEY_FIELDS = new Set([
  'label-key',
  'display-name-key',
  'title-key',
  'subtitle-key',
  'hint-key',
  'fruit-label-key',
  'ability-label-key',
  'score-label-key'
]);

const BOOT_CONFIG_KEYS = [
  'visual-unit.value',
  'canvas.viewport-percent',
  'loop.update-rate',
  'tile-types',
  'initial-stage',
  'save-namespace',
  'physics.gravity',
  'physics.max-fall-speed',
  'physics.friction',
  'physics.walk-speed',
  'physics.walk-acceleration',
  'physics.jump-velocity',
  'player.size',
  'player.starting-level',
  'player.starting-color',
  'health.max-life',
  'health.starting-lives',
  'health.starting-continues',
  'health.iframe-timer',
  'damage.enemy-shape-damage',
  'damage.hazard-damage',
  'damage.shield-damage-multiplier',
  'projectile.size',
  'projectile.max-travel',
  'projectile.enemy-color',
  'projectile.player-color'
];

function compare(a, b) {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

function stageDataPath(stageId) {
  const base = stageId.startsWith('data/') ? stageId : `data/stages/${stageId}`;
  return base.endsWith('.json') ? base : `${base}.json`;
}

function flattenStrings(value, prefix = '', result = new Map()) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flattenStrings(child, prefix === '' ? key : `${prefix}.${key}`, result);
    }
    return result;
  }

  result.set(prefix, value);
  return result;
}

function collectTextReferences(value, location, references) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectTextReferences(item, `${location}[${index}]`, references));
    return;
  }

  if (value === null || typeof value !== 'object') {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childLocation = location === '' ? key : `${location}.${key}`;

    if (TEXT_KEY_FIELDS.has(key) && typeof child === 'string') {
      references.push({ location: childLocation, key: child });
      continue;
    }

    if (key === 'text' && typeof child === 'string') {
      references.push({ location: childLocation, key: child });
      continue;
    }

    if (key === 'lines' && Array.isArray(child)) {
      child.forEach((line, index) => {
        if (typeof line === 'string') {
          references.push({ location: `${childLocation}[${index}]`, key: line });
        }
      });
      continue;
    }

    collectTextReferences(child, childLocation, references);
  }
}

function collectColorReferences(value, location, references) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectColorReferences(item, `${location}[${index}]`, references));
    return;
  }

  if (value === null || typeof value !== 'object') {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childLocation = location === '' ? key : `${location}.${key}`;

    if ((key === 'color' || key.endsWith('-color')) && typeof child === 'string') {
      references.push({ location: childLocation, value: child });
      continue;
    }

    collectColorReferences(child, childLocation, references);
  }
}

function isCssColorLiteral(value) {
  return /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)
    || /^(?:rgb|hsl)a?\(/i.test(value);
}

function isPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isSlopeAngle(value) {
  return isPositiveNumber(value) && value < 90;
}

function resolveColorName(value, colorNames) {
  const base = value.startsWith('dark-') ? value.slice('dark-'.length) : value;
  return colorNames.has(base);
}

function getAtPath(value, dottedPath) {
  let current = value;

  for (const segment of dottedPath.split('.')) {
    if (current === null || typeof current !== 'object' || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

async function readJsonFile(root, relativePath) {
  const raw = await readFile(path.join(root, relativePath), 'utf8');
  return JSON.parse(raw);
}

async function loadDataFiles(root) {
  const files = (await collectDataFiles(root)).sort(compare);
  const parsed = new Map();
  const errors = [];

  for (const relativePath of files) {
    try {
      parsed.set(relativePath, await readJsonFile(root, relativePath));
    } catch (error) {
      errors.push(`${relativePath}: expected valid JSON (${error.message})`);
    }
  }

  return { files, parsed, errors };
}

function validateIndex(indexValue, indexError, files, errors) {
  if (indexError) {
    errors.push(`${INDEX_ENTRY}: expected a readable JSON index (${indexError.message}); run "bun run data:index"`);
    return;
  }

  if (!indexValue || !Array.isArray(indexValue.files)) {
    errors.push(`${INDEX_ENTRY}: expected an object with a "files" array; run "bun run data:index"`);
    return;
  }

  const onDisk = new Set(files);
  const indexed = new Set();

  for (const entry of indexValue.files) {
    if (typeof entry !== 'string') {
      errors.push(`${INDEX_ENTRY}: expected every "files" entry to be a string, found ${JSON.stringify(entry)}`);
      continue;
    }

    if (indexed.has(entry)) {
      errors.push(`${INDEX_ENTRY}: "${entry}" is listed more than once`);
    }
    indexed.add(entry);

    if (!onDisk.has(entry)) {
      errors.push(`${INDEX_ENTRY}: "${entry}" is listed but does not exist on disk`);
    }
  }

  for (const file of files) {
    if (!indexed.has(file)) {
      errors.push(`${INDEX_ENTRY}: "${file}" exists on disk but is missing from the index; run "bun run data:index"`);
    }
  }
}

function validateTileTypes(gameConfig, files, parsed, errors) {
  const tileTypes = gameConfig?.['tile-types'];

  if (!Array.isArray(tileTypes)) {
    return;
  }

  tileTypes.forEach((tileType, index) => {
    if (typeof tileType !== 'string') {
      errors.push(`${GAME_CONFIG_ENTRY}: "tile-types[${index}]" expected a tile type name string`);
      return;
    }

    const tilePath = `data/tiles/${tileType}.json`;
    if (!files.includes(tilePath)) {
      errors.push(
        `${GAME_CONFIG_ENTRY}: "tile-types[${index}]" = "${tileType}" expects ${tilePath}, which does not exist`
      );
      return;
    }

    const tileData = parsed.get(tilePath);
    if (tileData && tileData.type !== tileType) {
      errors.push(`${tilePath}: "type" expected "${tileType}" to match game-config.tile-types, found "${tileData.type}"`);
    }
  });
}

function validateSlopes(files, parsed, errors) {
  const slopeTileData = parsed.get(SLOPE_TILE_ENTRY);

  if (slopeTileData) {
    const collisionAngle = slopeTileData.collision?.['slope-angle'];
    if (collisionAngle !== null && collisionAngle !== undefined && !isSlopeAngle(collisionAngle)) {
      errors.push(
        `${SLOPE_TILE_ENTRY}: "collision.slope-angle" expected an angle between 0 and 90 degrees, found ${JSON.stringify(collisionAngle)}`
      );
    }

    const slopeTypes = slopeTileData.physics?.['slope-types'];
    if (slopeTypes !== undefined && slopeTypes !== null) {
      if (typeof slopeTypes !== 'object' || Array.isArray(slopeTypes)) {
        errors.push(`${SLOPE_TILE_ENTRY}: "physics.slope-types" expected an object mapping names to angles`);
      } else {
        for (const [name, angle] of Object.entries(slopeTypes)) {
          if (!isSlopeAngle(angle)) {
            errors.push(
              `${SLOPE_TILE_ENTRY}: "physics.slope-types.${name}" expected an angle between 0 and 90 degrees, found ${JSON.stringify(angle)}`
            );
          }
        }
      }
    }
  }

  const slopeTypes = slopeTileData?.physics?.['slope-types'];
  const declaredAngles = slopeTypes !== null && typeof slopeTypes === 'object' && !Array.isArray(slopeTypes)
    ? slopeTypes
    : {};

  for (const file of files) {
    if (!file.startsWith(STAGE_DATA_PREFIX)) {
      continue;
    }

    const stageData = parsed.get(file);
    if (!stageData || !Array.isArray(stageData.sections)) {
      continue;
    }

    stageData.sections.forEach((section, sectionIndex) => {
      const objects = Array.isArray(section.objects) ? section.objects : [];

      objects.forEach((object, objectIndex) => {
        if (!object || object.type !== 'slope') {
          return;
        }

        const location = `sections[${sectionIndex}].objects[${objectIndex}]`;
        const size = object.size;

        if (!size || !isPositiveNumber(size.width) || !isPositiveNumber(size.height)) {
          errors.push(`${file}: "${location}.size" expected positive width and height for a slope`);
        }

        if (!isSlopeAngle(declaredAngles[object.variant])) {
          errors.push(
            `${file}: "${location}.variant" expected a slope type declared in ${SLOPE_TILE_ENTRY} "physics.slope-types", found ${JSON.stringify(object.variant)}`
          );
        }

        if (object.inverted !== undefined && typeof object.inverted !== 'boolean') {
          errors.push(`${file}: "${location}.inverted" expected a boolean, found ${JSON.stringify(object.inverted)}`);
        }
      });
    });
  }
}

function validateDropTables(files, parsed, errors) {
  for (const file of files) {
    if (!file.startsWith(STAGE_DATA_PREFIX)) {
      continue;
    }

    const stageData = parsed.get(file);
    if (!stageData || !Array.isArray(stageData.sections)) {
      continue;
    }

    stageData.sections.forEach((section, sectionIndex) => {
      const objects = Array.isArray(section.objects) ? section.objects : [];

      objects.forEach((object, objectIndex) => {
        if (!object || typeof object !== 'object' || !Object.hasOwn(object, 'drop-table')) {
          return;
        }

        const location = `sections[${sectionIndex}].objects[${objectIndex}].drop-table`;
        const dropTable = object['drop-table'];

        if (!Array.isArray(dropTable)) {
          errors.push(`${file}: "${location}" expected an array of drop entries, found ${JSON.stringify(dropTable)}`);
          return;
        }

        dropTable.forEach((entry, entryIndex) => {
          const entryLocation = `${location}[${entryIndex}]`;

          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            errors.push(`${file}: "${entryLocation}" expected an object with "type" and "weight"`);
            return;
          }

          if (typeof entry.type !== 'string') {
            errors.push(`${file}: "${entryLocation}.type" expected a collectible type string, found ${JSON.stringify(entry.type)}`);
          } else if (!/^[a-z0-9-]+$/.test(entry.type) || !files.includes(`${COLLECTIBLE_DATA_PREFIX}${entry.type}.json`)) {
            errors.push(
              `${file}: "${entryLocation}.type" expected an existing ${COLLECTIBLE_DATA_PREFIX}${entry.type}.json collectible file`
            );
          }

          if (!isPositiveNumber(entry.weight)) {
            errors.push(
              `${file}: "${entryLocation}.weight" expected a positive finite number, found ${JSON.stringify(entry.weight)}`
            );
          }
        });
      });
    });
  }
}

function validateBgm(parsed, files, errors) {
  const bgmIndex = parsed.get(BGM_INDEX_ENTRY);

  if (!bgmIndex || bgmIndex.tracks === null || typeof bgmIndex.tracks !== 'object') {
    return;
  }

  for (const [trackName, trackPath] of Object.entries(bgmIndex.tracks)) {
    if (typeof trackPath !== 'string') {
      errors.push(`${BGM_INDEX_ENTRY}: "tracks.${trackName}" expected a track file path string`);
      continue;
    }

    if (!files.includes(trackPath)) {
      errors.push(`${BGM_INDEX_ENTRY}: "tracks.${trackName}" points at ${trackPath}, which does not exist`);
      continue;
    }

    const track = parsed.get(trackPath);
    if (!track) {
      continue;
    }

    const hasChannels = track.channels !== null && typeof track.channels === 'object' && !Array.isArray(track.channels);
    const hasLegacyNotes = Array.isArray(track.notes);

    if (!hasChannels && !hasLegacyNotes) {
      errors.push(`${trackPath}: expected a "channels" object or a legacy "notes" array`);
      continue;
    }

    if (hasChannels) {
      for (const [channelName, channel] of Object.entries(track.channels)) {
        if (!channel || !Array.isArray(channel.notes)) {
          errors.push(`${trackPath}: "channels.${channelName}.notes" expected an array`);
        }
      }
    }
  }
}

function validateStages(gameConfig, mapData, files, errors, warnings) {
  const initialStage = gameConfig?.['initial-stage'];

  if (typeof initialStage === 'string' && initialStage.length > 0) {
    const initialPath = stageDataPath(initialStage);
    if (!files.includes(initialPath)) {
      errors.push(`${GAME_CONFIG_ENTRY}: "initial-stage" expects ${initialPath}, which does not exist`);
    }
  }

  if (!mapData || !Array.isArray(mapData.sections)) {
    return;
  }

  mapData.sections.forEach((section, sectionIndex) => {
    const objects = Array.isArray(section.objects) ? section.objects : [];

    objects.forEach((object, objectIndex) => {
      if (!object || object.type !== 'stage-node') {
        return;
      }

      const stageId = object['stage-id'];
      const location = `sections[${sectionIndex}].objects[${objectIndex}]`;

      if (typeof stageId !== 'string' || stageId.length === 0) {
        errors.push(`${MAP_ENTRY}: "${location}" expected a non-empty "stage-id"`);
        return;
      }

      const stagePath = stageDataPath(stageId);
      if (files.includes(stagePath)) {
        return;
      }

      if (object.state === 'locked') {
        warnings.push(
          `${MAP_ENTRY}: "${location}" is locked and its stage file ${stagePath} does not exist; the node stays unselectable`
        );
        return;
      }

      errors.push(
        `${MAP_ENTRY}: "${location}" declares stage-id "${stageId}" as ${JSON.stringify(object.state ?? 'unlocked')} but ${stagePath} does not exist`
      );
    });
  });
}

function validateTextKeys(files, parsed, i18n, errors) {
  const targets = files.filter((file) => file.startsWith('data/ui/') || file.startsWith('data/stages/') || file === MAP_ENTRY);

  for (const file of targets) {
    const data = parsed.get(file);
    if (data === undefined) {
      continue;
    }

    const references = [];
    collectTextReferences(data, '', references);

    for (const reference of references) {
      if (!i18n.has(reference.key)) {
        errors.push(
          `${file}: "${reference.location}" expects text key "${reference.key}" in ${I18N_ENTRY}, which does not define it`
        );
      }
    }
  }
}

function validateColors(files, parsed, colorsConfig, errors) {
  const colorNames = new Set(Object.keys(colorsConfig?.colors ?? {}));

  for (const file of files) {
    if (file === COLORS_ENTRY) {
      continue;
    }

    const data = parsed.get(file);
    if (data === undefined) {
      continue;
    }

    const references = [];
    collectColorReferences(data, '', references);

    for (const reference of references) {
      if (isCssColorLiteral(reference.value) || resolveColorName(reference.value, colorNames)) {
        continue;
      }

      errors.push(
        `${file}: "${reference.location}" = "${reference.value}" expected a name from ${COLORS_ENTRY} or a CSS color literal`
      );
    }
  }
}

function validateBootConfig(gameConfig, errors) {
  if (!gameConfig || typeof gameConfig !== 'object') {
    errors.push(`${GAME_CONFIG_ENTRY}: expected a configuration object read at boot`);
    return;
  }

  for (const key of BOOT_CONFIG_KEYS) {
    const value = getAtPath(gameConfig, key);
    if (value === undefined || value === null) {
      errors.push(`${GAME_CONFIG_ENTRY}: "${key}" is missing but is read at boot`);
    }
  }

  if (Array.isArray(gameConfig['tile-types']) && gameConfig['tile-types'].length === 0) {
    errors.push(`${GAME_CONFIG_ENTRY}: "tile-types" expected at least one tile type`);
  }
}

export async function validateData({ root = ROOT } = {}) {
  const errors = [];
  const warnings = [];

  const { files, parsed, errors: parseErrors } = await loadDataFiles(root);
  errors.push(...parseErrors);

  let indexValue = null;
  let indexError = null;
  try {
    indexValue = await readJsonFile(root, INDEX_ENTRY);
  } catch (error) {
    indexError = error;
  }
  validateIndex(indexValue, indexError, files, errors);

  const gameConfig = parsed.get(GAME_CONFIG_ENTRY);
  const colorsConfig = parsed.get(COLORS_ENTRY);
  const i18nValue = parsed.get(I18N_ENTRY);
  const i18n = flattenStrings(i18nValue ?? {});
  const mapData = parsed.get(MAP_ENTRY);

  validateBootConfig(gameConfig, errors);
  validateTileTypes(gameConfig, files, parsed, errors);
  validateSlopes(files, parsed, errors);
  validateDropTables(files, parsed, errors);
  validateBgm(parsed, files, errors);
  validateStages(gameConfig, mapData, files, errors, warnings);
  validateTextKeys(files, parsed, i18n, errors);
  validateColors(files, parsed, colorsConfig, errors);

  return { files, errors, warnings };
}

function printReport(result) {
  for (const warning of result.warnings) {
    console.log(`warning: ${warning}`);
  }

  for (const error of result.errors) {
    console.error(`error: ${error}`);
  }

  const summary = `${result.files.length} data files, ${result.errors.length} error(s), ${result.warnings.length} warning(s)`;

  if (result.errors.length > 0) {
    console.error(`Data validation failed: ${summary}.`);
    return 1;
  }

  console.log(`Data validation passed: ${summary}.`);
  return 0;
}

if (import.meta.main) {
  const result = await validateData();
  const exitCode = printReport(result);
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
