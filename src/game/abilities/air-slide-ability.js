import { Ability } from './ability.js';

class AirSlideAbility extends Ability {
  #midairDistance;
  #groundedDistance;
  #slideSpeed;
  #damage;
  #groundCooldown;
  #cooldownRemaining;
  #isSliding;
  #slideProgress;

  constructor(config) {
    super(config);
    this.#midairDistance = config['midair-distance'] ?? 5.0;
    this.#groundedDistance = config['grounded-distance'] ?? 2.0;
    this.#slideSpeed = config['slide-speed'] ?? 2.0;
    this.#damage = config.damage ?? 1;
    this.#groundCooldown = config['ground-cooldown'] ?? 0.5;
    this.#cooldownRemaining = 0;
    this.#isSliding = false;
    this.#slideProgress = 0;
  }

  get midairDistance() { return this.#midairDistance; }
  get groundedDistance() { return this.#groundedDistance; }
  get slideSpeed() { return this.#slideSpeed; }
  get damage() { return this.#damage; }
  get groundCooldown() { return this.#groundCooldown; }

  activate(player, inputManager) {
    if (this.#cooldownRemaining > 0 || this.#isSliding) {
      return;
    }

    this.#isSliding = true;
    this.#slideProgress = 0;
  }

  update(player, dt, inputManager) {
    super.update(player, dt, inputManager);

    if (player.level < this.requiredLevel) {
      return;
    }

    if (this.#cooldownRemaining > 0) {
      this.#cooldownRemaining = Math.max(0, this.#cooldownRemaining - dt);
    }

    if (inputManager && inputManager.isPressed('air-slide')) {
      this.activate(player, inputManager);
    }

    if (this.#isSliding) {
      const distance = player.onGround ? this.#groundedDistance : this.#midairDistance;
      const dir = player.direction ?? 1;

      const moveThisFrame = this.#slideSpeed * player.width * dt;
      player.x += moveThisFrame * dir;
      this.#slideProgress += moveThisFrame;

      if (this.#slideProgress >= distance * player.width) {
        this.#isSliding = false;
        this.#cooldownRemaining = this.#groundCooldown;
      }

      if (player.stage) {
        for (const entity of player.stage.entities) {
          if (entity.constructor.name === 'Enemy' || entity.takeDamage) {
            const overlap = (
              player.x + player.hitbox.x < entity.x + entity.hitbox.x + entity.hitbox.width &&
              player.x + player.hitbox.x + player.hitbox.width > entity.x + entity.hitbox.x &&
              player.y + player.hitbox.y < entity.y + entity.hitbox.y + entity.hitbox.height &&
              player.y + player.hitbox.y + player.hitbox.height > entity.y + entity.hitbox.y
            );
            if (overlap && entity.takeDamage) {
              entity.takeDamage(this.#damage);
            }
          }
        }
      }
    }
  }
}

export { AirSlideAbility };
