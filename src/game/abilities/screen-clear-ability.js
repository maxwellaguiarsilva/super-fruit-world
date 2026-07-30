import { Ability } from './ability.js';

class ScreenClearAbility extends Ability {
  #damage;
  #holdTime;
  #flashDuration;
  #usesRemaining;
  #holdTimer;
  #isFlashing;
  #flashTimer;
  #hasActivated;

  constructor(config) {
    super(config);
    this.#damage = config.damage ?? 4;
    this.#holdTime = config['hold-time'] ?? 1.0;
    this.#flashDuration = config['flash-duration'] ?? 1.0;
    this.#usesRemaining = 1;
    this.#holdTimer = 0;
    this.#isFlashing = false;
    this.#flashTimer = 0;
    this.#hasActivated = false;
  }

  get damage() { return this.#damage; }
  get holdTime() { return this.#holdTime; }
  get flashDuration() { return this.#flashDuration; }
  get usesRemaining() { return this.#usesRemaining; }
  get isFlashing() { return this.#isFlashing; }
  get flashAlpha() { return this.#isFlashing ? this.#flashTimer / this.#flashDuration : 0; }

  activate(player, inputManager) {
    if (this.#usesRemaining <= 0 || this.#hasActivated) {
      return;
    }

    if (inputManager && inputManager.isComboHeld(['down', 'shoot', 'air-slide'], this.#holdTime)) {
      this.#usesRemaining--;
      this.#isFlashing = true;
      this.#flashTimer = this.#flashDuration;
      this.#hasActivated = true;

      if (player.stage) {
        for (const entity of player.stage.entities) {
          if (entity.isEnemy && entity.takeDamage) {
            entity.takeDamage(this.#damage);
          }
        }
      }
    }
  }

  update(player, dt, inputManager) {
    super.update(player, dt, inputManager);

    if (player.level < this.requiredLevel) {
      return;
    }

    if (this.#isFlashing) {
      this.#flashTimer -= dt;
      if (this.#flashTimer <= 0) {
        this.#isFlashing = false;
      }
    }

    if (!this.#hasActivated && inputManager) {
      if (inputManager.isDown('down') && inputManager.isDown('shoot') && inputManager.isDown('air-slide')) {
        this.#holdTimer += dt;
        if (this.#holdTimer >= this.#holdTime) {
          this.activate(player, inputManager);
        }
      } else {
        this.#holdTimer = 0;
      }
    }
  }

  reset() {
    this.#usesRemaining = 1;
    this.#hasActivated = false;
    this.#isFlashing = false;
    this.#flashTimer = 0;
    this.#holdTimer = 0;
  }
}

export { ScreenClearAbility };
