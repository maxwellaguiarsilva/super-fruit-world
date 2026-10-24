import { Ability } from './ability.js';

class InvincibilityAbility extends Ability {
  #holdTime;
  #usesRemaining;
  #timeRemaining;
  #holdTimer;
  #hasActivated;

  constructor(config) {
    super(config);
    this.#holdTime = config['hold-time'] ?? 1.0;
    this.#usesRemaining = 1;
    this.#timeRemaining = config.duration ?? 60;
    this.#holdTimer = 0;
    this.#hasActivated = false;
  }

  get timeRemaining() { return this.#timeRemaining; }
  get usesRemaining() { return this.#usesRemaining; }

  activate(player, inputManager) {
    if (this.#usesRemaining <= 0 || this.#hasActivated) {
      return;
    }

    if (inputManager && inputManager.isComboHeld(['up', 'shoot', 'air-slide'], this.#holdTime)) {
      this.#usesRemaining--;
      this.#hasActivated = true;
      this.#timeRemaining = this.duration;
      player.healthSystem.invincibilityTimer = this.#timeRemaining;
    }
  }

  update(player, dt, inputManager) {
    super.update(player, dt, inputManager);

    if (player.level < this.requiredLevel) {
      return;
    }

    if (!this.#hasActivated && inputManager) {
      if (inputManager.isDown('up') && inputManager.isDown('shoot') && inputManager.isDown('air-slide')) {
        this.#holdTimer += dt;
        if (this.#holdTimer >= this.#holdTime) {
          this.activate(player, inputManager);
        }
      } else {
        this.#holdTimer = 0;
      }
    }
  }

  extendDuration(seconds) {
    this.#timeRemaining += seconds;
    super.extendDuration(seconds);
  }

  reset() {
    this.#usesRemaining = 1;
    this.#hasActivated = false;
    this.#timeRemaining = this.duration;
    this.#holdTimer = 0;
  }
}

export { InvincibilityAbility };
