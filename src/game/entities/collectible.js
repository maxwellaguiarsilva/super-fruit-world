import { Entity } from '../../engine/entities/entity.js';

class Collectible extends Entity {
  #type;
  #collectibleConfig;
  #isAutoUse;
  #collected;

  constructor(x, y, width, height, collectibleConfig) {
    super(x, y, width, height);
    this.#collectibleConfig = collectibleConfig;
    this.#type = collectibleConfig.type ?? 'coin';
    this.#isAutoUse = collectibleConfig['auto-use'] ?? true;
    this.#collected = false;
  }

  get type() { return this.#type; }
  get effect() { return this.#collectibleConfig.effect ?? {}; }
  get isAutoUse() { return this.#isAutoUse; }

  collect(player) {
    if (this.#collected) {
      return;
    }
    this.#collected = true;
    this.isAlive = false;

    const effect = this.#collectibleConfig.effect ?? {};
    const action = effect.action;

    let sfxName = 'collect';
    let sfxFreq = null;

    if (action === 'add-coins') {
      if (this.#type === 'coin') {
        sfxName = 'coin';
      }
      if (player.scoreSystem) {
        const earned = player.scoreSystem.addCoins(effect.value ?? 1);
        if (earned) {
          player.healthSystem.addLife();
        }
      }
      player.scoreSystem?.addScore?.(effect.score ?? 10);
    } else if (action === 'add-ammo') {
      player.inventory.add(this.#type, effect.value ?? 1);
    } else if (action === 'add-to-inventory') {
      if (this.#isAutoUse && effect.usage?.action === 'restore-health') {
        player.heal(effect.usage.value === 'full' ? player.healthSystem.maxLife : (effect.usage.value ?? 1));
      } else {
        const keyName = this.#collectibleConfig['key-name'] ?? effect['key-name'];
        const itemName = keyName ? `key:${keyName}` : this.#type;
        player.inventory.add(itemName, 1);
      }
    } else if (action === 'invincibility') {
      sfxName = 'star';
      player.healthSystem.invincibilityTimer = effect.duration ?? 30;
    } else if (action === 'extra-life') {
      player.healthSystem.addLife();
    } else if (action === 'add-score') {
      player.scoreSystem?.addScore?.(effect.value ?? 50);
    } else if (action === 'level-up') {
      if (player.progressionSystem) {
        const collectibleName = this.#collectibleConfig.collectible ?? this.#type;
        if (player.progressionSystem.hasLevelUp(collectibleName, player.level)) {
          sfxName = 'level-up';
          player.progressionSystem.applyLevelUp(player, collectibleName);
        } else {
          player.healthSystem.addLife();
        }
      }
    } else if (action === 'collect-note') {
      const noteOrder = this.#collectibleConfig['note-order'] ?? 1;
      if (player.noteCollection) {
        const noteName = player.noteCollection.noteForOrder(noteOrder);
        if (noteName) {
          sfxName = 'musical-note';
          sfxFreq = noteName;
        }
        player.noteCollection.collect(noteOrder);
        if (player.noteCollection.isAllCollected) {
          player.healthSystem.addContinue();
        }
      }
    } else if (action === 'set-respawn') {
      sfxName = null;
      const index = this.#collectibleConfig.index ?? 0;
      if (player.stage) {
        player.stage.activateCheckpoint(index);
      }
    } else if (action === 'teleport-if-key') {
      const requiredKey = this.#collectibleConfig['required-key'] ?? 'default';
      if (player.inventory.has(`key:${requiredKey}`)) {
        player.inventory.remove(`key:${requiredKey}`, 1);
      }
    } else if (action === 'complete-stage') {
      sfxName = null;
      if (player.stage) {
        player.stage.completeStage();
      }
    }

    if (sfxName) {
      player.audioEngine?.playSFX(sfxName, sfxFreq);
    }
  }

  render(renderer) {
    const config = this.#collectibleConfig;
    const fillColor = config['fill-color'] ?? '#FFFF00';
    const radius = this.width / 2;
    const cx = this.x + radius;
    const cy = this.y + radius;

    renderer.drawCircle(cx, cy, radius * 0.8, fillColor, '#000000', 0.02);
  }
}

export { Collectible };
