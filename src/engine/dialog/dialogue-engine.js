const GLYPH_WIDTH_RATIO = 0.6;
const MIN_GLYPH_SLOTS = 1;

function measureTextWidth(text, fontSize) {
  if (typeof text !== 'string' || text.length === 0) {
    return 0;
  }

  return text.length * fontSize * GLYPH_WIDTH_RATIO;
}

function wrapText(text, maxWidth, fontSize) {
  if (typeof text !== 'string' || text.length === 0) {
    return [];
  }

  const glyphWidth = fontSize * GLYPH_WIDTH_RATIO;
  if (!(glyphWidth > 0) || !(maxWidth > 0)) {
    return [text];
  }

  const maxGlyphs = Math.max(MIN_GLYPH_SLOTS, Math.floor(maxWidth / glyphWidth));
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current.length > 0 ? `${current} ${word}` : word;
    if (candidate.length <= maxGlyphs) {
      current = candidate;
      continue;
    }

    if (current.length > 0) {
      lines.push(current);
      current = '';
    }

    let remainder = word;
    while (remainder.length > maxGlyphs) {
      lines.push(remainder.slice(0, maxGlyphs));
      remainder = remainder.slice(maxGlyphs);
    }
    current = remainder;
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines;
}

function computeDialogueLayout(viewportWidth, viewportHeight, layout, lineCount = 0) {
  const config = layout ?? {};
  const margin = config.margin ?? 0.5;
  const maxWidth = config['max-width'] ?? viewportWidth - margin * 2;
  const padding = config.padding ?? { x: 0, y: 0 };
  const speaker = config.speaker ?? {};
  const platePadding = speaker.plate?.padding ?? { x: 0, y: 0 };
  const plateHeight = (speaker['font-size'] ?? 0) + platePadding.y * 2;

  const text = config.text ?? {};
  const fontSize = text['font-size'] ?? 0;
  const lineHeight = text['line-height'] ?? 0;
  const baseHeight = config.height ?? 0;
  const maxHeight = Math.max(baseHeight, config['max-height'] ?? baseHeight);
  const requiredHeight = lineCount > 0
    ? padding.y * 2 + plateHeight + (text.gap ?? 0) + fontSize + (lineCount - 1) * lineHeight
    : 0;
  const availableHeight = Math.max(0, viewportHeight - margin * 2);
  const height = Math.min(Math.max(baseHeight, requiredHeight), maxHeight, availableHeight);

  const width = Math.max(0, Math.min(maxWidth, viewportWidth - margin * 2));
  const x = (viewportWidth - width) / 2;
  const y = viewportHeight - margin - height;
  const textX = x + padding.x;
  const textY = y + padding.y + plateHeight + (text.gap ?? 0);
  const textWidth = Math.max(0, width - padding.x * 2);
  const textBottom = y + height - padding.y;

  let maxLines = MIN_GLYPH_SLOTS;
  if (lineHeight > 0 && textBottom > textY) {
    maxLines = Math.max(1, Math.floor((textBottom - textY - fontSize) / lineHeight) + 1);
  }

  return {
    x,
    y,
    width,
    height,
    padding,
    textX,
    textY,
    textWidth,
    textBottom,
    maxLines,
    fontSize,
    lineHeight,
    plateHeight
  };
}

class DialogueEngine {
  #isActive;
  #textResolver;
  #layout;
  #sequences;
  #currentSequence;
  #currentLineIndex;
  #charTimer;
  #textBuffer;
  #onComplete;

  constructor(config, textResolver) {
    this.#textResolver = textResolver ?? null;
    this.#layout = config?.layout ?? null;
    this.#sequences = new Map();
    this.#isActive = false;
    this.#currentSequence = null;
    this.#currentLineIndex = 0;
    this.#charTimer = 0;
    this.#textBuffer = '';
    this.#onComplete = null;

    if (config && config.sequences) {
      for (const [name, sequence] of Object.entries(config.sequences)) {
        this.#sequences.set(name, sequence);
      }
    }
  }

  get isActive() { return this.#isActive; }

  async playSequence(sequenceId) {
    const sequence = this.#sequences.get(sequenceId);
    if (!sequence) {
      return;
    }

    this.#isActive = true;
    this.#currentSequence = sequence;
    this.#currentLineIndex = 0;
    this.#charTimer = 0;
    this.#textBuffer = '';
  }

  stop() {
    this.#isActive = false;
    this.#currentSequence = null;
    this.#currentLineIndex = 0;
    this.#textBuffer = '';

    if (this.#onComplete) {
      this.#onComplete();
      this.#onComplete = null;
    }
  }

  update(dt, inputManager) {
    if (!this.#isActive || !this.#currentSequence) {
      return;
    }

    if (this.#currentLineIndex >= this.#currentSequence.length) {
      this.stop();
      return;
    }

    const line = this.#currentSequence[this.#currentLineIndex];
    const fullText = this.#resolveLineText(line);

    if (this.#textBuffer.length < fullText.length) {
      this.#charTimer += dt;
      const charsPerSecond = this.#layout?.typewriter?.['characters-per-second'] ?? 30;
      const charsToAdd = Math.floor(this.#charTimer * charsPerSecond);

      if (charsToAdd > 0) {
        this.#textBuffer = fullText.substring(0, this.#textBuffer.length + charsToAdd);
        this.#charTimer = 0;
      }
    }

    if (inputManager && inputManager.isPressed('confirm')) {
      if (this.#textBuffer.length < fullText.length) {
        this.#textBuffer = fullText;
      } else {
        this.#currentLineIndex++;
        this.#textBuffer = '';
        this.#charTimer = 0;
      }
    }
  }

  render(renderer) {
    if (!this.#isActive || !this.#currentSequence) {
      return;
    }

    if (this.#currentLineIndex >= this.#currentSequence.length) {
      return;
    }

    const layout = this.#layout;
    if (!layout || layout.enabled === false) {
      return;
    }

    const line = this.#currentSequence[this.#currentLineIndex];
    const speaker = typeof line === 'string' ? '' : (line.speaker ?? '');
    const fullText = this.#resolveLineText(line);
    const fontFamily = layout['font-family'] ?? 'monospace';
    const measured = computeDialogueLayout(renderer.viewportWidth, renderer.viewportHeight, layout);
    const fullLines = wrapText(fullText, measured.textWidth, measured.fontSize);
    const geometry = computeDialogueLayout(
      renderer.viewportWidth,
      renderer.viewportHeight,
      layout,
      fullLines.length
    );
    const lines = wrapText(this.#textBuffer, geometry.textWidth, geometry.fontSize);

    this.#renderBox(renderer, layout, geometry);
    this.#renderSpeaker(renderer, layout, geometry, speaker, fontFamily);
    this.#renderText(renderer, layout, geometry, lines, fontFamily);
    this.#renderHint(renderer, layout, geometry, fullText, fontFamily);
  }

  #resolveLineText(line) {
    const textKey = typeof line === 'string' ? line : line.text;
    if (typeof textKey !== 'string') {
      return '';
    }

    return this.#textResolver ? this.#textResolver.text(textKey) : textKey;
  }

  #renderBox(renderer, layout, geometry) {
    const box = layout.box ?? {};
    renderer.drawRect(
      geometry.x,
      geometry.y,
      geometry.width,
      geometry.height,
      box['corner-radius'] ?? 0,
      box['fill-color'] ?? null,
      box['border-color'] ?? null,
      box['border-width'] ?? 0
    );
  }

  #renderSpeaker(renderer, layout, geometry, speaker, fontFamily) {
    if (!speaker) {
      return;
    }

    const speakerConfig = layout.speaker ?? {};
    const plate = speakerConfig.plate ?? {};
    const platePadding = plate.padding ?? { x: 0, y: 0 };
    const fontSize = speakerConfig['font-size'] ?? 0;
    const measured = measureTextWidth(speaker, fontSize);
    const plateX = geometry.textX;
    const plateY = geometry.y + geometry.padding.y;
    const plateWidth = Math.min(measured + platePadding.x * 2, geometry.textWidth);
    const plateHeight = geometry.plateHeight;

    renderer.drawRect(
      plateX,
      plateY,
      plateWidth,
      plateHeight,
      plate['corner-radius'] ?? 0,
      plate['fill-color'] ?? null,
      plate['border-color'] ?? null,
      plate['border-width'] ?? 0
    );

    renderer.drawText(
      speaker,
      plateX + platePadding.x,
      plateY + platePadding.y + fontSize,
      `${fontSize}px ${fontFamily}`,
      speakerConfig.color ?? null,
      'left'
    );
  }

  #renderText(renderer, layout, geometry, lines, fontFamily) {
    const textConfig = layout.text ?? {};

    for (let i = 0; i < lines.length; i++) {
      renderer.drawText(
        lines[i],
        geometry.textX,
        geometry.textY + geometry.fontSize + i * geometry.lineHeight,
        `${geometry.fontSize}px ${fontFamily}`,
        textConfig.color ?? null,
        'left'
      );
    }
  }

  #renderHint(renderer, layout, geometry, fullText, fontFamily) {
    const hint = layout.hint;
    if (!hint || !hint['label-key']) {
      return;
    }

    if (this.#textBuffer.length < fullText.length) {
      return;
    }

    const offset = hint.offset ?? { x: 0, y: 0 };
    renderer.drawText(
      this.#textResolver ? this.#textResolver.text(hint['label-key']) : hint['label-key'],
      geometry.x + geometry.width + offset.x,
      geometry.y + geometry.height + offset.y,
      `${hint['font-size'] ?? 0}px ${fontFamily}`,
      hint.color ?? null,
      'right'
    );
  }
}

export { DialogueEngine, wrapText, measureTextWidth, computeDialogueLayout };
