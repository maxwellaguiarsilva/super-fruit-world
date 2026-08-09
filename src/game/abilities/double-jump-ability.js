import { Ability } from './ability.js';

class DoubleJumpAbility extends Ability {
  #maxJumps;
  #jumpsRemaining;

  constructor(config) {
    super(config);
    this.#maxJumps = config['max-jumps'] ?? 2;
    this.#jumpsRemaining = this.#maxJumps;
  }

  get maxJumps() { return this.#maxJumps; }
  get jumpsRemaining() { return this.#jumpsRemaining; }

  canJump(player) {
    if (player.level < this.requiredLevel) {
      return player.onGround;
    }
    return player.onGround || this.#jumpsRemaining > 0;
  }

  useJump() {
    if (this.#jumpsRemaining > 0) {
      this.#jumpsRemaining--;
    }
  }

  reset() {
    this.#jumpsRemaining = this.#maxJumps;
  }

  update(player, dt, inputManager) {
    super.update(player, dt, inputManager);

    if (player.onGround) {
      this.#jumpsRemaining = this.#maxJumps;
    }
  }
}

export { DoubleJumpAbility };
