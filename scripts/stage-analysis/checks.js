import {
  boxAt,
  boxIntersectsSolidTile,
  boxIsEntirelyBelow,
  boxIsEntirelyHorizontallyOutside,
  boxesOverlap,
  spawnPlayerBox,
  unionBoxes
} from './model.js';

const GRID_STEP = 0.25;
const GRID_MARGIN = 2;
const MAX_GRID_CELLS = 2_000_000;
const EPSILON = 1e-9;
const CREATION_CELL_SIZE = 1;
const DEFAULT_PLAYER_SIZE = 1;

function compare(a, b) {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

function formatNumber(value) {
  const rounded = Number(value.toFixed(4));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function formatPoint(x, y) {
  return `(${formatNumber(x)}, ${formatNumber(y)})`;
}

function formatBox(box) {
  return `(${formatNumber(box.x)}, ${formatNumber(box.y)}, ${formatNumber(box.width)}, ${formatNumber(box.height)})`;
}

function describeObject(object) {
  return `${object.kind}:${object.type}@${formatNumber(object.x)},${formatNumber(object.y)}`;
}

function errorFinding(layout, code, message, details = {}) {
  return { stage: layout.id, severity: 'error', code, message, ...details };
}

function warningFinding(layout, code, message, details = {}) {
  return { stage: layout.id, severity: 'warning', code, message, ...details };
}

function firstOverlappingTile(tiles, box, predicate, intersects = boxesOverlap) {
  for (const tile of tiles) {
    if (predicate(tile) && intersects(box, tile)) {
      return tile;
    }
  }

  return null;
}

function tileDetails(tile) {
  return {
    tile: tile.type,
    tileBox: boxAt(tile.x, tile.y, tile.width, tile.height)
  };
}

function findBlockingTile(tiles, box, includeDeadly = true) {
  const solidTile = firstOverlappingTile(tiles, box, (tile) => tile.solid, boxIntersectsSolidTile);
  if (solidTile !== null) {
    return { tile: solidTile, kind: 'solid' };
  }

  if (!includeDeadly) {
    return null;
  }

  const deadlyTile = firstOverlappingTile(tiles, box, (tile) => tile.deadly);
  return deadlyTile !== null ? { tile: deadlyTile, kind: 'deadly' } : null;
}

function activeSpawn(layout) {
  const spawns = layout.spawns ?? [];
  return spawns.length > 0 ? spawns[spawns.length - 1] : null;
}

function layoutPlayerSize(layout) {
  const size = layout.playerSize;
  return Number.isFinite(size) && size > 0 ? size : DEFAULT_PLAYER_SIZE;
}

function sortFindings(findings) {
  return findings.sort((a, b) => {
    const byCode = compare(a.code, b.code);
    if (byCode !== 0) {
      return byCode;
    }

    const aPosition = a.evidence?.position ?? { x: 0, y: 0 };
    const bPosition = b.evidence?.position ?? { x: 0, y: 0 };
    const byX = compare(aPosition.x, bPosition.x);
    if (byX !== 0) {
      return byX;
    }

    const byY = compare(aPosition.y, bPosition.y);
    if (byY !== 0) {
      return byY;
    }

    return compare(a.message, b.message);
  });
}

function checkSpawn(layout, findings) {
  const spawn = activeSpawn(layout);

  if (spawn === null) {
    findings.push(errorFinding(layout, 'spawn-missing', 'stage has no player-spawn object'));
    return { spawn: null, invalid: true };
  }

  const playerBox = spawnPlayerBox(spawn, layout.playerSize);
  const solidTile = firstOverlappingTile(layout.tiles ?? [], playerBox, (tile) => tile.solid, boxIntersectsSolidTile);
  const deadlyTile = firstOverlappingTile(layout.tiles ?? [], playerBox, (tile) => tile.deadly);

  if (solidTile !== null) {
    findings.push(errorFinding(
      layout,
      'spawn-in-solid',
      `player spawn at ${formatPoint(spawn.x, spawn.y)} places the player box ${formatBox(playerBox)} inside solid tile "${solidTile.type}" box ${formatBox(solidTile)}`,
      { section: spawn.section, object: describeObject(spawn), evidence: { position: { x: spawn.x, y: spawn.y }, box: playerBox, ...tileDetails(solidTile) } }
    ));
  }

  if (deadlyTile !== null) {
    findings.push(errorFinding(
      layout,
      'spawn-in-deadly',
      `player spawn at ${formatPoint(spawn.x, spawn.y)} places the player box ${formatBox(playerBox)} inside deadly tile "${deadlyTile.type}" box ${formatBox(deadlyTile)}`,
      { section: spawn.section, object: describeObject(spawn), evidence: { position: { x: spawn.x, y: spawn.y }, box: playerBox, ...tileDetails(deadlyTile) } }
    ));
  }

  return { spawn, invalid: solidTile !== null || deadlyTile !== null };
}

function collectibleFindings(layout, findings) {
  const tiles = layout.tiles ?? [];
  const collectibles = layout.collectibles ?? [];

  for (const collectible of collectibles) {
    const pickupBox = boxAt(collectible.x, collectible.y, collectible.width, collectible.height);
    const solidTile = firstOverlappingTile(tiles, pickupBox, (tile) => tile.solid, boxIntersectsSolidTile);

    if (solidTile !== null) {
      const overlapDescription = solidTile.slope
        ? `overlaps the solid wedge of slope "${solidTile.variant ?? solidTile.type}" box ${formatBox(solidTile)}`
        : `overlaps solid tile "${solidTile.type}" box ${formatBox(solidTile)}`;

      findings.push(errorFinding(
        layout,
        'collectible-embedded-in-solid',
        `collectible "${collectible.type}" at ${formatPoint(collectible.x, collectible.y)} ${overlapDescription}`,
        { section: collectible.section, object: describeObject(collectible), evidence: { position: { x: collectible.x, y: collectible.y }, box: pickupBox, ...tileDetails(solidTile) } }
      ));
    }

    const deadlyTile = firstOverlappingTile(tiles, pickupBox, (tile) => tile.deadly);

    if (deadlyTile !== null) {
      findings.push(errorFinding(
        layout,
        'collectible-in-deadly-tile',
        `collectible "${collectible.type}" at ${formatPoint(collectible.x, collectible.y)} overlaps deadly tile "${deadlyTile.type}" box ${formatBox(deadlyTile)}`,
        { section: collectible.section, object: describeObject(collectible), evidence: { position: { x: collectible.x, y: collectible.y }, box: pickupBox, ...tileDetails(deadlyTile) } }
      ));
    }

    if (tiles.length === 0) {
      continue;
    }

    if (boxIsEntirelyBelow(pickupBox, layout.tileBounds)) {
      const bottom = layout.tileBounds.y + layout.tileBounds.height;
      findings.push(errorFinding(
        layout,
        'collectible-below-geometry',
        `collectible "${collectible.type}" at ${formatPoint(collectible.x, collectible.y)} sits below all tile geometry (bottom edge ${formatNumber(bottom)})`,
        { section: collectible.section, object: describeObject(collectible), evidence: { position: { x: collectible.x, y: collectible.y }, box: pickupBox, tileBounds: layout.tileBounds } }
      ));
    }

    if (boxIsEntirelyHorizontallyOutside(pickupBox, layout.tileBounds)) {
      const left = layout.tileBounds.x;
      const right = layout.tileBounds.x + layout.tileBounds.width;
      findings.push(errorFinding(
        layout,
        'collectible-outside-geometry',
        `collectible "${collectible.type}" at ${formatPoint(collectible.x, collectible.y)} sits outside tile geometry horizontally (left edge ${formatNumber(left)}, right edge ${formatNumber(right)})`,
        { section: collectible.section, object: describeObject(collectible), evidence: { position: { x: collectible.x, y: collectible.y }, box: pickupBox, tileBounds: layout.tileBounds } }
      ));
    }
  }
}

function clampIndex(value, count) {
  return Math.min(count - 1, Math.max(0, value));
}

function cellCoordinate(index, min, step) {
  return min + index * step;
}

function createGrid(anchor) {
  const minX = anchor.x - GRID_MARGIN;
  const minY = anchor.y - GRID_MARGIN;
  const maxX = anchor.x + anchor.width + GRID_MARGIN;
  const maxY = anchor.y + anchor.height + GRID_MARGIN;
  const columns = Math.max(1, Math.ceil((maxX - minX) / GRID_STEP));
  const rows = Math.max(1, Math.ceil((maxY - minY) / GRID_STEP));

  return { minX, minY, columns, rows, cells: columns * rows };
}

function markBlockedCells(grid, solidTiles, playerSize) {
  const blocked = new Uint8Array(grid.cells);

  for (const tile of solidTiles) {
    const firstColumn = clampIndex(Math.floor((tile.x - playerSize - grid.minX) / GRID_STEP), grid.columns);
    const lastColumn = clampIndex(Math.ceil((tile.x + tile.width - grid.minX) / GRID_STEP), grid.columns);
    const firstRow = clampIndex(Math.floor((tile.y - playerSize - grid.minY) / GRID_STEP), grid.rows);
    const lastRow = clampIndex(Math.ceil((tile.y + tile.height - grid.minY) / GRID_STEP), grid.rows);

    for (let row = firstRow; row <= lastRow; row += 1) {
      const y = cellCoordinate(row, grid.minY, GRID_STEP);

      for (let column = firstColumn; column <= lastColumn; column += 1) {
        const x = cellCoordinate(column, grid.minX, GRID_STEP);
        if (boxesOverlap(boxAt(x, y, playerSize, playerSize), tile)) {
          blocked[row * grid.columns + column] = 1;
        }
      }
    }
  }

  return blocked;
}

function findStartCell(grid, blocked, playerBox) {
  const anchorColumn = clampIndex(Math.round((playerBox.x - grid.minX) / GRID_STEP), grid.columns);
  const anchorRow = clampIndex(Math.round((playerBox.y - grid.minY) / GRID_STEP), grid.rows);
  const candidates = [];

  for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
    for (let columnDelta = -1; columnDelta <= 1; columnDelta += 1) {
      const column = anchorColumn + columnDelta;
      const row = anchorRow + rowDelta;

      if (column < 0 || column >= grid.columns || row < 0 || row >= grid.rows) {
        continue;
      }

      const x = cellCoordinate(column, grid.minX, GRID_STEP);
      const y = cellCoordinate(row, grid.minY, GRID_STEP);
      candidates.push({
        index: row * grid.columns + column,
        distance: Math.abs(x - playerBox.x) + Math.abs(y - playerBox.y),
        column,
        row
      });
    }
  }

  candidates.sort((a, b) => compare(a.distance, b.distance) || compare(a.row, b.row) || compare(a.column, b.column));

  for (const candidate of candidates) {
    if (blocked[candidate.index] === 0) {
      return candidate.index;
    }
  }

  return -1;
}

function walkReachableCells(grid, blocked, startIndex) {
  const reachable = new Uint8Array(grid.cells);
  const queue = new Int32Array(grid.cells);
  let head = 0;
  let tail = 0;

  reachable[startIndex] = 1;
  queue[tail] = startIndex;
  tail += 1;

  while (head < tail) {
    const index = queue[head];
    head += 1;
    const column = index % grid.columns;
    const row = (index - column) / grid.columns;

    for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
      for (let columnDelta = -1; columnDelta <= 1; columnDelta += 1) {
        if (rowDelta === 0 && columnDelta === 0) {
          continue;
        }

        const nextColumn = column + columnDelta;
        const nextRow = row + rowDelta;

        if (nextColumn < 0 || nextColumn >= grid.columns || nextRow < 0 || nextRow >= grid.rows) {
          continue;
        }

        const nextIndex = nextRow * grid.columns + nextColumn;
        if (blocked[nextIndex] === 1 || reachable[nextIndex] === 1) {
          continue;
        }

        if (rowDelta !== 0 && columnDelta !== 0) {
          const horizontalBlocked = blocked[row * grid.columns + nextColumn] === 1;
          const verticalBlocked = blocked[nextRow * grid.columns + column] === 1;
          if (horizontalBlocked || verticalBlocked) {
            continue;
          }
        }

        reachable[nextIndex] = 1;
        queue[tail] = nextIndex;
        tail += 1;
      }
    }
  }

  return reachable;
}

function buildReachability(layout, spawn, findings) {
  const playerSize = layoutPlayerSize(layout);
  const playerBox = spawnPlayerBox(spawn, playerSize);
  const anchorBoxes = [
    playerBox,
    ...(layout.collectibles ?? []).map((collectible) => boxAt(collectible.x, collectible.y, collectible.width, collectible.height))
  ];

  if ((layout.tiles ?? []).length > 0) {
    anchorBoxes.push(layout.tileBounds);
  }

  const anchor = unionBoxes(anchorBoxes);
  const grid = createGrid(anchor);

  if (grid.cells > MAX_GRID_CELLS) {
    findings.push(warningFinding(
      layout,
      'reachability-skipped',
      `reachability skipped: the ${GRID_STEP} unit grid needs ${grid.cells} cells, above the ${MAX_GRID_CELLS} cell cap`,
      { evidence: { position: { x: spawn.x, y: spawn.y }, cells: grid.cells, cap: MAX_GRID_CELLS } }
    ));
    return null;
  }

  const solidTiles = (layout.tiles ?? []).filter((tile) => tile.solid && !tile.slope);
  const blocked = markBlockedCells(grid, solidTiles, playerSize);
  const startIndex = findStartCell(grid, blocked, playerBox);

  if (startIndex === -1) {
    findings.push(warningFinding(
      layout,
      'reachability-skipped',
      'reachability skipped: no free grid cell matches the player spawn',
      { evidence: { position: { x: spawn.x, y: spawn.y } } }
    ));
    return null;
  }

  return {
    grid,
    playerSize,
    reachable: walkReachableCells(grid, blocked, startIndex)
  };
}

function isCollectibleReachable(collectible, reachability) {
  const { grid, playerSize, reachable } = reachability;
  const firstColumn = Math.max(0, Math.ceil((collectible.x - playerSize - grid.minX) / GRID_STEP - EPSILON));
  const lastColumn = Math.min(grid.columns - 1, Math.floor((collectible.x + collectible.width - grid.minX) / GRID_STEP + EPSILON));
  const firstRow = Math.max(0, Math.ceil((collectible.y - playerSize - grid.minY) / GRID_STEP - EPSILON));
  const lastRow = Math.min(grid.rows - 1, Math.floor((collectible.y + collectible.height - grid.minY) / GRID_STEP + EPSILON));

  for (let row = firstRow; row <= lastRow; row += 1) {
    const y = cellCoordinate(row, grid.minY, GRID_STEP);

    for (let column = firstColumn; column <= lastColumn; column += 1) {
      if (reachable[row * grid.columns + column] === 0) {
        continue;
      }

      const x = cellCoordinate(column, grid.minX, GRID_STEP);
      if (boxesOverlap(boxAt(x, y, playerSize, playerSize), collectible)) {
        return true;
      }
    }
  }

  return false;
}

function checkCollectibleReachability(layout, spawn, spawnInvalid, findings) {
  const collectibles = layout.collectibles ?? [];
  if (spawnInvalid || spawn === null || collectibles.length === 0) {
    return;
  }

  const reachability = buildReachability(layout, spawn, findings);
  if (reachability === null) {
    return;
  }

  for (const collectible of collectibles) {
    if (isCollectibleReachable(collectible, reachability)) {
      continue;
    }

    findings.push(errorFinding(
      layout,
      'collectible-unreachable-region',
      `collectible "${collectible.type}" at ${formatPoint(collectible.x, collectible.y)} is not reachable from the player spawn at ${formatPoint(spawn.x, spawn.y)}`,
      { section: collectible.section, object: describeObject(collectible), evidence: { position: { x: collectible.x, y: collectible.y }, box: boxAt(collectible.x, collectible.y, collectible.width, collectible.height) } }
    ));
  }
}

function checkCheckpoints(layout, findings) {
  for (const checkpoint of layout.checkpoints ?? []) {
    const activationBox = boxAt(checkpoint.x, checkpoint.y - 1, CREATION_CELL_SIZE, CREATION_CELL_SIZE);
    const blocker = findBlockingTile(layout.tiles ?? [], activationBox);

    if (blocker === null) {
      continue;
    }

    findings.push(errorFinding(
      layout,
      'checkpoint-unusable',
      `checkpoint at ${formatPoint(checkpoint.x, checkpoint.y)} has an activation cell ${formatBox(activationBox)} overlapping ${blocker.kind} tile "${blocker.tile.type}" box ${formatBox(blocker.tile)}`,
      { section: checkpoint.section, object: describeObject(checkpoint), evidence: { position: { x: checkpoint.x, y: checkpoint.y }, box: activationBox, ...tileDetails(blocker.tile) } }
    ));
  }
}

function checkTeleporters(layout, findings) {
  for (const teleporter of layout.teleporters ?? []) {
    const box = boxAt(teleporter.x, teleporter.y, CREATION_CELL_SIZE, CREATION_CELL_SIZE);
    const blocker = findBlockingTile(layout.tiles ?? [], box);

    if (blocker === null) {
      continue;
    }

    findings.push(errorFinding(
      layout,
      'teleporter-in-solid',
      `teleporter "${teleporter.name}" at ${formatPoint(teleporter.x, teleporter.y)} overlaps ${blocker.kind} tile "${blocker.tile.type}" box ${formatBox(blocker.tile)}`,
      { section: teleporter.section, object: describeObject(teleporter), evidence: { position: { x: teleporter.x, y: teleporter.y }, box, ...tileDetails(blocker.tile) } }
    ));
  }
}

function checkMarkers(layout, findings) {
  for (const marker of layout.markers ?? []) {
    const box = boxAt(marker.x, marker.y, CREATION_CELL_SIZE, CREATION_CELL_SIZE);
    const blocker = findBlockingTile(layout.tiles ?? [], box);

    if (blocker === null) {
      continue;
    }

    findings.push(errorFinding(
      layout,
      'teleporter-marker-in-solid',
      `teleporter marker "${marker.name}" at ${formatPoint(marker.x, marker.y)} overlaps ${blocker.kind} tile "${blocker.tile.type}" box ${formatBox(blocker.tile)}`,
      { section: marker.section, object: describeObject(marker), evidence: { position: { x: marker.x, y: marker.y }, box, ...tileDetails(blocker.tile) } }
    ));
  }
}

function checkEnemies(layout, findings) {
  for (const enemy of layout.enemies ?? []) {
    const box = boxAt(enemy.x, enemy.y, enemy.width, enemy.height);
    const blocker = findBlockingTile(layout.tiles ?? [], box, false);

    if (blocker === null) {
      continue;
    }

    findings.push(errorFinding(
      layout,
      'enemy-in-solid',
      `enemy "${enemy.type}" at ${formatPoint(enemy.x, enemy.y)} overlaps ${blocker.kind} tile "${blocker.tile.type}" box ${formatBox(blocker.tile)}`,
      { section: enemy.section, object: describeObject(enemy), evidence: { position: { x: enemy.x, y: enemy.y }, box, ...tileDetails(blocker.tile) } }
    ));
  }
}

export function analyzeStage(layout) {
  const findings = [];
  const spawnState = checkSpawn(layout, findings);

  collectibleFindings(layout, findings);
  checkCollectibleReachability(layout, spawnState.spawn, spawnState.invalid, findings);
  checkCheckpoints(layout, findings);
  checkTeleporters(layout, findings);
  checkMarkers(layout, findings);
  checkEnemies(layout, findings);

  return sortFindings(findings);
}

export function analyzeLayouts(layouts) {
  return layouts.flatMap((layout) => analyzeStage(layout));
}
