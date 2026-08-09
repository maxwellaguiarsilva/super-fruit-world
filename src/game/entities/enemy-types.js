import { Enemy } from './enemy.js';

class PatrolEnemy extends Enemy {
  #patrolRange;
  #direction;
  #localX;

  constructor(enemyConfig, stage) {
    super(enemyConfig, stage);
    this.#patrolRange = enemyConfig['patrol-range'];
    this.#direction = 1;
    this.#localX = 0;
  }

  get patrolRange() { return this.#patrolRange; }
  get direction() { return this.#direction; }

  update(dt, stage) {
    const walkSpeed = 0.5;
    this.#localX += walkSpeed * dt * this.#direction;

    if (Math.abs(this.#localX) >= this.#patrolRange) {
      this.#direction *= -1;
      this.#localX = Math.sign(this.#localX) * this.#patrolRange;
    }

    this.velocity = { x: walkSpeed * this.#direction, y: this.velocity.y };
  }

  onWallHit() {
    this.#direction *= -1;
  }
}

class ShooterEnemy extends Enemy {
  #fireRate;
  #projectileSpeed;
  #detectionRange;
  #fireTimer;

  constructor(enemyConfig, stage) {
    super(enemyConfig, stage);
    this.#fireRate = enemyConfig['fire-rate'];
    this.#projectileSpeed = enemyConfig['projectile-speed'];
    this.#detectionRange = enemyConfig['detection-range'];
    this.#fireTimer = 0;
  }

  get fireRate() { return this.#fireRate; }
  get projectileSpeed() { return this.#projectileSpeed; }
  get playerDetectionRange() { return this.#detectionRange; }

  update(dt, stage) {
    this.#fireTimer -= dt;

    if (stage && stage.player && this.#fireTimer <= 0) {
      const player = stage.player;
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= this.#detectionRange) {
        this.#fireTimer = 1.0 / this.#fireRate;
        const angle = Math.atan2(dy, dx);
        const vx = Math.cos(angle) * this.#projectileSpeed;
        const vy = Math.sin(angle) * this.#projectileSpeed;

        const Projectile = stage.constructor.projectileClass;
        if (Projectile) {
          const proj = new Projectile(this.x, this.y, vx, vy, 1, this, stage.projectileConfig);
          stage.addEntity(proj);
        }
      }
    }
  }
}

class FlyerEnemy extends Enemy {
  #dropRate;
  #dropType;
  #hoverAmplitude;
  #hoverFrequency;
  #hoverTimer;

  constructor(enemyConfig, stage) {
    super(enemyConfig, stage);
    this.#dropRate = enemyConfig['drop-rate'];
    this.#dropType = enemyConfig['drop-type'];
    this.#hoverAmplitude = enemyConfig['hover-amplitude'];
    this.#hoverFrequency = enemyConfig['hover-frequency'];
    this.#hoverTimer = 0;
  }

  get dropRate() { return this.#dropRate; }
  get dropType() { return this.#dropType; }
  get hoverAmplitude() { return this.#hoverAmplitude; }
  get hoverFrequency() { return this.#hoverFrequency; }
  get isFlyer() { return true; }

  update(dt, stage) {
    this.#hoverTimer += dt;
    this.y = this.y + Math.sin(this.#hoverTimer * this.#hoverFrequency * Math.PI * 2) * this.#hoverAmplitude * dt;
  }
}

class BossEnemy extends Enemy {
  constructor(enemyConfig, stage) {
    super(enemyConfig, stage);
  }

  render(renderer) {
    const fillColor = this.colorPalette[this.colorIndex];

    const radius = this.width / 2;
    const cx = this.x + radius;
    const cy = this.y + radius;

    renderer.drawPolygon(
      cx, cy, radius, this.shape,
      0, 0.08,
      fillColor,
      '#FFFFFF',
      0.06
    );

    renderer.drawPolygon(
      cx, cy, radius * 0.6, 4,
      Math.PI / 4, 0.05,
      '#000000',
      null,
      0
    );
  }
}

export { PatrolEnemy, ShooterEnemy, FlyerEnemy, BossEnemy };
