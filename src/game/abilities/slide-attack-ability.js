import { Ability } from './ability.js';

class SlideAttackAbility extends Ability {
  #damage;
  #isAttacking;
  #hasDamaged;

  constructor(config) {
    super(config);
    this.#damage = config.damage ?? 2;
    this.#isAttacking = false;
    this.#hasDamaged = false;
  }

  get damage() { return this.#damage; }
  get isAttacking() { return this.#isAttacking; }

  update(player, dt, inputManager) {
    super.update(player, dt, inputManager);

    if (player.level < this.requiredLevel) {
      this.#isAttacking = false;
      this.#hasDamaged = false;
      return;
    }

    const dash = player.ability ? player.ability('dash') : null;
    this.#isAttacking = player.onGround && dash?.isActive === true;

    if (!this.#isAttacking) {
      this.#hasDamaged = false;
      return;
    }

    if (this.#hasDamaged) {
      return;
    }

    // The stage owns the overlap test and the enemy owns the damage entry
    // point, so the slide attack does not duplicate either one.
    const enemies = player.stage?.overlappingEnemies?.(player) ?? [];
    const target = enemies.find((enemy) => enemy.isAlive !== false);
    if (!target) {
      return;
    }

    this.#hasDamaged = true;
    target.takeDamage(this.#damage);
    player.audioEngine?.playSFX('attack');
  }
}

export { SlideAttackAbility };
