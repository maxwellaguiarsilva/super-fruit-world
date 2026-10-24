function formatTileBox(tile) {
  return `${tile.tileType}[x:${tile.x}, y:${tile.y}, width:${tile.width}, height:${tile.height}]`;
}

function validateTileOverlaps(tiles, collisionSolver) {
  for (let i = 0; i < tiles.length; i++) {
    const a = tiles[i];
    for (let j = i + 1; j < tiles.length; j++) {
      const b = tiles[j];
      if (!collisionSolver.checkAABB(a, b)) {
        continue;
      }
      const bothSolid = a.isSolid && b.isSolid;
      const solidVsClimbable = (a.isSolid && b.isClimbable) || (b.isSolid && a.isClimbable);
      if (!bothSolid && !solidVsClimbable) {
        continue;
      }
      const overlap = collisionSolver.getOverlap(a, b);
      const overlapText = overlap ? `${overlap.x} x ${overlap.y}` : 'indeterminate';
      const cause = bothSolid
        ? 'both tiles are solid and share the same space'
        : 'a solid tile is embedded in a climbable surface';
      throw new Error(
        `Tile overlap error: ${formatTileBox(a)} and ${formatTileBox(b)} overlap by ${overlapText} (${cause}).`
      );
    }
  }
}

export { validateTileOverlaps };
