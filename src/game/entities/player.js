import { Entity } from '../../engine/entities/entity.js';
import { requireDependencies } from '../../engine/core/dependency-contract.js';

const PLAYER_DEPENDENCIES = [
  'playerConfig',
  'abilities',
  'inventory',
  'healthSystem',
  'scoreSystem',
  'progressionSystem',
  'audioEngine',
  'stage'
];

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
  #audioEngine;
  #stage;
  #damageTimer;
  #playerConfig;
  #isClimbing;
  #isCrouching;
  #moonGravityTimer;
  #moonGravityMultiplier;

  constructor(dependencies) {
    const {
      playerConfig,
      abilities,
      inventory,
      healthSystem,
      scoreSystem,
      progressionSystem,
      audioEngine,
      stage
    } = requireDependencies('Player', dependencies, PLAYER_DEPENDENCIES);

    super(0, 0, playerConfig.size, playerConfig.size);

    this.#playerConfig = playerConfig;
    this.#level = playerConfig['starting-level'];
    this.#color = playerConfig['starting-color'];
    this.#direction = 1;
    this.#faceState = 'normal';
    this.#abilities = abilities;
    this.#inventory = inventory;
    this.#healthSystem = healthSystem;
    this.#scoreSystem = scoreSystem;
    this.#progressionSystem = progressionSystem;
    this.#audioEngine = audioEngine;
    this.#stage = stage;
    this.#damageTimer = 0;
    this.#isClimbing = false;
    this.#isCrouching = false;
    this.#moonGravityTimer = 0;
    this.#moonGravityMultiplier = 1;
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

  get progressionSystem() { return this.#progressionSystem; }

  get noteCollection() { return this.#stage ? this.#stage.noteCollection : null; }

  get audioEngine() { return this.#audioEngine; }

  get stage() { return this.#stage; }
  // Declared constructor key, bound by the owning stage because the stage is constructed with the player.
  set stage(v) { this.#stage = v; }

  get isClimbing() { return this.#isClimbing; }
  set isClimbing(v) { this.#isClimbing = v; }

  get isCrouching() { return this.#isCrouching; }
  set isCrouching(v) { this.#isCrouching = v; }

  get walkSpeed() { return this.#playerConfig['walk-speed']; }

  get moonGravityTimer() { return this.#moonGravityTimer; }

  get isMoonGravityActive() { return this.#moonGravityTimer > 0; }

  get gravityMultiplier() {
    return this.#moonGravityTimer > 0 ? this.#moonGravityMultiplier : 1;
  }

  applyMoonGravity(duration, multiplier) {
    const seconds = Number(duration);
    const factor = Number(multiplier);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return false;
    }
    if (!Number.isFinite(factor) || factor <= 0 || factor >= 1) {
      return false;
    }

    this.#moonGravityTimer = Math.max(this.#moonGravityTimer, seconds);
    this.#moonGravityMultiplier = factor;
    return true;
  }

  get isInvincible() {
    return this.#healthSystem.invincibilityTimer > 0;
  }

  takeDamage(amount) {
    const applied = this.#healthSystem.takeDamage(amount);
    if (!applied) {
      return false;
    }

    this.#damageTimer = 1.0;
    this.#audioEngine?.playSFX(this.#healthSystem.isDead ? 'death' : 'hit');
    return true;
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

  tryJump(inputManager) {
    const flight = this.ability('flight');
    if (flight && flight.tryTakeoff(this, inputManager)) {
      this.jump();
      return true;
    }

    if (this.onGround || this.#isClimbing) {
      this.ability('double-jump')?.consumeGroundJump(this);
      this.jump();
      return true;
    }

    const doubleJump = this.ability('double-jump');
    if (doubleJump && doubleJump.consumeAirJump(this)) {
      this.jump();
      return true;
    }

    return false;
  }

  update(dt, inputManager) {
    const crouch = this.ability('crouch');
    crouch?.refreshState?.(this, inputManager);

    const crouchMultiplier = this.#isCrouching ? (crouch?.speedMultiplier ?? 1) : 1;
    const walkSpeed = this.#playerConfig['walk-speed'] * crouchMultiplier;
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

      if (inputManager.isPressed('jump')) {
        this.tryJump(inputManager);
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

    if (this.#moonGravityTimer > 0) {
      this.#moonGravityTimer = Math.max(0, this.#moonGravityTimer - dt);
      if (this.#moonGravityTimer === 0) {
        this.#moonGravityMultiplier = 1;
      }
    }

    this.#healthSystem.update(dt);
  }

  render(renderer) {
    const alpha = this.#damageTimer > 0 ? 0.5 : 1.0;

    const radius = (this.width / 2) * (this.#isCrouching ? 0.8 : 1);
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height - radius;

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
