import { Ability } from './ability.js';

class ShootAbility extends Ability {
  #projectileSpeed;
  #fireRate;
  #shieldDamageReduction;
  #isShielding;
  #fireTimer;

  #ammoType;

  constructor(config) {
    super(config);
    this.#projectileSpeed = config['projectile-speed'] ?? 1.0;
    this.#fireRate = config['fire-rate'] ?? 2.0;
    this.#shieldDamageReduction = config['shield-damage-reduction'] ?? 0.9;
    this.#isShielding = false;
    this.#fireTimer = 0;
    this.#ammoType = config['ammo-type'] ?? 'ammo';
  }

  get projectileSpeed() { return this.#projectileSpeed; }
  get fireRate() { return this.#fireRate; }
  get shieldDamageReduction() { return this.#shieldDamageReduction; }
  get isShielding() { return this.#isShielding; }
  get ammoType() { return this.#ammoType; }

  activate(player, inputManager) {
  }

  deactivate(player) {
    this.#isShielding = false;
  }

  update(player, dt, inputManager) {
    super.update(player, dt, inputManager);

    if (player.level < this.requiredLevel) {
      this.#isShielding = false;
      return;
    }

    this.#fireTimer = Math.max(0, this.#fireTimer - dt);

    if (!inputManager) {
      return;
    }

    const shootDown = inputManager.isDown('shoot');
    this.#isShielding = shootDown;

    if (shootDown && this.#fireTimer <= 0 && player.inventory.count(this.#ammoType) > 0) {
      player.inventory.remove(this.#ammoType, 1);
      this.#fireTimer = 1.0 / this.#fireRate;
      player.audioEngine?.playSFX('attack');

      const speed = this.#projectileSpeed + (player.level * 0.3);
      const dir = player.direction ?? 1;

      if (player.stage) {
        const cx = player.x + player.width / 2;
        const cy = player.y + player.height / 2;
        const Projectile = player.stage.constructor.projectileClass;
        if (Projectile) {
          const proj = new Projectile(cx, cy, speed * dir, 0, 1, player, player.stage.projectileConfig);
          player.stage.addEntity(proj);
        }
      }
    }
  }
}

export { ShootAbility };
