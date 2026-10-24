import { resolveColor } from '../../game/utils/color-utils.js';

export function resolveTileType(obj, tileDataMap, colorsConfig, bordersConfig) {
  const type = obj.type ?? '';
  const tileData = tileDataMap[type] ?? {};
  const visual = obj.visual ?? {};
  const tileVisual = tileData.visual ?? {};

  const fillName = visual['fill-color'] ?? tileVisual['fill-color'] ?? null;
  const borderName = visual['border-color'] ?? tileVisual['border-color'] ?? null;
  const borderStyle = visual.border ?? tileVisual.border ?? null;
  const borderWidth = borderStyle && bordersConfig?.borders?.[borderStyle]
    ? bordersConfig.borders[borderStyle].width
    : (visual['border-width'] ?? 0);

  const collision = tileData.collision ?? {};
  const physics = tileData.physics ?? {};
  const damageData = tileData.damage ?? {};
  const tileVariant = obj.variant ?? null;
  const variantData = tileVariant ? (tileData.variants?.[tileVariant] ?? {}) : {};
  const slopeTypes = physics['slope-types'] ?? {};
  const slopeAngle = tileVariant ? (slopeTypes[tileVariant] ?? null) : null;

  return {
    type,
    solid: obj.solid ?? (tileData.type ? collision.solid !== false : (type !== 'decorative' && type !== 'pit' && type !== 'teleporter-marker')),
    deadly: obj.deadly ?? (damageData['on-contact'] === true || tileData.effect?.action === 'death'),
    'damage-value': obj['damage-value'] ?? variantData.damage ?? damageData.value ?? null,
    liquid: obj.liquid ?? (physics['gravity-multiplier'] !== undefined && physics['gravity-multiplier'] < 1 && physics['gravity-multiplier'] !== 0),
    climbable: obj.climbable ?? (collision.climbable === true),
    variant: tileVariant,
    inverted: obj.inverted ?? tileData.inverted ?? false,
    'slope-angle': slopeAngle,
    rendered: visual.rendered ?? tileVisual.rendered ?? true,
    'fill-color': resolveColor(fillName, colorsConfig) ?? '#404040',
    'border-color': resolveColor(borderName, colorsConfig) ?? resolveColor(tileVisual['border-color'], colorsConfig) ?? null,
    'border-width': borderWidth,
    'corner-radius': visual['corner-radius'] ?? tileVisual['corner-radius'] ?? 0.1,
    friction: obj.friction ?? physics.friction ?? null
  };
}
