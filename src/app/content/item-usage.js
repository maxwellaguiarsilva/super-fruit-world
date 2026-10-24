import { DataDriven } from '../../engine/index.js';
import { collectibleTypeFromPath } from './collectible-type.js';

function collectItemUsage(dataDriven) {
  const usageByItem = {};

  for (const [path, collectible] of dataDriven.all) {
    const itemName = collectibleTypeFromPath(path);
    if (itemName === null) {
      continue;
    }

    const usage = collectible?.effect?.usage;
    if (!usage || typeof usage.action !== 'string') {
      continue;
    }

    usageByItem[itemName] = DataDriven.toPlain(usage);
  }

  return usageByItem;
}

export { collectItemUsage };
