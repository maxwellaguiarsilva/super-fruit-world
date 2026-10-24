import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { InputManager } from '../src/engine/input/input-manager.js';

const bindings = JSON.parse(readFileSync(new URL('../data/input/bindings.json', import.meta.url), 'utf8'));

class FakeWindow {
  #listeners = new Map();

  addEventListener(type, listener) {
    const listeners = this.#listeners.get(type) ?? [];
    listeners.push(listener);
    this.#listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    const listeners = this.#listeners.get(type) ?? [];
    this.#listeners.set(type, listeners.filter((entry) => entry !== listener));
  }

  dispatch(type, init = {}) {
    const event = { type, ...init };
    for (const listener of this.#listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

function installGlobals(getGamepads = () => []) {
  const previousWindow = globalThis.window;
  const previousNavigator = globalThis.navigator;
  const fakeWindow = new FakeWindow();

  globalThis.window = fakeWindow;
  globalThis.navigator = { getGamepads };

  return {
    window: fakeWindow,
    restore() {
      globalThis.window = previousWindow;
      globalThis.navigator = previousNavigator;
    }
  };
}

function createInput(getGamepads, options) {
  const host = installGlobals(getGamepads);
  const input = new InputManager(bindings, options);

  return { ...host, input };
}

function createGamepad(axes = [0, 0, 0, 0]) {
  return {
    index: 0,
    connected: true,
    buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
    axes
  };
}

describe('InputManager press detection', () => {
  test('reports a press that starts and ends between two frames exactly once', () => {
    const { window: fakeWindow, input, restore } = createInput();

    try {
      fakeWindow.dispatch('keydown', { code: 'Enter' });
      fakeWindow.dispatch('keyup', { code: 'Enter' });

      input.update();
      expect(input.isPressed('confirm')).toBe(true);
      input.finalize();

      input.update();
      expect(input.isPressed('confirm')).toBe(false);
      input.finalize();
    } finally {
      restore();
    }
  });

  test('reports a press held across frames exactly once', () => {
    const { window: fakeWindow, input, restore } = createInput();

    try {
      fakeWindow.dispatch('keydown', { code: 'Enter' });

      input.update();
      expect(input.isPressed('confirm')).toBe(true);
      input.finalize();

      input.update();
      expect(input.isPressed('confirm')).toBe(false);
      input.finalize();

      input.update();
      expect(input.isPressed('confirm')).toBe(false);
      input.finalize();

      fakeWindow.dispatch('keyup', { code: 'Enter' });

      input.update();
      expect(input.isDown('confirm')).toBe(false);
      expect(input.isReleased('confirm')).toBe(true);
      input.finalize();

      input.update();
      expect(input.isReleased('confirm')).toBe(false);
      input.finalize();
    } finally {
      restore();
    }
  });

  test('survives a keydown and keyup that arrive between the update and the finalize of a frame', () => {
    const { window: fakeWindow, input, restore } = createInput();

    try {
      input.update();
      expect(input.isPressed('confirm')).toBe(false);

      fakeWindow.dispatch('keydown', { code: 'Enter' });
      fakeWindow.dispatch('keyup', { code: 'Enter' });
      input.finalize();

      input.update();
      expect(input.isPressed('confirm')).toBe(true);
      input.finalize();

      input.update();
      expect(input.isPressed('confirm')).toBe(false);
      input.finalize();
    } finally {
      restore();
    }
  });

  test('delivers an edge collected during the render phase on the next frame', () => {
    const { window: fakeWindow, input, restore } = createInput();

    try {
      input.update();
      fakeWindow.dispatch('keydown', { code: 'Enter' });
      input.finalize();
      fakeWindow.dispatch('keyup', { code: 'Enter' });

      input.update();
      expect(input.isPressed('confirm')).toBe(true);
      input.finalize();

      input.update();
      expect(input.isPressed('confirm')).toBe(false);
      input.finalize();
    } finally {
      restore();
    }
  });

  test('ignores auto-repeat while the key is held', () => {
    const { window: fakeWindow, input, restore } = createInput();

    try {
      fakeWindow.dispatch('keydown', { code: 'Enter' });

      input.update();
      expect(input.isPressed('confirm')).toBe(true);
      input.finalize();

      for (let i = 0; i < 3; i++) {
        fakeWindow.dispatch('keydown', { code: 'Enter', repeat: true });

        input.update();
        expect(input.isPressed('confirm')).toBe(false);
        input.finalize();
      }
    } finally {
      restore();
    }
  });

  test('reports a new press after a latched press was released', () => {
    const { window: fakeWindow, input, restore } = createInput();

    try {
      fakeWindow.dispatch('keydown', { code: 'Enter' });
      fakeWindow.dispatch('keyup', { code: 'Enter' });

      input.update();
      expect(input.isPressed('confirm')).toBe(true);
      input.finalize();

      input.update();
      expect(input.isPressed('confirm')).toBe(false);
      input.finalize();

      fakeWindow.dispatch('keydown', { code: 'Enter' });
      fakeWindow.dispatch('keyup', { code: 'Enter' });

      input.update();
      expect(input.isPressed('confirm')).toBe(true);
      input.finalize();
    } finally {
      restore();
    }
  });

  test('reports a new press when a previous keyup was lost', () => {
    const { window: fakeWindow, input, restore } = createInput();

    try {
      fakeWindow.dispatch('keydown', { code: 'Enter' });

      input.update();
      expect(input.isPressed('confirm')).toBe(true);
      input.finalize();

      input.update();
      expect(input.isPressed('confirm')).toBe(false);
      input.finalize();

      fakeWindow.dispatch('keydown', { code: 'Enter' });
      fakeWindow.dispatch('keyup', { code: 'Enter' });

      input.update();
      expect(input.isPressed('confirm')).toBe(true);
      input.finalize();

      input.update();
      expect(input.isPressed('confirm')).toBe(false);
      input.finalize();
    } finally {
      restore();
    }
  });

  test('clears held keys and pending presses on blur', () => {
    const { window: fakeWindow, input, restore } = createInput();

    try {
      fakeWindow.dispatch('keydown', { code: 'Enter' });

      input.update();
      expect(input.isPressed('confirm')).toBe(true);
      input.finalize();

      fakeWindow.dispatch('blur');

      input.update();
      expect(input.isDown('confirm')).toBe(false);
      expect(input.isPressed('confirm')).toBe(false);
      input.finalize();
    } finally {
      restore();
    }
  });

  test('discards a press that is still pending when the window is blurred', () => {
    const { window: fakeWindow, input, restore } = createInput();

    try {
      fakeWindow.dispatch('keydown', { code: 'Enter' });
      fakeWindow.dispatch('blur');

      input.update();
      expect(input.isPressed('confirm')).toBe(false);
      input.finalize();
    } finally {
      restore();
    }
  });

  test('maps one physical key to the action and its aliases', () => {
    const { window: fakeWindow, input, restore } = createInput();

    try {
      fakeWindow.dispatch('keydown', { code: 'ArrowDown' });
      fakeWindow.dispatch('keyup', { code: 'ArrowDown' });

      input.update();
      expect(input.isPressed('move-down')).toBe(true);
      expect(input.isPressed('down')).toBe(true);
      expect(input.isPressed('crouch')).toBe(true);
      expect(input.isPressed('up')).toBe(false);
      expect(input.isPressed('confirm')).toBe(false);
      input.finalize();
    } finally {
      restore();
    }
  });

  test('resolves confirm from both bound keys', () => {
    const { window: fakeWindow, input, restore } = createInput();

    try {
      fakeWindow.dispatch('keydown', { code: 'Space' });
      fakeWindow.dispatch('keyup', { code: 'Space' });

      input.update();
      expect(input.isPressed('confirm')).toBe(true);
      expect(input.isPressed('jump')).toBe(true);
      input.finalize();

      input.update();
      expect(input.isPressed('confirm')).toBe(false);
      input.finalize();

      fakeWindow.dispatch('keydown', { code: 'Enter' });
      fakeWindow.dispatch('keyup', { code: 'Enter' });

      input.update();
      expect(input.isPressed('confirm')).toBe(true);
      input.finalize();
    } finally {
      restore();
    }
  });

  test('keeps isDown and getAxis on the current key state', () => {
    const { window: fakeWindow, input, restore } = createInput();

    try {
      fakeWindow.dispatch('keydown', { code: 'ArrowLeft' });

      input.update();
      expect(input.isDown('left')).toBe(true);
      expect(input.getAxis('left')).toBe(-1);
      expect(input.isDown('right')).toBe(false);
      input.finalize();

      fakeWindow.dispatch('keydown', { code: 'ArrowRight' });

      input.update();
      expect(input.getAxis('right')).toBe(1);
      input.finalize();

      fakeWindow.dispatch('keyup', { code: 'ArrowLeft' });
      fakeWindow.dispatch('keyup', { code: 'ArrowRight' });

      input.update();
      expect(input.isDown('left')).toBe(false);
      expect(input.getAxis('left')).toBe(0);
      input.finalize();
    } finally {
      restore();
    }
  });

  test('keeps gamepad button and dpad bindings working', () => {
    const gamepad = {
      index: 0,
      connected: true,
      buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
      axes: [0, 0, 0, 0]
    };
    const { input, restore } = createInput(() => [gamepad]);

    try {
      input.update();
      expect(input.isDown('confirm')).toBe(false);
      input.finalize();

      gamepad.buttons[0].pressed = true;

      input.update();
      expect(input.isDown('confirm')).toBe(true);
      expect(input.isPressed('confirm')).toBe(true);
      input.finalize();

      input.update();
      expect(input.isPressed('confirm')).toBe(false);
      input.finalize();

      gamepad.buttons[0].pressed = false;
      gamepad.buttons[12].pressed = true;

      input.update();
      expect(input.isDown('up')).toBe(true);
      input.finalize();
    } finally {
      restore();
    }
  });
});

describe('InputManager gamepad axes', () => {
  test('resolves up and down against the vertical axis with the correct sign', () => {
    const gamepad = createGamepad([0, -0.9, 0, 0]);
    const { input, restore } = createInput(() => [gamepad]);

    try {
      input.update();
      expect(input.isDown('up')).toBe(true);
      expect(input.isDown('down')).toBe(false);
      expect(input.isDown('left')).toBe(false);
      expect(input.isDown('right')).toBe(false);
      input.finalize();

      gamepad.axes[1] = 0.9;

      input.update();
      expect(input.isDown('up')).toBe(false);
      expect(input.isDown('down')).toBe(true);
      input.finalize();
    } finally {
      restore();
    }
  });

  test('resolves a right-stick binding against the right-stick axis', () => {
    const customBindings = structuredClone(bindings);
    customBindings.actions['move-up'].gamepad.secondary = 'right-stick-up';
    const gamepad = createGamepad([0, -0.9, 0, 0]);
    const host = installGlobals(() => [gamepad]);
    const input = new InputManager(customBindings);

    try {
      input.update();
      expect(input.isDown('up')).toBe(false);
      input.finalize();

      gamepad.axes[3] = -0.9;

      input.update();
      expect(input.isDown('up')).toBe(true);
      input.finalize();
    } finally {
      host.restore();
    }
  });

  test('rejects an axis value below the configured threshold', () => {
    const gamepad = createGamepad([0.4, 0, 0, 0]);
    const { input, restore } = createInput(() => [gamepad]);

    try {
      input.update();
      expect(input.isDown('right')).toBe(false);
      expect(input.isDown('left')).toBe(false);
      input.finalize();
    } finally {
      restore();
    }
  });

  test('accepts an axis value above the configured threshold', () => {
    const gamepad = createGamepad([0.6, 0, 0, 0]);
    const { input, restore } = createInput(() => [gamepad]);

    try {
      input.update();
      expect(input.isDown('right')).toBe(true);
      expect(input.isDown('left')).toBe(false);
      input.finalize();

      gamepad.axes[0] = -0.6;

      input.update();
      expect(input.isDown('right')).toBe(false);
      expect(input.isDown('left')).toBe(true);
      input.finalize();
    } finally {
      restore();
    }
  });

  test('keeps keyboard input independent from the axis threshold', () => {
    const gamepad = createGamepad([0, 0, 0, 0]);
    const { window: fakeWindow, input, restore } = createInput(() => [gamepad]);

    try {
      fakeWindow.dispatch('keydown', { code: 'ArrowRight' });

      input.update();
      expect(input.isDown('right')).toBe(true);
      input.finalize();
    } finally {
      restore();
    }
  });
});

describe('InputManager combo hold', () => {
  test('requires the combo to stay down for the requested duration', () => {
    let clock = 0;
    const { window: fakeWindow, input, restore } = createInput(undefined, { now: () => clock });

    try {
      fakeWindow.dispatch('keydown', { code: 'KeyZ' });
      fakeWindow.dispatch('keydown', { code: 'KeyX' });

      expect(input.isComboHeld(['shoot', 'special'])).toBe(true);
      expect(input.isComboHeld(['shoot', 'special'], 0.5)).toBe(false);

      clock = 250;
      expect(input.isComboHeld(['shoot', 'special'], 0.5)).toBe(false);

      clock = 500;
      expect(input.isComboHeld(['shoot', 'special'], 0.5)).toBe(true);
    } finally {
      restore();
    }
  });

  test('restarts the timer when the combo is released and pressed again', () => {
    let clock = 0;
    const { window: fakeWindow, input, restore } = createInput(undefined, { now: () => clock });

    try {
      fakeWindow.dispatch('keydown', { code: 'KeyZ' });
      fakeWindow.dispatch('keydown', { code: 'KeyX' });
      input.isComboHeld(['shoot', 'special'], 0.5);

      clock = 500;
      expect(input.isComboHeld(['shoot', 'special'], 0.5)).toBe(true);

      fakeWindow.dispatch('keyup', { code: 'KeyX' });
      expect(input.isComboHeld(['shoot', 'special'], 0.5)).toBe(false);

      clock = 2000;
      fakeWindow.dispatch('keydown', { code: 'KeyX' });

      expect(input.isComboHeld(['shoot', 'special'], 0.5)).toBe(false);

      clock = 2400;
      expect(input.isComboHeld(['shoot', 'special'], 0.5)).toBe(false);

      clock = 2500;
      expect(input.isComboHeld(['shoot', 'special'], 0.5)).toBe(true);
    } finally {
      restore();
    }
  });
});
