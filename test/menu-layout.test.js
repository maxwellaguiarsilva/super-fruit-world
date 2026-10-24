import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

import { TextResolver } from '../src/engine/data/text-resolver.js';
import { UiBuilder } from '../src/app/factories/ui-builder.js';
import { PauseMenu, GameOverScreen, StageClearScreen, SettingsMenu } from '../src/game/ui/ui-components.js';

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8'));
}

function flattenStrings(node, prefix = '', result = {}) {
  for (const [key, value] of Object.entries(node)) {
    const keyPath = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenStrings(value, keyPath, result);
    } else if (typeof value === 'string') {
      result[keyPath] = value;
    }
  }
  return result;
}

const MENUS = readJson('data/ui/menus.json');
const COLORS = readJson('data/colors.json');
const STRINGS = flattenStrings(readJson('data/i18n/default.json'));

const textResolver = new TextResolver((key) => STRINGS[key], { onMissing: () => {} });

function createMenuConfig(screenKey) {
  return UiBuilder.buildMenuSubConfig(MENUS, screenKey, COLORS);
}

function createRenderer() {
  const texts = [];

  return {
    viewportWidth: 40,
    viewportHeight: 30,
    texts,
    drawRect() {},
    drawText(text, x, y, font, color, align) {
      texts.push({ text, x, y, font, color, align });
    },
    drawCircle() {},
    drawLine() {}
  };
}

function findText(renderer, value) {
  return renderer.texts.find((entry) => entry.text === value);
}

describe('menu layout configuration', () => {
  test('a changed item start position moves the game-over button', () => {
    const config = createMenuConfig('game-over');
    const screen = new GameOverScreen(config, textResolver, { continues: 1, lives: 3 });
    const renderer = createRenderer();

    screen.render(renderer);
    expect(findText(renderer, '> Continue <').y).toBe(7.2);

    config.layout.items['start-y'] = 10.5;
    renderer.texts.length = 0;
    screen.render(renderer);

    expect(findText(renderer, '> Continue <').y).toBe(10.5);
  });

  test('a changed row position moves the stage-clear score row', () => {
    const config = createMenuConfig('stage-clear');
    const screen = new StageClearScreen(config, textResolver, {
      stageName: 'strawberry-fields',
      fruit: () => null,
      abilities: () => [],
      score: () => 42
    });
    const renderer = createRenderer();

    screen.render(renderer);
    expect(findText(renderer, 'Score: 42').y).toBe(6.5);

    config.layout.rows.score['offset-y'] = 1.25;
    renderer.texts.length = 0;
    screen.render(renderer);

    expect(findText(renderer, 'Score: 42').y).toBe(1.25);
  });

  test('the pause menu reads its title offset and button prefixes from configuration', () => {
    const config = createMenuConfig('pause-menu');
    const screen = new PauseMenu(config, textResolver);
    const renderer = createRenderer();

    screen.render(renderer);

    expect(findText(renderer, 'Paused').y).toBe(2.2);
    expect(findText(renderer, '> Resume')).toBeDefined();
    expect(findText(renderer, '  Settings')).toBeDefined();
    expect(findText(renderer, '> Resume <')).toBeUndefined();
  });

  test('the settings menu reads its title, row layout and prefixes from configuration', () => {
    const config = createMenuConfig('settings');
    const screen = new SettingsMenu(config, textResolver, { get: () => 0.5, set() {} });
    const renderer = createRenderer();

    screen.render(renderer);

    expect(findText(renderer, 'Settings').y).toBe(1.5);
    expect(findText(renderer, 'Settings').font).toBe("0.7px 'Comic Sans MS', 'Comic Sans', monospace");
    expect(findText(renderer, '> Music Volume <').y).toBe(3.0);
    expect(findText(renderer, 'SFX Volume').y).toBe(4.15);
    expect(findText(renderer, 'Controls').y).toBe(5.3);

    config.layout.title['offset-y'] = 0.5;
    config.layout.title['font-size-offset'] = 0.4;
    config.layout.items['start-y'] = 1.0;
    config.layout.items.gap = 0.9;
    config.layout.rows.gap = 2.0;
    config.layout.items['selected-prefix'] = '>> ';
    config.layout.items['selected-suffix'] = ' <<';
    config.layout.items['default-prefix'] = '  ';
    config.layout.items['default-suffix'] = '';
    renderer.texts.length = 0;
    screen.render(renderer);

    expect(findText(renderer, 'Settings').y).toBe(0.5);
    expect(findText(renderer, 'Settings').font).toBe("1px 'Comic Sans MS', 'Comic Sans', monospace");
    expect(findText(renderer, '>> Music Volume <<').y).toBe(1.0);
    expect(findText(renderer, '  SFX Volume').y).toBe(3.0);
    expect(findText(renderer, '  Controls').y).toBe(5.0);
    expect(findText(renderer, '  Back').y).toBe(5.9);
  });

  test('game-over and stage-clear keep an opaque overlay so the stage stays hidden', () => {
    const gameOver = createMenuConfig('game-over');
    const stageClear = createMenuConfig('stage-clear');

    expect(gameOver['overlay-opacity']).toBe(1);
    expect(stageClear['overlay-opacity']).toBe(1);
  });
});
