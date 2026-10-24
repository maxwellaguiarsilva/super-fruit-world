import { readFileSync, readdirSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

import { TextResolver } from '../src/engine/data/text-resolver.js';

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8'));
}

function stageFiles() {
  return readdirSync(new URL('../data/stages/', import.meta.url))
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => readJson(`data/stages/${entry}`));
}

function lookupKey(root, key) {
  let current = root;

  for (const segment of key.split('.')) {
    if (current === null || typeof current !== 'object' || !(segment in current)) {
      return null;
    }
    current = current[segment];
  }

  return typeof current === 'string' ? current : null;
}

const I18N = readJson('data/i18n/en-us.json');
const DEFAULT_I18N = readJson('data/i18n/default.json');
const LEVELS = readJson('data/player/levels.json');
const ABILITY_CONFIG = readJson('data/player/abilities.json');
const FRUITS = readJson('data/player/fruits.json');
const STAGES = stageFiles();

const textResolver = new TextResolver((key) => lookupKey(I18N, key), { onMissing: () => {} });

function levelAbilityNames() {
  return [...new Set(
    Object.values(LEVELS.levels).flatMap((level) => level.abilities ?? [])
  )];
}

function fruitNames() {
  return [...new Set([
    ...Object.keys(FRUITS.fruits),
    ...STAGES.map((stage) => stage['big-fruit']).filter((fruit) => typeof fruit === 'string')
  ])];
}

describe('i18n resolution contract', () => {
  test('the default accessor and the physical locale file are the same tree', () => {
    expect(DEFAULT_I18N).toEqual(I18N);
  });

  test('every ability declared in levels.json resolves through player.abilities.*', () => {
    for (const ability of levelAbilityNames()) {
      const key = `player.abilities.${ability}`;

      expect({ ability, key, resolved: textResolver.has(key) }).toEqual({ ability, key, resolved: true });
      expect(textResolver.text(key)).not.toBe(key);
    }
  });

  test('every configured ability resolves through player.abilities.*', () => {
    for (const ability of Object.keys(ABILITY_CONFIG.abilities)) {
      const key = `player.abilities.${ability}`;

      expect({ ability, key, resolved: textResolver.has(key) }).toEqual({ ability, key, resolved: true });
    }
  });

  test('the stomp and slide-attack abilities use their display names', () => {
    expect(textResolver.text('player.abilities.stomp')).toBe('Stomp');
    expect(textResolver.text('player.abilities.slide-attack')).toBe('Slide Attack');
  });

  test('every fruit declared in fruits.json and every stage big-fruit resolves through fruits.*', () => {
    for (const fruit of fruitNames()) {
      const key = `fruits.${fruit}`;

      expect({ fruit, key, resolved: textResolver.has(key) }).toEqual({ fruit, key, resolved: true });
      expect(textResolver.text(key)).not.toBe(key);
    }
  });

  test('keys with no code or data reader are absent', () => {
    const removedKeys = [
      'collectibles.star',
      'collectibles.checkpoint',
      'collectibles.extra-life',
      'hud.stars',
      'messages.checkpoint-activated'
    ];

    for (const key of removedKeys) {
      expect({ key, resolved: textResolver.has(key) }).toEqual({ key, resolved: false });
    }
  });
});
