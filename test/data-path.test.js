import { describe, expect, test } from 'bun:test';
import { DataDriven } from '../src/engine/data/data-driven.js';

describe('DataDriven.keyForDataPath', () => {
  test('strips the data prefix and the json extension from a top-level file', () => {
    expect(DataDriven.keyForDataPath('data/game-config.json')).toBe('game-config');
  });

  test('converts directory separators to accessor separators', () => {
    expect(DataDriven.keyForDataPath('data/audio/bgm/title-screen.json')).toBe('audio.bgm.title-screen');
  });

  test('keeps lower-kebab-case segments intact', () => {
    expect(DataDriven.keyForDataPath('data/i18n/en-us.json')).toBe('i18n.en-us');
  });

  test('accepts a path without the data prefix or json extension', () => {
    expect(DataDriven.keyForDataPath('player/fruits.json')).toBe('player.fruits');
    expect(DataDriven.keyForDataPath('data/colors')).toBe('colors');
  });
});
