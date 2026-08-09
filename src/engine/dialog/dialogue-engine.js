class DialogueEngine {
  #isActive;
  #dataDriven;
  #sequences;
  #currentSequence;
  #currentLineIndex;
  #charTimer;
  #textBuffer;
  #onComplete;

  constructor(config, dataDriven) {
    this.#dataDriven = dataDriven;
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
    const text = typeof line === 'string' ? line : line.text;
    const fullText = this.#dataDriven ? this.#dataDriven['i18n.default.' + text] : text;

    if (this.#textBuffer.length < fullText.length) {
      this.#charTimer += dt;
      const charsPerSecond = 30;
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

    const line = this.#currentSequence[this.#currentLineIndex];
    const speaker = typeof line === 'string' ? '' : line.speaker;
    const text = typeof line === 'string' ? line : line.text;
    const fullText = this.#dataDriven ? this.#dataDriven['i18n.default.' + text] : text;

    const boxX = 2;
    const boxY = renderer.viewportHeight - 8;
    const boxW = renderer.viewportWidth - 4;
    const boxH = 6;

    renderer.drawRect(boxX, boxY, boxW, boxH, 0.3, '#000000', '#FFFFFF', 0.1);

    if (speaker) {
      renderer.drawText(speaker, boxX + 0.5, boxY + 0.8, '0.5px \'Comic Sans MS\', \'Comic Sans\', monospace', '#FFFFFF', 'left');
    }

    renderer.drawText(this.#textBuffer, boxX + 0.5, boxY + 1.8, '0.5px \'Comic Sans MS\', \'Comic Sans\', monospace', '#FFFFFF', 'left');

    if (this.#textBuffer.length >= fullText.length) {
      renderer.drawText('▼', boxX + boxW - 1, boxY + boxH - 0.5, '0.5px \'Comic Sans MS\', \'Comic Sans\', monospace', '#FFFFFF', 'right');
    }
  }
}

export { DialogueEngine };
