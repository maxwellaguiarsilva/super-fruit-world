class PhysicsEngine {
  #gravity;
  #maxFallSpeed;
  #friction;

  constructor(config) {
    this.#gravity = config.gravity;
    this.#maxFallSpeed = config['max-fall-speed'];
    this.#friction = config.friction;
  }

  get gravity() {
    return this.#gravity;
  }

  set gravity(v) {
    this.#gravity = v;
  }

  get maxFallSpeed() {
    return this.#maxFallSpeed;
  }

  get friction() {
    return this.#friction;
  }

  applyGravity(entity, dt) {
    const gravity = this.#gravity * this.#gravityMultiplier(entity);
    entity.velocity = {
      x: entity.velocity.x,
      y: Math.min(entity.velocity.y + gravity * dt, this.#maxFallSpeed)
    };
  }

  applyFriction(entity, dt) {
    if (entity.onGround) {
      entity.velocity = {
        x: entity.velocity.x * Math.pow(1 - this.#friction, dt * 60),
        y: entity.velocity.y
      };
    }
  }

  integratePosition(entity, dt) {
    entity.x += entity.velocity.x * dt;
    entity.y += entity.velocity.y * dt;
  }

  getAppliedForce(entity) {
    return {
      x: 0,
      y: this.#gravity * this.#gravityMultiplier(entity)
    };
  }

  #gravityMultiplier(entity) {
    const multiplier = entity?.gravityMultiplier;
    return Number.isFinite(multiplier) ? multiplier : 1;
  }
}

export { PhysicsEngine };
