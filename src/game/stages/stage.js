import { StageBase } from '../../engine/entities/stage-base.js';
import { Projectile } from '../entities/projectile.js';
import { Collectible } from '../entities/collectible.js';

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
  static projectileClass = Projectile;

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
  #teleporters;
  #stageConfig;
  #projectileConfig;

  constructor(stageConfig, player, physicsEngine, collisionSolver, collectibleFactory, enemyFactory, noteCollection, projectileConfig) {
    super(stageConfig);

    this.#stageConfig = stageConfig;
    this.#player = player;
    this.#physicsEngine = physicsEngine;
    this.#collisionSolver = collisionSolver;
    this.#noteCollection = noteCollection;
    this.#projectileConfig = projectileConfig;
    this.#activeCheckpoint = 0;
    this.#isCompleted = false;
    this.#tiles = [];
    this.#collectibles = [];
    this.#enemies = [];
    this.#projectiles = [];
    this.#teleporters = [];

    player.stage = this;
  }

  get player() { return this.#player; }
  get isCompleted() { return this.#isCompleted; }
  get noteCollection() { return this.#noteCollection; }
  get projectileConfig() { return this.#projectileConfig; }

  get tilesList() { return this.#tiles; }
  set tilesList(v) { this.#tiles = v; }

  get enemiesList() { return this.#enemies; }
  set enemiesList(v) { this.#enemies = v; }

  get collectiblesList() { return this.#collectibles; }
  set collectiblesList(v) { this.#collectibles = v; }

  get checkpointsList() { return this._checkpoints; }
  set checkpointsList(v) { this._checkpoints = v; }
  _checkpoints = [];

  get checkpointCount() { return this._checkpoints.length; }
  set checkpointCount(v) {}

  get spawnPoint() { return this._spawnPoint; }
  set spawnPoint(v) { this._spawnPoint = v; }

  _spawnPoint = { x: 2, y: 0 };

  addTeleporter(tp) {
    this.#teleporters.push(tp);
  }

  get checkpoints() {
    const cps = [];
    for (const entity of super.entities) {
      if (entity instanceof Checkpoint) {
        cps.push(entity);
      }
    }
    return cps.concat(this._checkpoints);
  }

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

  handleTeleporter(teleporter, player) {
    if (teleporter.activate) {
      teleporter.activate(player, this);
    }
  }

  update(dt, inputManager) {
    if (this.#isCompleted) {
      return;
    }

    const initialPlayerBox = {
      x: this.#player.x + this.#player.hitbox.x,
      y: this.#player.y + this.#player.hitbox.y,
      width: this.#player.hitbox.width,
      height: this.#player.hitbox.height
    };

    let isOnLadder = false;
    for (const tile of this.#tiles) {
      if (tile.isAlive && tile.isClimbable) {
        const tileBox = { x: tile.x, y: tile.y, width: tile.width, height: tile.height };
        if (this.#collisionSolver.checkAABB(initialPlayerBox, tileBox)) {
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

    this.#player.onGround = false;

    for (const tile of this.#tiles) {
      if (!tile.isAlive) {
        continue;
      }

      const tileBox = { x: tile.x, y: tile.y, width: tile.width, height: tile.height };
      const playerBox = {
        x: this.#player.x + this.#player.hitbox.x,
        y: this.#player.y + this.#player.hitbox.y,
        width: this.#player.hitbox.width,
        height: this.#player.hitbox.height
      };

      if (!this.#collisionSolver.checkAABB(playerBox, tileBox)) {
        continue;
      }

      if (tile.isSolid) {
        const result = this.#collisionSolver.resolveCollision(
          { position: this.#player.position, velocity: this.#player.velocity, hitbox: this.#player.hitbox, onGround: this.#player.onGround },
          tileBox
        );

        this.#player.position = result.position;
        this.#player.velocity = result.velocity;
        if (result.onGround) {
          this.#player.onGround = true;
          this.#player.isClimbing = false;
        }
      }

      if (tile.isDeadly) {
        this.#player.takeDamage(tile.damageValue);
      }

      if (tile.isLiquid) {
        this.#player.velocity = {
          x: this.#player.velocity.x * 0.5,
          y: Math.min(this.#player.velocity.y, 0.5)
        };
      }
    }

    for (const collectible of this.#collectibles) {
      if (!collectible.isAlive) {
        continue;
      }

      const playerBox = {
        x: this.#player.x + this.#player.hitbox.x,
        y: this.#player.y + this.#player.hitbox.y,
        width: this.#player.hitbox.width,
        height: this.#player.hitbox.height
      };
      const colBox = {
        x: collectible.x,
        y: collectible.y,
        width: collectible.width,
        height: collectible.height
      };

      if (this.#collisionSolver.checkAABB(playerBox, colBox)) {
        collectible.collect(this.#player);
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

        enemy.onGround = false;
        for (const tile of this.#tiles) {
          if (!tile.isAlive || !tile.isSolid) {
            continue;
          }

          const tileBox = { x: tile.x, y: tile.y, width: tile.width, height: tile.height };
          const enemyBox = {
            x: enemy.x + enemy.hitbox.x,
            y: enemy.y + enemy.hitbox.y,
            width: enemy.hitbox.width,
            height: enemy.hitbox.height
          };

          if (this.#collisionSolver.checkAABB(enemyBox, tileBox)) {
            const oldVelX = enemy.velocity.x;
            const result = this.#collisionSolver.resolveCollision(
              { position: enemy.position, velocity: enemy.velocity, hitbox: enemy.hitbox, onGround: enemy.onGround },
              tileBox,
              dt
            );

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
      }

      const playerBox = {
        x: this.#player.x + this.#player.hitbox.x,
        y: this.#player.y + this.#player.hitbox.y,
        width: this.#player.hitbox.width,
        height: this.#player.hitbox.height
      };
      const enemyBox = {
        x: enemy.x + enemy.hitbox.x,
        y: enemy.y + enemy.hitbox.y,
        width: enemy.hitbox.width,
        height: enemy.hitbox.height
      };

      if (this.#collisionSolver.checkAABB(playerBox, enemyBox)) {
        const playerBottom = this.#player.y + this.#player.hitbox.y + this.#player.hitbox.height;
        const enemyTop = enemy.y;

        if (this.#player.velocity.y > 0 && playerBottom - enemyTop < 0.3) {
          enemy.takeDamage(1);
          this.#player.audioEngine?.playSFX('attack');
          this.#player.velocity = { x: this.#player.velocity.x, y: -0.5 };
        } else if (!this.#player.isInvincible) {
          const damage = enemy.damageOutput;
          const shieldActive = this.#player.ability('shoot')?.isShielding;
          const actualDamage = shieldActive ? damage * 0.1 : damage;
          this.#player.takeDamage(actualDamage);
        }
      }
    }

    for (const teleporter of this.#teleporters) {
      if (!teleporter.isActive) {
        continue;
      }

      const playerBox = {
        x: this.#player.x + this.#player.hitbox.x,
        y: this.#player.y + this.#player.hitbox.y,
        width: this.#player.hitbox.width,
        height: this.#player.hitbox.height
      };
      const tpBox = {
        x: teleporter.x,
        y: teleporter.y,
        width: 1,
        height: 1
      };

      if (inputManager && inputManager.isPressed('up') && this.#collisionSolver.checkAABB(playerBox, tpBox)) {
        this.handleTeleporter(teleporter, this.#player);
      }
    }

    for (const proj of this.#projectiles) {
      if (!proj.isAlive) {
        continue;
      }
      proj.update(dt, this);
    }

    for (let i = this.#enemies.length - 1; i >= 0; i--) {
      if (!this.#enemies[i].isAlive) {
        const drop = this.#enemies[i].resolveDrop();
        if (drop) {
          this.#spawnCollectibleAt(drop, this.#enemies[i].x, this.#enemies[i].y);
        }
        this.removeEntity(this.#enemies[i]);
        this.#enemies.splice(i, 1);
      }
    }

    for (let i = this.#collectibles.length - 1; i >= 0; i--) {
      if (!this.#collectibles[i].isAlive) {
        this.removeEntity(this.#collectibles[i]);
        this.#collectibles.splice(i, 1);
      }
    }

    for (let i = this.#projectiles.length - 1; i >= 0; i--) {
      if (!this.#projectiles[i].isAlive) {
        this.removeEntity(this.#projectiles[i]);
        this.#projectiles.splice(i, 1);
      }
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
    const col = new Collectible(0, 0, 0.5, 0.5, config);
    col.x = x;
    col.y = y;
    col.stage = this;
    this.#collectibles.push(col);
    this.addEntity(col);
  }

  static _collectibleClass = Collectible;

  get entities() { return [...super.entities, ...this.#tiles, ...this.#collectibles, ...this.#enemies, ...this.#projectiles, ...this.checkpoints]; }

  addEntity(entity) {
    super.addEntity(entity);
    if (entity instanceof Projectile) {
      this.#projectiles.push(entity);
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
