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

  update(player, dt, inputManager) {
    super.update(player, dt, inputManager);

    if (player.level < this.requiredLevel) {
      this.#isFlying = false;
      this.#isSlowFalling = false;
      this.#dashTimer = 0;
      return;
    }

    if (!inputManager) {
      return;
    }

    if (player.onGround && inputManager.isDown('dash')) {
      this.#dashTimer += dt;
    } else if (!inputManager.isDown('dash')) {
      this.#dashTimer = Math.max(0, this.#dashTimer - dt * 2);
    }

    if (!player.onGround && player.velocity.y > 0 && inputManager.isDown('jump')) {
      this.#isSlowFalling = true;
      player.velocity = {
        x: player.velocity.x,
        y: Math.min(player.velocity.y, this.#slowFallSpeed)
      };
    } else {
      this.#isSlowFalling = false;
    }

    if (this.#dashTimer >= this.#dashChargeRequired && player.onGround) {
      if (!this.#isFlying && inputManager.isPressed('jump')) {
        this.#isFlying = true;
        this.#flightTimer = this.#flightDuration;
      }
    }

    if (this.#isFlying) {
      if (inputManager.isDown('jump') && this.#flightTimer > 0) {
        player.velocity = {
          x: player.velocity.x,
          y: -this.#flightSpeed
        };
        this.#flightTimer -= dt;

        if (inputManager.isDown('left')) {
          player.velocity = { x: -this.#flightSpeed * 0.7, y: player.velocity.y };
        }
        if (inputManager.isDown('right')) {
          player.velocity = { x: this.#flightSpeed * 0.7, y: player.velocity.y };
        }
      } else {
        this.#isFlying = false;
        this.#dashTimer = 0;
      }
    }

    if (player.onGround && !inputManager.isDown('jump')) {
      this.#isFlying = false;
      this.#flightTimer = 0;
    }
  }
}

export { FlightAbility };
