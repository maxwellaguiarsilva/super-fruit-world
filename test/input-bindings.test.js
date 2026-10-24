import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

import { InputManager } from '../src/engine/input/input-manager.js';

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8'));
}

class FakeWindow {
  addEventListener() {}
}

function installGlobals(gamepads = []) {
  const previousWindow = globalThis.window;
  const previousNavigator = globalThis.navigator;

  globalThis.window = new FakeWindow();
  globalThis.navigator = { getGamepads: () => gamepads };

  return {
    restore() {
      if (previousWindow === undefined) {
        delete globalThis.window;
      } else {
        globalThis.window = previousWindow;
      }

      if (previousNavigator === undefined) {
        delete globalThis.navigator;
      } else {
        globalThis.navigator = previousNavigator;
      }
    }
  };
}

const BINDINGS = readJson('data/input/bindings.json');
const GAMEPAD = BINDINGS.gamepad;
const DECLARED_BUTTONS = Object.entries(GAMEPAD['button-map']);

describe('gamepad button declarations', () => {
  test('button-count matches the number of declared buttons', () => {
    expect(GAMEPAD['button-count']).toBe(DECLARED_BUTTONS.length);
  });

  test('the declared buttons cover every index below button-count exactly once', () => {
    const indices = DECLARED_BUTTONS.map(([, entry]) => entry.index).sort((a, b) => a - b);
    const expected = Array.from({ length: GAMEPAD['button-count'] }, (_, index) => index);

    expect(indices).toEqual(expected);
  });

  test('every declared button name matches its index', () => {
    for (const [name, entry] of DECLARED_BUTTONS) {
      expect({ name, index: entry.index }).toEqual({ name, index: Number(name.replace('button-', '')) });
      expect({ name, inRange: entry.index < GAMEPAD['button-count'] }).toEqual({ name, inRange: true });
    }
  });

  test('every action button reference is declared in the button map', () => {
    for (const [action, binding] of Object.entries(BINDINGS.actions)) {
      for (const slot of ['primary', 'secondary']) {
        const reference = binding.gamepad?.[slot];

        if (typeof reference !== 'string' || !reference.startsWith('button-')) {
          continue;
        }

        expect({
          action,
          slot,
          reference,
          declared: Object.hasOwn(GAMEPAD['button-map'], reference)
        }).toEqual({ action, slot, reference, declared: true });
        expect({
          action,
          slot,
          reference,
          inRange: GAMEPAD['button-map'][reference].index < GAMEPAD['button-count']
        }).toEqual({ action, slot, reference, inRange: true });
      }
    }
  });

  test('pressed buttons beyond the declared count activate no action', () => {
    const extraButtonCount = 8;
    const buttons = Array.from(
      { length: GAMEPAD['button-count'] + extraButtonCount },
      (_, index) => ({ pressed: index >= GAMEPAD['button-count'] })
    );
    const gamepad = { index: 0, connected: true, buttons, axes: [0, 0, 0, 0] };
    const host = installGlobals([gamepad]);
    const input = new InputManager(BINDINGS);

    try {
      input.update();

      for (const action of Object.keys(BINDINGS.actions)) {
        expect({ action, down: input.isDown(action) }).toEqual({ action, down: false });
      }
    } finally {
      host.restore();
    }
  });
});
