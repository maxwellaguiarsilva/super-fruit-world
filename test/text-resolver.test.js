import { describe, expect, test } from 'bun:test';
import { TextResolver } from '../src/engine/data/text-resolver.js';

const STRINGS = {
  'hud.score-prefix': 'Score: ',
  'menu.main.title': 'Super Fruit World',
  'dialogue.advance-hint': 'Confirm: Continue'
};

function storeResolver(options = {}) {
  return new TextResolver((key) => STRINGS[key], options);
}

describe('TextResolver', () => {
  test('resolves a known key to its string', () => {
    const resolver = storeResolver();

    expect(resolver.text('hud.score-prefix')).toBe('Score: ');
    expect(resolver.text('menu.main.title')).toBe('Super Fruit World');
  });

  test('reports whether a key resolves', () => {
    const resolver = storeResolver();

    expect(resolver.has('dialogue.advance-hint')).toBe(true);
    expect(resolver.has('dialogue.missing')).toBe(false);
  });

  test('returns the key itself and reports it once when the key is missing', () => {
    const reported = [];
    const resolver = new TextResolver(() => null, { onMissing: (key) => reported.push(key) });

    expect(resolver.text('dialogue.missing')).toBe('dialogue.missing');
    expect(resolver.text('dialogue.missing')).toBe('dialogue.missing');
    expect(reported).toEqual(['dialogue.missing']);
  });

  test('never throws when the lookup throws', () => {
    const reported = [];
    const resolver = new TextResolver(() => {
      throw new Error('lookup failed');
    }, { onMissing: (key) => reported.push(key) });

    expect(() => resolver.text('any.key')).not.toThrow();
    expect(resolver.text('any.key')).toBe('any.key');
    expect(resolver.has('any.key')).toBe(false);
    expect(reported).toEqual(['any.key']);
  });

  test('does not report a missing key from has', () => {
    const reported = [];
    const resolver = new TextResolver(() => null, { onMissing: (key) => reported.push(key) });

    expect(resolver.has('any.key')).toBe(false);
    expect(reported).toEqual([]);
  });

  test('treats non-string values as missing', () => {
    const reported = [];
    const resolver = new TextResolver(() => 42, { onMissing: (key) => reported.push(key) });

    expect(resolver.has('numeric.value')).toBe(false);
    expect(resolver.text('numeric.value')).toBe('numeric.value');
    expect(reported).toEqual(['numeric.value']);
  });

  test('requires a lookup function', () => {
    expect(() => new TextResolver(null)).toThrow(TypeError);
    expect(() => new TextResolver('not-a-function')).toThrow('TextResolver requires a lookup function.');
  });
});
