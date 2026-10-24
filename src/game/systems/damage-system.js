const DEFAULT_SHAPE_DAMAGE = {
  '3': 1.0,
  '4': 1.5,
  '5': 2.0,
  '6': 2.5,
  '7': 3.0
};

class DamageSystem {
  #damageConfig;
  #hazardDamage;
  #shieldDamageMultiplier;

  constructor(damageConfig) {
    this.#damageConfig = damageConfig ?? {};
    this.#hazardDamage = this.#damageConfig['hazard-damage'];
    this.#shieldDamageMultiplier = this.#damageConfig['shield-damage-multiplier'];
  }

  enemyDamageToPlayer(enemy) {
    if (typeof enemy?.damageOutput === 'number') {
      return enemy.damageOutput;
    }

    const shapeDamageMap = this.#damageConfig['enemy-shape-damage'] ?? DEFAULT_SHAPE_DAMAGE;
    const shape = String(enemy?.shape);
    return shapeDamageMap[shape] ?? DEFAULT_SHAPE_DAMAGE['3'];
  }

  hazardDamage(value) {
    return typeof value === 'number' ? value : this.#hazardDamage;
  }

  applyEnemyDamage(player, enemy) {
    const baseDamage = this.enemyDamageToPlayer(enemy);
    const shieldActive = player.ability?.('shoot')?.isShielding === true;
    const damage = shieldActive ? baseDamage * this.#shieldDamageMultiplier : baseDamage;
    return player.takeDamage(damage) === true;
  }

  applyHazardDamage(player, value) {
    return player.takeDamage(this.hazardDamage(value)) === true;
  }

  isFatalHit(damage, currentLife) {
    return currentLife - damage <= 0;
  }
}

export { DamageSystem };
