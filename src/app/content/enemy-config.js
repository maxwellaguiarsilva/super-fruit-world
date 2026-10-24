import { resolveColor } from '../../game/utils/color-utils.js';

export function parseEnemyConfig(obj, enemyConfigData, colorsConfigData) {
  const typeName = obj.type ?? '';
  const parts = typeName.split('-');
  const shapeName = parts[0];
  const behavior = parts[1] ?? 'patrol';

  const shapeMap = enemyConfigData['shape-map'] ?? {};
  const shape = shapeMap[shapeName] ?? 3;

  const colorOrder = colorsConfigData['color-order'] ?? [];
  const colorIndex = colorOrder.indexOf(obj.color);
  const finalColorIndex = colorIndex !== -1 ? colorIndex : 1;

  const colorPalette = colorOrder.map((name) => resolveColor(name, colorsConfigData));

  const isBoss = obj['is-boss'] ?? false;
  const size = isBoss
    ? (enemyConfigData['boss-size'] ?? 3)
    : (enemyConfigData.size ?? 1);

  return {
    shape,
    size,
    behavior,
    'color-index': finalColorIndex,
    'color-palette': colorPalette,
    'is-boss': isBoss,
    'patrol-range': obj['patrol-range'] ?? 3,
    'damage-output': obj['damage-output'] ?? null,
    'drop-table': obj['drop-table'] ?? [],
    'fire-rate': obj['fire-rate'] ?? null,
    'projectile-speed': obj['projectile-speed'] ?? null,
    'detection-range': obj['detection-range'] ?? null,
    'hover-amplitude': obj['hover-amplitude'] ?? 0,
    'hover-frequency': obj['hover-frequency'] ?? 0
  };
}
