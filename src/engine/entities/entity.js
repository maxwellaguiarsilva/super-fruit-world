class Entity {
  #x;
  #y;
  #width;
  #height;
  #vx;
  #vy;
  #isAlive;
  #onGround;

  constructor(x, y, width, height) {
    this.#x = x;
    this.#y = y;
    this.#width = width;
    this.#height = height;
    this.#vx = 0;
    this.#vy = 0;
    this.#isAlive = true;
    this.#onGround = false;
  }

  get x() { return this.#x; }
  set x(v) { this.#x = v; }

  get y() { return this.#y; }
  set y(v) { this.#y = v; }

  get width() { return this.#width; }
  get height() { return this.#height; }

  get position() { return { x: this.#x, y: this.#y }; }
  set position(p) { this.#x = p.x; this.#y = p.y; }

  get velocity() { return { x: this.#vx, y: this.#vy }; }
  set velocity(v) { this.#vx = v.x; this.#vy = v.y; }

  get hitbox() {
    return {
      x: 0,
      y: 0,
      width: this.#width,
      height: this.#height
    };
  }

  get center() {
    return {
      x: this.#x + this.#width / 2,
      y: this.#y + this.#height / 2
    };
  }

  get isAlive() { return this.#isAlive; }
  set isAlive(v) { this.#isAlive = v; }

  get onGround() { return this.#onGround; }
  set onGround(v) { this.#onGround = v; }

  update(dt) {
  }

  render(renderer) {
  }
}

export { Entity };
