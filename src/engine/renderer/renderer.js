class Renderer {
  #canvas;
  #ctx;
  #unitScale;
  #unitHeight;
  #viewportFraction;
  #viewportWidth;
  #viewportHeight;

  constructor(canvasSelector, scaleConfig) {
    const canvas = document.querySelector(canvasSelector);
    if (!canvas) {
      throw new Error(`Canvas not found: ${canvasSelector}`);
    }

    const unitHeight = scaleConfig?.unitHeight;
    if (typeof unitHeight !== 'number' || !(unitHeight > 0)) {
      throw new Error(
        `Renderer requires a positive numeric "unitHeight" in its scale configuration; received ${String(unitHeight)}.`
      );
    }

    const viewportPercent = scaleConfig?.viewportPercent;
    if (typeof viewportPercent !== 'number' || !(viewportPercent > 0)) {
      throw new Error(
        `Renderer requires a positive numeric "viewportPercent" in its scale configuration; received ${String(viewportPercent)}.`
      );
    }

    this.#canvas = canvas;
    this.#ctx = canvas.getContext('2d');
    this.#unitScale = 0;
    this.#unitHeight = unitHeight;
    this.#viewportFraction = viewportPercent / 100;
    this.#viewportWidth = 0;
    this.#viewportHeight = 0;
    this.#resize();
    window.addEventListener('resize', () => this.#resize());
  }

  #resize() {
    const w = window.innerWidth * this.#viewportFraction;
    const h = window.innerHeight * this.#viewportFraction;
    this.#canvas.width = w;
    this.#canvas.height = h;
    this.#canvas.style.width = `${w}px`;
    this.#canvas.style.height = `${h}px`;
    this.#unitScale = h / this.#unitHeight;
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

  drawPolygonPath(points, fillColor, borderColor, borderWidth) {
    if (!Array.isArray(points) || points.length < 3) {
      return;
    }

    this.#ctx.beginPath();

    points.forEach((point, index) => {
      const px = point.x * this.#unitScale;
      const py = point.y * this.#unitScale;

      if (index === 0) {
        this.#ctx.moveTo(px, py);
      } else {
        this.#ctx.lineTo(px, py);
      }
    });

    this.#ctx.closePath();

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

  drawPolygon(cx, cy, radius, sides, rotation, fillColor, borderColor, borderWidth) {
    const px = cx * this.#unitScale;
    const py = cy * this.#unitScale;
    const pr = radius * this.#unitScale;

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

  #scaleFont(font) {
    return font.replace(/(\d+(?:\.\d+)?)px/, (_, size) => `${parseFloat(size) * this.#unitScale}px`);
  }

  measureText(text, font) {
    if (typeof text !== 'string' || text.length === 0) {
      return 0;
    }

    this.#ctx.save();
    this.#ctx.font = this.#scaleFont(font);
    const width = this.#ctx.measureText(text).width;
    this.#ctx.restore();

    return this.#unitScale > 0 ? width / this.#unitScale : 0;
  }

  drawText(text, x, y, font, color, align) {
    const px = x * this.#unitScale;
    const py = y * this.#unitScale;

    this.#ctx.font = this.#scaleFont(font);
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
