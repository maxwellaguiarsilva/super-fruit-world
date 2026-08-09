class Camera {
  #x;
  #y;
  #width;
  #height;

  constructor() {
    this.#x = 0;
    this.#y = 0;
    this.#width = 0;
    this.#height = 0;
  }

  get x() {
    return this.#x;
  }

  set x(v) {
    this.#x = v;
  }

  get y() {
    return this.#y;
  }

  set y(v) {
    this.#y = v;
  }

  get width() {
    return this.#width;
  }

  get height() {
    return this.#height;
  }

  setSize(w, h) {
    this.#width = w;
    this.#height = h;
  }

  worldToScreen(worldX, worldY) {
    return {
      x: worldX - this.#x,
      y: worldY - this.#y
    };
  }

  screenToWorld(screenX, screenY) {
    return {
      x: screenX + this.#x,
      y: screenY + this.#y
    };
  }

  follow(target, smoothing) {
    const desiredX = target.x - this.#width / 2;
    const desiredY = target.y - this.#height / 2;
    const t = Math.min(1, smoothing);
    this.#x += (desiredX - this.#x) * t;
    this.#y += (desiredY - this.#y) * t;
  }

  isVisible(worldRect) {
    return (
      worldRect.x + worldRect.width > this.#x &&
      worldRect.x < this.#x + this.#width &&
      worldRect.y + worldRect.height > this.#y &&
      worldRect.y < this.#y + this.#height
    );
  }

  constrainToBounds(bounds) {
    if (this.#x < bounds.x) {
      this.#x = bounds.x;
    }
    if (this.#y < bounds.y) {
      this.#y = bounds.y;
    }
    const maxX = bounds.x + bounds.width - this.#width;
    const maxY = bounds.y + bounds.height - this.#height;
    if (this.#x > maxX) {
      this.#x = maxX;
    }
    if (this.#y > maxY) {
      this.#y = maxY;
    }
  }
}

export { Camera };
