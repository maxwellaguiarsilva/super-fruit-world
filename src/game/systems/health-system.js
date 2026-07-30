class HealthSystem {
  #life;
  #maxLife;
  #lives;
  #continues;
  #invincibilityTimer;
  #iframeTimer;
  #iframeDuration;

  constructor(config) {
    const merged = { ...HealthSystem.defaultConfig, ...config };
    this.#maxLife = merged['max-life'] ?? 10;
    this.#life = this.#maxLife;
    this.#lives = merged['starting-lives'] ?? 5;
    this.#continues = merged['starting-continues'] ?? 1;
    this.#invincibilityTimer = 0;
    this.#iframeDuration = merged['iframe-timer'] ?? 1.0;
    this.#iframeTimer = 0;
  }

  static defaultConfig = {
    'max-life': 10,
    'starting-lives': 5,
    'starting-continues': 1,
    'iframe-timer': 1.0
  };

  get life() { return this.#life; }
  set life(v) { this.#life = Math.max(0, Math.min(v, this.#maxLife)); }
  get maxLife() { return this.#maxLife; }
  get lives() { return this.#lives; }
  set lives(v) { this.#lives = Math.max(0, v); }
  get continues() { return this.#continues; }
  set continues(v) { this.#continues = Math.max(0, v); }

  get isDead() { return this.#life <= 0; }
  get isGameOver() { return this.#lives <= 0 && this.#continues <= 0; }

  get invincibilityTimer() { return this.#invincibilityTimer; }

  takeDamage(amount) {
    if (this.#invincibilityTimer > 0 || this.#iframeTimer > 0) {
      return;
    }

    this.#life -= amount;

    if (this.#life <= 0) {
      this.#life = 0;
    }

    this.#iframeTimer = this.#iframeDuration;
  }

  heal(amount) {
    this.#life = Math.min(this.#life + amount, this.#maxLife);
  }

  addLife() {
    this.#lives++;
  }

  addContinue() {
    this.#continues++;
  }

  useContinue() {
    if (this.#continues <= 0) {
      return false;
    }
    this.#continues--;
    this.#lives = HealthSystem.defaultConfig['starting-lives'];
    this.#life = this.#maxLife;
    return true;
  }

  respawn() {
    this.#lives--;
    this.#life = this.#maxLife;
  }

  set invincibilityTimer(seconds) {
    this.#invincibilityTimer = seconds;
  }

  update(dt) {
    if (this.#iframeTimer > 0) {
      this.#iframeTimer = Math.max(0, this.#iframeTimer - dt);
    }

    if (this.#invincibilityTimer > 0) {
      this.#invincibilityTimer = Math.max(0, this.#invincibilityTimer - dt);
    }
  }
}

export { HealthSystem };
