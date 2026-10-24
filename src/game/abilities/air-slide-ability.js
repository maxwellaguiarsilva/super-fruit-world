import { Ability } from './ability.js';

class AirSlideAbility extends Ability {
  #midairDistance;
  #slideSpeed;
  #damage;
  #groundCooldown;
  #cooldownRemaining;
  #isSliding;
  #slideTimer;
  #slideDirection;
  #damagedEntities;

  constructor(config) {
    super(config);
    this.#midairDistance = config['midair-distance'] ?? 5.0;
    this.#slideSpeed = config['slide-speed'] ?? 2.0;
    this.#damage = config.damage ?? 1;
    this.#groundCooldown = config['ground-cooldown'] ?? 0.5;
    this.#cooldownRemaining = 0;
    this.#isSliding = false;
    this.#slideTimer = 0;
    this.#slideDirection = 1;
    this.#damagedEntities = new Set();
  }

  get midairDistance() { return this.#midairDistance; }
  get slideSpeed() { return this.#slideSpeed; }
  get damage() { return this.#damage; }
  get groundCooldown() { return this.#groundCooldown; }
  get isSliding() { return this.#isSliding; }
  get cooldownRemaining() { return this.#cooldownRemaining; }
  get slideTimer() { return this.#slideTimer; }

  activate(player, inputManager) {
    if (player.level < this.requiredLevel || player.onGround) {
      return false;
    }
    if (this.#cooldownRemaining > 0 || this.#isSliding) {
      return false;
    }

    this.#isSliding = true;
    this.#slideDirection = player.direction ?? 1;
    // The configured distance is expressed in player widths and the speed in
    // widths per second, so the width cancels out of the slide duration.
    this.#slideTimer = this.#midairDistance / this.#slideSpeed;
    this.#damagedEntities.clear();
    return true;
  }

  update(player, dt, inputManager) {
    super.update(player, dt, inputManager);

    if (player.level < this.requiredLevel) {
      this.#isSliding = false;
      this.#cooldownRemaining = 0;
      return;
    }

    if (player.onGround) {
      this.#isSliding = false;
      this.#slideTimer = 0;
      this.#cooldownRemaining = 0;
    } else if (this.#cooldownRemaining > 0) {
      this.#cooldownRemaining = Math.max(0, this.#cooldownRemaining - dt);
    }

    if (!player.onGround && inputManager && inputManager.isPressed('air-slide')) {
      this.activate(player, inputManager);
    }

    if (!this.#isSliding) {
      return;
    }

    // The slide keeps its own velocity for its duration; the stage integration
    // and collision pass remain the only path that changes position.
    player.velocity = {
      x: this.#slideDirection * this.#slideSpeed * player.width,
      y: player.velocity.y
    };

    this.#damageOverlapping(player);

    this.#slideTimer = Math.max(0, this.#slideTimer - dt);
    if (this.#slideTimer <= 0) {
      this.#isSliding = false;
      this.#damagedEntities.clear();
      this.#cooldownRemaining = this.#groundCooldown;
    }
  }

  #damageOverlapping(player) {
    const enemies = player.stage?.overlappingEnemies?.(player) ?? [];
    let dealtDamage = false;

    for (const enemy of enemies) {
      if (!enemy.isAlive || this.#damagedEntities.has(enemy)) {
        continue;
      }
      this.#damagedEntities.add(enemy);
      enemy.takeDamage(this.#damage);
      dealtDamage = true;
    }

    if (dealtDamage) {
      player.audioEngine?.playSFX('attack');
    }
  }
}

export { AirSlideAbility };
