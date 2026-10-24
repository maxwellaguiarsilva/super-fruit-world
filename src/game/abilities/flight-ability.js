import { Ability } from './ability.js';

class FlightAbility extends Ability {
  #dashChargeRequired;
  #flightDuration;
  #flightSpeed;
  #slowFallSpeed;
  #isFlying;
  #isSlowFalling;
  #dashTimer;
  #flightTimer;

  constructor(config) {
    super(config);
    this.#dashChargeRequired = config['dash-charge-required'] ?? 1.0;
    this.#flightDuration = config['flight-duration'] ?? 2.0;
    this.#flightSpeed = config['flight-speed'] ?? 1.0;
    this.#slowFallSpeed = config['slow-fall-speed'] ?? 1.0;
    this.#isFlying = false;
    this.#isSlowFalling = false;
    this.#dashTimer = 0;
    this.#flightTimer = 0;
  }

  get dashChargeRequired() { return this.#dashChargeRequired; }
  get flightDuration() { return this.#flightDuration; }
  get flightSpeed() { return this.#flightSpeed; }
  get slowFallSpeed() { return this.#slowFallSpeed; }
  get isSlowFalling() { return this.#isSlowFalling; }
  get isFlying() { return this.#isFlying; }
  get dashTimer() { return this.#dashTimer; }
  get flightTimer() { return this.#flightTimer; }

  // The player calls this before the jump clears the ground state, so the
  // take-off gate sees the same onGround value the charge was accumulated on.
  tryTakeoff(player, inputManager) {
    if (player.level < this.requiredLevel) {
      return false;
    }
    if (!player.onGround) {
      return false;
    }
    if (!inputManager || !inputManager.isDown('dash')) {
      return false;
    }
    if (this.#dashTimer < this.#dashChargeRequired) {
      return false;
    }

    this.#beginFlight();
    return true;
  }

  #beginFlight() {
    this.#isFlying = true;
    this.#flightTimer = this.#flightDuration;
    this.#dashTimer = 0;
  }

  update(player, dt, inputManager) {
    super.update(player, dt, inputManager);

    if (player.level < this.requiredLevel) {
      this.#isFlying = false;
      this.#isSlowFalling = false;
      this.#dashTimer = 0;
      this.#flightTimer = 0;
      return;
    }

    if (!inputManager) {
      return;
    }

    if (player.onGround && inputManager.isDown('dash')) {
      this.#dashTimer += dt;
    } else if (!this.#isFlying) {
      this.#dashTimer = Math.max(0, this.#dashTimer - dt * 2);
    }

    // Fallback for callers that update the ability directly instead of going
    // through Player.tryJump; the player path already consumed the take-off.
    if (
      !this.#isFlying
      && player.onGround
      && inputManager.isDown('dash')
      && this.#dashTimer >= this.#dashChargeRequired
      && inputManager.isPressed('jump')
    ) {
      this.#beginFlight();
    }

    if (this.#isFlying) {
      if (inputManager.isDown('jump') && this.#flightTimer > 0) {
        player.velocity = {
          x: player.velocity.x,
          y: -this.#flightSpeed
        };
        this.#flightTimer = Math.max(0, this.#flightTimer - dt);
        if (this.#flightTimer <= 0) {
          this.#isFlying = false;
        }
      } else {
        this.#isFlying = false;
      }
    }

    if (!this.#isFlying && !player.onGround && player.velocity.y > 0 && inputManager.isDown('jump')) {
      this.#isSlowFalling = true;
      player.velocity = {
        x: player.velocity.x,
        y: Math.min(player.velocity.y, this.#slowFallSpeed)
      };
    } else {
      this.#isSlowFalling = false;
    }

    if (player.onGround && !this.#isFlying) {
      this.#flightTimer = 0;
    }
  }
}

export { FlightAbility };
