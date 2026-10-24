class DamageSystem {
  #damageConfig;

  constructor(damageConfig) {
    this.#damageConfig = damageConfig ?? {};
  }

  enemyDamageToPlayer(enemy) {
    const shapeDamageMap = this.#damageConfig['enemy-shape-damage'] ?? {
      '3': 1.0,
      '4': 1.5,
      '5': 2.0,
      '6': 2.5,
      '7': 3.0
    };

    const shape = String(enemy.shape);
    return shapeDamageMap[shape] ?? 1.0;
  }

  playerDamageToEnemy(attackType) {
    const damageMap = {
      'jump': 1,
      'slide': 2,
      'shoot': 1,
      'air-slide': 1,
      'screen-clear': 4
    };

    return damageMap[attackType] ?? 1;
  }

  isFatalHit(damage, currentLife) {
    return currentLife - damage <= 0;
  }
}

export { DamageSystem };
