class Renderer {
  #canvas;
  #ctx;
  #unitScale;
  #viewportWidth;
  #viewportHeight;

  constructor(canvasSelector, scaleConfig) {
    const canvas = document.querySelector(canvasSelector);
    if (!canvas) {
      throw new Error(`Canvas not found: ${canvasSelector}`);
    }
    this.#canvas = canvas;
    this.#ctx = canvas.getContext('2d');
    this.#unitScale = 0;
    this.#viewportWidth = 0;
    this.#viewportHeight = 0;
    this.#resize(scaleConfig.unitHeight);
    window.addEventListener('resize', () => this.#resize(scaleConfig.unitHeight));
  }

  #resize(unitHeight) {
    const w = window.innerWidth * 0.9;
    const h = window.innerHeight * 0.9;
    this.#canvas.width = w;
    this.#canvas.height = h;
    this.#canvas.style.width = `${w}px`;
    this.#canvas.style.height = `${h}px`;
    this.#unitScale = h / unitHeight;
    this.#viewportWidth = w / this.#unitScale;
    this.#viewportHeight = h / this.#unitScale;
  }

  get canvas() {
    return this.#canvas;
  }

  get context() {
    return this.#ctx;
  }

  get unitScale() {
    return this.#unitScale;
  }

  get viewportWidth() {
    return this.#viewportWidth;
  }

  get viewportHeight() {
    return this.#viewportHeight;
  }

  clear() {
    this.#ctx.fillStyle = '#000000';
    this.#ctx.fillRect(0, 0, this.#canvas.width, this.#canvas.height);
  }

  set cameraTransform(camera) {
    this.#ctx.save();
    this.#ctx.setTransform(
      1, 0, 0, 1,
      Math.round(-camera.x * this.#unitScale),
      Math.round(-camera.y * this.#unitScale)
    );
  }

  restoreCameraTransform() {
    this.#ctx.restore();
  }

  drawCircle(cx, cy, radius, fillColor, borderColor, borderWidth) {
    const px = cx * this.#unitScale;
    const py = cy * this.#unitScale;
    const pr = radius * this.#unitScale;

    this.#ctx.beginPath();
    this.#ctx.arc(px, py, pr, 0, Math.PI * 2);

    if (fillColor) {
      this.#ctx.fillStyle = fillColor;
      this.#ctx.fill();
    }

    if (borderColor && borderWidth > 0) {
      this.#ctx.strokeStyle = borderColor;
      this.#ctx.lineWidth = borderWidth * this.#unitScale;
      this.#ctx.stroke();
    }
  }

  drawRect(x, y, width, height, cornerRadius, fillColor, borderColor, borderWidth) {
    const px = x * this.#unitScale;
    const py = y * this.#unitScale;
    const pw = width * this.#unitScale;
    const ph = height * this.#unitScale;
    const cr = Math.min(cornerRadius * this.#unitScale, pw / 2, ph / 2);

    this.#ctx.beginPath();

    if (cr <= 0) {
      this.#ctx.rect(px, py, pw, ph);
    } else {
      this.#ctx.moveTo(px + cr, py);
      this.#ctx.lineTo(px + pw - cr, py);
      this.#ctx.arcTo(px + pw, py, px + pw, py + cr, cr);
      this.#ctx.lineTo(px + pw, py + ph - cr);
      this.#ctx.arcTo(px + pw, py + ph, px + pw - cr, py + ph, cr);
      this.#ctx.lineTo(px + cr, py + ph);
      this.#ctx.arcTo(px, py + ph, px, py + ph - cr, cr);
      this.#ctx.lineTo(px, py + cr);
      this.#ctx.arcTo(px, py, px + cr, py, cr);
      this.#ctx.closePath();
    }

    if (fillColor) {
      this.#ctx.fillStyle = fillColor;
      this.#ctx.fill();
    }

    if (borderColor && borderWidth > 0) {
      this.#ctx.strokeStyle = borderColor;
      this.#ctx.lineWidth = borderWidth * this.#unitScale;
      this.#ctx.stroke();
    }
  }

  drawPolygon(cx, cy, radius, sides, rotation, cornerRadius, fillColor, borderColor, borderWidth) {
    const px = cx * this.#unitScale;
    const py = cy * this.#unitScale;
    const pr = radius * this.#unitScale;
    const cr = Math.min(cornerRadius * this.#unitScale, pr / 2);

    const angleStep = (Math.PI * 2) / sides;

    this.#ctx.beginPath();

    for (let i = 0; i < sides; i++) {
      const angle = rotation + i * angleStep;
      const vx = px + Math.cos(angle) * pr;
      const vy = py + Math.sin(angle) * pr;

      if (i === 0) {
        this.#ctx.moveTo(vx, vy);
      } else {
        this.#ctx.lineTo(vx, vy);
      }
    }

    this.#ctx.closePath();

    if (cr > 0) {
      this.#ctx.lineJoin = 'round';
    }

    if (fillColor) {
      this.#ctx.fillStyle = fillColor;
      this.#ctx.fill();
    }

    if (borderColor && borderWidth > 0) {
      this.#ctx.strokeStyle = borderColor;
      this.#ctx.lineWidth = borderWidth * this.#unitScale;
      this.#ctx.lineJoin = 'round';
      this.#ctx.stroke();
    }

    this.#ctx.lineJoin = 'miter';
  }

  drawText(text, x, y, font, color, align) {
    const px = x * this.#unitScale;
    const py = y * this.#unitScale;

    const scaledFont = font.replace(/(\d+(?:\.\d+)?)px/, (_, size) => `${parseFloat(size) * this.#unitScale}px`);

    this.#ctx.font = scaledFont;
    this.#ctx.fillStyle = color;
    this.#ctx.textAlign = align;
    this.#ctx.fillText(text, px, py);
  }

  drawLine(x1, y1, x2, y2, color, width) {
    const px1 = x1 * this.#unitScale;
    const py1 = y1 * this.#unitScale;
    const px2 = x2 * this.#unitScale;
    const py2 = y2 * this.#unitScale;

    this.#ctx.beginPath();
    this.#ctx.moveTo(px1, py1);
    this.#ctx.lineTo(px2, py2);
    this.#ctx.strokeStyle = color;
    this.#ctx.lineWidth = width * this.#unitScale;
    this.#ctx.lineCap = 'round';
    this.#ctx.stroke();
  }

  applyFlash(alpha) {
    this.#ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    this.#ctx.fillRect(0, 0, this.#canvas.width, this.#canvas.height);
  }
}

export { Renderer };
