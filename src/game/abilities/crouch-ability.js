import { Ability } from './ability.js';

class CrouchAbility extends Ability {
  #speedMultiplier;

  constructor(config) {
    super(config);
    this.#speedMultiplier = config['speed-multiplier'] ?? 0.5;
  }

  get speedMultiplier() { return this.#speedMultiplier; }

  // The current collision code derives the hitbox from the entity size, so the
  // crouch state changes the movement speed and the drawn size but not the
  // hitbox. A smaller hitbox would require a variable hitbox in the collision
  // solver and is intentionally left out.
  refreshState(player, inputManager) {
    const crouching = player.level >= this.requiredLevel
      && player.onGround
      && Boolean(inputManager && inputManager.isDown('crouch'));

    player.isCrouching = crouching;
  }

  update(player, dt, inputManager) {
    super.update(player, dt, inputManager);
    this.refreshState(player, inputManager);
  }
}

export { CrouchAbility };
