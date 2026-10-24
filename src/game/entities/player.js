import { Entity } from '../../engine/entities/entity.js';

class Player extends Entity {
  #level;
  #color;
  #direction;
  #faceState;
  #abilities;
  #inventory;
  #healthSystem;
  #scoreSystem;
  #progressionSystem;
  #noteCollection;
  #audioEngine;
  #stage;
  #damageTimer;
  #playerConfig;
  #isClimbing;

  constructor(playerConfig, inputManager, physicsEngine, abilities, inventory, healthSystem) {
    super(0, 0, playerConfig.size, playerConfig.size);

    this.#playerConfig = playerConfig;
    this.#level = playerConfig['starting-level'];
    this.#color = playerConfig['starting-color'];
    this.#direction = 1;
    this.#faceState = 'normal';
    this.#abilities = abilities;
    this.#inventory = inventory;
    this.#healthSystem = healthSystem;
    this.#damageTimer = 0;
    this.#isClimbing = false;
  }

  get level() { return this.#level; }
  set level(v) {
    this.#level = v;
  }

  get color() { return this.#color; }
  set color(v) { this.#color = v; }

  get direction() { return this.#direction; }

  get faceState() { return this.#faceState; }

  get abilities() { return this.#abilities; }

  ability(name) {
    return this.#abilities.find((a) => a.name === name);
  }

  get inventory() { return this.#inventory; }
  get healthSystem() { return this.#healthSystem; }

  get scoreSystem() { return this.#scoreSystem; }
  set scoreSystem(v) { this.#scoreSystem = v; }

  get progressionSystem() { return this.#progressionSystem; }
  set progressionSystem(v) { this.#progressionSystem = v; }

  get noteCollection() { return this.#noteCollection; }
  set noteCollection(v) { this.#noteCollection = v; }

  get audioEngine() { return this.#audioEngine; }
  set audioEngine(v) { this.#audioEngine = v; }

  get stage() { return this.#stage; }
  set stage(v) { this.#stage = v; }

  get isClimbing() { return this.#isClimbing; }
  set isClimbing(v) { this.#isClimbing = v; }

  get isInvincible() {
    return this.#healthSystem.invincibilityTimer > 0;
  }

  takeDamage(amount) {
    this.#healthSystem.takeDamage(amount);
    this.#damageTimer = 1.0;
    this.#audioEngine?.playSFX(this.#healthSystem.isDead ? 'death' : 'hit');
  }

  heal(amount) {
    this.#healthSystem.heal(amount);
  }

  jump() {
    const speed = this.#playerConfig['jump-velocity'];
    this.velocity = { x: this.velocity.x, y: -speed };
    this.onGround = false;
    this.#isClimbing = false;
    this.#audioEngine?.playSFX('jump');
  }

  update(dt, inputManager) {
    const walkSpeed = this.#playerConfig['walk-speed'];
    const walkAccel = this.#playerConfig['walk-acceleration'];

    let moveX = 0;

    if (inputManager) {
      if (inputManager.isDown('left')) {
        moveX = -walkSpeed;
        this.#direction = -1;
      }
      if (inputManager.isDown('right')) {
        moveX = walkSpeed;
        this.#direction = 1;
      }

      if (inputManager.isPressed('jump') && (this.onGround || this.#isClimbing)) {
        this.jump();
      }
    }

    if (this.onGround) {
      this.velocity = {
        x: this.velocity.x + (moveX - this.velocity.x) * Math.min(walkAccel * dt * 60, 1),
        y: this.velocity.y
      };
    } else {
      this.velocity = {
        x: this.velocity.x + (moveX - this.velocity.x) * Math.min(walkAccel * dt * 60 * 0.5, 1),
        y: this.velocity.y
      };
    }

    for (const ability of this.#abilities) {
      ability.update(this, dt, inputManager);
    }

    if (this.#damageTimer > 0) {
      this.#damageTimer = Math.max(0, this.#damageTimer - dt);
      this.#faceState = 'damaged';
    } else {
      this.#faceState = 'normal';
    }

    this.#healthSystem.update(dt);
  }

  render(renderer) {
    const alpha = this.#damageTimer > 0 ? 0.5 : 1.0;

    const radius = this.width / 2;
    const cx = this.x + radius;
    const cy = this.y + radius;

    renderer.drawCircle(cx, cy, radius, this.#color, '#000000', 0.05);

    if (alpha < 1) {
      return;
    }

    const eyeOffsetX = radius * 0.3 * this.#direction;
    const eyeOffsetY = -radius * 0.2;
    const eyeRadius = radius * 0.12;

    renderer.drawCircle(cx + eyeOffsetX - radius * 0.15, cy + eyeOffsetY, eyeRadius, '#000000', null, 0);
    renderer.drawCircle(cx + eyeOffsetX + radius * 0.15, cy + eyeOffsetY, eyeRadius, '#000000', null, 0);

    if (this.#faceState === 'damaged') {
      const mouthX = cx + eyeOffsetX;
      const mouthY = cy + radius * 0.3;
      renderer.drawCircle(mouthX, mouthY, radius * 0.15, '#000000', null, 0);
    } else {
      const mouthX = cx + eyeOffsetX;
      const mouthY = cy + radius * 0.1;
      const mouthR = radius * 0.35;

      const { context } = renderer;
      if (context) {
        const px = mouthX * renderer.unitScale;
        const py = mouthY * renderer.unitScale;
        const pr = mouthR * renderer.unitScale;

        context.save();
        context.beginPath();
        context.arc(px, py, pr, Math.PI * 0.1, Math.PI * 0.9);
        context.strokeStyle = '#000000';
        context.lineWidth = eyeRadius * renderer.unitScale;
        context.stroke();
        context.restore();
      }
    }
  }
}

export { Player };
