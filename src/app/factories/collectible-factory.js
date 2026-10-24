import { Collectible } from '../../game/entities/collectible.js';

export function createCollectibleFactory() {
  return function (config) {
    const w = config.size?.width ?? 0.5;
    const h = config.size?.height ?? 0.5;
    return new Collectible(0, 0, w, h, config);
  };
}
