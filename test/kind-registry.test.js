import { describe, expect, test } from 'bun:test';
import { createKindRegistry } from '../src/app/content/kind-registry.js';

describe('createKindRegistry', () => {
  test('resolves a registered value to its entry', () => {
    const registry = createKindRegistry('ability kind', [
      ['dash', 'dash-entry'],
      ['shoot', 'shoot-entry']
    ]);

    expect(registry.resolve('dash')).toBe('dash-entry');
    expect(registry.resolve('shoot')).toBe('shoot-entry');
  });

  test('names the kind and the value when a value is not registered', () => {
    const registry = createKindRegistry('enemy kind', [
      ['patrol', 'patrol-entry'],
      ['shooter', 'shooter-entry']
    ]);

    expect(() => registry.resolve('diver')).toThrow('Unknown enemy kind "diver"');
    expect(() => registry.resolve('diver')).toThrow('patrol, shooter');
  });

  test('rejects a duplicated registration entry', () => {
    expect(() => createKindRegistry('stage object kind', [
      ['coin', 'first'],
      ['coin', 'second']
    ])).toThrow('Duplicate stage object kind registration "coin"');
  });

  test('reports registered values in registration order', () => {
    const registry = createKindRegistry('stage object kind', [
      ['tile', {}],
      ['enemy', {}],
      ['checkpoint', {}]
    ]);

    expect(registry.values()).toEqual(['tile', 'enemy', 'checkpoint']);
    expect(registry.has('enemy')).toBe(true);
    expect(registry.has('coin')).toBe(false);
    expect(registry.entries().map(([value]) => value)).toEqual(['tile', 'enemy', 'checkpoint']);
  });
});
