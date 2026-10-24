import { Projectile } from '../../game/entities/projectile.js';

function createProjectileFactory(projectileConfig) {
  return function createProjectile(x, y, velocityX, velocityY, damage, source) {
    return new Projectile(x, y, velocityX, velocityY, damage, source, projectileConfig);
  };
}

export { createProjectileFactory };
