import { readdir } from 'node:fs/promises';

import {
  PROGRESS_STORAGE_KEY,
  serializeProgress
} from '../../src/game/systems/progression-system.js';

const STAGE_FILE_EXTENSION = '.json';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

export async function discoverStageIds(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(STAGE_FILE_EXTENSION))
    .map((entry) => entry.name.slice(0, -STAGE_FILE_EXTENSION.length))
    .sort();
}

export function collectKeyNames(mapConfig) {
  const keyNames = [];

  for (const section of mapConfig?.sections ?? []) {
    for (const object of section.objects ?? []) {
      if (object?.type !== 'stage-node') {
        continue;
      }

      const condition = object['unlock-condition'];
      if (condition?.type !== 'key-required' || !isNonEmptyString(condition['key-name'])) {
        continue;
      }
      if (!keyNames.includes(condition['key-name'])) {
        keyNames.push(condition['key-name']);
      }
    }
  }

  return keyNames;
}

export function buildProgressStorageEntry({ namespace, stageId, stageIds, keyNames = [] }) {
  if (!isNonEmptyString(namespace)) {
    throw new TypeError('buildProgressStorageEntry requires a non-empty save namespace.');
  }
  if (!isNonEmptyString(stageId)) {
    throw new TypeError('buildProgressStorageEntry requires a non-empty stage id.');
  }

  const items = [...new Set(keyNames)].map((name) => ({ name: `key:${name}`, count: 1 }));
  const progress = serializeProgress({
    completedStageIds: [],
    unlockedStageIds: [...new Set(stageIds)],
    lastStageId: stageId,
    score: 0,
    level: 0,
    inventory: {
      items,
      defaultSelected: null
    }
  });

  return {
    [`${namespace}:${PROGRESS_STORAGE_KEY}`]: JSON.stringify(progress)
  };
}

export function resolveTextKey(textConfig, textKey) {
  if (!isNonEmptyString(textKey) || textConfig === null || typeof textConfig !== 'object') {
    return '';
  }

  let value = textConfig;
  for (const segment of textKey.split('.')) {
    if (value === null || typeof value !== 'object') {
      return '';
    }
    value = value[segment];
  }

  return typeof value === 'string' ? value : '';
}

export function introLine(stageConfig, textConfig) {
  const intro = stageConfig?.dialogue?.intro;
  const line = Array.isArray(intro) ? intro[0] : null;

  if (line === null || line === undefined) {
    return { speaker: '', text: '', word: '' };
  }

  const speaker = typeof line === 'string' ? '' : (line.speaker ?? '');
  const textKey = typeof line === 'string' ? line : line.text;
  const text = resolveTextKey(textConfig, textKey);
  const word = text.split(/\s+/).find((entry) => entry.length > 0) ?? '';

  return {
    speaker: isNonEmptyString(speaker) ? speaker : '',
    text,
    word
  };
}
