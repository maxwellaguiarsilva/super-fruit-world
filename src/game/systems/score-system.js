class ScoreSystem {
  #score;
  #coins;
  #extraLivesEarned;

  constructor() {
    this.#score = 0;
    this.#coins = 0;
    this.#extraLivesEarned = 0;
  }

  get score() { return this.#score; }
  get coins() { return this.#coins; }

  addScore(amount) {
    this.#score += amount;
  }

  addCoins(amount) {
    this.#coins += amount;
    const coinsPerLife = 100;
    let earned = false;

    while (this.#coins >= coinsPerLife) {
      this.#coins -= coinsPerLife;
      this.#extraLivesEarned++;
      earned = true;
    }

    return earned;
  }

  get extraLivesEarned() { return this.#extraLivesEarned; }

  reset() {
    this.#score = 0;
    this.#coins = 0;
    this.#extraLivesEarned = 0;
  }
}

export { ScoreSystem };
