class UIElement {
  #x;
  #y;
  #anchor;
  #visible;
  #children;
  #fillColorName;
  #borderName;
  #width;
  #height;

  constructor(config) {
    this.#x = config.x;
    this.#y = config.y;
    this.#anchor = config.anchor;
    this.#visible = config.visible;
    this.#children = [];
    this.#fillColorName = config['fill-color'];
    this.#borderName = config.border;
    this.#width = config.width;
    this.#height = config.height;
  }

  get x() { return this.#x; }
  set x(v) { this.#x = v; }

  get y() { return this.#y; }
  set y(v) { this.#y = v; }

  get anchor() { return this.#anchor; }

  get visible() { return this.#visible; }
  set visible(v) { this.#visible = v; }

  get children() { return this.#children; }

  get width() { return this.#width; }
  get height() { return this.#height; }

  get fillColorName() { return this.#fillColorName; }
  get borderName() { return this.#borderName; }

  addChild(child) {
    this.#children.push(child);
  }

  removeChild(child) {
    const idx = this.#children.indexOf(child);
    if (idx !== -1) {
      this.#children.splice(idx, 1);
    }
  }

  computeScreenPosition(camera) {
    const vw = camera ? camera.width : 40;
    const vh = camera ? camera.height : 30;

    let sx, sy;

    switch (this.#anchor) {
      case 'top-left':
        sx = this.#x;
        sy = this.#y;
        break;
      case 'top-right':
        sx = vw - this.#x - this.#width;
        sy = this.#y;
        break;
      case 'top-center':
        sx = (vw - this.#width) / 2 + this.#x;
        sy = this.#y;
        break;
      case 'center':
        sx = (vw - this.#width) / 2 + this.#x;
        sy = (vh - this.#height) / 2 + this.#y;
        break;
      case 'bottom-left':
        sx = this.#x;
        sy = vh - this.#y - this.#height;
        break;
      case 'bottom-right':
        sx = vw - this.#x - this.#width;
        sy = vh - this.#y - this.#height;
        break;
      case 'bottom-center':
        sx = (vw - this.#width) / 2 + this.#x;
        sy = vh - this.#y - this.#height;
        break;
      default:
        sx = this.#x;
        sy = this.#y;
    }

    if (camera) {
      sx += camera.x;
      sy += camera.y;
    }

    return { x: sx, y: sy };
  }

  update(dt) {
    for (const child of this.#children) {
      child.update(dt);
    }
  }

  render(renderer) {
    if (!this.#visible) {
      return;
    }

    for (const child of this.#children) {
      child.render(renderer);
    }
  }

  handleInput(inputManager) {
  }
}

export { UIElement };
