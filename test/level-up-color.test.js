import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

import { createAbilities } from '../src/app/factories/ability-factory.js';
import { Collectible } from '../src/game/entities/collectible.js';
import { ProgressionSystem } from '../src/game/systems/progression-system.js';
import { resolveColor } from '../src/game/utils/color-utils.js';

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8'));
}

function bigFruitObject(stagePath) {
  const stage = readJson(stagePath);
  return stage.sections
    .flatMap((section) => section.objects)
    .find((object) => object.type === 'big-fruit');
}

function createPlayer(abilities, progressionSystem, colorsConfig) {
  return {
    level: 0,
    color: resolveColor('black', colorsConfig),
    abilities,
    ability(name) {
      return abilities.find((ability) => ability.name === name);
    },
    progressionSystem,
    audioEngine: null,
    healthSystem: {
      maxLife: 10,
      lives: 0,
      addLife() {
        this.lives += 1;
      }
    }
  };
}

function collectBigFruit(stagePath, player) {
  const collectible = new Collectible(0, 0, 2, 2, {
    ...readJson('data/collectibles/big-fruit.json'),
    ...bigFruitObject(stagePath)
  });
  collectible.collect(player);
}

describe('level-up player color', () => {
  const colorsConfig = readJson('data/colors.json');
  const fruitsConfig = readJson('data/player/fruits.json');
  const levelsConfig = readJson('data/player/levels.json');
  const abilitiesConfig = readJson('data/player/abilities.json');

  test('collecting the strawberry applies the resolved red palette color immediately', () => {
    const progressionSystem = new ProgressionSystem(levelsConfig, fruitsConfig, colorsConfig);
    const abilities = createAbilities(abilitiesConfig, { projectileFactory: () => null });
    const player = createPlayer(abilities, progressionSystem, colorsConfig);

    expect(player.color).toBe(colorsConfig.colors.black.light);

    collectBigFruit('data/stages/strawberry-fields.json', player);

    expect(player.level).toBe(1);
    expect(player.color).toBe(resolveColor('red', colorsConfig));
    expect(player.color).toBe(colorsConfig.colors.red.light);
  });

  test('collecting the avocado applies the resolved green palette color immediately', () => {
    const progressionSystem = new ProgressionSystem(levelsConfig, fruitsConfig, colorsConfig);
    const abilities = createAbilities(abilitiesConfig, { projectileFactory: () => null });
    const player = createPlayer(abilities, progressionSystem, colorsConfig);
    player.level = 1;
    player.color = resolveColor('red', colorsConfig);

    collectBigFruit('data/stages/avocado-grove.json', player);

    expect(player.level).toBe(2);
    expect(player.color).toBe(resolveColor('green', colorsConfig));
    expect(player.color).toBe(colorsConfig.colors.green.light);
  });

  test('a fruit that is not an upgrade leaves the color unchanged', () => {
    const progressionSystem = new ProgressionSystem(levelsConfig, fruitsConfig, colorsConfig);
    const abilities = createAbilities(abilitiesConfig, { projectileFactory: () => null });
    const player = createPlayer(abilities, progressionSystem, colorsConfig);
    player.level = 2;
    player.color = resolveColor('green', colorsConfig);

    collectBigFruit('data/stages/strawberry-fields.json', player);

    expect(player.level).toBe(2);
    expect(player.color).toBe(resolveColor('green', colorsConfig));
    expect(player.healthSystem.lives).toBe(1);
  });

  test('the color comes from the palette order, not a duplicated table', () => {
    const progressionSystem = new ProgressionSystem(levelsConfig, fruitsConfig, colorsConfig);
    const abilities = createAbilities(abilitiesConfig, { projectileFactory: () => null });
    const player = createPlayer(abilities, progressionSystem, colorsConfig);

    progressionSystem.applyLevelUp(player, 'strawberry');

    const levelColorName = colorsConfig['color-order'][player.level];

    expect(levelColorName).toBe('red');
    expect(player.color).toBe(colorsConfig.colors[levelColorName].light);
  });
});
