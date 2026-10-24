import { StageBase } from '../../engine/entities/stage-base.js';
import { requireDependencies } from '../../engine/core/dependency-contract.js';
import { entityBox } from '../../engine/physics/aabb.js';
import { Projectile } from '../entities/projectile.js';
import { Collectible } from '../entities/collectible.js';
import { Enemy } from '../entities/enemy.js';
import { Tile } from '../entities/tile.js';

const STAGE_DEPENDENCIES = [
  'player',
  'physicsEngine',
  'collisionSolver',
  'collectibleFactory',
  'noteCollection',
  'projectileFactory',
  'damageSystem'
];

class Checkpoint {
  #index;
  #isActive;

  constructor(x, y, width, height, index, checkpointConfig) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.#index = index;
    this.#isActive = false;
  }

  get index() { return this.#index; }
  get isActive() { return this.#isActive; }

  activate(player) {
    this.#isActive = true;
  }

  deactivate() {
    this.#isActive = false;
  }

  get hitbox() {
    return { x: 0, y: 0, width: this.width, height: this.height };
  }

  render(renderer) {
    const color = this.#isActive ? '#40BF40' : '#808080';
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const radius = this.width / 2 * 0.8;

    renderer.drawCircle(cx, cy, radius, color, '#FFFFFF', 0.02);

    if (this.#isActive) {
      renderer.drawCircle(cx, cy, radius * 0.5, '#FFFFFF', null, 0);
    }
  }
}

class Stage extends StageBase {
  #player;
  #physicsEngine;
  #collisionSolver;
  #noteCollection;
  #activeCheckpoint;
  #isCompleted;
  #tiles;
  #collectibles;
  #enemies;
  #projectiles;
  #checkpoints;
  #teleporters;
  #projectileFactory;
  #damageSystem;
  #navigation;
  #teleporterLatch;
  #stompLatch;
  #collectibleFactory;

  constructor(stageData, dependencies) {
    super(stageData);

    const deps = requireDependencies('Stage', dependencies, STAGE_DEPENDENCIES);

    if (typeof deps.projectileFactory !== 'function') {
      throw new Error('Stage requires a projectile factory.');
    }

    this.#player = deps.player;
    this.#physicsEngine = deps.physicsEngine;
    this.#collisionSolver = deps.collisionSolver;
    this.#collectibleFactory = deps.collectibleFactory;
    this.#noteCollection = deps.noteCollection;
    this.#projectileFactory = deps.projectileFactory;
    this.#damageSystem = deps.damageSystem;
    this.#activeCheckpoint = 0;
    this.#isCompleted = false;
    this.#tiles = [];
    this.#collectibles = [];
    this.#enemies = [];
    this.#projectiles = [];
    this.#checkpoints = [];
    this.#teleporters = [];
    this.#navigation = deps.navigation ?? null;
    this.#teleporterLatch = new Set();
    this.#stompLatch = new Set();

    this.#player.stage = this;
  }

  get player() { return this.#player; }
  get isCompleted() { return this.#isCompleted; }
  get noteCollection() { return this.#noteCollection; }
  get projectileFactory() { return this.#projectileFactory; }

  get tilesList() { return this.#tiles; }
  get enemiesList() { return this.#enemies; }
  get collectiblesList() { return this.#collectibles; }
  get checkpointsList() { return this.#checkpoints; }

  get checkpointCount() { return this.#checkpoints.length; }

  get spawnPoint() { return this._spawnPoint; }
  set spawnPoint(v) { this._spawnPoint = v; }

  _spawnPoint = { x: 2, y: 0 };

  get teleporters() { return [...this.#teleporters]; }

  addTeleporter(tp) {
    this.#teleporters.push(tp);
  }

  getTeleporterMarker(name) {
    return this.entitiesByType('teleporter-marker').find((marker) => marker.name === name) ?? null;
  }

  overlappingEnemies(entity = this.#player) {
    const box = entityBox(entity);
    if (!box) {
      return [];
    }

    return this.#enemies.filter((enemy) => {
      if (!enemy.isAlive) {
        return false;
      }
      return this.#collisionSolver.checkAABB(box, entityBox(enemy));
    });
  }

  get checkpoints() { return [...this.#checkpoints]; }

  get activeCheckpoint() { return this.#activeCheckpoint; }

  respawnPlayer() {
    this.#player.healthSystem.respawn();
    this.#noteCollection?.reset();

    const cps = this.checkpoints;
    if (this.#activeCheckpoint > 0 && this.#activeCheckpoint <= cps.length) {
      const cp = cps[this.#activeCheckpoint - 1];
      this.#player.x = cp.x;
      this.#player.y = cp.y - 1;
    } else {
      const sp = this.spawnPoint;
      this.#player.x = sp.x;
      this.#player.y = sp.y - 1;
    }

    this.#player.velocity = { x: 0, y: 0 };
  }

  activateCheckpoint(index) {
    const cps = this.checkpoints;
    if (index > 0 && index <= cps.length) {
      this.#activeCheckpoint = index;
      cps[index - 1].activate(this.#player);
      this.#player.audioEngine?.playSFX('checkpoint');
    }
  }

  completeStage() {
    this.#isCompleted = true;
    this.#player.audioEngine?.playSFX('stage-clear');
  }

  handleTeleporter(teleporter, player = this.#player) {
    return teleporter.activate(this.#createTeleporterContext(player));
  }

  #createTeleporterContext(player) {
    return {
      player,
      overlaps: (teleporter) => this.#overlapsTeleporter(teleporter, player),
      markerFor: (markerName) => this.getTeleporterMarker(markerName),
      navigate: (sceneName) => this.#navigateToScene(sceneName),
      inventory: player.inventory ?? null,
      report: (message) => console.warn(message)
    };
  }

  #overlapsTeleporter(teleporter, player) {
    return this.#collisionSolver.checkAABB(entityBox(player), entityBox(teleporter));
  }

  #navigateToScene(sceneName) {
    if (!sceneName) {
      return false;
    }

    if (!this.#navigation || typeof this.#navigation.navigate !== 'function') {
      console.warn(`[teleporter] Cannot navigate to scene "${sceneName}": the stage has no navigation seam.`);
      return false;
    }

    try {
      return this.#navigation.navigate(sceneName) !== false;
    } catch (error) {
      console.warn(`[teleporter] Navigation to scene "${sceneName}" failed: ${error.message}`);
      return false;
    }
  }

  update(dt, inputManager) {
    if (this.#isCompleted) {
      return;
    }

    const initialPlayerBox = entityBox(this.#player);

    let isOnLadder = false;
    for (const tile of this.#tiles) {
      if (tile.isAlive && tile.isClimbable) {
        if (this.#collisionSolver.checkAABB(initialPlayerBox, entityBox(tile))) {
          isOnLadder = true;
          break;
        }
      }
    }

    if (isOnLadder) {
      this.#player.isClimbing = true;
    } else {
      this.#player.isClimbing = false;
    }

    if (!this.#player.isClimbing) {
      this.#physicsEngine.applyGravity(this.#player, dt);
    }

    this.#physicsEngine.applyFriction(this.#player, dt);
    this.#player.update(dt, inputManager);

    if (this.#player.isClimbing) {
      this.#player.onGround = false;
      if (inputManager) {
        if (inputManager.isDown('up')) {
          this.#player.velocity = { x: this.#player.velocity.x, y: -5.0 };
        } else if (inputManager.isDown('down')) {
          this.#player.velocity = { x: this.#player.velocity.x, y: 5.0 };
        } else {
          this.#player.velocity = { x: this.#player.velocity.x, y: 0 };
        }
      }
    }

    this.#physicsEngine.integratePosition(this.#player, dt);

    const wasOnGround = this.#player.onGround;
    this.#player.onGround = false;

    for (const tile of this.#tiles) {
      if (!tile.isAlive) {
        continue;
      }

      const tileBox = entityBox(tile);
      const playerBox = entityBox(this.#player);
      const slopeSurface = tile.isSlope ? tile.slopeSurface : null;

      if (!slopeSurface && !this.#collisionSolver.checkAABB(playerBox, tileBox)) {
        continue;
      }

      if (slopeSurface && tile.isSolid) {
        const result = this.#collisionSolver.resolveSlopeCollision(
          { position: this.#player.position, velocity: this.#player.velocity, hitbox: this.#player.hitbox, onGround: wasOnGround },
          tile,
          dt
        );

        if (result.collided) {
          this.#player.position = result.position;
          this.#player.velocity = result.velocity;
          if (result.onGround) {
            this.#player.onGround = true;
            this.#player.isClimbing = false;
          }
        }
      } else if (tile.isSolid) {
        const result = this.#collisionSolver.resolveCollision(
          { position: this.#player.position, velocity: this.#player.velocity, hitbox: this.#player.hitbox, onGround: this.#player.onGround },
          tileBox,
          dt
        );

        this.#player.position = result.position;
        this.#player.velocity = result.velocity;
        if (result.onGround) {
          this.#player.onGround = true;
          this.#player.isClimbing = false;
        }
      }

      if (tile.isDeadly) {
        this.#damageSystem.applyHazardDamage(this.#player, tile.damageValue);
      }

      if (tile.isLiquid) {
        this.#player.velocity = {
          x: this.#player.velocity.x * 0.5,
          y: Math.min(this.#player.velocity.y, 0.5)
        };
      }
    }

    const playerBox = entityBox(this.#player);

    for (const collectible of this.#collectibles) {
      if (!collectible.isAlive) {
        continue;
      }

      if (this.#collisionSolver.checkAABB(playerBox, entityBox(collectible))) {
        collectible.collect(this.#player);
      }
    }

    for (const checkpoint of this.#checkpoints) {
      if (checkpoint.isActive) {
        continue;
      }

      // A checkpoint is placed at the surface it belongs to, so its contact volume is the cell above its origin.
      const checkpointBox = {
        ...entityBox(checkpoint),
        y: checkpoint.y - checkpoint.height
      };

      if (this.#collisionSolver.checkAABB(playerBox, checkpointBox)) {
        this.activateCheckpoint(checkpoint.index);
      }
    }

    for (const enemy of this.#enemies) {
      if (!enemy.isAlive) {
        continue;
      }

      if (!enemy.isFlyer) {
        this.#physicsEngine.applyGravity(enemy, dt);
      }

      enemy.update(dt, this);

      if (!enemy.isFlyer) {
        this.#physicsEngine.integratePosition(enemy, dt);

        const enemyWasOnGround = enemy.onGround;
        enemy.onGround = false;
        for (const tile of this.#tiles) {
          if (!tile.isAlive || !tile.isSolid) {
            continue;
          }

          const tileBox = entityBox(tile);
          const enemyBox = entityBox(enemy);
          const slopeSurface = tile.isSlope ? tile.slopeSurface : null;

          if (!slopeSurface && !this.#collisionSolver.checkAABB(enemyBox, tileBox)) {
            continue;
          }

          const oldVelX = enemy.velocity.x;
          const result = slopeSurface
            ? this.#collisionSolver.resolveSlopeCollision(
              { position: enemy.position, velocity: enemy.velocity, hitbox: enemy.hitbox, onGround: enemyWasOnGround },
              tile,
              dt
            )
            : this.#collisionSolver.resolveCollision(
              { position: enemy.position, velocity: enemy.velocity, hitbox: enemy.hitbox, onGround: enemy.onGround },
              tileBox,
              dt
            );

          if (!result.collided) {
            continue;
          }

          enemy.position = result.position;
          enemy.velocity = result.velocity;
          if (result.onGround) {
            enemy.onGround = true;
          }

          if (enemy.onWallHit && oldVelX !== 0 && result.velocity.x === 0) {
            enemy.onWallHit();
          }
        }
      }

      const playerBox = entityBox(this.#player);
      const enemyBox = entityBox(enemy);

      if (!this.#collisionSolver.checkAABB(playerBox, enemyBox)) {
        this.#stompLatch.delete(enemy);
        continue;
      }

      const playerBottom = this.#player.y + this.#player.hitbox.y + this.#player.hitbox.height;
      const enemyTop = enemy.y;
      const canStomp = this.#player.velocity.y > 0 && playerBottom - enemyTop < 0.3;

      if (canStomp && !this.#stompLatch.has(enemy)) {
        this.#stompLatch.add(enemy);
        enemy.takeDamage(1);
        this.#player.audioEngine?.playSFX('attack');
        this.#player.velocity = { x: this.#player.velocity.x, y: -0.5 };
      } else if (!this.#stompLatch.has(enemy)) {
        this.#damageSystem.applyEnemyDamage(this.#player, enemy);
      }
    }

    const teleporterContext = this.#createTeleporterContext(this.#player);
    for (const teleporter of this.#teleporters) {
      if (!teleporterContext.overlaps(teleporter)) {
        this.#teleporterLatch.delete(teleporter);
        continue;
      }

      if (this.#teleporterLatch.has(teleporter)) {
        continue;
      }

      if (!inputManager || !inputManager.isPressed('up')) {
        continue;
      }

      if (!teleporter.canActivate(teleporterContext)) {
        continue;
      }

      if (teleporter.activate(teleporterContext)) {
        this.#teleporterLatch.add(teleporter);
        break;
      }
    }

    for (const proj of this.#projectiles) {
      if (!proj.isAlive) {
        continue;
      }
      proj.update(dt, this);
    }

    for (let i = this.#enemies.length - 1; i >= 0; i--) {
      const enemy = this.#enemies[i];
      if (!enemy.isAlive) {
        const drop = enemy.resolveDrop();
        if (drop) {
          this.#spawnCollectibleAt(drop, enemy.x, enemy.y);
        }
        this.#stompLatch.delete(enemy);
        this.removeEntity(enemy);
      }
    }

    for (let i = this.#collectibles.length - 1; i >= 0; i--) {
      if (!this.#collectibles[i].isAlive) {
        this.removeEntity(this.#collectibles[i]);
      }
    }

    for (let i = this.#projectiles.length - 1; i >= 0; i--) {
      if (!this.#projectiles[i].isAlive) {
        this.removeEntity(this.#projectiles[i]);
      }
    }

    if (this.#player.healthSystem?.isDead === true) {
      this.respawnPlayer();
      return;
    }

    const maxFallY = this.bounds.y + this.bounds.height + 5;
    if (this.#player.y > maxFallY) {
      this.respawnPlayer();
    }
  }

  #spawnCollectibleAt(type, x, y) {
    const config = {
      type,
      size: { width: 0.5, height: 0.5 },
      'fill-color': '#BFBF40'
    };
    const col = this.#collectibleFactory(config);
    col.x = x;
    col.y = y;
    this.addEntity(col);
  }

  get entities() { return super.entities; }

  addEntity(entity) {
    super.addEntity(entity);

    if (entity instanceof Tile) {
      this.#tiles.push(entity);
    } else if (entity instanceof Enemy) {
      this.#enemies.push(entity);
    } else if (entity instanceof Collectible) {
      this.#collectibles.push(entity);
    } else if (entity instanceof Projectile) {
      this.#projectiles.push(entity);
    } else if (entity instanceof Checkpoint) {
      this.#checkpoints.push(entity);
    }
  }

  removeEntity(entity) {
    super.removeEntity(entity);
    this.#removeFrom(this.#tiles, entity);
    this.#removeFrom(this.#enemies, entity);
    this.#removeFrom(this.#collectibles, entity);
    this.#removeFrom(this.#projectiles, entity);
    this.#removeFrom(this.#checkpoints, entity);
  }

  #removeFrom(list, entity) {
    const index = list.indexOf(entity);
    if (index !== -1) {
      list.splice(index, 1);
    }
  }

  render(renderer) {
    for (const tile of this.#tiles) {
      tile.render(renderer);
    }

    for (const tp of this.#teleporters) {
      if (tp.render) {
        tp.render(renderer);
      }
    }

    for (const collectible of this.#collectibles) {
      if (collectible.isAlive) {
        collectible.render(renderer);
      }
    }

    for (const enemy of this.#enemies) {
      if (enemy.isAlive) {
        enemy.render(renderer);
      }
    }

    for (const proj of this.#projectiles) {
      if (proj.isAlive) {
        proj.render(renderer);
      }
    }

    for (const cp of this.checkpoints) {
      cp.render(renderer);
    }

    if (this.#player && this.#player.isAlive) {
      this.#player.render(renderer);
    }
  }
}

export { Stage, Checkpoint };
