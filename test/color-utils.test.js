import { describe, expect, test } from 'bun:test';
import { resolveColor, resolveConfig } from '../src/game/utils/color-utils.js';

const colorsConfig = {
  colors: {
    red: { light: '#ff0000', dark: '#990000' },
    blue: { light: '#0000ff', dark: '#000099' }
  }
};

describe('resolveColor', () => {
  test('returns the light variant for a base color name', () => {
    expect(resolveColor('red', colorsConfig)).toBe('#ff0000');
  });

  test('returns the dark variant for a name with the dark prefix', () => {
    expect(resolveColor('dark-red', colorsConfig)).toBe('#990000');
  });

  test('returns a literal hex color that is not in the palette', () => {
    expect(resolveColor('#123abc', colorsConfig)).toBe('#123abc');
  });

  test('returns null for an unknown name and for an empty name', () => {
    expect(resolveColor('missing', colorsConfig)).toBeNull();
    expect(resolveColor('', colorsConfig)).toBeNull();
  });

  test('returns null for a known name when no palette is supplied', () => {
    expect(resolveColor('red', null)).toBeNull();
  });
});

describe('resolveConfig', () => {
  test('resolves the color key and every key ending in -color', () => {
    const resolved = resolveConfig(
      {
        color: 'red',
        'background-color': 'dark-blue',
        'fill-color': '#abcdef'
      },
      colorsConfig
    );

    expect(resolved).toEqual({
      color: '#ff0000',
      'background-color': '#000099',
      'fill-color': '#abcdef'
    });
  });

  test('resolves colors nested in objects and arrays', () => {
    const resolved = resolveConfig(
      {
        sections: [
          {
            'tile-color': 'blue',
            nested: { color: 'dark-red' }
          }
        ]
      },
      colorsConfig
    );

    expect(resolved).toEqual({
      sections: [
        {
          'tile-color': '#0000ff',
          nested: { color: '#990000' }
        }
      ]
    });
  });

  test('leaves non-color keys and non-string color values untouched', () => {
    const resolved = resolveConfig(
      {
        width: 32,
        enabled: true,
        'border-color': 7,
        label: 'red'
      },
      colorsConfig
    );

    expect(resolved).toEqual({
      width: 32,
      enabled: true,
      'border-color': 7,
      label: 'red'
    });
  });

  test('returns non-object input unchanged', () => {
    expect(resolveConfig(null, colorsConfig)).toBeNull();
    expect(resolveConfig('red', colorsConfig)).toBe('red');
  });
});
