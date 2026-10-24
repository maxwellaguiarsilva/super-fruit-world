import { Ability } from './ability.js';

class InvincibilityAbility extends Ability {
  #holdTime;
  #initialUses;
  #usesRemaining;
  #timeRemaining;
  #cooldownRemaining;
  #holdTimer;

  constructor(config) {
    super(config);
    this.#holdTime = config['hold-time'] ?? 1.0;
    this.#initialUses = config.uses ?? 1;
    this.#usesRemaining = this.#initialUses;
    this.#timeRemaining = config.duration ?? 60;
    this.#cooldownRemaining = 0;
    this.#holdTimer = 0;
  }

  get timeRemaining() { return this.#timeRemaining; }
  get usesRemaining() { return this.#usesRemaining; }
  get cooldownRemaining() { return this.#cooldownRemaining; }

  activate(player) {
    if (this.#usesRemaining <= 0 || this.#cooldownRemaining > 0) {
      return false;
    }

    this.#usesRemaining--;
    this.#cooldownRemaining = this.cooldown;
    this.#holdTimer = 0;
    this.#timeRemaining = this.duration;
    player.healthSystem.invincibilityTimer = this.#timeRemaining;

    return true;
  }

  update(player, dt, inputManager) {
    super.update(player, dt, inputManager);

    if (this.#cooldownRemaining > 0) {
      this.#cooldownRemaining = Math.max(0, this.#cooldownRemaining - dt);
    }

    if (this.#timeRemaining > 0) {
      this.#timeRemaining = player.healthSystem.invincibilityTimer;
    }

    if (player.level < this.requiredLevel || this.#usesRemaining <= 0) {
      this.#holdTimer = 0;
      return;
    }

    const held = inputManager && inputManager.isDown('up') && inputManager.isDown('special');
    if (!held) {
      this.#holdTimer = 0;
      return;
    }

    this.#holdTimer += dt;
    if (this.#holdTimer >= this.#holdTime) {
      this.activate(player);
    }
  }

  extendDuration(seconds) {
    this.#timeRemaining += seconds;
    super.extendDuration(seconds);
  }

  reset() {
    this.#usesRemaining = this.#initialUses;
    this.#timeRemaining = this.duration;
    this.#cooldownRemaining = 0;
    this.#holdTimer = 0;
  }
}

export { InvincibilityAbility };
