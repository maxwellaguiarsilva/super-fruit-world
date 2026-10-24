class InputManager {
  #bindingsConfig;
  #keyState;
  #prevKeyState;
  #gamepadIndex;
  #deadZone;
  #axisThreshold;
  #actionMap;

  constructor(bindingsConfig) {
    this.#bindingsConfig = bindingsConfig;
    this.#keyState = new Map();
    this.#prevKeyState = new Map();
    this.#gamepadIndex = null;
    this.#deadZone = bindingsConfig['gamepad']?.['dead-zone'];
    this.#axisThreshold = bindingsConfig['gamepad']?.['axis-threshold'];
    this.#actionMap = {};

    this.#buildActionMap();
    this.#attachListeners();
  }

  #buildActionMap() {
    const actions = this.#bindingsConfig['actions'];
    const buttonMap = this.#bindingsConfig['gamepad']?.['button-map'];
    const axisMap = this.#bindingsConfig['gamepad']?.['axis-map'];

    for (const [actionName, binding] of Object.entries(actions)) {
      this.#actionMap[actionName] = {
        keys: [],
        gamepadButtons: [],
        gamepadAxes: []
      };

      const keyboard = binding['keyboard'];
      if (keyboard?.primary) {
        this.#actionMap[actionName].keys.push(keyboard.primary);
      }
      if (keyboard?.secondary) {
        this.#actionMap[actionName].keys.push(keyboard.secondary);
      }

      const gamepad = binding['gamepad'];
      if (gamepad?.primary) {
        const btnName = gamepad['primary'];
        if (btnName.startsWith('dpad-')) {
          this.#actionMap[actionName].keys.push(`gp-dpad-${btnName.replace('dpad-', '')}`);
        } else if (btnName.startsWith('left-stick-')) {
          this.#actionMap[actionName].gamepadAxes.push({
            axis: `axis-${axisMap['left-stick-x']?.index}`,
            direction: btnName.replace('left-stick-', '')
          });
        } else {
          const btnConfig = buttonMap[btnName];
          if (btnConfig) {
            this.#actionMap[actionName].gamepadButtons.push(btnConfig.index);
          }
        }
      }
      if (gamepad['secondary']) {
        const btnName = gamepad['secondary'];
        if (btnName.startsWith('left-stick-')) {
          this.#actionMap[actionName].gamepadAxes.push({
            axis: `axis-${axisMap['left-stick-x']?.index}`,
            direction: btnName.replace('left-stick-', '')
          });
        }
      }
    }
  }

  get deadZone() {
    return this.#deadZone;
  }

  #attachListeners() {
    window.addEventListener('keydown', (event) => {
      this.#keyState.set(event.code, true);
    });

    window.addEventListener('keyup', (event) => {
      this.#keyState.set(event.code, false);
    });

    window.addEventListener('blur', () => {
      this.#keyState.clear();
      this.#prevKeyState.clear();
    });
  }

  update() {
    this.#scanGamepads();
  }

  finalize() {
    this.#prevKeyState = new Map(this.#keyState);
  }

  #scanGamepads() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let found = false;

    const dPadButtons = { up: 12, down: 13, left: 14, right: 15 };

    for (const gp of gamepads) {
      if (gp && gp.connected) {
        this.#gamepadIndex = gp.index;
        found = true;

        for (const [dpName, dpIndex] of Object.entries(dPadButtons)) {
          const button = gp.buttons[dpIndex];
          this.#keyState.set(`gp-dpad-${dpName}`, button ? button.pressed : false);
        }

        for (let i = 0; i < 4; i++) {
          const value = gp.axes[i] ?? 0;
          this.#keyState.set(`axis-${i}`, value);
        }
        break;
      }
    }

    if (!found) {
      for (const [dpName] of Object.entries(dPadButtons)) {
        this.#keyState.set(`gp-dpad-${dpName}`, false);
      }
      this.#gamepadIndex = null;
    }
  }

  #getActionBinding(action) {
    if (this.#actionMap[action]) {
      return this.#actionMap[action];
    }

    switch (action) {
      case 'left':
        return this.#actionMap['move-left'];
      case 'right':
        return this.#actionMap['move-right'];
      case 'up':
        return this.#actionMap['move-up'];
      case 'down':
        return this.#actionMap['move-down'];
      case 'air-slide':
        return this.#actionMap['special'];
      default:
        return this.#actionMap[action];
    }
  }

  #isActionActive(action, keyStates) {
    const binding = this.#getActionBinding(action);

    if (!binding) {
      return false;
    }

    for (const key of binding.keys) {
      if (keyStates.get(key)) {
        return true;
      }
    }

    for (const btnIndex of binding.gamepadButtons) {
      if (this.#gamepadIndex !== null) {
        const gamepads = navigator.getGamepads();
        const gp = gamepads[this.#gamepadIndex];
        if (gp && gp.buttons[btnIndex]?.pressed) {
          return true;
        }
      }
    }

    for (const axisBinding of binding.gamepadAxes) {
      const axisVal = keyStates.get(axisBinding.axis) ?? 0;
      if (axisBinding.direction === 'left' && axisVal < -this.#deadZone) {
        return true;
      }
      if (axisBinding.direction === 'right' && axisVal > this.#deadZone) {
        return true;
      }
      if (axisBinding.direction === 'up' && axisVal < -this.#deadZone) {
        return true;
      }
      if (axisBinding.direction === 'down' && axisVal > this.#deadZone) {
        return true;
      }
    }

    return false;
  }

  isDown(action) {
    return this.#isActionActive(action, this.#keyState);
  }

  isPressed(action) {
    return this.#isActionActive(action, this.#keyState) && !this.#isActionActive(action, this.#prevKeyState);
  }

  isReleased(action) {
    return !this.#isActionActive(action, this.#keyState) && this.#isActionActive(action, this.#prevKeyState);
  }

  getAxis(action) {
    const binding = this.#getActionBinding(action);

    let value = 0;

    if (action === 'left' || this.#getActionBinding('move-left') === binding) {
      if (this.#isActionActive('left', this.#keyState)) {
        value = -1;
      }
    }
    if (action === 'right' || this.#getActionBinding('move-right') === binding) {
      if (this.#isActionActive('right', this.#keyState)) {
        value = 1;
      }
    }

    for (const axisBinding of binding.gamepadAxes) {
      const axisVal = this.#keyState.get(axisBinding.axis) ?? 0;
      if (Math.abs(axisVal) > this.#deadZone && Math.abs(axisVal) > Math.abs(value)) {
        value = axisVal;
      }
    }

    return value;
  }

  isComboHeld(actions, holdTime) {
    for (const action of actions) {
      if (!this.isDown(action)) {
        return false;
      }
    }

    return true;
  }

  reloadBindings(bindingsConfig) {
    this.#bindingsConfig = bindingsConfig;
    this.#buildActionMap();
  }
}

export { InputManager };
