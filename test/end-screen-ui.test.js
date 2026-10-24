import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

import { TextResolver } from '../src/engine/data/text-resolver.js';
import { UiBuilder } from '../src/app/factories/ui-builder.js';
import { Menu, GameOverScreen, StageClearScreen } from '../src/game/ui/ui-components.js';
import { HealthSystem } from '../src/game/systems/health-system.js';
import { ScoreSystem } from '../src/game/systems/score-system.js';
import { ProgressionSystem } from '../src/game/systems/progression-system.js';

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8'));
}

function flattenStrings(node, prefix = '', result = {}) {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenStrings(value, path, result);
    } else if (typeof value === 'string') {
      result[path] = value;
    }
  }
  return result;
}

const MENUS = readJson('data/ui/menus.json');
const HUD_CONFIG = readJson('data/ui/hud.json');
const INVENTORY_CONFIG = readJson('data/ui/inventory.json');
const COLORS = readJson('data/colors.json');
const STRINGS = flattenStrings(readJson('data/i18n/default.json'));

const textResolver = new TextResolver((key) => STRINGS[key], { onMissing: () => {} });

function createRenderer() {
  const texts = [];
  return {
    viewportWidth: 40,
    viewportHeight: 30,
    texts,
    drawText(text) {
      texts.push(text);
    },
    drawRect() {},
    drawCircle() {}
  };
}

function createMenuConfig(screenKey) {
  return UiBuilder.buildMenuSubConfig(MENUS, screenKey, COLORS);
}

function createBuilder({ healthSystem, scoreSystem, progressionSystem, player = {} }) {
  return new UiBuilder({
    textResolver,
    menuConfig: MENUS,
    hudConfig: HUD_CONFIG,
    inventoryConfig: INVENTORY_CONFIG,
    colorsConfig: COLORS,
    bordersConfig: readJson('data/borders.json'),
    inventory: { slots: [], defaultSelected: null },
    player,
    scoreSystem,
    progressionSystem,
    healthSystem
  });
}

function createProgressionSystem() {
  return new ProgressionSystem(
    readJson('data/player/levels.json'),
    readJson('data/player/fruits.json'),
    COLORS
  );
}

describe('menu visible conditions', () => {
  test('a hidden first button is skipped and the next visible button confirms', () => {
    const menu = new Menu(createMenuConfig('game-over'), textResolver, {
      'condition-hidden': () => false
    });
    menu.items[0]['visible-condition'] = 'condition-hidden';
    const confirmed = [];
    menu.onConfirm = (action) => confirmed.push(action);

    menu.confirm();

    expect(confirmed).toEqual(['quit-to-menu']);

    const renderer = createRenderer();
    menu.render(renderer);
    expect(renderer.texts).toEqual(['> Quit <']);
  });

  test('hiding the selected button moves the selection to a visible button', () => {
    let secondVisible = true;
    const menu = new Menu(createMenuConfig('game-over'), textResolver, {
      'condition-second': () => secondVisible
    });
    menu.items[1]['visible-condition'] = 'condition-second';
    const confirmed = [];
    menu.onConfirm = (action) => confirmed.push(action);

    menu.navigateDown();
    expect(menu.selectedIndex).toBe(1);

    secondVisible = false;
    expect(menu.selectedIndex).toBe(0);

    menu.confirm();
    expect(confirmed).toEqual(['continue']);
  });

  test('confirm does nothing when every button is hidden', () => {
    const menu = new Menu(createMenuConfig('game-over'), textResolver, {
      'condition-hidden': () => false
    });
    for (const item of menu.items) {
      item['visible-condition'] = 'condition-hidden';
    }
    const confirmed = [];
    menu.onConfirm = (action) => confirmed.push(action);

    menu.navigateDown();
    menu.confirm();

    expect(confirmed).toEqual([]);
    expect(menu.selectedIndex).toBe(-1);
  });
});

describe('game-over end screen', () => {
  test('continues and lives follow the live health system', () => {
    const healthSystem = new HealthSystem({ 'starting-lives': 3, 'starting-continues': 1 });
    const builder = createBuilder({
      healthSystem,
      scoreSystem: new ScoreSystem(),
      progressionSystem: createProgressionSystem()
    });
    const { gameOverScreen } = builder.stageScreens({ stage: {}, stageName: 'strawberry-fields' });
    const renderer = createRenderer();

    gameOverScreen.render(renderer);
    expect(renderer.texts).toContain('Continues: 1');
    expect(renderer.texts).toContain('Lives: 3');
    expect(renderer.texts).toContain('Press START to continue');
    expect(renderer.texts).toContain('> Continue <');

    healthSystem.continues = 0;
    healthSystem.lives = 2;
    renderer.texts.length = 0;
    gameOverScreen.render(renderer);

    expect(renderer.texts).toContain('Continues: 0');
    expect(renderer.texts).toContain('Lives: 2');
    expect(renderer.texts).not.toContain('Press START to continue');
    expect(renderer.texts).not.toContain('> Continue <');
    expect(renderer.texts).not.toContain('Continue');
    expect(renderer.texts).toContain('> Quit <');
  });

  test('with zero continues only quit is reachable', () => {
    const healthSystem = new HealthSystem({ 'starting-lives': 1, 'starting-continues': 1 });
    const builder = createBuilder({
      healthSystem,
      scoreSystem: new ScoreSystem(),
      progressionSystem: createProgressionSystem()
    });
    const { gameOverScreen } = builder.stageScreens({ stage: {}, stageName: 'strawberry-fields' });
    const confirmed = [];
    gameOverScreen.onConfirm = (action) => confirmed.push(action);

    healthSystem.continues = 0;
    gameOverScreen.confirm();
    expect(confirmed).toEqual(['quit-to-menu']);

    gameOverScreen.navigateUp();
    expect(gameOverScreen.selectedIndex).toBe(1);
  });
});

describe('stage-clear end screen', () => {
  test('the summary resolves the fruit, its ability and the live score', () => {
    const scoreSystem = new ScoreSystem();
    scoreSystem.addScore(120);
    const healthSystem = new HealthSystem({ 'starting-lives': 3, 'starting-continues': 1 });
    const builder = createBuilder({
      healthSystem,
      scoreSystem,
      progressionSystem: createProgressionSystem()
    });
    const { clearScreen } = builder.stageScreens({
      stage: {},
      stageName: 'strawberry-fields',
      bigFruit: 'strawberry'
    });
    const renderer = createRenderer();

    clearScreen.render(renderer);
    expect(renderer.texts).toContain('strawberry-fields');
    expect(renderer.texts).toContain('Collected: Strawberry');
    expect(renderer.texts).toContain('Ability: Dash');
    expect(renderer.texts).toContain('Score: 120');
    expect(renderer.texts).toContain('> Continue <');

    scoreSystem.addScore(30);
    renderer.texts.length = 0;
    clearScreen.render(renderer);

    expect(renderer.texts).toContain('Score: 150');
  });

  test('the ability row is omitted when the stage has no big fruit', () => {
    const builder = createBuilder({
      healthSystem: new HealthSystem(),
      scoreSystem: new ScoreSystem(),
      progressionSystem: createProgressionSystem()
    });
    const { clearScreen } = builder.stageScreens({ stage: {}, stageName: 'avocado-grove' });
    const renderer = createRenderer();

    clearScreen.render(renderer);

    expect(renderer.texts).toContain('Score: 0');
    expect(renderer.texts.some((text) => text.startsWith('Ability:'))).toBe(false);
    expect(renderer.texts.some((text) => text.startsWith('Collected:'))).toBe(false);
  });

  test('the stage name resolves the display-name-key through the text resolver', () => {
    const builder = createBuilder({
      healthSystem: new HealthSystem(),
      scoreSystem: new ScoreSystem(),
      progressionSystem: createProgressionSystem()
    });
    const { clearScreen } = builder.stageScreens({
      stage: {},
      stageName: 'strawberry-fields',
      stageNameKey: 'stage.strawberry-fields'
    });
    const renderer = createRenderer();

    clearScreen.render(renderer);

    expect(renderer.texts).toContain('Strawberry Fields');
    expect(renderer.texts).not.toContain('strawberry-fields');
  });

  test('the stage name falls back to the raw name without a display-name-key', () => {
    const builder = createBuilder({
      healthSystem: new HealthSystem(),
      scoreSystem: new ScoreSystem(),
      progressionSystem: createProgressionSystem()
    });
    const { clearScreen } = builder.stageScreens({
      stage: {},
      stageName: 'strawberry-fields',
      stageNameKey: null
    });
    const renderer = createRenderer();

    clearScreen.render(renderer);

    expect(renderer.texts).toContain('strawberry-fields');
  });

  test('the screen resolves providers at render time', () => {
    let fruit = 'avocado';
    let abilities = ['shoot', 'shield'];
    let score = 10;
    const screen = new StageClearScreen(createMenuConfig('stage-clear'), textResolver, {
      stageName: 'avocado-grove',
      fruit: () => fruit,
      abilities: () => abilities,
      score: () => score
    });
    const renderer = createRenderer();

    screen.render(renderer);
    expect(renderer.texts).toContain('Collected: Avocado');
    expect(renderer.texts).toContain('Ability: Shoot, Shield');
    expect(renderer.texts).toContain('Score: 10');

    fruit = 'strawberry';
    abilities = ['dash'];
    score = 75;
    renderer.texts.length = 0;
    screen.render(renderer);

    expect(renderer.texts).toContain('Collected: Strawberry');
    expect(renderer.texts).toContain('Ability: Dash');
    expect(renderer.texts).toContain('Score: 75');
  });
});
