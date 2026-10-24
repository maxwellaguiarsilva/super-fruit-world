import { requireDependencies } from '../../engine/core/dependency-contract.js';

const ITEM_EFFECTS_DEPENDENCIES = ['healthSystem', 'getPlayer'];

const DEFAULT_MOON_GRAVITY_MULTIPLIER = 0.4;

const EARTHQUAKE_TARGETS = Object.freeze({
  'ground-enemies': (enemy) => enemy.isFlyer !== true,
  'enemies': () => true
});

class ItemEffects {
  #healthSystem;
  #getPlayer;
  #actions;

  constructor(dependencies) {
    const { healthSystem, getPlayer } = requireDependencies(
      'ItemEffects',
      dependencies,
      ITEM_EFFECTS_DEPENDENCIES
    );

    if (typeof getPlayer !== 'function') {
      throw new Error('ItemEffects requires "getPlayer" to be a function.');
    }

    this.#healthSystem = healthSystem;
    this.#getPlayer = getPlayer;
    this.#actions = new Map([
      ['restore-health', (usage) => this.#restoreHealth(usage)],
      ['moon-gravity', (usage) => this.#moonGravity(usage)],
      ['fire-shield', (usage) => this.#fireShield(usage)],
      ['earthquake', (usage) => this.#earthquake(usage)]
    ]);
  }

  get isMoonGravityActive() {
    return this.#getPlayer()?.isMoonGravityActive ?? false;
  }

  get moonGravityRemaining() {
    return this.#getPlayer()?.moonGravityTimer ?? 0;
  }

  get gravityMultiplier() {
    return this.#getPlayer()?.gravityMultiplier ?? 1;
  }

  get isFireShieldActive() {
    return this.#healthSystem.isFireShieldActive ?? false;
  }

  get fireShieldRemaining() {
    return this.#healthSystem.fireShieldTimer ?? 0;
  }

  apply(usage) {
    if (!usage || typeof usage.action !== 'string') {
      return false;
    }

    const applyAction = this.#actions.get(usage.action);
    if (!applyAction) {
      console.warn(`[item-effects] Unknown usage action "${usage.action}".`);
      return false;
    }

    applyAction(usage);
    return true;
  }

  #restoreHealth(usage) {
    const configured = usage.value === 'full' ? this.#healthSystem.maxLife : Number(usage.value);
    if (!Number.isFinite(configured) || configured <= 0) {
      return;
    }

    this.#healthSystem.heal(configured);
  }

  #moonGravity(usage) {
    const duration = Number(usage.duration);
    const multiplier = Number(usage.multiplier ?? DEFAULT_MOON_GRAVITY_MULTIPLIER);
    if (!Number.isFinite(duration) || duration <= 0) {
      return;
    }

    this.#player().applyMoonGravity(duration, multiplier);
  }

  #fireShield(usage) {
    const duration = Number(usage.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
      return;
    }

    this.#healthSystem.applyFireShield(duration);
  }

  #earthquake(usage) {
    const damage = Number(usage.damage);
    const matchesTarget = EARTHQUAKE_TARGETS[usage.target];
    if (!Number.isFinite(damage) || damage <= 0 || !matchesTarget) {
      return;
    }

    const stage = this.#player().stage;
    for (const enemy of stage?.enemiesList ?? []) {
      if (!enemy?.isAlive || !matchesTarget(enemy)) {
        continue;
      }
      enemy.takeDamage(damage);
    }
  }

  #player() {
    const player = this.#getPlayer();
    if (!player) {
      throw new Error('ItemEffects cannot apply a usage action before the player exists.');
    }
    return player;
  }
}

export { ItemEffects };
