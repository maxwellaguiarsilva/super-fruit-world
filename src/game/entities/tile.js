import { Entity } from '../../engine/entities/entity.js';

class Tile extends Entity {
  #tileType;
  #isSolid;
  #isDeadly;
  #damageValue;
  #isLiquid;
  #isClimbable;
  #isSlope;
  #slopeAngle;
  #slopeInverted;
  #friction;
  #tileConfig;

  constructor(x, y, width, height, tileConfig) {
    super(x, y, width, height);
    this.#tileConfig = tileConfig;
    this.#tileType = tileConfig.type;
    this.#isSolid = tileConfig.solid !== false;
    this.#isDeadly = tileConfig.deadly === true;
    this.#damageValue = tileConfig['damage-value'];
    this.#isLiquid = tileConfig.liquid === true;
    this.#isClimbable = tileConfig.climbable === true;
    this.#isSlope = tileConfig.type === 'slope';
    this.#slopeAngle = 0;
    this.#slopeInverted = false;
    this.#friction = tileConfig.friction;

    if (this.#isSlope) {
      this.#slopeAngle = tileConfig['slope-angle'];
      this.#slopeInverted = tileConfig.inverted === true;
    }
  }

  get tileType() { return this.#tileType; }
  get isSolid() { return this.#isSolid; }
  get isDeadly() { return this.#isDeadly; }
  get damageValue() { return this.#damageValue; }
  get isLiquid() { return this.#isLiquid; }
  get isClimbable() { return this.#isClimbable; }
  get isSlope() { return this.#isSlope; }
  get slopeAngle() { return this.#slopeAngle; }
  get slopeInverted() { return this.#slopeInverted; }
  get friction() { return this.#friction; }

  render(renderer) {
    const config = this.#tileConfig;
    if (config.rendered === false) { return; }
    const fillColor = config['fill-color'];
    const borderColor = config['border-color'];
    const borderWidth = config['border-width'];
    const cornerRadius = config['corner-radius'];

    if (this.#isSlope) {
      const angle = this.#slopeInverted ? -this.#slopeAngle : this.#slopeAngle;
      const rad = (angle * Math.PI) / 180;

      renderer.drawRect(
        this.x, this.y,
        this.width, this.height,
        cornerRadius,
        fillColor,
        borderColor,
        borderWidth
      );
    } else {
      renderer.drawRect(
        this.x, this.y,
        this.width, this.height,
        cornerRadius,
        fillColor,
        borderColor,
        borderWidth
      );
    }
  }
}

export { Tile };
