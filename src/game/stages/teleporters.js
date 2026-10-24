import { requireDependencies } from '../../engine/core/dependency-contract.js';
import { keyItemName } from '../utils/key-item-name.js';

const ACTIVATION_CONTEXT_KEYS = [
  'player',
  'overlaps',
  'markerFor',
  'navigate',
  'inventory',
  'report'
];

function requireActivationContext(owner, context) {
  return requireDependencies(owner, context, ACTIVATION_CONTEXT_KEYS);
}

function movePlayerToMarker(context, marker) {
  context.player.x = marker.x;
  context.player.y = marker.y;
}

class TeleporterMarker {
  #name;
  #x;
  #y;
  _missingTargetReported = false;

  constructor(name, x, y) {
    this.#name = name;
    this.#x = x;
    this.#y = y;
  }

  get name() { return this.#name; }
  get type() { return 'teleporter-marker'; }
  get x() { return this.#x; }
  get y() { return this.#y; }
  get position() { return { x: this.#x, y: this.#y }; }
  get hitbox() { return { x: 0, y: 0, width: 1, height: 1 }; }

  get isActive() { return false; }
  get isLocked() { return true; }

  canActivate() {
    return false;
  }

  activate() {
    return false;
  }

  _requireContext(owner, context) {
    return requireActivationContext(owner, context);
  }

  _markerFor(context, markerName) {
    const marker = context.markerFor(markerName);
    if (marker) {
      return marker;
    }

    if (!this._missingTargetReported) {
      this._missingTargetReported = true;
      context.report(
        `[teleporter] "${this.name}" targets marker "${markerName}", which does not exist in this stage.`
      );
    }

    return null;
  }

  _draw(renderer, fillColor) {
    renderer.drawRect(this.#x, this.#y, 1, 1, 0.1, fillColor, '#000000', 0.02);
  }

  render(renderer) {
    this._draw(renderer, '#40BFBF');
  }
}

class MarkerTeleporter extends TeleporterMarker {
  #targetMarker;

  constructor(name, x, y, targetMarker) {
    super(name, x, y);
    this.#targetMarker = targetMarker;
  }

  get targetMarker() { return this.#targetMarker; }
  get isActive() { return Boolean(this.#targetMarker); }
  get isLocked() { return !this.isActive; }

  canActivate(context) {
    const activation = this._requireContext(this.constructor.name, context);
    if (!this.isActive || !activation.overlaps(this)) {
      return false;
    }

    return this._markerFor(activation, this.#targetMarker) !== null;
  }

  activate(context) {
    if (!this.canActivate(context)) {
      return false;
    }

    const marker = this._markerFor(context, this.#targetMarker);
    if (!marker) {
      return false;
    }

    movePlayerToMarker(context, marker);
    return true;
  }
}

class InnerTeleporter extends MarkerTeleporter {
  #isDeactivated;

  constructor(name, x, y, targetMarker) {
    super(name, x, y, targetMarker);
    this.#isDeactivated = false;
  }

  get type() { return 'inner-teleporter'; }
  get isActive() { return !this.#isDeactivated && super.isActive; }

  deactivate() {
    this.#isDeactivated = true;
  }

  render(renderer) {
    this._draw(renderer, this.isActive ? '#4040BF' : '#404040');
  }
}

class MapTeleporter extends MarkerTeleporter {
  get type() { return 'map-teleporter'; }

  render(renderer) {
    this._draw(renderer, this.isActive ? '#40BFBF' : '#404040');
  }
}

class SpecialTeleporter extends TeleporterMarker {
  #targetMarker;
  #targetScene;

  constructor(name, x, y, targetMarker, targetScene) {
    super(name, x, y);
    this.#targetMarker = targetMarker;
    this.#targetScene = targetScene;
  }

  get type() { return 'special-teleporter'; }
  get targetMarker() { return this.#targetMarker; }
  get targetScene() { return this.#targetScene; }
  get isActive() { return Boolean(this.#targetScene) || Boolean(this.#targetMarker); }
  get isLocked() { return !this.isActive; }

  canActivate(context) {
    const activation = this._requireContext(this.constructor.name, context);
    if (!this.isActive || !activation.overlaps(this)) {
      return false;
    }

    if (this.#targetScene) {
      return true;
    }

    return this._markerFor(activation, this.#targetMarker) !== null;
  }

  activate(context) {
    if (!this.canActivate(context)) {
      return false;
    }

    if (this.#targetScene) {
      return context.navigate(this.#targetScene) === true;
    }

    const marker = this._markerFor(context, this.#targetMarker);
    if (!marker) {
      return false;
    }

    movePlayerToMarker(context, marker);
    return true;
  }

  render(renderer) {
    this._draw(renderer, this.isActive ? '#40BF40' : '#404040');
  }
}

class KeyDoor extends SpecialTeleporter {
  #requiredKey;
  #inventory;
  #isUnlocked;

  constructor(name, x, y, targetMarker, targetScene, requiredKey, dependencies) {
    super(name, x, y, targetMarker, targetScene);

    const { inventory } = requireDependencies('KeyDoor', dependencies, ['inventory']);
    this.#requiredKey = requiredKey;
    this.#inventory = inventory;
    this.#isUnlocked = false;
  }

  get type() { return 'key-door'; }
  get requiredKey() { return this.#requiredKey; }
  get isUnlocked() { return this.#isUnlocked; }
  get hasKey() { return this.#hasKeyIn(this.#inventory); }
  get isActive() {
    return Boolean(this.#requiredKey) && super.isActive && (this.#isUnlocked || this.hasKey);
  }

  #hasKeyIn(inventory) {
    if (!this.#requiredKey || !inventory) {
      return false;
    }

    return inventory.has(keyItemName(this.#requiredKey));
  }

  canActivate(context) {
    const activation = this._requireContext(this.constructor.name, context);
    if (!this.#isUnlocked && !this.#hasKeyIn(activation.inventory)) {
      return false;
    }

    return super.canActivate(context);
  }

  activate(context) {
    if (!this.canActivate(context)) {
      return false;
    }

    if (!super.activate(context)) {
      return false;
    }

    this.#isUnlocked = true;
    return true;
  }
}

export { TeleporterMarker, InnerTeleporter, MapTeleporter, SpecialTeleporter, KeyDoor };
