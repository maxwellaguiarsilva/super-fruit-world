import { Entity } from '../../engine/entities/entity.js';

class Enemy extends Entity {
  #shape;
  #colorIndex;
  #colorPalette;
  #damageOutput;
  #isBoss;
  #dropTable;
  #projectileFactory;
  #random;

  constructor(enemyConfig, stage, deps = {}) {
    if (!Number.isFinite(enemyConfig?.size)) {
      throw new Error('Enemy requires a normalized configuration with a numeric "size".');
    }

    super(0, 0, enemyConfig.size, enemyConfig.size);

    this.#shape = enemyConfig.shape;
    this.#colorIndex = enemyConfig['color-index'];
    this.#colorPalette = enemyConfig['color-palette'];
    this.#damageOutput = enemyConfig['damage-output'];
    this.#isBoss = enemyConfig['is-boss'];
    this.#dropTable = enemyConfig['drop-table'];
    this.#projectileFactory = deps.projectileFactory ?? null;
    this.#random = deps.random ?? Math.random;
  }

  get shape() { return this.#shape; }
  get colorIndex() { return this.#colorIndex; }
  get damageOutput() { return this.#damageOutput; }
  get isBoss() { return this.#isBoss; }
  get dropTable() { return this.#dropTable; }
  get isFlyer() { return false; }
  get isEnemy() { return true; }
  get colorPalette() { return this.#colorPalette; }
  get projectileFactory() { return this.#projectileFactory; }

  takeDamage(amount) {
    this.#colorIndex = Math.max(0, this.#colorIndex - amount);

    if (this.#colorIndex <= 0) {
      this.isAlive = false;
    }
  }

  resolveDrop() {
    if (this.#dropTable.length === 0) {
      return null;
    }

    const totalWeight = this.#dropTable.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = this.#random() * totalWeight;

    for (const entry of this.#dropTable) {
      roll -= entry.weight;
      if (roll <= 0) {
        return entry.type;
      }
    }

    return null;
  }

  update(dt, stage) {
  }

  render(renderer) {
    const fillColor = this.#colorPalette[this.#colorIndex];

    const radius = this.width / 2;
    const cx = this.x + radius;
    const cy = this.y + radius;

    renderer.drawPolygon(
      cx, cy, radius, this.#shape,
      0,
      fillColor,
      '#000000',
      0.03
    );
  }
}

export { Enemy };
