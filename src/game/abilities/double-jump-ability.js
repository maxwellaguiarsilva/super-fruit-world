import { Ability } from './ability.js';

class DoubleJumpAbility extends Ability {
  #maxJumps;
  #jumpsRemaining;
  #wasOnGround;

  constructor(config) {
    super(config);
    this.#maxJumps = config['max-jumps'] ?? 2;
    this.#jumpsRemaining = this.#maxJumps;
    this.#wasOnGround = true;
  }

  get maxJumps() { return this.#maxJumps; }
  get jumpsRemaining() { return this.#jumpsRemaining; }

  canJump(player) {
    if (player.level < this.requiredLevel) {
      return player.onGround;
    }
    return player.onGround || this.#jumpsRemaining > 0;
  }

  consumeGroundJump(player) {
    if (player.level < this.requiredLevel) {
      return false;
    }
    this.#jumpsRemaining = Math.max(0, this.#jumpsRemaining - 1);
    return true;
  }

  consumeAirJump(player) {
    if (player.level < this.requiredLevel || player.onGround) {
      return false;
    }
    if (this.#jumpsRemaining <= 0) {
      return false;
    }
    this.#jumpsRemaining--;
    return true;
  }

  useJump() {
    if (this.#jumpsRemaining > 0) {
      this.#jumpsRemaining--;
    }
  }

  reset() {
    this.#jumpsRemaining = this.#maxJumps;
    this.#wasOnGround = true;
  }

  update(player, dt, inputManager) {
    super.update(player, dt, inputManager);

    if (player.onGround) {
      this.#jumpsRemaining = this.#maxJumps;
    } else if (this.#wasOnGround && this.#jumpsRemaining === this.#maxJumps) {
      // Walking off a ledge spends the ground jump even when no jump was pressed.
      this.#jumpsRemaining = Math.max(0, this.#maxJumps - 1);
    }

    this.#wasOnGround = player.onGround;
  }
}

export { DoubleJumpAbility };
