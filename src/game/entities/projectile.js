import { Entity } from '../../engine/entities/entity.js';
import { entityBox, boxesOverlap } from '../../engine/physics/aabb.js';

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
    if (!this.isAlive) {
      return;
    }

    this.x += this.velocity.x * dt;
    this.y += this.velocity.y * dt;

    this.#travelDistance += Math.abs(this.velocity.x * dt) + Math.abs(this.velocity.y * dt);

    if (this.#travelDistance >= this.#maxTravel) {
      this.isAlive = false;
      return;
    }

    if (!stage) {
      return;
    }

    const isEnemyShot = this.#source?.isEnemy === true;

    for (const entity of stage.entities) {
      if (entity === this.#source || entity === this || entity.isAlive === false) {
        continue;
      }

      if (!this.#overlaps(entity)) {
        continue;
      }

      if (entity.isSolid === true) {
        this.isAlive = false;
        return;
      }

      if (!isEnemyShot && entity.isEnemy === true && typeof entity.takeDamage === 'function') {
        entity.takeDamage(this.#damage);
        this.isAlive = false;
        return;
      }
    }

    if (!isEnemyShot) {
      return;
    }

    const player = stage.player;
    if (!player || player === this.#source || player.isAlive === false) {
      return;
    }

    if (this.#overlaps(player) && typeof player.takeDamage === 'function') {
      player.takeDamage(this.#damage);
      this.isAlive = false;
    }
  }

  #overlaps(entity) {
    return boxesOverlap(entityBox(this), entityBox(entity));
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
