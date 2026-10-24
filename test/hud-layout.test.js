import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'bun:test';

import { TextResolver } from '../src/engine/data/text-resolver.js';
import { anchorPosition } from '../src/engine/ui/ui-element.js';
import { resolveConfig } from '../src/game/utils/color-utils.js';
import { HUD } from '../src/game/ui/ui-components.js';

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

const HUD_CONFIG = readJson('data/ui/hud.json');
const COLORS = readJson('data/colors.json');
const BORDERS = readJson('data/borders.json');
const STRINGS = flattenStrings(readJson('data/i18n/default.json'));

const textResolver = new TextResolver((key) => STRINGS[key], { onMissing: () => {} });

function createHudConfig() {
  return resolveConfig(HUD_CONFIG, COLORS);
}

function createRenderer() {
  const calls = { rects: [], texts: [], circles: [], lines: [] };

  return {
    viewportWidth: 40,
    viewportHeight: 30,
    calls,
    drawRect(...args) {
      calls.rects.push(args);
    },
    drawText(...args) {
      calls.texts.push(args);
    },
    drawCircle(...args) {
      calls.circles.push(args);
    },
    drawLine(...args) {
      calls.lines.push(args);
    }
  };
}

function createPlayer({ defaultSelected = null, items = {} } = {}) {
  return {
    level: 1,
    noteCollection: null,
    healthSystem: { life: 5, maxLife: 10 },
    scoreSystem: { coins: 0, score: 0 },
    inventory: {
      defaultSelected,
      count(name) {
        return items[name] ?? 0;
      }
    }
  };
}

function textValues(renderer) {
  return renderer.calls.texts.map((call) => call[0]);
}

function collectDataFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectDataFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

describe('HUD chrome', () => {
  test('draws the configured background band and bottom border', () => {
    const renderer = createRenderer();

    new HUD(createHudConfig(), createPlayer(), textResolver, BORDERS).render(renderer);

    const band = renderer.calls.rects[0];
    expect(band.slice(0, 4)).toEqual([0, 0, 40, HUD_CONFIG.hud.height]);
    expect(band[5]).toBe('rgba(0, 0, 0, 0.7)');
    expect(renderer.calls.lines).toContainEqual([0, HUD_CONFIG.hud.height, 40, HUD_CONFIG.hud.height, '#FFFFFF', 0.1]);
  });

  test('draws nothing when the HUD is disabled', () => {
    const config = createHudConfig();
    config.hud.enabled = false;
    const renderer = createRenderer();

    new HUD(config, createPlayer(), textResolver, BORDERS).render(renderer);

    expect(renderer.calls.rects).toEqual([]);
    expect(renderer.calls.texts).toEqual([]);
    expect(renderer.calls.circles).toEqual([]);
    expect(renderer.calls.lines).toEqual([]);
  });

  test('skips the note tracker when its element is disabled', () => {
    const config = createHudConfig();
    config.elements['note-tracker'].enabled = false;
    const player = createPlayer();
    player.noteCollection = {
      collectedCount: 2,
      totalNotes: 8,
      isCollected: () => false
    };
    const renderer = createRenderer();

    new HUD(config, player, textResolver, BORDERS).render(renderer);

    expect(textValues(renderer).some((text) => text.startsWith('Notes: '))).toBe(false);
  });
});

describe('HUD inventory indicator', () => {
  test('draws the selected item and its live count at the configured anchor', () => {
    const player = createPlayer({ defaultSelected: 'ammo', items: { ammo: 7 } });
    const renderer = createRenderer();

    new HUD(createHudConfig(), player, textResolver, BORDERS).render(renderer);

    const frame = renderer.calls.rects.find((rect) => rect[2] === 0.8 && rect[3] === 0.5);
    expect(frame[0]).toBe(38);
    expect(frame[1]).toBe(0.2);

    const inventoryCfg = HUD_CONFIG.elements['inventory-indicator'];
    const expected = anchorPosition(
      inventoryCfg.anchor,
      inventoryCfg.offset,
      inventoryCfg.size.width,
      inventoryCfg.size.height,
      renderer.viewportWidth,
      renderer.viewportHeight
    );
    expect(frame.slice(0, 2)).toEqual([expected.x, expected.y]);

    const texts = textValues(renderer);
    expect(texts).toContain('Inventory');
    expect(texts).toContain('ammo');
    expect(texts).toContain('x7');

    const itemCall = renderer.calls.texts.find((call) => call[0] === 'ammo');
    const countCall = renderer.calls.texts.find((call) => call[0] === 'x7');
    expect(itemCall[4]).toBe('#FFFFFF');
    expect(countCall[4]).toBe('#BFBF40');
  });

  test('draws the empty frame and label when no item is selected', () => {
    const renderer = createRenderer();

    new HUD(createHudConfig(), createPlayer(), textResolver, BORDERS).render(renderer);

    const frame = renderer.calls.rects.find((rect) => rect[2] === 0.8 && rect[3] === 0.5);
    expect(frame).toBeDefined();

    const texts = textValues(renderer);
    expect(texts).toContain('Inventory');
    expect(texts.some((text) => text.startsWith('x'))).toBe(false);
  });
});

describe('HUD data', () => {
  test('no data file references the removed star counter', () => {
    const dataRoot = new URL('../data/', import.meta.url).pathname;
    const references = collectDataFiles(dataRoot)
      .filter((file) => readFileSync(file, 'utf8').includes('star-counter'));

    expect(references).toEqual([]);
  });
});
