class Ability {
  #name;
  #requiredLevel;
  #duration;
  #cooldownDuration;
  #cooldownRemaining;
  #isActive;
  #activationType;

  constructor(config) {
    this.#name = config.name ?? 'unknown';
    this.#requiredLevel = config['required-level'] ?? 0;
    this.#duration = config.duration ?? 0;
    this.#cooldownDuration = config.cooldown ?? 0;
    this.#cooldownRemaining = 0;
    this.#isActive = false;
    this.#activationType = config['activation-type'] ?? 'hold';
  }

  get name() { return this.#name; }

  get requiredLevel() { return this.#requiredLevel; }
  set requiredLevel(v) { this.#requiredLevel = v; }

  get isAvailable() { return true; }
  get isActive() { return this.#isActive; }
  get duration() { return this.#duration; }
  get cooldown() { return this.#cooldownDuration; }
  get cooldownRemaining() { return this.#cooldownRemaining; }

  activate(player, inputManager) {
    if (this.#cooldownRemaining > 0) {
      return;
    }
    this.#isActive = true;
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
