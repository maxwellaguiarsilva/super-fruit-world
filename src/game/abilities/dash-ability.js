import { Ability } from './ability.js';

class DashAbility extends Ability {
  #speedMultiplier;

  constructor(config) {
    super(config);
    this.#speedMultiplier = config['speed-multiplier'] ?? 2.0;
  }

  get speedMultiplier() { return this.#speedMultiplier; }

  activate(player, inputManager) {
    this._activateInternal();
  }

  _activateInternal() {
  }

  deactivate(player) {
  }

  update(player, dt, inputManager) {
    super.update(player, dt, inputManager);

    if (inputManager && inputManager.isDown('dash') && player.level >= this.requiredLevel) {
      const speed = player.constructor.prototype.velocity;

    }
  }
}

export { DashAbility };
