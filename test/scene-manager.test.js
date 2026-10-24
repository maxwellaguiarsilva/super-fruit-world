import { describe, expect, test } from 'bun:test';

import { SceneManager } from '../src/engine/core/scene-manager.js';

function createScene(name) {
  const calls = [];
  return {
    name,
    calls,
    enter(previousScene) {
      calls.push(['enter', previousScene?.name ?? null]);
    },
    exit(nextScene) {
      calls.push(['exit', nextScene?.name ?? null]);
    }
  };
}

describe('SceneManager registration', () => {
  test('removes the current scene by its registration key when the scene name differs', () => {
    const manager = new SceneManager();
    const stage = createScene('stage');
    manager.registerScene('strawberry-fields', stage);
    manager.switchTo('strawberry-fields');

    manager.unregisterScene('strawberry-fields');

    expect(manager.sceneNames).toEqual([]);
    expect(manager.currentScene).toBeNull();
    expect(() => manager.switchTo('strawberry-fields')).toThrow('Scene "strawberry-fields" is not registered.');
  });

  test('keeps the current scene when another registration is removed', () => {
    const manager = new SceneManager();
    const title = createScene('title');
    const map = createScene('map');
    manager.registerScene('title', title);
    manager.registerScene('map', map);
    manager.switchTo('title');

    manager.unregisterScene('map');

    expect(manager.sceneNames).toEqual(['title']);
    expect(manager.currentScene).toBe(title);
  });

  test('allows the registration key to be reused after removal', () => {
    const manager = new SceneManager();
    const first = createScene('stage');
    const second = createScene('stage');
    manager.registerScene('stage-key', first);
    manager.switchTo('stage-key');
    manager.unregisterScene('stage-key');

    manager.registerScene('stage-key', second);
    manager.switchTo('stage-key');

    expect(manager.currentScene).toBe(second);
    expect(second.calls).toEqual([['enter', null]]);
  });
});
