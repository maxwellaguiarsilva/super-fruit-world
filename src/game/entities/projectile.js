import { Entity } from '../../engine/entities/entity.js';

class Projectile extends Entity {
  #damage;
  #source;
  #maxTravel;
  #travelDistance;
  #projectileConfig;

  constructor(x, y, velocityX, velocityY, damage, source, config) {
    super(x, y, config.size, config.size);
    this.velocity = { x: velocityX, y: velocityY };
    this.#damage = damage;
    this.#source = source;
    this.#maxTravel = config['max-travel'];
    this.#travelDistance = 0;
    this.#projectileConfig = config;
  }

  get damage() { return this.#damage; }
  get source() { return this.#source; }
  get maxTravel() { return this.#maxTravel; }
  get isProjectile() { return true; }

  update(dt, stage) {
    this.x += this.velocity.x * dt;
    this.y += this.velocity.y * dt;

    this.#travelDistance += Math.abs(this.velocity.x * dt) + Math.abs(this.velocity.y * dt);

    if (this.#travelDistance >= this.#maxTravel) {
      this.isAlive = false;
    }

    if (stage) {
      for (const entity of stage.entities) {
        if (entity === this.#source || entity === this) {
          continue;
        }
        if (entity.isAlive === false) {
          continue;
        }

        const hitboxA = this.hitbox;
        const hitboxB = entity.hitbox;

        const overlap = (
          (this.x + hitboxA.x) < (entity.x + hitboxB.x + hitboxB.width) &&
          (this.x + hitboxA.x + hitboxA.width) > (entity.x + hitboxB.x) &&
          (this.y + hitboxA.y) < (entity.y + hitboxB.y + hitboxB.height) &&
          (this.y + hitboxA.y + hitboxA.height) > (entity.y + hitboxB.y)
        );

        if (overlap) {
          if (entity.takeDamage) {
            entity.takeDamage(this.#damage);
          }
          this.isAlive = false;
          break;
        }

        if (entity.isSolid && entity.isSolid !== false) {
          this.isAlive = false;
          break;
        }
      }
    }
  }

  render(renderer) {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const radius = this.width / 2;

    const isEnemyProjectile = this.#source && this.#source.isEnemy;
    const fillColor = isEnemyProjectile
      ? this.#projectileConfig['enemy-color']
      : this.#projectileConfig['player-color'];
    renderer.drawCircle(cx, cy, radius, fillColor, '#000000', 0.01);
  }
}

export { Projectile };
