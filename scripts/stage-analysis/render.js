import { CHROME, PLOT_MARGIN } from './chunks.js';
import { boxesOverlap, spawnPlayerBox } from './model.js';

const FONT_FAMILY = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const TITLE_FONT_SIZE = 15;
const LABEL_FONT_SIZE = 10;
const SMALL_FONT_SIZE = 9;
const MIN_MARKER_SIZE = 14;
const GRID_MINOR_STEP = 5;
const GRID_MAJOR_STEP = 10;
const MAX_GRID_LINES = 600;
const LEGEND_COLUMNS = 5;
const LEGEND_ROW_HEIGHT = 17;
const LEGEND_ORIGIN_X = 12;
const LEGEND_ORIGIN_Y = 52;
const SWATCH_SIZE = 11;
const MIN_VISIBLE_LABEL_SIZE = 8;
const SECTION_ROW_OFFSETS = Object.freeze([12, 26]);
// Downward lanes tried only when every primary candidate collides. They keep
// crowded clusters (exit / big fruit / teleporter) readable without changing
// the deterministic order of the primary search.
const FALLBACK_LANE_OFFSETS = Object.freeze([12, 24, 36, 48]);
// Candidate search order per `prefer` option. 'right' is the historical order
// and must stay byte-identical for every caller that does not opt in. 'above'
// and 'below' front-load the vertical candidates so a label points at its own
// icon instead of running sideways into a neighbouring icon.
const CANDIDATE_KEYS = Object.freeze({
  right: Object.freeze([
    'right',
    'left',
    'above',
    'below',
    'above-right',
    'below-right',
    'above-left',
    'below-left'
  ]),
  above: Object.freeze([
    'above',
    'above-right',
    'above-left',
    'right',
    'left',
    'below',
    'below-right',
    'below-left'
  ]),
  below: Object.freeze([
    'below',
    'below-right',
    'below-left',
    'right',
    'left',
    'above',
    'above-right',
    'above-left'
  ])
});
// Conservative monospace advance width. Real glyphs are narrower, but
// overestimating keeps the clip and collision tests on the safe side.
export const TEXT_WIDTH_FACTOR = 0.75;

const COLORS = Object.freeze({
  background: '#0a0a0a',
  plot: '#101010',
  text: '#e8e8e8',
  muted: '#9a9a9a',
  gridMinor: '#1b1b1b',
  gridMajor: '#2c2c2c',
  platform: '#9aa0a6',
  platformStroke: '#6b7280',
  wall: '#5b6470',
  wallStroke: '#c7cdd4',
  slope: '#8a939e',
  slopeStroke: '#c7cdd4',
  slopeSurface: '#ffe066',
  spike: '#d64545',
  spikeStroke: '#7f1d1d',
  pit: '#ff4fd8',
  water: '#22d3ee',
  ladder: '#facc15',
  decorative: '#22d3ee',
  spawn: '#51cf66',
  exit: '#51cf66',
  checkpoint: '#4dabf7',
  teleporter: '#b197fc',
  marker: '#b197fc',
  finding: '#ef4444',
  collectibles: Object.freeze({
    coin: '#ffd43b',
    ammo: '#ff922b',
    apple: '#f783ac',
    heart: '#ff6b6b',
    moon: '#d0bfff',
    sun: '#ffe066',
    earth: '#69db7c',
    'musical-note': '#22d3ee',
    key: '#69ff9c',
    'big-fruit': '#ff4fd8',
    'exit-door': '#51cf66'
  }),
  enemy: Object.freeze({
    patrol: '#f59f00',
    shooter: '#e03131',
    flyer: '#4dabf7',
    boss: '#d6336c'
  })
});

const TILE_TYPES = new Set(['platform', 'wall', 'slope', 'spike', 'pit', 'water', 'ladder', 'decorative']);
const ICON_COLLECTIBLES = new Set(['coin', 'ammo', 'apple', 'heart', 'moon', 'sun', 'earth']);
const ENEMY_SIDES = Object.freeze({
  triangle: 3,
  square: 4,
  pentagon: 5,
  hexagon: 6,
  heptagon: 7
});
const ENEMY_LETTERS = Object.freeze({ patrol: 'P', shooter: 'S', flyer: 'F', boss: 'B' });

const LEGEND_ITEMS = Object.freeze([
  { label: 'platform', swatch: 'rect', fill: COLORS.platform, stroke: COLORS.platformStroke },
  { label: 'wall', swatch: 'rect', fill: COLORS.wall, stroke: COLORS.wallStroke },
  { label: 'slope', swatch: 'wedge' },
  { label: 'spike', swatch: 'spike' },
  { label: 'pit (deadly)', swatch: 'pit' },
  { label: 'water', swatch: 'water' },
  { label: 'ladder', swatch: 'ladder' },
  { label: 'decorative', swatch: 'decorative' },
  { label: 'spawn', swatch: 'spawn' },
  { label: 'exit', swatch: 'diamond', color: COLORS.exit },
  { label: 'checkpoint', swatch: 'flag' },
  { label: 'big fruit', swatch: 'diamond', color: COLORS.collectibles['big-fruit'] },
  { label: 'key', swatch: 'key' },
  { label: 'note', swatch: 'note' },
  { label: 'coin/ammo', swatch: 'coin' },
  { label: 'enemy P/S/F/B', swatch: 'enemy' },
  { label: 'teleporter/marker', swatch: 'cross' },
  { label: 'static finding', swatch: 'badge' }
]);

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function formatNumber(value, digits = 1) {
  const rounded = Number(value.toFixed(digits));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function finiteNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function estimateTextWidth(value, size) {
  return String(value ?? '').length * size * TEXT_WIDTH_FACTOR;
}

function rectInsideClip(rect, clip) {
  return (
    rect.x >= clip.x
    && rect.y >= clip.y
    && rect.x + rect.width <= clip.x + clip.width
    && rect.y + rect.height <= clip.y + clip.height
  );
}

// Returns the part of an object box that is actually visible, or null when the
// object is a sliver at the edge of the view or its center is outside the view
// world. Labels use this so geometry can still be clipped while tiny fragments
// do not produce floating text in empty space.
function visibleBox(ctx, box) {
  if (box === null || typeof box !== 'object') {
    return null;
  }

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  if (centerX < ctx.world.x || centerX > ctx.world.x + ctx.world.width) {
    return null;
  }

  if (centerY < ctx.world.y || centerY > ctx.world.y + ctx.world.height) {
    return null;
  }

  const left = Math.max(ctx.toX(box.x), ctx.clip.x);
  const right = Math.min(ctx.toX(box.x + box.width), ctx.clip.x + ctx.clip.width);
  const top = Math.max(ctx.toY(box.y), ctx.clip.y);
  const bottom = Math.min(ctx.toY(box.y + box.height), ctx.clip.y + ctx.clip.height);
  const width = right - left;
  const height = bottom - top;

  const threshold = MIN_VISIBLE_LABEL_SIZE - 1e-9;

  if (width < threshold || height < threshold) {
    return null;
  }

  return { x: left, y: top, width, height };
}

function resolveColors(legend) {
  const overrides = legend !== null && typeof legend === 'object' ? legend : {};

  return {
    ...COLORS,
    collectibles: { ...COLORS.collectibles, ...(overrides.collectibles ?? {}) },
    enemy: { ...COLORS.enemy, ...(overrides.enemy ?? {}) }
  };
}

function validateView(view) {
  if (view === null || typeof view !== 'object' || Array.isArray(view)) {
    throw new TypeError('view must be an object');
  }

  if (view.kind !== 'overview' && view.kind !== 'chunk') {
    throw new TypeError('view.kind must be "overview" or "chunk"');
  }

  const world = view.world;
  if (world === null || typeof world !== 'object') {
    throw new TypeError('view.world must be an object');
  }

  for (const key of ['x', 'y', 'width', 'height']) {
    if (!Number.isFinite(world[key])) {
      throw new TypeError(`view.world.${key} must be a finite number`);
    }
  }

  if (!(world.width > 0) || !(world.height > 0)) {
    throw new RangeError('view.world width and height must be positive');
  }

  if (!(view.scale > 0) || !Number.isFinite(view.scale)) {
    throw new RangeError('view.scale must be a positive finite number');
  }

  if (!(view.pixelWidth > 0) || !(view.pixelHeight > 0)) {
    throw new RangeError('view pixel sizes must be positive');
  }
}

function createContext({ layout, view, colors }) {
  const world = view.world;
  const content = {
    x: CHROME.axisLeft,
    y: PLOT_MARGIN.top,
    width: world.width * view.scale,
    height: world.height * view.scale
  };
  const clip = {
    x: content.x,
    y: content.y,
    width: Math.max(0, Math.min(content.width, view.pixelWidth - content.x)),
    height: Math.max(0, Math.min(content.height, view.pixelHeight - content.y))
  };

  return {
    layout,
    view,
    colors,
    world,
    content,
    clip,
    placedLabels: [],
    // Important labels are rendered inline where they are computed but emitted
    // later, as one overlay on top of every icon and glyph. The array keeps the
    // original call order so output stays deterministic.
    labels: [],
    toX: (x) => content.x + (x - world.x) * view.scale,
    toY: (y) => content.y + (y - world.y) * view.scale,
    toWidth: (width) => width * view.scale,
    toHeight: (height) => height * view.scale
  };
}

// The overview is the global layout view: entity names are long and would
// collide with section names and with each other, so overview images keep only
// the structural labels (spawn, exit, checkpoints, boss) plus every glyph.
// Chunks carry the detailed entity names.
function entityLabelsVisible(ctx) {
  return ctx.view.kind !== 'overview';
}

// Entity labels are gated separately from entity geometry: a checkpoint, boss,
// spawn, collectible, teleporter or marker that is only a fragment at the edge
// of the view, or whose center falls outside the view world, still draws its
// shape but never contributes a label to the SVG or to the collision set.
// Unlike visibleBox this has no minimum on-screen size, so the structural
// labels of the overview survive at small scales.
function entityLabelVisible(ctx, box) {
  if (box === null || typeof box !== 'object') {
    return false;
  }

  const x = finiteNumber(box.x, 0);
  const y = finiteNumber(box.y, 0);
  const width = finiteNumber(box.width, 0);
  const height = finiteNumber(box.height, 0);
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  if (centerX < ctx.world.x || centerX > ctx.world.x + ctx.world.width) {
    return false;
  }

  if (centerY < ctx.world.y || centerY > ctx.world.y + ctx.world.height) {
    return false;
  }

  return (
    ctx.toX(x + width) > ctx.clip.x
    && ctx.toX(x) < ctx.clip.x + ctx.clip.width
    && ctx.toY(y + height) > ctx.clip.y
    && ctx.toY(y) < ctx.clip.y + ctx.clip.height
  );
}

// Places a text label at a pixel anchor and flips it when it would leave the
// plot, so no label is clipped at the right or bottom edge.
function labelLayout(ctx, text, x, y, options = {}) {
  const {
    anchor = 'start',
    dx = 4,
    dy = -4,
    size = LABEL_FONT_SIZE,
    fill = ctx.colors.text,
    weight = 'normal'
  } = options;

  const value = String(text ?? '');
  const estimatedWidth = estimateTextWidth(value, size);
  let px = x + dx;
  let py = y + dy;
  let textAnchor = anchor;

  if (textAnchor === 'start' && px + estimatedWidth > ctx.clip.x + ctx.clip.width) {
    textAnchor = 'end';
    px = x - Math.max(4, dx);
  } else if (textAnchor === 'middle') {
    const leftEdge = ctx.clip.x + 2;
    const rightEdge = ctx.clip.x + ctx.clip.width - 2;
    px = Math.min(Math.max(px, leftEdge + estimatedWidth / 2), rightEdge - estimatedWidth / 2);
  }

  if (py > ctx.clip.y + ctx.clip.height) {
    py = y - Math.max(size + 2, Math.abs(dy) + 2);
  } else if (py < ctx.clip.y) {
    py = y + size + Math.abs(dy);
  }

  return { value, px, py, textAnchor, size, fill, weight, estimatedWidth };
}

function renderTextLayout(layout) {
  if (layout.value.length === 0) {
    return '';
  }

  return `<text x="${round(layout.px)}" y="${round(layout.py)}" font-family="${FONT_FAMILY}" font-size="${layout.size}" font-weight="${layout.weight}" fill="${layout.fill}" text-anchor="${layout.textAnchor}">${escapeXml(layout.value)}</text>`;
}

function label(ctx, text, x, y, options = {}) {
  return renderTextLayout(labelLayout(ctx, text, x, y, options));
}

function textLayoutRect(layout) {
  const left = layout.textAnchor === 'end'
    ? layout.px - layout.estimatedWidth
    : layout.textAnchor === 'middle'
      ? layout.px - layout.estimatedWidth / 2
      : layout.px;
  const top = layout.py - layout.size * 0.8;

  return {
    x: left,
    y: top,
    width: layout.estimatedWidth,
    height: layout.size + 2
  };
}

function candidateLayout(value, x, y, { anchor, dx, dy, size, fill, weight }) {
  return {
    value,
    px: x + dx,
    py: y + dy,
    textAnchor: anchor,
    size,
    fill,
    weight,
    estimatedWidth: estimateTextWidth(value, size)
  };
}

// Places important labels with a deterministic search over right, left, above
// and below. A candidate is rejected when its estimated rectangle leaves the
// plot or intersects a label that was already placed in this view. Accepted
// labels are queued in ctx.labels instead of being returned inline, so the
// caller can emit them after every icon and glyph.
//
// `prefer` only rotates the candidate order: 'right' keeps the historical
// behavior, 'above' and 'below' start with the vertical candidates centered on
// x so the text is associated with the icon at x. Every candidate, in every
// order, goes through the same clip and placed-label collision checks.
function placeLabel(ctx, text, x, y, options = {}) {
  const value = String(text ?? '');
  if (value.length === 0) {
    return '';
  }

  const {
    size = LABEL_FONT_SIZE,
    fill = ctx.colors.text,
    weight = 'normal',
    dx = 4,
    dy = 4,
    prefer = 'right'
  } = options;
  const gap = Math.max(4, dx);
  const above = -(gap + size);
  const below = gap + size + 2;
  const candidatesByKey = {
    right: { anchor: 'start', dx: gap, dy },
    left: { anchor: 'end', dx: -gap, dy },
    above: { anchor: 'middle', dx: 0, dy: above },
    below: { anchor: 'middle', dx: 0, dy: below },
    'above-right': { anchor: 'start', dx: gap, dy: above },
    'above-left': { anchor: 'end', dx: -gap, dy: above },
    'below-right': { anchor: 'start', dx: gap, dy: below },
    'below-left': { anchor: 'end', dx: -gap, dy: below }
  };
  const candidates = (CANDIDATE_KEYS[prefer] ?? CANDIDATE_KEYS.right)
    .map((key) => candidatesByKey[key]);
  const accept = (layout) => {
    const rect = textLayoutRect(layout);

    if (!rectInsideClip(rect, ctx.clip)) {
      return false;
    }

    if (ctx.placedLabels.some((placed) => boxesOverlap(rect, placed))) {
      return false;
    }

    ctx.placedLabels.push(rect);
    ctx.labels.push(renderTextLayout(layout));
    return true;
  };

  for (const candidate of candidates) {
    if (accept(candidateLayout(value, x, y, { ...candidate, size, fill, weight }))) {
      return '';
    }
  }

  // The primary search collided everywhere. Rather than dropping the label back
  // onto the old inline position, walk down a few lanes with the same
  // right/left candidates. Lanes that would leave the clip are rejected.
  for (const offset of FALLBACK_LANE_OFFSETS) {
    for (const anchor of ['start', 'end']) {
      const laneDx = anchor === 'start' ? gap : -gap;

      if (accept(candidateLayout(value, x, y, { anchor, dx: laneDx, dy: dy + offset, size, fill, weight }))) {
        return '';
      }
    }
  }

  const fallback = labelLayout(ctx, value, x, y, { anchor: 'start', dx, dy, size, fill, weight });
  ctx.placedLabels.push(textLayoutRect(fallback));
  ctx.labels.push(renderTextLayout(fallback));
  return '';
}

function renderLegendSwatch(item, x, y, colors) {
  const s = SWATCH_SIZE;
  const half = s / 2;
  let shape = '';

  switch (item.swatch) {
    case 'rect':
      shape = `<rect x="0" y="0" width="${s}" height="${s}" fill="${item.fill}" stroke="${item.stroke}" stroke-width="1"/>`;
      break;
    case 'wedge':
      shape = `<polygon points="0,${s} ${s},0 ${s},${s}" fill="${colors.slope}" stroke="${colors.slopeStroke}" stroke-width="1"/>`
        + `<line x1="0" y1="${s}" x2="${s}" y2="0" stroke="${colors.slopeSurface}" stroke-width="1.5"/>`;
      break;
    case 'spike':
      shape = `<polygon points="0,${s} ${half},0 ${s},${s}" fill="${colors.spike}" stroke="${colors.spikeStroke}" stroke-width="1"/>`;
      break;
    case 'pit':
      shape = `<rect x="0" y="0" width="${s}" height="${s}" fill="${colors.pit}" fill-opacity="0.25" stroke="${colors.pit}" stroke-dasharray="2 2"/>`;
      break;
    case 'water':
      shape = `<rect x="0" y="0" width="${s}" height="${s}" fill="${colors.water}" fill-opacity="0.25" stroke="${colors.water}"/>`;
      break;
    case 'ladder':
      shape = `<rect x="2" y="0" width="${s - 4}" height="${s}" fill="${colors.ladder}" fill-opacity="0.3" stroke="${colors.ladder}"/>`
        + `<line x1="2" y1="${half}" x2="${s - 2}" y2="${half}" stroke="${colors.ladder}"/>`;
      break;
    case 'decorative':
      shape = `<rect x="0" y="0" width="${s}" height="${s}" fill="${colors.decorative}" fill-opacity="0.08" stroke="${colors.decorative}" stroke-dasharray="2 2"/>`;
      break;
    case 'spawn':
      shape = `<polygon points="${half},0 ${s},${s} 0,${s}" fill="${colors.spawn}"/>`;
      break;
    case 'diamond':
      shape = `<polygon points="${half},0 ${s},${half} ${half},${s} 0,${half}" fill="${item.color}"/>`;
      break;
    case 'flag':
      shape = `<line x1="1" y1="${s}" x2="1" y2="0" stroke="${colors.checkpoint}" stroke-width="1.5"/>`
        + `<polygon points="1,0 ${s},2 1,4" fill="${colors.checkpoint}"/>`;
      break;
    case 'key':
      shape = `<circle cx="2" cy="${half}" r="2" fill="none" stroke="${colors.collectibles.key}" stroke-width="1.5"/>`
        + `<line x1="4" y1="${half}" x2="${s}" y2="${half}" stroke="${colors.collectibles.key}" stroke-width="1.5"/>`
        + `<line x1="${s - 2}" y1="${half}" x2="${s - 2}" y2="${s}" stroke="${colors.collectibles.key}" stroke-width="1.5"/>`;
      break;
    case 'note':
      shape = `<ellipse cx="3" cy="${s - 2}" rx="2.5" ry="1.8" fill="${colors.collectibles['musical-note']}"/>`
        + `<line x1="5.5" y1="${s - 2}" x2="5.5" y2="0" stroke="${colors.collectibles['musical-note']}" stroke-width="1.5"/>`
        + `<line x1="5.5" y1="0" x2="${s}" y2="2" stroke="${colors.collectibles['musical-note']}" stroke-width="1.5"/>`;
      break;
    case 'coin':
      shape = `<circle cx="3.5" cy="${half}" r="3.5" fill="${colors.collectibles.coin}" stroke="#8a6d00" stroke-width="1"/>`
        + `<rect x="7.5" y="${half - 2}" width="4" height="4" fill="${colors.collectibles.ammo}" stroke="#7a3d00" stroke-width="1"/>`;
      break;
    case 'enemy':
      shape = `<polygon points="${half},0 ${s},${half} ${half},${s} 0,${half}" fill="${colors.enemy.patrol}" stroke="#ffffff"/>`
        + `<text x="${half}" y="${half + 3}" font-family="${FONT_FAMILY}" font-size="9" fill="#ffffff" text-anchor="middle">P</text>`;
      break;
    case 'cross':
      shape = `<line x1="0" y1="${half}" x2="${s}" y2="${half}" stroke="${colors.teleporter}" stroke-width="2"/>`
        + `<line x1="${half}" y1="0" x2="${half}" y2="${s}" stroke="${colors.teleporter}" stroke-width="2"/>`;
      break;
    case 'badge':
      shape = `<rect x="0" y="0" width="${s}" height="${s}" rx="2" fill="${colors.finding}"/>`
        + `<text x="${half}" y="${s - 1}" font-family="${FONT_FAMILY}" font-size="9" fill="#ffffff" text-anchor="middle">E</text>`;
      break;
    default:
      shape = `<rect x="0" y="0" width="${s}" height="${s}" fill="${colors.muted}"/>`;
  }

  return `<g transform="translate(${round(x)}, ${round(y)})">${shape}`
    + `<text x="${s + 5}" y="${s - 1}" font-family="${FONT_FAMILY}" font-size="${SMALL_FONT_SIZE}" fill="${colors.muted}">${escapeXml(item.label)}</text></g>`;
}

function renderHeader(ctx, findings) {
  const { layout, view, colors } = ctx;
  const width = view.pixelWidth;
  const world = ctx.world;
  const right = world.x + world.width;
  const bottom = world.y + world.height;
  const cellWidth = Math.max(1, (width - 2 * LEGEND_ORIGIN_X) / LEGEND_COLUMNS);
  const legendRows = Math.ceil(LEGEND_ITEMS.length / LEGEND_COLUMNS);
  const parts = [];

  parts.push(`<rect x="0" y="0" width="${round(width)}" height="${CHROME.header + CHROME.axisTop}" fill="${colors.background}"/>`);
  parts.push(
    `<text x="${LEGEND_ORIGIN_X}" y="21" font-family="${FONT_FAMILY}" font-size="${TITLE_FONT_SIZE}" font-weight="bold" fill="${colors.text}">Stage map: ${escapeXml(layout.id)}</text>`
  );
  parts.push(
    `<text x="${round(width - LEGEND_ORIGIN_X)}" y="21" font-family="${FONT_FAMILY}" font-size="11" fill="${colors.muted}" text-anchor="end">${escapeXml(view.kind.toUpperCase())}</text>`
  );
  parts.push(
    `<text x="${LEGEND_ORIGIN_X}" y="38" font-family="${FONT_FAMILY}" font-size="${SMALL_FONT_SIZE}" fill="${colors.muted}">world x ${formatNumber(world.x)}..${formatNumber(right)} | y ${formatNumber(world.y)}..${formatNumber(bottom)} | ${formatNumber(view.scale, 2)} px/unit | player ${formatNumber(finiteNumber(layout.playerSize, 1), 2)}u</text>`
  );

  LEGEND_ITEMS.forEach((item, index) => {
    const column = index % LEGEND_COLUMNS;
    const row = Math.floor(index / LEGEND_COLUMNS);
    const x = LEGEND_ORIGIN_X + column * cellWidth;
    const y = LEGEND_ORIGIN_Y + row * LEGEND_ROW_HEIGHT;
    parts.push(renderLegendSwatch(item, x, y, colors));
  });

  const noteY = LEGEND_ORIGIN_Y + legendRows * LEGEND_ROW_HEIGHT + 8;
  parts.push(
    `<text x="${LEGEND_ORIGIN_X}" y="${noteY}" font-family="${FONT_FAMILY}" font-size="${SMALL_FONT_SIZE}" fill="${colors.pit}">Pits are invisible in-game; shown here.</text>`
  );
  parts.push(
    `<text x="${round(width - LEGEND_ORIGIN_X)}" y="${noteY}" font-family="${FONT_FAMILY}" font-size="${SMALL_FONT_SIZE}" fill="${colors.muted}" text-anchor="end">${findings.length} static findings - listed in manifest.json</text>`
  );

  return parts.join('');
}

function gridStep(scale) {
  for (const step of [GRID_MAJOR_STEP, 20, 50, 100, 200, 500, 1000]) {
    if (step * scale >= 46) {
      return step;
    }
  }

  return 1000;
}

function renderGrid(ctx) {
  const { colors, world } = ctx;
  const right = world.x + world.width;
  const bottom = world.y + world.height;
  const parts = [];

  const countLines = (start, end, step) => Math.floor((end - start) / step) + 2;
  if (countLines(world.x, right, GRID_MINOR_STEP) > MAX_GRID_LINES || countLines(world.y, bottom, GRID_MINOR_STEP) > MAX_GRID_LINES) {
    return '';
  }

  for (let x = Math.ceil(world.x / GRID_MINOR_STEP) * GRID_MINOR_STEP; x <= right; x += GRID_MINOR_STEP) {
    const major = Math.abs(x % GRID_MAJOR_STEP) < 1e-9;
    const px = ctx.toX(x);
    parts.push(
      `<line x1="${round(px)}" y1="${round(ctx.content.y)}" x2="${round(px)}" y2="${round(ctx.content.y + ctx.content.height)}" stroke="${major ? colors.gridMajor : colors.gridMinor}" stroke-width="1"/>`
    );
  }

  for (let y = Math.ceil(world.y / GRID_MINOR_STEP) * GRID_MINOR_STEP; y <= bottom; y += GRID_MINOR_STEP) {
    const major = Math.abs(y % GRID_MAJOR_STEP) < 1e-9;
    const py = ctx.toY(y);
    parts.push(
      `<line x1="${round(ctx.content.x)}" y1="${round(py)}" x2="${round(ctx.content.x + ctx.content.width)}" y2="${round(py)}" stroke="${major ? colors.gridMajor : colors.gridMinor}" stroke-width="1"/>`
    );
  }

  return parts.join('');
}

function sectionLabelBox(ctx, x) {
  const size = Math.max(MIN_VISIBLE_LABEL_SIZE, SMALL_FONT_SIZE);
  const width = size / ctx.view.scale;
  const height = size / ctx.view.scale;

  return {
    x,
    y: ctx.world.y,
    width,
    height
  };
}

function intervalsOverlap(a, b) {
  return a.left < b.right && a.right > b.left;
}

function renderSections(ctx) {
  const { layout, colors, world } = ctx;
  const right = world.x + world.width;
  const sections = (Array.isArray(layout.sections) ? layout.sections : [])
    .filter((section) => section !== null && typeof section === 'object')
    .filter((section) => {
      const x = finiteNumber(section.position?.x, NaN);
      return Number.isFinite(x) && x >= world.x && x <= right;
    })
    .sort((a, b) => {
      const byX = finiteNumber(a.position?.x, 0) - finiteNumber(b.position?.x, 0);
      if (byX !== 0) {
        return byX;
      }
      const leftName = String(a.name ?? '');
      const rightName = String(b.name ?? '');
      return leftName < rightName ? -1 : leftName > rightName ? 1 : 0;
    });
  const lines = [];
  const entries = [];

  for (const section of sections) {
    const x = finiteNumber(section.position?.x, 0);
    const px = ctx.toX(x);
    lines.push(`<line x1="${round(px)}" y1="${round(ctx.content.y)}" x2="${round(px)}" y2="${round(ctx.content.y + ctx.content.height)}" stroke="${colors.muted}" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>`);

    const name = String(section.name ?? '');
    if (name.length === 0) {
      continue;
    }

    if (visibleBox(ctx, sectionLabelBox(ctx, x)) === null) {
      continue;
    }

    entries.push({ x, px, name });
  }

  // Sections that share a world x are merged into one label so the same
  // position never renders duplicate text on top of itself.
  const groups = [];
  for (const entry of entries) {
    const key = round(entry.x, 3);
    let group = groups.find((candidate) => candidate.key === key);

    if (group === undefined) {
      group = { key, px: entry.px, names: [] };
      groups.push(group);
    }

    if (!group.names.includes(entry.name)) {
      group.names.push(entry.name);
    }
  }

  const rowIntervals = [[], []];
  const labels = [];

  for (const group of groups) {
    const name = group.names.join(' / ');
    const width = estimateTextWidth(name, SMALL_FONT_SIZE);
    const clipRight = ctx.clip.x + ctx.clip.width;
    let left = group.px + 4;
    let intervalRight = left + width;

    if (intervalRight > clipRight) {
      intervalRight = group.px - 4;
      left = intervalRight - width;
    }

    const interval = { left, right: intervalRight };
    let row = 0;

    if (rowIntervals[0].some((existing) => intervalsOverlap(existing, interval))) {
      row = 1;

      if (rowIntervals[1].some((existing) => intervalsOverlap(existing, interval))) {
        const lastZero = rowIntervals[0].at(-1)?.right ?? -Infinity;
        const lastOne = rowIntervals[1].at(-1)?.right ?? -Infinity;
        row = lastZero <= lastOne ? 0 : 1;
      }
    }

    rowIntervals[row].push(interval);
    labels.push(label(ctx, name, group.px, ctx.content.y, {
      dx: 4,
      dy: SECTION_ROW_OFFSETS[row],
      size: SMALL_FONT_SIZE,
      fill: colors.text
    }));
  }

  return lines.join('') + labels.join('');
}

function rect(ctx, box, attributes) {
  const width = ctx.toWidth(box.width);
  const height = ctx.toHeight(box.height);

  if (!(width > 0) || !(height > 0)) {
    return '';
  }

  return `<rect x="${round(ctx.toX(box.x))}" y="${round(ctx.toY(box.y))}" width="${round(width)}" height="${round(height)}" ${attributes}/>`;
}

function renderSlope(ctx, tile) {
  const { colors } = ctx;
  const x = ctx.toX(tile.x);
  const y = ctx.toY(tile.y);
  const width = ctx.toWidth(tile.width);
  const height = ctx.toHeight(tile.height);

  if (!(width > 0) || !(height > 0)) {
    return '';
  }

  const inverted = tile.inverted === true;
  const bottom = y + height;
  const right = x + width;
  const wedge = inverted
    ? `${round(x)},${round(y)} ${round(right)},${round(bottom)} ${round(x)},${round(bottom)}`
    : `${round(x)},${round(bottom)} ${round(right)},${round(y)} ${round(right)},${round(bottom)}`;
  const surface = inverted
    ? `<line x1="${round(x)}" y1="${round(y)}" x2="${round(right)}" y2="${round(bottom)}" stroke="${colors.slopeSurface}" stroke-width="2" data-role="slope-surface"/>`
    : `<line x1="${round(x)}" y1="${round(bottom)}" x2="${round(right)}" y2="${round(y)}" stroke="${colors.slopeSurface}" stroke-width="2" data-role="slope-surface"/>`;
  const labelVisible = visibleBox(ctx, tile) !== null;

  return `<g>`
    + `<polygon points="${wedge}" fill="${colors.slope}" stroke="${colors.slopeStroke}" stroke-width="1" data-role="slope-wedge"/>`
    + surface
    + (labelVisible ? label(ctx, 'SLOPE', x + width / 2, y + height / 2, { anchor: 'middle', dx: 0, dy: 4, size: SMALL_FONT_SIZE }) : '')
    + '</g>';
}

function renderSpike(ctx, tile) {
  const { colors } = ctx;
  const x = ctx.toX(tile.x);
  const y = ctx.toY(tile.y);
  const width = ctx.toWidth(tile.width);
  const height = ctx.toHeight(tile.height);

  if (!(width > 0) || !(height > 0)) {
    return '';
  }

  const bottom = y + height;
  const teeth = Math.max(2, Math.min(7, Math.round(width / 16)));
  const step = width / teeth;
  const points = [];

  for (let index = 0; index < teeth; index += 1) {
    const left = x + index * step;
    points.push(`${round(left)},${round(bottom)}`);
    points.push(`${round(left + step / 2)},${round(y + height * 0.15)}`);
    points.push(`${round(left + step)},${round(bottom)}`);
  }

  const labelVisible = visibleBox(ctx, tile) !== null;

  return `<g>`
    + rect(ctx, tile, `fill="${colors.spike}" fill-opacity="0.35" stroke="${colors.spikeStroke}" stroke-width="1"`)
    + `<polygon points="${points.join(' ')}" fill="${colors.spike}" stroke="${colors.spikeStroke}" stroke-width="1"/>`
    + (labelVisible ? label(ctx, 'SPIKE', x + width / 2, y, { anchor: 'middle', dx: 0, dy: 12, size: SMALL_FONT_SIZE }) : '')
    + '</g>';
}

function renderLadder(ctx, tile) {
  const { colors } = ctx;
  const x = ctx.toX(tile.x);
  const y = ctx.toY(tile.y);
  const width = ctx.toWidth(tile.width);
  const height = ctx.toHeight(tile.height);

  if (!(width > 0) || !(height > 0)) {
    return '';
  }

  const rungCount = Math.max(2, Math.floor(tile.height * 2));
  const rungs = [];

  for (let index = 1; index < rungCount; index += 1) {
    const rungY = y + (height * index) / rungCount;
    rungs.push(`<line x1="${round(x)}" y1="${round(rungY)}" x2="${round(x + width)}" y2="${round(rungY)}" stroke="${colors.ladder}" stroke-width="1"/>`);
  }

  const labelVisible = visibleBox(ctx, tile) !== null;

  return `<g>`
    + rect(ctx, tile, `fill="${colors.ladder}" fill-opacity="0.16" stroke="${colors.ladder}" stroke-width="1"`)
    + rungs.join('')
    + (labelVisible ? label(ctx, 'LADDER', x + width / 2, y + height / 2, { anchor: 'middle', dx: 0, dy: 4, size: SMALL_FONT_SIZE }) : '')
    + '</g>';
}

function renderTile(ctx, tile) {
  const { colors } = ctx;
  const type = String(tile.type ?? '');

  if (type === 'decorative') {
    return rect(ctx, tile, `fill="${colors.decorative}" fill-opacity="0.07" stroke="${colors.decorative}" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"`);
  }

  if (type === 'pit') {
    const pxWidth = ctx.toWidth(tile.width);
    const pxHeight = ctx.toHeight(tile.height);
    const body = rect(ctx, tile, `fill="${colors.pit}" fill-opacity="0.2" stroke="${colors.pit}" stroke-width="1.5" stroke-dasharray="5 4"`);
    const labelVisible = visibleBox(ctx, tile) !== null;
    const text = labelVisible && pxWidth >= 96 && pxHeight >= 48
      ? label(ctx, 'PIT (deadly)', ctx.toX(tile.x) + pxWidth / 2, ctx.toY(tile.y) + pxHeight / 2, { anchor: 'middle', dx: 0, dy: 4, size: LABEL_FONT_SIZE, fill: colors.pit })
      : '';
    return body + text;
  }

  if (type === 'water') {
    const labelVisible = visibleBox(ctx, tile) !== null;
    return rect(ctx, tile, `fill="${colors.water}" fill-opacity="0.2" stroke="${colors.water}" stroke-width="1"`)
      + (labelVisible ? label(ctx, 'WATER', ctx.toX(tile.x) + ctx.toWidth(tile.width) / 2, ctx.toY(tile.y) + ctx.toHeight(tile.height) / 2, { anchor: 'middle', dx: 0, dy: 4, size: SMALL_FONT_SIZE, fill: colors.water }) : '');
  }

  if (type === 'ladder') {
    return renderLadder(ctx, tile);
  }

  if (type === 'slope') {
    return renderSlope(ctx, tile);
  }

  if (type === 'spike') {
    return renderSpike(ctx, tile);
  }

  if (type === 'platform') {
    return rect(ctx, tile, `fill="${colors.platform}" fill-opacity="0.85" stroke="${colors.platformStroke}" stroke-width="1"`);
  }

  if (type === 'wall') {
    return rect(ctx, tile, `fill="${colors.wall}" fill-opacity="0.95" stroke="${colors.wallStroke}" stroke-width="1"`);
  }

  if (TILE_TYPES.has(type)) {
    return '';
  }

  return rect(ctx, tile, `fill="${colors.muted}" fill-opacity="0.3" stroke="${colors.muted}" stroke-width="1"`);
}

function renderTiles(ctx) {
  const tiles = (Array.isArray(ctx.layout.tiles) ? ctx.layout.tiles : [])
    .filter((tile) => tile !== null && typeof tile === 'object');
  const isKnownType = (tile) => TILE_TYPES.has(String(tile.type ?? ''));
  const groups = [
    tiles.filter((tile) => tile.type === 'decorative'),
    tiles.filter((tile) => tile.type === 'pit'),
    tiles.filter((tile) => tile.type === 'water'),
    tiles.filter((tile) => tile.type === 'ladder'),
    tiles.filter((tile) => ['platform', 'wall', 'slope'].includes(tile.type) || !isKnownType(tile)),
    tiles.filter((tile) => tile.type === 'spike')
  ];

  return groups.flat().map((tile) => renderTile(ctx, tile)).join('');
}

function collectibleCenter(ctx, collectible) {
  return {
    cx: ctx.toX(collectible.x) + ctx.toWidth(collectible.width) / 2,
    cy: ctx.toY(collectible.y) + ctx.toHeight(collectible.height) / 2,
    size: Math.max(MIN_MARKER_SIZE, Math.min(ctx.toWidth(collectible.width), ctx.toHeight(collectible.height)) * 0.9)
  };
}

function renderCollectibleIcon(type, cx, cy, size, colors) {
  const half = size / 2;
  const color = colors.collectibles[type] ?? colors.muted;

  if (type === 'coin') {
    return `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(half)}" fill="${color}" stroke="#8a6d00" stroke-width="1"/>`
      + `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(half * 0.55)}" fill="none" stroke="#8a6d00" stroke-width="1"/>`;
  }

  if (type === 'ammo') {
    return `<rect x="${round(cx - half * 0.85)}" y="${round(cy - half * 0.7)}" width="${round(size * 0.85)}" height="${round(size * 0.7)}" rx="1" fill="${color}" stroke="#7a3d00" stroke-width="1"/>`;
  }

  if (type === 'apple') {
    return `<circle cx="${round(cx)}" cy="${round(cy + 1)}" r="${round(half * 0.8)}" fill="${color}" stroke="#8a2f47" stroke-width="1"/>`
      + `<line x1="${round(cx)}" y1="${round(cy - half * 0.7)}" x2="${round(cx + 2)}" y2="${round(cy - half - 2)}" stroke="#69db7c" stroke-width="1.5"/>`;
  }

  if (type === 'heart') {
    const r = half;
    return `<path d="M ${round(cx)} ${round(cy + r * 0.75)} C ${round(cx - r * 1.1)} ${round(cy - r * 0.1)} ${round(cx - r * 0.55)} ${round(cy - r * 0.95)} ${round(cx)} ${round(cy - r * 0.35)} C ${round(cx + r * 0.55)} ${round(cy - r * 0.95)} ${round(cx + r * 1.1)} ${round(cy - r * 0.1)} ${round(cx)} ${round(cy + r * 0.75)} Z" fill="${color}" stroke="#8a2f2f" stroke-width="1"/>`;
  }

  if (type === 'moon') {
    const r = half;
    return `<path d="M ${round(cx)} ${round(cy - r)} A ${round(r)} ${round(r)} 0 1 0 ${round(cx)} ${round(cy + r)} A ${round(r * 0.62)} ${round(r * 0.62)} 0 1 1 ${round(cx)} ${round(cy - r)} Z" fill="${color}" stroke="#6b5ca5" stroke-width="1"/>`;
  }

  if (type === 'sun') {
    const rays = [];

    for (let index = 0; index < 8; index += 1) {
      const angle = (index * Math.PI) / 4;
      rays.push(
        `<line x1="${round(cx + Math.cos(angle) * half * 0.7)}" y1="${round(cy + Math.sin(angle) * half * 0.7)}" x2="${round(cx + Math.cos(angle) * half)}" y2="${round(cy + Math.sin(angle) * half)}" stroke="${color}" stroke-width="1.5"/>`
      );
    }

    return `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(half * 0.52)}" fill="${color}" stroke="#9a7b00" stroke-width="1"/>`
      + rays.join('');
  }

  if (type === 'earth') {
    return `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(half * 0.8)}" fill="${color}" stroke="#2b6b3a" stroke-width="1"/>`
      + `<path d="M ${round(cx - half * 0.8)} ${round(cy - half * 0.25)} Q ${round(cx)} ${round(cy + half * 0.15)} ${round(cx + half * 0.8)} ${round(cy - half * 0.25)}" fill="none" stroke="#2b6b3a" stroke-width="1"/>`
      + `<path d="M ${round(cx - half * 0.7)} ${round(cy + half * 0.35)} Q ${round(cx)} ${round(cy + half * 0.6)} ${round(cx + half * 0.7)} ${round(cy + half * 0.35)}" fill="none" stroke="#2b6b3a" stroke-width="1"/>`;
  }

  return `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(half * 0.7)}" fill="${color}" stroke="${colors.text}" stroke-width="1"/>`;
}

function renderDiamond(cx, cy, size, color) {
  const half = size / 2;
  return `<polygon points="${round(cx)},${round(cy - half)} ${round(cx + half)},${round(cy)} ${round(cx)},${round(cy + half)} ${round(cx - half)},${round(cy)}" fill="${color}" stroke="#ffffff" stroke-width="1"/>`;
}

function renderKeyIcon(cx, cy, size, color) {
  const half = size / 2;
  return `<circle cx="${round(cx - half * 0.55)}" cy="${round(cy)}" r="${round(half * 0.32)}" fill="none" stroke="${color}" stroke-width="2"/>`
    + `<line x1="${round(cx - half * 0.2)}" y1="${round(cy)}" x2="${round(cx + half)}" y2="${round(cy)}" stroke="${color}" stroke-width="2"/>`
    + `<line x1="${round(cx + half * 0.45)}" y1="${round(cy)}" x2="${round(cx + half * 0.45)}" y2="${round(cy + half * 0.5)}" stroke="${color}" stroke-width="2"/>`
    + `<line x1="${round(cx + half * 0.8)}" y1="${round(cy)}" x2="${round(cx + half * 0.8)}" y2="${round(cy + half * 0.4)}" stroke="${color}" stroke-width="2"/>`;
}

function renderNoteIcon(cx, cy, size, color) {
  const half = size / 2;
  return `<ellipse cx="${round(cx - half * 0.35)}" cy="${round(cy + half * 0.55)}" rx="${round(half * 0.42)}" ry="${round(half * 0.3)}" fill="${color}"/>`
    + `<line x1="${round(cx + half * 0.02)}" y1="${round(cy + half * 0.55)}" x2="${round(cx + half * 0.02)}" y2="${round(cy - half)}" stroke="${color}" stroke-width="2"/>`
    + `<line x1="${round(cx + half * 0.02)}" y1="${round(cy - half)}" x2="${round(cx + half * 0.7)}" y2="${round(cy - half * 0.65)}" stroke="${color}" stroke-width="2"/>`;
}

function renderCollectibles(ctx) {
  const { colors } = ctx;
  const showEntityLabels = entityLabelsVisible(ctx);
  const collectibles = (Array.isArray(ctx.layout.collectibles) ? ctx.layout.collectibles : [])
    .filter((collectible) => collectible !== null && typeof collectible === 'object');
  let noteCount = 0;

  return collectibles.map((collectible) => {
    const type = String(collectible.type ?? '');
    const { cx, cy, size } = collectibleCenter(ctx, collectible);
    const labelVisible = entityLabelVisible(ctx, collectible);

    if (type === 'exit-door') {
      return renderDiamond(cx, cy, Math.max(24, size), colors.exit)
        + (labelVisible
          ? placeLabel(ctx, 'EXIT', cx, cy, { dy: 4, size: LABEL_FONT_SIZE, fill: colors.exit, weight: 'bold', prefer: 'below' })
          : '');
    }

    if (type === 'big-fruit') {
      const name = typeof collectible.collectible === 'string' && collectible.collectible.length > 0
        ? `BIG FRUIT ${collectible.collectible}`
        : 'BIG FRUIT';
      return renderDiamond(cx, cy, Math.max(18, size), colors.collectibles['big-fruit'])
        + (showEntityLabels && labelVisible
          ? placeLabel(ctx, name, cx, cy, { dy: 4, size: SMALL_FONT_SIZE, fill: colors.collectibles['big-fruit'], prefer: 'above' })
          : '');
    }

    if (type === 'key') {
      const keyName = typeof collectible['key-name'] === 'string' && collectible['key-name'].length > 0
        ? `KEY ${collectible['key-name']}`
        : 'KEY';
      return renderKeyIcon(cx, cy, Math.max(16, size), colors.collectibles.key)
        + (showEntityLabels && labelVisible
          ? placeLabel(ctx, keyName, cx + Math.max(10, size / 2), cy, { dy: 4, size: SMALL_FONT_SIZE, fill: colors.collectibles.key })
          : '');
    }

    if (type === 'musical-note') {
      noteCount += 1;
      const order = Number.isFinite(collectible['note-order']) ? collectible['note-order'] : noteCount;
      return renderNoteIcon(cx, cy, Math.max(16, size), colors.collectibles['musical-note'])
        + (showEntityLabels && labelVisible
          ? placeLabel(ctx, `NOTE ${order}`, cx + Math.max(10, size / 2), cy, { dy: 4, size: SMALL_FONT_SIZE, fill: colors.collectibles['musical-note'] })
          : '');
    }

    if (ICON_COLLECTIBLES.has(type)) {
      return renderCollectibleIcon(type, cx, cy, size, colors);
    }

    return renderCollectibleIcon('unknown', cx, cy, size, colors);
  }).join('');
}

function enemyShapePoints(cx, cy, radius, sides) {
  const points = [];

  for (let index = 0; index < sides; index += 1) {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / sides;
    points.push(`${round(cx + Math.cos(angle) * radius)},${round(cy + Math.sin(angle) * radius)}`);
  }

  return points.join(' ');
}

function renderEnemy(ctx, enemy) {
  const { colors } = ctx;
  const pxWidth = ctx.toWidth(enemy.width);
  const pxHeight = ctx.toHeight(enemy.height);
  const cx = ctx.toX(enemy.x) + pxWidth / 2;
  const cy = ctx.toY(enemy.y) + pxHeight / 2;
  const radius = Math.max(9, Math.min(pxWidth, pxHeight) * 0.42);
  const shape = String(enemy.type ?? '').split('-')[0];
  const sides = ENEMY_SIDES[shape] ?? 3;
  const isBoss = enemy.boss === true || enemy.behavior === 'boss';
  const behavior = isBoss ? 'boss' : String(enemy.behavior ?? 'patrol');
  const fill = colors.enemy[behavior] ?? colors.enemy.patrol;
  const letter = ENEMY_LETTERS[behavior] ?? ENEMY_LETTERS.patrol;
  const points = enemyShapePoints(cx, cy, radius, sides);
  const bossLabel = isBoss && entityLabelVisible(ctx, enemy)
    ? placeLabel(ctx, 'BOSS', cx + radius, cy - radius, { dy: 0, size: SMALL_FONT_SIZE, fill: colors.enemy.boss, weight: 'bold' })
    : '';

  return `<g>`
    + `<polygon points="${points}" fill="${fill}" stroke="#ffffff" stroke-width="1.5"/>`
    + `<text x="${round(cx)}" y="${round(cy + 3.5)}" font-family="${FONT_FAMILY}" font-size="10" font-weight="bold" fill="#ffffff" text-anchor="middle">${letter}</text>`
    + bossLabel
    + '</g>';
}

function renderTeleporters(ctx) {
  const { colors } = ctx;
  const showEntityLabels = entityLabelsVisible(ctx);
  const parts = [];
  const markers = (Array.isArray(ctx.layout.markers) ? ctx.layout.markers : [])
    .filter((marker) => marker !== null && typeof marker === 'object');
  const teleporters = (Array.isArray(ctx.layout.teleporters) ? ctx.layout.teleporters : [])
    .filter((teleporter) => teleporter !== null && typeof teleporter === 'object');

  for (const marker of markers) {
    const cx = ctx.toX(marker.x) + ctx.toWidth(marker.width) / 2;
    const cy = ctx.toY(marker.y) + ctx.toHeight(marker.height) / 2;
    const size = Math.max(14, Math.min(ctx.toWidth(marker.width), ctx.toHeight(marker.height)) * 0.8);
    const half = size / 2;
    const markerName = typeof marker.name === 'string' ? marker.name : '';
    const text = markerName.length === 0 || markerName === 'unnamed' ? 'MARKER' : markerName;
    parts.push(
      `<line x1="${round(cx - half)}" y1="${round(cy)}" x2="${round(cx + half)}" y2="${round(cy)}" stroke="${colors.marker}" stroke-width="2"/>`,
      `<line x1="${round(cx)}" y1="${round(cy - half)}" x2="${round(cx)}" y2="${round(cy + half)}" stroke="${colors.marker}" stroke-width="2"/>`,
      `<text x="${round(cx)}" y="${round(cy + 3.5)}" font-family="${FONT_FAMILY}" font-size="10" font-weight="bold" fill="${colors.marker}" text-anchor="middle">M</text>`,
      showEntityLabels && entityLabelVisible(ctx, marker) ? placeLabel(ctx, text, cx + half, cy, { dy: 4, size: SMALL_FONT_SIZE, fill: colors.marker }) : ''
    );
  }

  for (const teleporter of teleporters) {
    const cx = ctx.toX(teleporter.x) + ctx.toWidth(teleporter.width) / 2;
    const cy = ctx.toY(teleporter.y) + ctx.toHeight(teleporter.height) / 2;
    const size = Math.max(16, Math.min(ctx.toWidth(teleporter.width), ctx.toHeight(teleporter.height)) * 0.8);
    const half = size / 2;
    const target = teleporter['target-marker'] ?? teleporter['target-stage'] ?? null;
    const teleporterName = typeof teleporter.name === 'string' ? teleporter.name : '';
    const hasName = teleporterName.length > 0 && teleporterName !== 'unnamed';
    let text;

    if (hasName) {
      text = target === null ? teleporterName : `${teleporterName} -> ${target}`;
    } else if (target !== null) {
      text = `TELEPORTER -> ${target}`;
    } else {
      text = 'TELEPORTER';
    }

    parts.push(
      `<rect x="${round(cx - half)}" y="${round(cy - half)}" width="${round(size)}" height="${round(size)}" fill="${colors.teleporter}" fill-opacity="0.25" stroke="${colors.teleporter}" stroke-width="2"/>`,
      `<text x="${round(cx)}" y="${round(cy + 3.5)}" font-family="${FONT_FAMILY}" font-size="10" font-weight="bold" fill="${colors.teleporter}" text-anchor="middle">T</text>`,
      showEntityLabels && entityLabelVisible(ctx, teleporter) ? placeLabel(ctx, text, cx + half, cy, { dy: 4, size: SMALL_FONT_SIZE, fill: colors.teleporter }) : ''
    );
  }

  return parts.join('');
}

function renderSpawn(ctx) {
  const { colors } = ctx;
  const playerSize = finiteNumber(ctx.layout.playerSize, 1);
  const spawns = (Array.isArray(ctx.layout.spawns) ? ctx.layout.spawns : [])
    .filter((spawn) => spawn !== null && typeof spawn === 'object');

  return spawns.map((spawn) => {
    const box = spawnPlayerBox(spawn, playerSize);
    const x = ctx.toX(box.x);
    const y = ctx.toY(box.y);
    const width = ctx.toWidth(box.width);
    const height = ctx.toHeight(box.height);
    const cx = x + width / 2;
    const cy = y + height / 2;

    return `<g>`
      + `<rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" fill="${colors.spawn}" fill-opacity="0.15" stroke="${colors.spawn}" stroke-width="1.5"/>`
      + `<polygon points="${round(cx)},${round(y)} ${round(x + width * 0.8)},${round(y + height * 0.75)} ${round(cx)},${round(y + height * 0.5)} ${round(x + width * 0.2)},${round(y + height * 0.75)}" fill="${colors.spawn}"/>`
      + (entityLabelVisible(ctx, box)
        ? placeLabel(ctx, 'SPAWN', x + width, y, { dy: 10, size: LABEL_FONT_SIZE, fill: colors.spawn, weight: 'bold' })
        : '')
      + '</g>';
  }).join('');
}

function renderCheckpoints(ctx) {
  const { colors } = ctx;
  const checkpoints = (Array.isArray(ctx.layout.checkpoints) ? ctx.layout.checkpoints : [])
    .filter((checkpoint) => checkpoint !== null && typeof checkpoint === 'object');

  return checkpoints.map((checkpoint, index) => {
    const x = ctx.toX(checkpoint.x);
    const y = ctx.toY(checkpoint.y);
    const activation = rect(ctx, { x: checkpoint.x, y: checkpoint.y - 1, width: 1, height: 1 }, `fill="${colors.checkpoint}" fill-opacity="0.08" stroke="${colors.checkpoint}" stroke-width="1" stroke-dasharray="3 3"`);
    const poleTop = ctx.toY(checkpoint.y - 0.9);
    const poleBottom = ctx.toY(checkpoint.y + 0.9);
    const flagWidth = ctx.toWidth(0.7);
    const box = {
      x: finiteNumber(checkpoint.x, 0),
      y: finiteNumber(checkpoint.y, 0),
      width: finiteNumber(checkpoint.width, 1),
      height: finiteNumber(checkpoint.height, 1)
    };

    return `<g>`
      + activation
      + `<line x1="${round(x)}" y1="${round(poleBottom)}" x2="${round(x)}" y2="${round(poleTop)}" stroke="${colors.checkpoint}" stroke-width="2"/>`
      + `<polygon points="${round(x)},${round(poleTop)} ${round(x + flagWidth)},${round(poleTop + ctx.toHeight(0.25))} ${round(x)},${round(poleTop + ctx.toHeight(0.5))}" fill="${colors.checkpoint}"/>`
      + (entityLabelVisible(ctx, box)
        ? placeLabel(ctx, `CHECKPOINT ${index + 1}`, x + flagWidth, poleTop, { dy: 10, size: SMALL_FONT_SIZE, fill: colors.checkpoint })
        : '')
      + '</g>';
  }).join('');
}

function renderFindings(ctx, findings) {
  const { colors } = ctx;
  const groups = new Map();

  findings.forEach((finding, index) => {
    const position = finding?.evidence?.position;
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      return;
    }

    const key = `${round(position.x, 3)},${round(position.y, 3)}`;
    const group = groups.get(key) ?? { x: position.x, y: position.y, items: [] };
    group.items.push({ finding, number: index + 1 });
    groups.set(key, group);
  });

  const ordered = [...groups.values()].sort((a, b) => (a.x - b.x) || (a.y - b.y) || (a.items[0].number - b.items[0].number));

  return ordered.map((group) => {
    const first = group.items[0];
    const severity = first.finding?.severity === 'warning' ? 'warning' : 'error';
    const prefix = severity === 'warning' ? 'W' : 'E';
    const text = group.items.length > 1 ? `${prefix}${first.number} x${group.items.length}` : `${prefix}${first.number}`;
    const cx = ctx.toX(group.x);
    const cy = ctx.toY(group.y);
    const boxWidth = estimateTextWidth(text, SMALL_FONT_SIZE) + 8;
    const boxHeight = SMALL_FONT_SIZE + 5;
    const rightEdge = ctx.clip.x + ctx.clip.width;
    let boxX = cx + 5;
    let boxY = cy - boxHeight - 4;

    if (boxX + boxWidth > rightEdge) {
      boxX = cx - boxWidth - 5;
    }

    if (boxY < ctx.clip.y) {
      boxY = cy + 5;
    }

    return `<rect x="${round(boxX)}" y="${round(boxY)}" width="${round(boxWidth)}" height="${boxHeight}" rx="3" fill="${colors.finding}" stroke="#ffffff" stroke-width="1"/>`
      + `<text x="${round(boxX + boxWidth / 2)}" y="${round(boxY + boxHeight - 4)}" font-family="${FONT_FAMILY}" font-size="${SMALL_FONT_SIZE}" font-weight="bold" fill="#ffffff" text-anchor="middle">${escapeXml(text)}</text>`;
  }).join('');
}

function renderAxes(ctx) {
  const { colors, world } = ctx;
  const step = gridStep(ctx.view.scale);
  const parts = [];
  const right = world.x + world.width;
  const bottom = world.y + world.height;

  for (let x = Math.ceil(world.x / step) * step; x <= right; x += step) {
    const px = ctx.toX(x);
    parts.push(
      `<text x="${round(px)}" y="${round(ctx.content.y - 5)}" font-family="${FONT_FAMILY}" font-size="${SMALL_FONT_SIZE}" fill="${colors.muted}" text-anchor="middle">${formatNumber(x)}</text>`
    );
  }

  for (let y = Math.ceil(world.y / step) * step; y <= bottom; y += step) {
    const py = ctx.toY(y);
    parts.push(
      `<text x="${round(ctx.content.x - 6)}" y="${round(py + 3)}" font-family="${FONT_FAMILY}" font-size="${SMALL_FONT_SIZE}" fill="${colors.muted}" text-anchor="end">${formatNumber(y)}</text>`
    );
  }

  return parts.join('');
}

function renderFooter(ctx, findings) {
  const { colors, view } = ctx;
  const width = view.pixelWidth;
  const height = view.pixelHeight;

  return `<text x="${LEGEND_ORIGIN_X}" y="${round(height - 9)}" font-family="${FONT_FAMILY}" font-size="${SMALL_FONT_SIZE}" fill="${colors.muted}">${escapeXml(ctx.layout.id)} | ${view.kind} | ${findings.length} static findings</text>`
    + `<text x="${round(width - LEGEND_ORIGIN_X)}" y="${round(height - 9)}" font-family="${FONT_FAMILY}" font-size="${SMALL_FONT_SIZE}" fill="${colors.muted}" text-anchor="end">${
      findings.filter((finding) => finding?.severity === 'error').length
    } errors / ${findings.filter((finding) => finding?.severity === 'warning').length} warnings</text>`;
}

export function renderStageView({ layout, view, findings = [], legend = {} } = {}) {
  if (layout === null || typeof layout !== 'object' || Array.isArray(layout)) {
    throw new TypeError('layout must be an object');
  }

  if (typeof layout.id !== 'string' || layout.id.length === 0) {
    throw new TypeError('layout.id must be a non-empty string');
  }

  validateView(view);

  const colors = resolveColors(legend);
  const ctx = createContext({ layout, view, colors });
  const sortedFindings = Array.isArray(findings) ? findings : [];
  const clipId = 'stage-map-plot-clip';
  const parts = [];

  parts.push(`<rect x="0" y="0" width="${round(view.pixelWidth)}" height="${round(view.pixelHeight)}" fill="${colors.background}"/>`);
  parts.push(renderHeader(ctx, sortedFindings));
  parts.push(
    `<defs><clipPath id="${clipId}"><rect x="${round(ctx.clip.x)}" y="${round(ctx.clip.y)}" width="${round(ctx.clip.width)}" height="${round(ctx.clip.height)}"/></clipPath></defs>`
  );
  parts.push(
    `<rect x="${round(ctx.content.x)}" y="${round(ctx.content.y)}" width="${round(ctx.clip.width)}" height="${round(ctx.clip.height)}" fill="${colors.plot}"/>`
  );
  parts.push(`<g clip-path="url(#${clipId})">`);
  parts.push(renderGrid(ctx));
  parts.push(renderTiles(ctx));
  parts.push(renderTeleporters(ctx));
  parts.push(renderCheckpoints(ctx));
  parts.push(renderSpawn(ctx));
  parts.push(
    (Array.isArray(layout.enemies) ? layout.enemies : [])
      .filter((enemy) => enemy !== null && typeof enemy === 'object')
      .map((enemy) => renderEnemy(ctx, enemy))
      .join('')
  );
  parts.push(renderCollectibles(ctx));
  parts.push(renderSections(ctx));
  // Every important label is emitted in one overlay after all geometry and
  // icons, so a later icon can never cover an earlier label. Order inside the
  // overlay is the placement order, which keeps the SVG deterministic.
  parts.push(ctx.labels.join(''));
  parts.push(renderFindings(ctx, sortedFindings));
  parts.push('</g>');
  parts.push(renderAxes(ctx));
  parts.push(renderFooter(ctx, sortedFindings));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${round(view.pixelWidth)}" height="${round(view.pixelHeight)}" viewBox="0 0 ${round(view.pixelWidth)} ${round(view.pixelHeight)}" font-family="${FONT_FAMILY}" role="img" aria-label="${escapeXml(`Stage map for ${layout.id}`)}">`
    + `<title>${escapeXml(`Stage map: ${layout.id}`)}</title>`
    + parts.join('')
    + '</svg>';
}
