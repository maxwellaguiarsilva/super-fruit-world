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
    entity.velocity = {
      x: entity.velocity.x,
      y: Math.min(entity.velocity.y + this.#gravity * dt, this.#maxFallSpeed)
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
      y: this.#gravity
    };
  }
}

export { PhysicsEngine };
