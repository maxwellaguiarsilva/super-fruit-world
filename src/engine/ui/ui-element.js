function anchorPosition(anchor, offset, width, height, viewportWidth, viewportHeight) {
  const x = offset?.x ?? 0;
  const y = offset?.y ?? 0;

  switch (anchor) {
    case 'top-right':
      return { x: viewportWidth - x - width, y };
    case 'top-center':
      return { x: (viewportWidth - width) / 2 + x, y };
    case 'center':
      return { x: (viewportWidth - width) / 2 + x, y: (viewportHeight - height) / 2 + y };
    case 'bottom-left':
      return { x, y: viewportHeight - y - height };
    case 'bottom-right':
      return { x: viewportWidth - x - width, y: viewportHeight - y - height };
    case 'bottom-center':
      return { x: (viewportWidth - width) / 2 + x, y: viewportHeight - y - height };
    default:
      return { x, y };
  }
}

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
    const viewportWidth = camera ? camera.width : 40;
    const viewportHeight = camera ? camera.height : 30;
    const position = anchorPosition(
      this.#anchor,
      { x: this.#x, y: this.#y },
      this.#width,
      this.#height,
      viewportWidth,
      viewportHeight
    );

    if (camera) {
      position.x += camera.x;
      position.y += camera.y;
    }

    return position;
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

export { UIElement, anchorPosition };
