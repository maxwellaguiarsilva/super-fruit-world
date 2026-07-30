class ProgressionSystem {
  #levelsConfig;
  #fruitsConfig;
  #colorOrder;

  constructor(levelsConfig, fruitsConfig, colorsConfig) {
    this.#levelsConfig = levelsConfig;
    this.#fruitsConfig = fruitsConfig;
    this.#colorOrder = colorsConfig?.['color-order'] ?? [];
  }

  getLevelForCollectible(collectibleType) {
    const fruitConfig = this.#fruitsConfig?.fruits?.[collectibleType];
    if (fruitConfig && fruitConfig.color) {
      return this.getLevelForColor(fruitConfig.color);
    }
    return -1;
  }

  getAbilitiesForLevel(level) {
    const color = this.getColorForLevel(level);
    if (color && this.#levelsConfig?.levels?.[color]) {
      return this.#levelsConfig.levels[color].abilities ?? [];
    }
    return [];
  }

  getColorForLevel(level) {
    if (level >= 0 && level < this.#colorOrder.length) {
      return this.#colorOrder[level];
    }
    return '';
  }

  getCollectibleForLevel(level) {
    const color = this.getColorForLevel(level);
    const fruits = this.#fruitsConfig?.fruits ?? {};
    for (const [fruitName, fruitData] of Object.entries(fruits)) {
      if (fruitData.color === color) {
        return fruitName;
      }
    }
    return null;
  }

  getLevelForColor(colorName) {
    const index = this.#colorOrder.indexOf(colorName);
    return index !== -1 ? index : 0;
  }

  get maxLevel() {
    return this.#colorOrder.length - 1;
  }

  hasLevelUp(collectibleName, currentLevel) {
    const levelForCollectible = this.getLevelForCollectible(collectibleName);
    return levelForCollectible > currentLevel;
  }

  applyLevelUp(player, collectibleName) {
    const newLevel = this.getLevelForCollectible(collectibleName);
    if (newLevel <= player.level) {
      return false;
    }

    player.level = newLevel;

    // The abilities are already instantiated and added to the player.
    // Their requiredLevel should be set correctly.
    // We can update them here just in case.
    for (let i = 0; i <= newLevel; i++) {
      const abilities = this.getAbilitiesForLevel(i);
      for (const abilityName of abilities) {
        const ability = player.ability(abilityName);
        if (ability) {
          ability.requiredLevel = i;
        }
      }
    }

    return true;
  }
}

export { ProgressionSystem };
