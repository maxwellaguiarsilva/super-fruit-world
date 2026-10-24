// Monotonic clock used to measure how long a combo has been held.
function resolveCurrentTime() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

// A non-negative finite threshold wins; otherwise the dead zone is the fallback.
function resolveAxisThreshold(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof fallback === 'number' && Number.isFinite(fallback) && fallback >= 0) {
    return fallback;
  }
  return 0;
}

class InputManager {
  #bindingsConfig;
  #keyState;
  #prevKeyState;
  #pendingKeys;
  #framePresses;
  #deadZone;
  #axisThreshold;
  #actionMap;
  #now;
  #comboState;

  constructor(bindingsConfig, { now = resolveCurrentTime } = {}) {
    this.#bindingsConfig = bindingsConfig;
    this.#keyState = new Map();
    this.#prevKeyState = new Map();
    this.#pendingKeys = new Set();
    this.#framePresses = new Set();
    this.#deadZone = bindingsConfig['gamepad']?.['dead-zone'];
    this.#axisThreshold = resolveAxisThreshold(
      bindingsConfig['gamepad']?.['axis-threshold'],
      this.#deadZone
    );
    this.#actionMap = {};
    this.#now = typeof now === 'function' ? now : resolveCurrentTime;
    this.#comboState = null;

    this.#buildActionMap();
    this.#attachListeners();
  }

  // Resolves a stick binding such as `left-stick-up` against the axis declared
  // for that stick and direction: horizontal directions use `<stick>-x`,
  // vertical directions use `<stick>-y`. The sign is the axis value that points
  // along the requested direction.
  #resolveStickBinding(buttonName, axisMap) {
    const match = /^(left|right)-stick-(up|down|left|right)$/.exec(buttonName);
    if (!match) {
      return null;
    }

    const [, stick, direction] = match;
    const isVertical = direction === 'up' || direction === 'down';
    const axisKey = `${stick}-stick-${isVertical ? 'y' : 'x'}`;
    const index = axisMap?.[axisKey]?.index;

    if (!Number.isInteger(index)) {
      return null;
    }

    return {
      axis: `axis-${index}`,
      direction,
      sign: direction === 'left' || direction === 'up' ? -1 : 1
    };
  }

  #buildActionMap() {
    const actions = this.#bindingsConfig['actions'];
    const buttonMap = this.#bindingsConfig['gamepad']?.['button-map'];
    const axisMap = this.#bindingsConfig['gamepad']?.['axis-map'];

    for (const [actionName, binding] of Object.entries(actions)) {
      this.#actionMap[actionName] = {
        keys: [],
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
        } else {
          const stickBinding = this.#resolveStickBinding(btnName, axisMap);
          if (stickBinding) {
            this.#actionMap[actionName].gamepadAxes.push(stickBinding);
          } else {
            const btnConfig = buttonMap[btnName];
            if (btnConfig) {
              this.#actionMap[actionName].keys.push(`gp-button-${btnConfig.index}`);
            }
          }
        }
      }
      if (gamepad['secondary']) {
        const stickBinding = this.#resolveStickBinding(gamepad['secondary'], axisMap);
        if (stickBinding) {
          this.#actionMap[actionName].gamepadAxes.push(stickBinding);
        }
      }
    }
  }

  get deadZone() {
    return this.#deadZone;
  }

  #attachListeners() {
    window.addEventListener('keydown', (event) => {
      if (event.repeat !== true) {
        this.#pendingKeys.add(event.code);
      }
      this.#keyState.set(event.code, true);
    });

    window.addEventListener('keyup', (event) => {
      this.#keyState.set(event.code, false);
    });

    window.addEventListener('blur', () => {
      this.#keyState.clear();
      this.#prevKeyState.clear();
      this.#pendingKeys.clear();
      this.#framePresses.clear();
    });
  }

  update() {
    // A frame sees exactly the edges collected since the previous update,
    // even when the key was released before the frame started.
    this.#framePresses = new Set(this.#pendingKeys);
    this.#pendingKeys.clear();
    this.#scanGamepads();
  }

  finalize() {
    this.#prevKeyState = new Map(this.#keyState);
  }

  #scanGamepads() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const buttonCount = this.#bindingsConfig['gamepad']?.['button-count'] ?? 16;
    let found = false;

    const dPadButtons = { up: 12, down: 13, left: 14, right: 15 };

    for (const gp of gamepads) {
      if (gp && gp.connected) {
        found = true;

        for (const [dpName, dpIndex] of Object.entries(dPadButtons)) {
          const button = gp.buttons[dpIndex];
          this.#keyState.set(`gp-dpad-${dpName}`, button ? button.pressed : false);
        }

        for (let i = 0; i < buttonCount; i++) {
          const button = gp.buttons[i];
          this.#keyState.set(`gp-button-${i}`, button ? button.pressed : false);
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
      for (let i = 0; i < buttonCount; i++) {
        this.#keyState.set(`gp-button-${i}`, false);
      }
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

    for (const axisBinding of binding.gamepadAxes) {
      const axisVal = keyStates.get(axisBinding.axis) ?? 0;
      if (typeof axisVal !== 'number' || !Number.isFinite(axisVal)) {
        continue;
      }
      // Project the axis value along the direction; the threshold is the
      // minimum projection that counts as a direction.
      const projected = axisVal * axisBinding.sign;
      if (projected > 0 && projected >= this.#axisThreshold) {
        return true;
      }
    }

    return false;
  }

  isDown(action) {
    return this.#isActionActive(action, this.#keyState);
  }

  isPressed(action) {
    // State difference covers presses that span at least one frame boundary;
    // the frame latch covers presses that ended before any frame observed them.
    if (this.#isActionActive(action, this.#keyState) && !this.#isActionActive(action, this.#prevKeyState)) {
      return true;
    }

    return this.#isActionLatched(action);
  }

  #isActionLatched(action) {
    const binding = this.#getActionBinding(action);

    if (!binding || this.#framePresses.size === 0) {
      return false;
    }

    return binding.keys.some((key) => this.#framePresses.has(key));
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
    if (!Array.isArray(actions) || actions.length === 0) {
      return false;
    }

    for (const action of actions) {
      if (!this.isDown(action)) {
        // Any release breaks the hold, so the next full press restarts the timer.
        this.#comboState = null;
        return false;
      }
    }

    const key = actions.join('|');
    const now = this.#now();

    if (!this.#comboState || this.#comboState.key !== key) {
      this.#comboState = { key, startedAt: now };
    }

    if (typeof holdTime !== 'number' || !Number.isFinite(holdTime) || holdTime <= 0) {
      return true;
    }

    return now - this.#comboState.startedAt >= holdTime * 1000;
  }

  reloadBindings(bindingsConfig) {
    this.#bindingsConfig = bindingsConfig;
    this.#buildActionMap();
  }
}

export { InputManager };
