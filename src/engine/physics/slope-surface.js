const DEGREES_TO_RADIANS = Math.PI / 180;
const RISE_EPSILON = 1e-6;

// A slope is the solid wedge below a diagonal inside the tile box. Collision and
// rendering both work on the box diagonal, so a configured angle that does not
// match the tile aspect ratio is replaced by the angle derived from width/height.
class SlopeSurface {
  #width;
  #height;
  #inverted;
  #declaredAngle;
  #angle;
  #rise;
  #usesDeclaredAngle;

  constructor({ width, height, angle = null, inverted = false }) {
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      throw new Error(`SlopeSurface requires a positive width and height; received ${width} x ${height}.`);
    }

    this.#width = width;
    this.#height = height;
    this.#inverted = inverted === true;

    const declared = Number(angle);
    this.#declaredAngle = Number.isFinite(declared) && declared > 0 && declared < 90 ? declared : null;

    const declaredRise = this.#declaredAngle === null
      ? null
      : Math.tan(this.#declaredAngle * DEGREES_TO_RADIANS) * width;

    if (declaredRise !== null && Math.abs(declaredRise - height) <= RISE_EPSILON) {
      this.#angle = this.#declaredAngle;
      this.#rise = declaredRise;
      this.#usesDeclaredAngle = true;
    } else {
      this.#angle = this.#angleFromSize();
      this.#rise = height;
      this.#usesDeclaredAngle = false;
    }
  }

  #angleFromSize() {
    return Math.atan2(this.#height, this.#width) / DEGREES_TO_RADIANS;
  }

  get width() { return this.#width; }
  get height() { return this.#height; }
  get inverted() { return this.#inverted; }
  get declaredAngle() { return this.#declaredAngle; }
  get angle() { return this.#angle; }
  get rise() { return this.#rise; }

  get derived() {
    return !this.#usesDeclaredAngle;
  }

  get topY() { return this.#height - this.#rise; }
  get bottomY() { return this.#height; }

  // Local surface height for a local x. y grows downward, so the low end sits at bottomY.
  surfaceY(localX) {
    const x = Math.min(Math.max(localX, 0), this.#width);
    const distanceFromLowEnd = this.#inverted ? this.#width - x : x;
    return this.#height - this.#rise * (distanceFromLowEnd / this.#width);
  }

  // Inverse of surfaceY: the local x where the surface reaches a local y.
  surfaceX(localY) {
    const y = Math.min(Math.max(localY, this.topY), this.#height);
    const distanceFromLowEnd = ((this.#height - y) / this.#rise) * this.#width;
    return this.#inverted ? this.#width - distanceFromLowEnd : distanceFromLowEnd;
  }
}

export { SlopeSurface };
