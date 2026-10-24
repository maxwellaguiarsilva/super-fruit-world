class Ability {
  #name;
  #requiredLevel;
  #initialDuration;
  #duration;
  #cooldownDuration;
  #cooldownRemaining;
  #isActive;

  constructor(config) {
    this.#name = config.name ?? 'unknown';
    this.#requiredLevel = config['required-level'] ?? 0;
    this.#initialDuration = config.duration ?? 0;
    this.#duration = this.#initialDuration;
    this.#cooldownDuration = config.cooldown ?? 0;
    this.#cooldownRemaining = 0;
    this.#isActive = false;
  }

  get name() { return this.#name; }

  get requiredLevel() { return this.#requiredLevel; }
  set requiredLevel(v) { this.#requiredLevel = v; }

  get isAvailable() { return true; }
  get isActive() { return this.#isActive; }
  get duration() { return this.#initialDuration; }
  get remainingDuration() { return this.#duration; }
  get cooldown() { return this.#cooldownDuration; }
  get cooldownRemaining() { return this.#cooldownRemaining; }

  activate(player, inputManager) {
    if (this.#cooldownRemaining > 0 || this.#isActive) {
      return false;
    }
    this.#duration = this.#initialDuration;
    this.#isActive = true;
    return true;
  }

  deactivate(player) {
    this.#isActive = false;
  }

  update(player, dt, inputManager) {
    if (this.#cooldownRemaining > 0) {
      this.#cooldownRemaining = Math.max(0, this.#cooldownRemaining - dt);
    }

    if (this.#isActive && this.#duration > 0) {
      this.#duration -= dt;
      if (this.#duration <= 0) {
        this.deactivate(player);
        this.#cooldownRemaining = this.#cooldownDuration;
      }
    }
  }

  extendDuration(seconds) {
    this.#duration += seconds;
  }
}

export { Ability };
