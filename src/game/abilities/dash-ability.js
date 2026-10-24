import { Ability } from './ability.js';

class DashAbility extends Ability {
  #speedMultiplier;
  #dashDirection;

  constructor(config) {
    super(config);
    this.#speedMultiplier = config['speed-multiplier'] ?? 2.0;
    this.#dashDirection = 1;
  }

  get speedMultiplier() { return this.#speedMultiplier; }

  activate(player, inputManager) {
    if (player.level < this.requiredLevel) {
      return false;
    }

    const activated = super.activate(player, inputManager);
    if (activated) {
      this.#dashDirection = player.direction ?? 1;
    }
    return activated;
  }

  update(player, dt, inputManager) {
    if (player.level < this.requiredLevel) {
      this.deactivate(player);
      return;
    }

    if (inputManager && inputManager.isPressed('dash')) {
      this.activate(player, inputManager);
    }

    super.update(player, dt, inputManager);

    // The dash writes a velocity instead of moving the player, so the stage
    // integration and collision pass stay the only path that changes position.
    if (this.isActive) {
      player.velocity = {
        x: this.#dashDirection * player.walkSpeed * this.#speedMultiplier,
        y: player.velocity.y
      };
    }
  }
}

export { DashAbility };
