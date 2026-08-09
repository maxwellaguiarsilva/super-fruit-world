import { Entity } from '../../engine/entities/entity.js';

class Enemy extends Entity {
  #shape;
  #colorIndex;
  #colorPalette;
  #damageOutput;
  #isBoss;
  #dropTable;
  #enemyConfig;
  #localX;

  constructor(enemyConfig, stage) {
    const size = enemyConfig['is-boss'] ? 3.0 : 1.0;
    super(0, 0, size, size);

    this.#enemyConfig = enemyConfig;
    this.#shape = enemyConfig.shape;
    this.#colorIndex = enemyConfig['color-index'];
    this.#colorPalette = enemyConfig['color-palette'];
    this.#damageOutput = enemyConfig['damage-output'];
    this.#isBoss = enemyConfig['is-boss'] === true;
    this.#dropTable = enemyConfig['drop-table'];
    this.#localX = 0;
  }

  get shape() { return this.#shape; }
  get colorIndex() { return this.#colorIndex; }
  get damageOutput() { return this.#damageOutput; }
  get isBoss() { return this.#isBoss; }
  get dropTable() { return this.#dropTable; }
  get isFlyer() { return false; }
  get isEnemy() { return true; }
  get colorPalette() { return this.#colorPalette; }

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
    let roll = Math.random() * totalWeight;

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
      0, 0.05,
      fillColor,
      '#000000',
      0.03
    );
  }
}

export { Enemy };
