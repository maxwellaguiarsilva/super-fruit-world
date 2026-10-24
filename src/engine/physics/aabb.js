function entityBox(entity) {
  if (!entity) {
    return null;
  }

  const hitbox = entity.hitbox ?? { x: 0, y: 0, width: entity.width, height: entity.height };
  return {
    x: entity.x + hitbox.x,
    y: entity.y + hitbox.y,
    width: hitbox.width,
    height: hitbox.height
  };
}

function boxesOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export { entityBox, boxesOverlap };
