import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

import { Collectible } from '../src/game/entities/collectible.js';
import { Inventory } from '../src/game/systems/inventory.js';
import { resolveColor } from '../src/game/utils/color-utils.js';
import { HUD } from '../src/game/ui/ui-components.js';

const AMMO_PATH = new URL('../data/collectibles/ammo.json', import.meta.url);
const COLORS_PATH = new URL('../data/colors.json', import.meta.url);
const BORDERS_PATH = new URL('../data/borders.json', import.meta.url);
const STAGE_PATH = new URL('../data/stages/strawberry-fields.json', import.meta.url);
const HUD_PATH = new URL('../data/ui/hud.json', import.meta.url);
const I18N_PATH = new URL('../data/i18n/default.json', import.meta.url);

function readJson(url) {
  return JSON.parse(readFileSync(url, 'utf8'));
}

function createPlayer(inventory) {
  return {
    level: 2,
    inventory,
    audioEngine: null,
    noteCollection: null,
    healthSystem: { life: 10, maxLife: 10 },
    scoreSystem: { coins: 0, score: 0 }
  };
}

function collectibleFromData() {
  const config = readJson(AMMO_PATH);

  return new Collectible(0, 0, 0.5, 0.5, {
    type: config.type,
    effect: config.effect
  });
}

describe('ammo collectible data', () => {
  test('declares the add-ammo effect with a positive amount', () => {
    const config = readJson(AMMO_PATH);

    expect(config.type).toBe('ammo');
    expect(config.effect.action).toBe('add-ammo');
    expect(config.effect.value).toBeGreaterThan(0);
    expect(typeof config.description).toBe('string');
    expect(config.description.length).toBeGreaterThan(0);
  });

  test('visual colors resolve through the colors configuration', () => {
    const config = readJson(AMMO_PATH);
    const colorsConfig = readJson(COLORS_PATH);
    const bordersConfig = readJson(BORDERS_PATH);

    expect(resolveColor(config.visual['fill-color'], colorsConfig)).toMatch(/^#[0-9A-F]{6}$/i);
    expect(resolveColor(config.visual['border-color'], colorsConfig)).toMatch(/^#[0-9A-F]{6}$/i);
    expect(bordersConfig.borders[config.visual.border]).toBeDefined();
  });

  test('stage places ammo pickups near the start and near the shooter enemies', () => {
    const stage = readJson(STAGE_PATH);
    const sections = stage.sections;
    const ammo = [];

    for (const section of sections) {
      for (const object of section.objects ?? []) {
        if (object.type === 'ammo') {
          ammo.push({ section: section.name, object });
        }
      }
    }

    const start = sections.find((section) => (section.objects ?? []).some((object) => object.type === 'player-spawn'));
    const gauntlet = sections.find((section) => (section.objects ?? []).some((object) => object.type.endsWith('-shooter')));

    expect(ammo.length).toBeGreaterThan(1);
    expect(ammo.some((entry) => entry.section === start.name)).toBe(true);
    expect(ammo.some((entry) => entry.section === gauntlet.name)).toBe(true);
  });

  test('collecting ammo accumulates the ammo count read by the HUD', () => {
    const inventory = new Inventory({ 'max-slots': 8 }, {
      audioEngine: null,
      usage: {},
      effects: null
    });
    const player = createPlayer(inventory);
    const config = readJson(AMMO_PATH);

    collectibleFromData().collect(player);
    collectibleFromData().collect(player);

    expect(inventory.count('ammo')).toBe(config.effect.value * 2);
    expect(inventory.count(config.type)).toBe(config.effect.value * 2);
  });

  test('the HUD ammo counter renders the collected amount', () => {
    const i18n = readJson(I18N_PATH);
    const textResolver = {
      text(key) {
        let value = i18n;
        for (const segment of key.split('.')) {
          value = value?.[segment];
        }
        return typeof value === 'string' ? value : key;
      }
    };
    const inventory = new Inventory({ 'max-slots': 8 }, {
      audioEngine: null,
      usage: {},
      effects: null
    });
    const player = createPlayer(inventory);
    const ammo = readJson(AMMO_PATH);

    collectibleFromData().collect(player);

    const drawn = [];
    const renderer = {
      viewportWidth: 40,
      viewportHeight: 30,
      drawText(text) { drawn.push(text); },
      drawRect() {},
      drawCircle() {},
      drawPolygon() {}
    };

    new HUD(readJson(HUD_PATH), player, textResolver).render(renderer);

    expect(drawn).toContain(`${i18n.hud['ammo-prefix']}${ammo.effect.value}`);
    expect(player.inventory.count('ammo')).toBe(ammo.effect.value);
  });
});
