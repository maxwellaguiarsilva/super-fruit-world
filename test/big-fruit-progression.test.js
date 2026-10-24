import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

import { createAbilities } from '../src/app/factories/ability-factory.js';
import { Collectible } from '../src/game/entities/collectible.js';
import { ProgressionSystem } from '../src/game/systems/progression-system.js';

const STRAWBERRY_STAGE_PATH = new URL('../data/stages/strawberry-fields.json', import.meta.url);
const AVOCADO_STAGE_PATH = new URL('../data/stages/avocado-grove.json', import.meta.url);
const BIG_FRUIT_PATH = new URL('../data/collectibles/big-fruit.json', import.meta.url);
const FRUITS_PATH = new URL('../data/player/fruits.json', import.meta.url);
const LEVELS_PATH = new URL('../data/player/levels.json', import.meta.url);
const ABILITIES_PATH = new URL('../data/player/abilities.json', import.meta.url);
const COLORS_PATH = new URL('../data/colors.json', import.meta.url);

function readJson(url) {
  return JSON.parse(readFileSync(url, 'utf8'));
}

function bigFruitObjects(stagePath) {
  const stage = readJson(stagePath);
  return {
    stage,
    objects: stage.sections.flatMap((section) =>
      section.objects.filter((object) => object.type === 'big-fruit')
    )
  };
}

function createPlayer(abilities, progressionSystem) {
  return {
    level: 0,
    audioEngine: null,
    abilities,
    ability(name) {
      return abilities.find((ability) => ability.name === name);
    },
    progressionSystem,
    healthSystem: {
      extraLives: 0,
      addLife() {
        this.extraLives += 1;
      }
    }
  };
}

describe('big fruit level-up data', () => {
  test('each stage big fruit names the fruit through the collectible key', () => {
    for (const [stagePath, fruitName] of [
      [STRAWBERRY_STAGE_PATH, 'strawberry'],
      [AVOCADO_STAGE_PATH, 'avocado']
    ]) {
      const { stage, objects } = bigFruitObjects(stagePath);

      expect(objects.length).toBe(1);
      expect(objects[0].collectible).toBe(fruitName);
      expect(stage['big-fruit']).toBe(fruitName);
      expect(objects[0].fruit).toBeUndefined();
    }
  });

  test('the strawberry maps to the red level and the dash ability', () => {
    const fruitsConfig = readJson(FRUITS_PATH);
    const levelsConfig = readJson(LEVELS_PATH);
    const abilitiesConfig = readJson(ABILITIES_PATH);
    const colorsConfig = readJson(COLORS_PATH);

    expect(fruitsConfig.fruits.strawberry.color).toBe('red');
    expect(colorsConfig['color-order'].indexOf('red')).toBe(1);
    expect(levelsConfig.levels.red.abilities).toContain('dash');
    expect(abilitiesConfig.abilities.dash['required-level']).toBe(1);
  });

  test('collecting the strawberry big fruit grants level 1 and the dash ability', () => {
    const bigFruitConfig = readJson(BIG_FRUIT_PATH);
    const fruitsConfig = readJson(FRUITS_PATH);
    const levelsConfig = readJson(LEVELS_PATH);
    const abilitiesConfig = readJson(ABILITIES_PATH);
    const colorsConfig = readJson(COLORS_PATH);

    const progressionSystem = new ProgressionSystem(levelsConfig, fruitsConfig, colorsConfig);
    const abilities = createAbilities(abilitiesConfig, { projectileFactory: () => null });
    const player = createPlayer(abilities, progressionSystem);
    const { objects } = bigFruitObjects(STRAWBERRY_STAGE_PATH);

    const collectible = new Collectible(0, 0, 2, 2, {
      ...bigFruitConfig,
      ...objects[0]
    });

    collectible.collect(player);

    expect(player.level).toBe(1);
    expect(player.healthSystem.extraLives).toBe(0);
    expect(progressionSystem.getLevelForCollectible('strawberry')).toBe(1);
    expect(progressionSystem.getAbilitiesForLevel(player.level)).toContain('dash');
    expect(player.ability('dash').requiredLevel).toBeLessThanOrEqual(player.level);
  });
});
