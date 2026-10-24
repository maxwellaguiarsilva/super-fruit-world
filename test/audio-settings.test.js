import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

import { AudioEngine } from '../src/engine/audio/audio-engine.js';
import {
  SettingsStore,
  SETTINGS_SCHEMA_VERSION,
  restoreAudioSettings
} from '../src/engine/audio/audio-settings.js';
import { NoteFrequencyCalculator } from '../src/engine/audio/note-frequency-calculator.js';
import { UiBuilder } from '../src/app/factories/ui-builder.js';
import { SettingsMenu } from '../src/game/ui/ui-components.js';

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8'));
}

class MemorySaveSystem {
  #entries = new Map();

  save(key, data) {
    this.#entries.set(key, JSON.parse(JSON.stringify(data)));
  }

  load(key) {
    if (!this.#entries.has(key)) {
      return null;
    }
    return JSON.parse(JSON.stringify(this.#entries.get(key)));
  }

  delete(key) {
    this.#entries.delete(key);
  }

  has(key) {
    return this.#entries.has(key);
  }
}

const AUDIO_CONFIG = readJson('data/audio/config.json');
const SYNTHESIS_CONFIG = readJson('data/audio/synthesis.json');
const MENUS = readJson('data/ui/menus.json');
const COLORS = readJson('data/colors.json');
const SETTING_KEYS = MENUS.menus.settings.sliders.map((slider) => slider['setting-key']);

function createAudioEngine() {
  const calculator = new NoteFrequencyCalculator(SYNTHESIS_CONFIG.tuning);
  return new AudioEngine(
    AUDIO_CONFIG,
    { sounds: {} },
    {},
    calculator,
    SYNTHESIS_CONFIG['default-envelope']
  );
}

function bootWith(store) {
  const engine = createAudioEngine();
  const settings = restoreAudioSettings({
    engine,
    store,
    settingKeys: SETTING_KEYS
  });
  return { engine, settings };
}

function press(action) {
  return { isPressed: (pressedAction) => pressedAction === action };
}

describe('SettingsStore', () => {
  test('round-trips the volume fields under its own storage key', () => {
    const saves = new MemorySaveSystem();
    const store = new SettingsStore(saves);

    store.save({ 'bgm-volume': 0.3, 'sfx-volume': 0.7 });
    saves.save('progress', { version: 1, score: 50 });

    expect(store.load()).toEqual({ 'bgm-volume': 0.3, 'sfx-volume': 0.7 });
    expect(saves.load('settings')).toEqual({
      version: SETTINGS_SCHEMA_VERSION,
      'bgm-volume': 0.3,
      'sfx-volume': 0.7
    });
    expect(saves.load('progress')).toEqual({ version: 1, score: 50 });
  });

  test('deletes an incompatible schema version', () => {
    const saves = new MemorySaveSystem();
    const store = new SettingsStore(saves);
    saves.save('settings', {
      version: SETTINGS_SCHEMA_VERSION + 1,
      'bgm-volume': 0.2
    });

    expect(store.load()).toBeNull();
    expect(saves.has('settings')).toBe(false);
  });

  test('keeps the valid fields of a partial record', () => {
    const saves = new MemorySaveSystem();
    const store = new SettingsStore(saves);
    saves.save('settings', {
      version: SETTINGS_SCHEMA_VERSION,
      'bgm-volume': 'loud',
      'sfx-volume': 0.4,
      'master-volume': 'half',
      unknown: 1
    });

    expect(store.load()).toEqual({ 'sfx-volume': 0.4 });
  });

  test('treats out-of-range volumes as invalid', () => {
    const saves = new MemorySaveSystem();
    const store = new SettingsStore(saves);
    saves.save('settings', {
      version: SETTINGS_SCHEMA_VERSION,
      'bgm-volume': 1.5,
      'sfx-volume': -0.2
    });

    expect(store.load()).toEqual({});
  });

  test('returns null for a record that is not an object', () => {
    const saves = new MemorySaveSystem();
    const store = new SettingsStore(saves);
    saves.save('settings', 'not-a-record');

    expect(store.load()).toBeNull();
  });
});

describe('Audio settings boot application', () => {
  test('applies the saved values after the engine is constructed', () => {
    const saves = new MemorySaveSystem();
    const store = new SettingsStore(saves);
    store.save({ 'bgm-volume': 0.25, 'sfx-volume': 0.5 });

    const { engine } = bootWith(store);

    expect(engine.bgmVolume).toBe(0.25);
    expect(engine.sfxVolume).toBe(0.5);
    expect(engine.masterVolume).toBe(AUDIO_CONFIG['master-volume']);
  });

  test('falls back per field to the data defaults for invalid values', () => {
    const saves = new MemorySaveSystem();
    const store = new SettingsStore(saves);
    saves.save('settings', {
      version: SETTINGS_SCHEMA_VERSION,
      'bgm-volume': 'loud',
      'sfx-volume': 0.35
    });

    const { engine } = bootWith(store);

    expect(engine.bgmVolume).toBe(AUDIO_CONFIG['bgm-volume']);
    expect(engine.sfxVolume).toBe(0.35);
    expect(engine.masterVolume).toBe(AUDIO_CONFIG['master-volume']);
  });

  test('ignores an incompatible record and keeps the data defaults', () => {
    const saves = new MemorySaveSystem();
    const store = new SettingsStore(saves);
    saves.save('settings', {
      version: SETTINGS_SCHEMA_VERSION + 1,
      'bgm-volume': 0.1,
      'sfx-volume': 0.1
    });

    const { engine } = bootWith(store);

    expect(engine.bgmVolume).toBe(AUDIO_CONFIG['bgm-volume']);
    expect(engine.sfxVolume).toBe(AUDIO_CONFIG['sfx-volume']);
    expect(saves.has('settings')).toBe(false);
  });

  test('persists engine changes made outside the settings screen', () => {
    const saves = new MemorySaveSystem();
    const store = new SettingsStore(saves);

    const { engine } = bootWith(store);
    engine.bgmVolume = 0.4;

    expect(store.load()).toEqual({
      'bgm-volume': 0.4,
      'sfx-volume': AUDIO_CONFIG['sfx-volume']
    });
  });
});

describe('SettingsMenu persistence', () => {
  test('writes a slider adjustment through the engine and the settings store', () => {
    const saves = new MemorySaveSystem();
    const store = new SettingsStore(saves);
    const engine = createAudioEngine();
    const settings = restoreAudioSettings({
      engine,
      store,
      settingKeys: SETTING_KEYS
    });
    const menu = new SettingsMenu(
      UiBuilder.buildMenuSubConfig(MENUS, 'settings', COLORS),
      { text: (key) => key },
      settings
    );

    menu.update(0, press('right'));

    expect(engine.bgmVolume).toBeCloseTo(AUDIO_CONFIG['bgm-volume'] + 0.1, 5);
    expect(store.load()['bgm-volume']).toBeCloseTo(AUDIO_CONFIG['bgm-volume'] + 0.1, 5);
  });
});
