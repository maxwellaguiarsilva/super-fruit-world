import { boxAt, spawnPlayerBox, unionBoxes } from './model.js';

export const MIN_OVERVIEW_SCALE = 2;
export const DEFAULT_OVERLAP = 2;
export const DEFAULT_PLAYER_SIZE = 1;
export const MIN_CHUNK_CONTENT_HEIGHT = 10;
export const CHUNK_CONTENT_PADDING = 2;

// Chrome is reserved space inside the SVG. Header carries the legend, axisTop
// carries the world-coordinate labels, axisLeft carries the left axis labels
// and footer carries the manifest hint. Every view's pixel size includes it.
export const CHROME = Object.freeze({
  header: 142,
  footer: 26,
  axisTop: 16,
  axisLeft: 34,
  right: 16,
  minViewWidth: 560
});

export const PLOT_MARGIN = Object.freeze({
  top: CHROME.header + CHROME.axisTop,
  right: CHROME.right,
  bottom: CHROME.footer,
  left: CHROME.axisLeft
});

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function positiveNumberOr(value, fallback) {
  return isFiniteNumber(value) && value > 0 ? value : fallback;
}

function coordinate(value) {
  return isFiniteNumber(value) ? value : 0;
}

function sizeOr(size) {
  if (size === null || typeof size !== 'object' || Array.isArray(size)) {
    return { width: 0, height: 0 };
  }

  return {
    width: Math.max(0, coordinate(size.width)),
    height: Math.max(0, coordinate(size.height))
  };
}

function objectBox(object) {
  const source = object !== null && typeof object === 'object' ? object : {};
  return boxAt(
    coordinate(source.x),
    coordinate(source.y),
    Math.max(0, coordinate(source.width)),
    Math.max(0, coordinate(source.height))
  );
}

function normalizeBounds(bounds) {
  if (bounds === null || typeof bounds !== 'object' || Array.isArray(bounds)) {
    throw new TypeError('bounds must be an object with x, y, width and height');
  }

  for (const key of ['x', 'y', 'width', 'height']) {
    if (!isFiniteNumber(bounds[key])) {
      throw new TypeError(`bounds.${key} must be a finite number`);
    }
  }

  if (bounds.width < 0 || bounds.height < 0) {
    throw new RangeError('bounds.width and bounds.height must not be negative');
  }

  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height
  };
}

// Bounds of every object the exporter can draw, so that no visible datum is
// cut from the overview. Sections contribute their declared boxes; spawns and
// checkpoints contribute the cells the player actually touches.
export function computeStageBounds(layout) {
  if (layout === null || typeof layout !== 'object' || Array.isArray(layout)) {
    throw new TypeError('layout must be an object');
  }

  const playerSize = positiveNumberOr(layout.playerSize, DEFAULT_PLAYER_SIZE);
  const boxes = [];

  for (const section of Array.isArray(layout.sections) ? layout.sections : []) {
    const origin = section?.position ?? {};
    const size = sizeOr(section?.size);
    boxes.push(boxAt(coordinate(origin.x), coordinate(origin.y), size.width, size.height));
  }

  for (const key of ['tiles', 'collectibles', 'enemies', 'teleporters', 'markers', 'other']) {
    for (const object of Array.isArray(layout[key]) ? layout[key] : []) {
      boxes.push(objectBox(object));
    }
  }

  for (const spawn of Array.isArray(layout.spawns) ? layout.spawns : []) {
    boxes.push(spawnPlayerBox({
      x: coordinate(spawn?.x),
      y: coordinate(spawn?.y)
    }, playerSize));
  }

  for (const checkpoint of Array.isArray(layout.checkpoints) ? layout.checkpoints : []) {
    boxes.push(boxAt(coordinate(checkpoint?.x), coordinate(checkpoint?.y) - 1, 1, 1));
    boxes.push(boxAt(coordinate(checkpoint?.x), coordinate(checkpoint?.y), 1, 1));
  }

  const union = unionBoxes(boxes);

  return {
    x: coordinate(union.x),
    y: coordinate(union.y),
    width: Math.max(0, coordinate(union.width)),
    height: Math.max(0, coordinate(union.height))
  };
}

function intersectsXRange(box, start, end) {
  const right = box.x + Math.max(0, box.width);
  return right >= start && box.x <= end;
}

// Measures the vertical band a chunk actually needs. Only objects whose X
// range intersects the chunk's core (the nominal chunk without the overlap
// shared with its neighbours) contribute, so content that belongs to a
// neighbouring chunk cannot inflate this view. Sections are deliberately
// excluded: they describe areas, not the objects drawn inside them.
export function computeChunkContentBounds(layout, { x, width } = {}) {
  if (layout === null || typeof layout !== 'object' || Array.isArray(layout)) {
    throw new TypeError('layout must be an object');
  }

  if (!isFiniteNumber(x) || !isFiniteNumber(width)) {
    throw new TypeError('chunk core x and width must be finite numbers');
  }

  if (width < 0) {
    throw new RangeError('chunk core width must not be negative');
  }

  const bounds = computeStageBounds(layout);
  const playerSize = positiveNumberOr(layout.playerSize, DEFAULT_PLAYER_SIZE);
  const start = x;
  const end = x + width;
  const boxes = [];

  const consider = (box) => {
    if (intersectsXRange(box, start, end)) {
      boxes.push(box);
    }
  };

  for (const key of ['tiles', 'collectibles', 'enemies', 'teleporters', 'markers', 'other']) {
    for (const object of Array.isArray(layout[key]) ? layout[key] : []) {
      consider(objectBox(object));
    }
  }

  for (const spawn of Array.isArray(layout.spawns) ? layout.spawns : []) {
    consider(spawnPlayerBox({
      x: coordinate(spawn?.x),
      y: coordinate(spawn?.y)
    }, playerSize));
  }

  for (const checkpoint of Array.isArray(layout.checkpoints) ? layout.checkpoints : []) {
    consider(boxAt(coordinate(checkpoint?.x), coordinate(checkpoint?.y) - 1, 1, 1));
    consider(boxAt(coordinate(checkpoint?.x), coordinate(checkpoint?.y), 1, 1));
  }

  const stageTop = bounds.y;
  const stageBottom = bounds.y + bounds.height;
  let minY;
  let maxY;

  if (boxes.length === 0) {
    const center = (stageTop + stageBottom) / 2;
    minY = center - MIN_CHUNK_CONTENT_HEIGHT / 2;
    maxY = center + MIN_CHUNK_CONTENT_HEIGHT / 2;
  } else {
    const union = unionBoxes(boxes);
    minY = union.y - CHUNK_CONTENT_PADDING;
    maxY = union.y + union.height + CHUNK_CONTENT_PADDING;
  }

  minY = Math.max(stageTop, minY);
  maxY = Math.min(stageBottom, maxY);

  if (maxY - minY < MIN_CHUNK_CONTENT_HEIGHT - 1e-9) {
    const center = (minY + maxY) / 2;
    minY = center - MIN_CHUNK_CONTENT_HEIGHT / 2;
    maxY = center + MIN_CHUNK_CONTENT_HEIGHT / 2;

    if (minY < stageTop) {
      minY = stageTop;
      maxY = Math.min(stageBottom, stageTop + MIN_CHUNK_CONTENT_HEIGHT);
    } else if (maxY > stageBottom) {
      maxY = stageBottom;
      minY = Math.max(stageTop, stageBottom - MIN_CHUNK_CONTENT_HEIGHT);
    }
  }

  return { y: minY, height: Math.max(0, maxY - minY) };
}

// Chunk world size is the largest view that fits the pixel budget, so a view
// never exceeds maxSize because of the world content alone.
function chunkWorldSize({ maxSize, scale }) {
  const usableWidth = maxSize - CHROME.axisLeft - CHROME.right;
  const usableHeight = maxSize - CHROME.header - CHROME.axisTop - CHROME.footer;

  if (usableWidth < 1 || usableHeight < 1) {
    throw new RangeError(
      `maxSize ${maxSize} is too small for the ${CHROME.header + CHROME.axisTop + CHROME.footer}px chrome`
    );
  }

  return {
    width: Math.max(1, Math.floor(usableWidth / scale)),
    height: Math.max(1, Math.floor(usableHeight / scale))
  };
}

// Starts on a fixed stride: consecutive chunks share exactly `overlap` units
// and the last chunk is clamped to the end of the extent.
function axisStarts(extent, chunkSize, overlap) {
  if (extent <= chunkSize) {
    return [0];
  }

  const stride = Math.max(1, chunkSize - overlap);
  const starts = [];
  let start = 0;

  for (;;) {
    starts.push(start);
    const end = Math.min(start + chunkSize, extent);
    if (end >= extent - 1e-9) {
      break;
    }
    start += stride;
  }

  return starts;
}

function pixelWidth(worldWidth, scale, maxSize) {
  const pixels = Math.ceil(CHROME.axisLeft + CHROME.right + worldWidth * scale);
  return Math.min(maxSize, Math.max(1, pixels));
}

function pixelHeight(worldHeight, scale, maxSize) {
  const pixels = Math.ceil(
    CHROME.header + CHROME.axisTop + CHROME.footer + worldHeight * scale
  );
  return Math.min(maxSize, Math.max(1, pixels));
}

function buildView({ kind, world, scale, maxSize }) {
  return {
    kind,
    world: {
      x: world.x,
      y: world.y,
      width: world.width,
      height: world.height
    },
    scale,
    pixelWidth: pixelWidth(world.width, scale, maxSize),
    pixelHeight: pixelHeight(world.height, scale, maxSize)
  };
}

function padView(view, maxSize) {
  return {
    ...view,
    pixelWidth: Math.min(maxSize, Math.max(CHROME.minViewWidth, view.pixelWidth))
  };
}

export function computeChunks({ layout = null, bounds, scale, maxSize, overlap = DEFAULT_OVERLAP } = {}) {
  const area = normalizeBounds(bounds);
  const hasLayout = layout !== null && layout !== undefined;

  if (hasLayout && (typeof layout !== 'object' || Array.isArray(layout))) {
    throw new TypeError('layout must be an object when provided');
  }

  if (!isFiniteNumber(scale) || scale <= 0) {
    throw new RangeError('scale must be a positive finite number');
  }

  if (!Number.isFinite(maxSize) || maxSize <= 0) {
    throw new RangeError('maxSize must be a positive finite number');
  }

  if (!isFiniteNumber(overlap) || overlap < 0) {
    throw new RangeError('overlap must be a non-negative finite number');
  }

  const limit = Math.floor(maxSize);
  const extentWidth = Math.max(area.width, 1);
  const extentHeight = Math.max(area.height, 1);
  const worldSize = chunkWorldSize({ maxSize: limit, scale });
  const overlapX = Math.min(overlap, worldSize.width - 1);
  const overlapY = Math.min(overlap, worldSize.height - 1);

  const availableWidth = limit - CHROME.axisLeft - CHROME.right;
  const availableHeight = limit - CHROME.header - CHROME.axisTop - CHROME.footer;
  const fitScale = Math.min(availableWidth / extentWidth, availableHeight / extentHeight);
  const overviewScale = Math.max(MIN_OVERVIEW_SCALE, Math.min(fitScale, scale));

  const overview = padView(
    buildView({
      kind: 'overview',
      world: { x: area.x, y: area.y, width: extentWidth, height: extentHeight },
      scale: overviewScale,
      maxSize: limit
    }),
    limit
  );

  if (extentWidth <= worldSize.width && extentHeight <= worldSize.height) {
    return { overview, chunks: [] };
  }

  const columnStarts = axisStarts(extentWidth, worldSize.width, overlapX);
  const chunks = [];

  if (!hasLayout) {
    const rowStarts = axisStarts(extentHeight, worldSize.height, overlapY);

    for (const startY of rowStarts) {
      for (const startX of columnStarts) {
        const width = Math.min(worldSize.width, extentWidth - startX);
        const height = Math.min(worldSize.height, extentHeight - startY);

        chunks.push(
          padView(
            buildView({
              kind: 'chunk',
              world: {
                x: area.x + startX,
                y: area.y + startY,
                width,
                height
              },
              scale,
              maxSize: limit
            }),
            limit
          )
        );
      }
    }

    return { overview, chunks };
  }

  // With a layout, the vertical extent of each column is reduced to the band
  // that holds its content. Rows are then split inside that band, so a short
  // content band produces short images instead of empty sky and underground.
  const coreStrideX = Math.max(1, worldSize.width - overlapX);
  const singleColumn = columnStarts.length === 1;
  const columns = columnStarts.map((startX) => {
    const width = Math.min(worldSize.width, extentWidth - startX);
    const coreWidth = singleColumn
      ? extentWidth
      : Math.min(coreStrideX, extentWidth - startX);
    const content = computeChunkContentBounds(layout, {
      x: area.x + startX,
      width: coreWidth
    });
    const contentTop = Math.max(area.y, content.y);
    const contentBottom = Math.min(area.y + area.height, content.y + content.height);
    const contentHeight = Math.max(contentBottom - contentTop, 1);

    return {
      startX,
      width,
      contentY: contentTop,
      contentHeight,
      rowStarts: axisStarts(contentHeight, worldSize.height, overlapY)
    };
  });
  const rowCount = columns.reduce(
    (maximum, column) => Math.max(maximum, column.rowStarts.length),
    0
  );

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    for (const column of columns) {
      if (rowIndex >= column.rowStarts.length) {
        continue;
      }

      const rowStart = column.rowStarts[rowIndex];
      const height = Math.min(worldSize.height, column.contentHeight - rowStart);

      chunks.push(
        padView(
          buildView({
            kind: 'chunk',
            world: {
              x: area.x + column.startX,
              y: column.contentY + rowStart,
              width: column.width,
              height
            },
            scale,
            maxSize: limit
          }),
          limit
        )
      );
    }
  }

  return { overview, chunks };
}
