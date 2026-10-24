class Section {
  #name;
  #x;
  #y;
  #width;
  #height;
  #parent;
  #children;
  #entities;

  constructor(name, x, y, width, height, parent) {
    this.#name = name;
    this.#x = x;
    this.#y = y;
    this.#width = width;
    this.#height = height;
    this.#parent = parent;
    this.#children = [];
    this.#entities = [];
  }

  get name() { return this.#name; }

  get x() { return this.#x; }
  set x(v) { this.#x = v; }

  get y() { return this.#y; }
  set y(v) { this.#y = v; }

  get width() { return this.#width; }
  get height() { return this.#height; }

  get parent() { return this.#parent; }

  get children() { return this.#children; }

  get entities() { return this.#entities; }

  addChild(section) {
    this.#children.push(section);
  }

  removeChild(section) {
    const idx = this.#children.indexOf(section);
    if (idx !== -1) {
      this.#children.splice(idx, 1);
    }
  }

  getWorldPosition(sectionMap) {
    let x = this.#x;
    let y = this.#y;
    let current = sectionMap ? sectionMap.get(this.#parent) : null;

    while (current) {
      x += current.x;
      y += current.y;
      current = sectionMap ? sectionMap.get(current.parent) : null;
    }

    return { x, y };
  }

  getBounds(sectionMap) {
    const worldPos = this.getWorldPosition(sectionMap);
    return {
      x: worldPos.x,
      y: worldPos.y,
      width: this.#width,
      height: this.#height
    };
  }

  containsPoint(worldX, worldY, sectionMap) {
    const bounds = this.getBounds(sectionMap);
    return (
      worldX >= bounds.x &&
      worldX < bounds.x + bounds.width &&
      worldY >= bounds.y &&
      worldY < bounds.y + bounds.height
    );
  }
}

export { Section };
