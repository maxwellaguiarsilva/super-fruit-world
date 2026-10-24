class HealthSystem {
  #life;
  #maxLife;
  #lives;
  #continues;
  #startingLives;
  #invincibilityTimer;
  #fireShieldTimer;
  #iframeTimer;
  #iframeDuration;

  constructor(config) {
    const merged = { ...HealthSystem.defaultConfig, ...config };
    this.#maxLife = merged['max-life'] ?? 10;
    this.#life = this.#maxLife;
    this.#startingLives = merged['starting-lives'] ?? 5;
    this.#lives = this.#startingLives;
    this.#continues = merged['starting-continues'] ?? 1;
    this.#invincibilityTimer = 0;
    this.#fireShieldTimer = 0;
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
  get isLivesExhausted() { return this.#lives <= 0; }
  get canContinue() { return this.#continues > 0; }
  get isGameOver() { return this.isLivesExhausted && !this.canContinue; }

  get invincibilityTimer() { return this.#invincibilityTimer; }
  get fireShieldTimer() { return this.#fireShieldTimer; }
  get isFireShieldActive() { return this.#fireShieldTimer > 0; }

  takeDamage(amount) {
    if (this.#invincibilityTimer > 0 || this.#fireShieldTimer > 0 || this.#iframeTimer > 0) {
      return false;
    }

    this.#life -= amount;

    if (this.#life <= 0) {
      this.#life = 0;
    }

    this.#iframeTimer = this.#iframeDuration;
    return true;
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
    if (!this.canContinue) {
      return false;
    }
    this.#continues--;
    this.#lives = this.#startingLives;
    this.#life = this.#maxLife;
    return true;
  }

  respawn() {
    if (this.#lives > 0) {
      this.#lives--;
    }
    this.#life = this.#maxLife;
    return !this.isLivesExhausted;
  }

  set invincibilityTimer(seconds) {
    this.#invincibilityTimer = seconds;
  }

  applyFireShield(seconds) {
    const duration = Number(seconds);
    if (!Number.isFinite(duration) || duration <= 0) {
      return false;
    }
    this.#fireShieldTimer = Math.max(this.#fireShieldTimer, duration);
    return true;
  }

  update(dt) {
    if (this.#iframeTimer > 0) {
      this.#iframeTimer = Math.max(0, this.#iframeTimer - dt);
    }

    if (this.#invincibilityTimer > 0) {
      this.#invincibilityTimer = Math.max(0, this.#invincibilityTimer - dt);
    }

    if (this.#fireShieldTimer > 0) {
      this.#fireShieldTimer = Math.max(0, this.#fireShieldTimer - dt);
    }
  }
}

export { HealthSystem };
