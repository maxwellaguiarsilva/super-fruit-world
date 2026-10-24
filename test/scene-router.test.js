import { describe, expect, test } from 'bun:test';

import { SceneRouter } from '../src/app/navigation/scene-router.js';

function createScene(name, { paused } = {}) {
  const scene = {
    name,
    log: [],
    enter(previousScene) {
      this.log.push(['enter', previousScene?.name ?? null]);
    },
    exit(nextScene) {
      this.log.push(['exit', nextScene?.name ?? null]);
    }
  };

  if (paused !== undefined) {
    scene.isPaused = paused;
  }

  return scene;
}

function captureConsoleError(callback) {
  const messages = [];
  const original = console.error;
  console.error = (message) => messages.push(message);

  try {
    const result = callback();
    return { result, messages };
  } finally {
    console.error = original;
  }
}

describe('SceneRouter registration', () => {
  test('registers scenes under keys and exposes the registration order', () => {
    const router = new SceneRouter();
    router.registerScene('title', createScene('title'));
    router.registerScene('map', createScene('map'));

    expect(router.sceneNames).toEqual(['title', 'map']);
    expect(router.hasScene('title')).toBe(true);
    expect(router.hasScene('missing')).toBe(false);
    expect(router.currentScene).toBeNull();
    expect(router.currentSceneName).toBeNull();
  });

  test('overwrites a scene registered under the same key', () => {
    const router = new SceneRouter();
    const first = createScene('first');
    const second = createScene('second');

    router.registerScene('map', first);
    router.registerScene('map', second);

    expect(router.sceneNames).toEqual(['map']);
    expect(router.hasScene('map')).toBe(true);
  });

  test('reports the current scene name by identity, not by its own name', () => {
    const router = new SceneRouter();
    const scene = createScene('internal-name');
    router.registerScene('stage-key', scene);

    router.switchTo('stage-key');

    expect(router.currentScene).toBe(scene);
    expect(router.currentSceneName).toBe('stage-key');
  });

  test('switching calls exit on the previous scene and enter on the next', () => {
    const router = new SceneRouter();
    const title = createScene('title');
    const map = createScene('map');
    router.registerScene('title', title);
    router.registerScene('map', map);

    router.switchTo('title');
    router.switchTo('map');

    expect(title.log).toEqual([['enter', null], ['exit', 'map']]);
    expect(map.log).toEqual([['enter', 'title']]);
  });

  test('switching to an unregistered scene throws and leaves the current scene alone', () => {
    const router = new SceneRouter();
    const title = createScene('title');
    router.registerScene('title', title);
    router.switchTo('title');

    expect(() => router.switchTo('missing')).toThrow('Scene "missing" is not registered.');
    expect(router.currentScene).toBe(title);
    expect(title.log).toEqual([['enter', null]]);
  });
});

describe('SceneRouter actions', () => {
  test('registers and dispatches an action', () => {
    const router = new SceneRouter();
    router.registerAction('start-game', (...args) => args.join(':'));

    expect(router.dispatch('start-game', 'a', 'b')).toBe('a:b');
    expect(router.actionNames).toEqual(['start-game']);
  });

  test('registers a table of actions and keeps their declared order', () => {
    const router = new SceneRouter();
    router.registerActions({
      resume: () => 'resume',
      back: () => 'back'
    });

    expect(router.actionNames).toEqual(['resume', 'back']);
    expect(router.dispatch('back')).toBe('back');
  });

  test('replaces an action registered under the same name', () => {
    const router = new SceneRouter();
    router.registerAction('resume', () => 'first');
    router.registerAction('resume', () => 'second');

    expect(router.dispatch('resume')).toBe('second');
    expect(router.actionNames).toEqual(['resume']);
  });

  test('rejects a non-function handler', () => {
    const router = new SceneRouter();

    expect(() => router.registerAction('resume', 'not-a-function'))
      .toThrow('Handler for action "resume" must be a function.');
  });

  test('reports an unknown action and returns false', () => {
    const router = new SceneRouter();

    const { result, messages } = captureConsoleError(() => router.dispatch('unknown'));

    expect(result).toBe(false);
    expect(messages).toEqual(['[menu] No handler is registered for action "unknown".']);
  });
});

describe('SceneRouter modals', () => {
  function createRouter() {
    const router = new SceneRouter();
    const title = createScene('title');
    const settings = createScene('settings');
    const controls = createScene('controls');
    router.registerScene('title', title);
    router.registerScene('settings', settings);
    router.registerScene('controls', controls);
    router.switchTo('title');
    return { router, title, settings, controls };
  }

  test('opens a registered modal and returns true', () => {
    const { router } = createRouter();

    expect(router.openModal('settings')).toBe(true);
    expect(router.currentSceneName).toBe('settings');
  });

  test('reports an unregistered modal and keeps the current scene', () => {
    const { router, title } = createRouter();

    const { result, messages } = captureConsoleError(() => router.openModal('missing'));

    expect(result).toBe(false);
    expect(messages).toEqual([
      '[navigation] Cannot open modal scene "missing": it is not registered.'
    ]);
    expect(router.currentScene).toBe(title);
  });

  test('closes a modal and restores the recorded scene', () => {
    const { router, title } = createRouter();

    router.openModal('settings');
    expect(router.closeModal()).toBe(true);

    expect(router.currentScene).toBe(title);
    expect(router.currentSceneName).toBe('title');
  });

  test('restores the paused flag that the scene had when the modal opened', () => {
    const router = new SceneRouter();
    const stage = createScene('stage', { paused: true });
    const settings = createScene('settings');
    router.registerScene('stage', stage);
    router.registerScene('settings', settings);
    router.switchTo('stage');

    router.openModal('settings');
    stage.isPaused = false;
    router.closeModal();

    expect(stage.isPaused).toBe(true);
  });

  test('does not assign a paused flag to a scene that has none', () => {
    const { router, title } = createRouter();

    router.openModal('settings');
    router.closeModal();

    expect(Object.hasOwn(title, 'isPaused')).toBe(false);
  });

  test('closes nested modals in last-opened first-closed order', () => {
    const { router, title, settings } = createRouter();

    router.openModal('settings');
    router.openModal('controls');
    expect(router.currentSceneName).toBe('controls');

    router.closeModal();
    expect(router.currentSceneName).toBe('settings');

    router.closeModal();
    expect(router.currentScene).toBe(title);
  });

  test('reports closing a modal when none is open', () => {
    const { router } = createRouter();

    const { result, messages } = captureConsoleError(() => router.closeModal());

    expect(result).toBe(false);
    expect(messages).toEqual(['[navigation] Cannot close a modal scene: no modal scene is open.']);
  });
});
