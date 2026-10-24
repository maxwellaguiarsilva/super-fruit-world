import { Stage } from '../../src/game/stages/stage.js';
import { Collectible } from '../../src/game/entities/collectible.js';
import { Projectile } from '../../src/game/entities/projectile.js';

const PROJECTILE_CONFIG = {
  size: 0.25,
  'max-travel': 20,
  'enemy-color': '#BF4040',
  'player-color': '#40BF40'
};

function createPlayer() {
  return {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    level: 0,
    direction: 1,
    isAlive: true,
    inventory: { count: () => 0, has: () => false, remove() {} },
    set stage(value) { this._stage = value; },
    get stage() { return this._stage; },
    update() {}
  };
}

function createPhysicsEngine() {
  return {
    applyGravity() {},
    applyFriction() {},
    integratePosition() {}
  };
}

function createCollisionSolver() {
  return {
    checkAABB: () => false,
    getOverlap: () => null,
    resolveCollision: () => ({
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      onGround: false
    })
  };
}

function createCollectibleFactory() {
  return (config) => new Collectible(0, 0, config.size?.width ?? 0.5, config.size?.height ?? 0.5, config);
}

function createProjectileFactory() {
  return (x, y, velocityX, velocityY, damage, source) =>
    new Projectile(x, y, velocityX, velocityY, damage, source, PROJECTILE_CONFIG);
}

function createStage(options = {}) {
  const player = options.player ?? createPlayer();
  const projectileFactory = options.projectileFactory ?? createProjectileFactory();
  const stageData = options.stageData ?? { name: 'fixture' };

  const stage = new Stage(stageData, {
    player,
    physicsEngine: options.physicsEngine ?? createPhysicsEngine(),
    collisionSolver: options.collisionSolver ?? createCollisionSolver(),
    collectibleFactory: options.collectibleFactory ?? createCollectibleFactory(),
    noteCollection: options.noteCollection ?? null,
    projectileFactory,
    damageSystem: options.damageSystem ?? { applyHazardDamage() {}, applyEnemyDamage() {} },
    navigation: options.navigation ?? null
  });

  return { stage, player, projectileFactory };
}

export {
  PROJECTILE_CONFIG,
  createPlayer,
  createPhysicsEngine,
  createCollisionSolver,
  createCollectibleFactory,
  createProjectileFactory,
  createStage
};
