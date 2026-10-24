import { Ability } from './ability.js';

class ScreenClearAbility extends Ability {
  #damage;
  #holdTime;
  #flashDuration;
  #cooldownRemaining;
  #holdTimer;
  #isFlashing;
  #flashTimer;

  constructor(config) {
    super(config);
    this.#damage = config.damage ?? 4;
    this.#holdTime = config['hold-time'] ?? 1.0;
    this.#flashDuration = config['flash-duration'] ?? 1.0;
    this.#cooldownRemaining = 0;
    this.#holdTimer = 0;
    this.#isFlashing = false;
    this.#flashTimer = 0;
  }

  get damage() { return this.#damage; }
  get holdTime() { return this.#holdTime; }
  get flashDuration() { return this.#flashDuration; }
  get cooldownRemaining() { return this.#cooldownRemaining; }
  get isFlashing() { return this.#isFlashing; }
  get flashAlpha() { return this.#isFlashing ? this.#flashTimer / this.#flashDuration : 0; }

  activate(player) {
    if (this.#cooldownRemaining > 0) {
      return false;
    }

    this.#cooldownRemaining = this.cooldown;
    this.#holdTimer = 0;
    this.#isFlashing = true;
    this.#flashTimer = this.#flashDuration;

    if (!player.stage) {
      return true;
    }

    let dealtDamage = false;
    for (const entity of player.stage.entities) {
      if (!entity.isAlive || !entity.isEnemy || typeof entity.takeDamage !== 'function') {
        continue;
      }
      entity.takeDamage(this.#damage);
      dealtDamage = true;
    }

    if (dealtDamage) {
      player.audioEngine?.playSFX('attack');
    }

    return true;
  }

  update(player, dt, inputManager) {
    super.update(player, dt, inputManager);

    if (this.#cooldownRemaining > 0) {
      this.#cooldownRemaining = Math.max(0, this.#cooldownRemaining - dt);
    }

    if (this.#isFlashing) {
      this.#flashTimer -= dt;
      if (this.#flashTimer <= 0) {
        this.#isFlashing = false;
      }
    }

    if (player.level < this.requiredLevel || this.#cooldownRemaining > 0) {
      this.#holdTimer = 0;
      return;
    }

    const held = inputManager && inputManager.isDown('down') && inputManager.isDown('special');
    if (!held) {
      this.#holdTimer = 0;
      return;
    }

    this.#holdTimer += dt;
    if (this.#holdTimer >= this.#holdTime) {
      this.activate(player);
    }
  }

  reset() {
    this.#cooldownRemaining = 0;
    this.#holdTimer = 0;
    this.#isFlashing = false;
    this.#flashTimer = 0;
  }
}

export { ScreenClearAbility };
