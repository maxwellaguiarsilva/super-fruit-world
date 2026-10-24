import { Entity } from '../../engine/entities/entity.js';
import { SlopeSurface } from '../../engine/physics/slope-surface.js';

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
  #slopeSurface;
  #friction;
  #tileConfig;

  constructor(x, y, width, height, tileConfig) {
    super(x, y, width, height);
    this.#tileConfig = tileConfig;
    this.#tileType = tileConfig.type;
    this.#isSolid = tileConfig.solid;
    this.#isDeadly = tileConfig.deadly;
    this.#damageValue = tileConfig['damage-value'];
    this.#isLiquid = tileConfig.liquid;
    this.#isClimbable = tileConfig.climbable;
    this.#isSlope = tileConfig.type === 'slope';
    this.#slopeAngle = tileConfig['slope-angle'];
    this.#slopeInverted = tileConfig.inverted;
    this.#slopeSurface = this.#isSlope
      ? new SlopeSurface({
        width,
        height,
        angle: this.#slopeAngle,
        inverted: this.#slopeInverted
      })
      : null;
    this.#friction = tileConfig.friction;
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
  get slopeSurface() { return this.#slopeSurface; }
  get friction() { return this.#friction; }

  surfaceYAt(worldX) {
    return this.#slopeSurface ? this.y + this.#slopeSurface.surfaceY(worldX - this.x) : null;
  }

  render(renderer) {
    const config = this.#tileConfig;
    if (config.rendered === false) { return; }
    const fillColor = config['fill-color'];
    const borderColor = config['border-color'];
    const borderWidth = config['border-width'];
    const cornerRadius = config['corner-radius'];

    if (this.#isSlope && this.#slopeSurface) {
      const surface = this.#slopeSurface;
      const bottom = this.y + surface.bottomY;
      const top = this.y + surface.topY;
      const points = surface.inverted
        ? [
          { x: this.x, y: top },
          { x: this.x + this.width, y: bottom },
          { x: this.x, y: bottom }
        ]
        : [
          { x: this.x, y: bottom },
          { x: this.x + this.width, y: top },
          { x: this.x + this.width, y: bottom }
        ];

      renderer.drawPolygonPath(points, fillColor, borderColor, borderWidth);
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
