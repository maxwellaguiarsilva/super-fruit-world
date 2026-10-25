import { describe, expect, test } from 'bun:test';

import {
  CHROME,
  computeChunkContentBounds,
  computeChunks,
  computeStageBounds
} from '../scripts/stage-analysis/chunks.js';
import { renderStageView, estimateTextWidth, TEXT_WIDTH_FACTOR } from '../scripts/stage-analysis/render.js';
import {
  CliError,
  buildStageIndex,
  buildStageManifest,
  parseArguments,
  resolveOutputDirectory
} from '../scripts/export-stage-map.js';

function zeroBox() {
  return { x: 0, y: 0, width: 0, height: 0 };
}

function baseLayout(overrides = {}) {
  return {
    id: 'test-stage',
    file: 'data/stages/test-stage.json',
    playerSize: 1,
    sections: [],
    tiles: [],
    collectibles: [],
    enemies: [],
    spawns: [],
    checkpoints: [],
    teleporters: [],
    markers: [],
    other: [],
    tileBounds: zeroBox(),
    sectionBounds: zeroBox(),
    ...overrides
  };
}

function section(name, x, y, width, height) {
  return {
    name,
    parent: 'root',
    position: { x, y },
    localPosition: { x, y },
    size: { width, height },
    objects: []
  };
}

function tile(type, x, y, width = 1, height = 1, extra = {}) {
  return {
    kind: 'tile',
    type,
    section: 'main',
    x,
    y,
    width,
    height,
    solid: !['decorative', 'pit'].includes(type),
    deadly: type === 'spike',
    liquid: type === 'water',
    climbable: type === 'ladder',
    slope: type === 'slope',
    variant: null,
    inverted: false,
    angle: null,
    ...extra
  };
}

function collectible(type, x, y, width, height, extra = {}) {
  return {
    kind: 'collectible',
    type,
    section: 'main',
    x,
    y,
    width,
    height,
    solid: false,
    deadly: false,
    liquid: false,
    climbable: false,
    slope: false,
    variant: null,
    inverted: false,
    angle: null,
    collectible: null,
    'key-name': null,
    'note-order': null,
    ...extra
  };
}

function enemy(type, x, y, behavior, extra = {}) {
  return {
    kind: 'enemy',
    type,
    section: 'main',
    x,
    y,
    width: 1,
    height: 1,
    solid: false,
    deadly: false,
    liquid: false,
    climbable: false,
    slope: false,
    variant: null,
    inverted: false,
    angle: null,
    boss: false,
    behavior,
    ...extra
  };
}

function teleporter(x, y, extra = {}) {
  return {
    kind: 'teleporter',
    type: 'inner-teleporter',
    section: 'main',
    x,
    y,
    width: 1,
    height: 1,
    name: 'gate',
    'target-marker': null,
    'target-stage': null,
    'required-key': null,
    ...extra
  };
}

function marker(x, y, name) {
  return {
    kind: 'marker',
    type: 'teleporter-marker',
    section: 'main',
    x,
    y,
    width: 1,
    height: 1,
    name
  };
}

function richLayout() {
  return baseLayout({
    sections: [
      section('start & <gate>', 0, 0, 12, 8),
      section('second', 20, 0, 10, 8)
    ],
    tiles: [
      tile('platform', 0, 0, 12, 1),
      tile('wall', 12, 0, 1, 3),
      tile('slope', 4, -1, 2, 1),
      tile('slope', 6, -1, 2, 1, { inverted: true }),
      tile('spike', 8, 0, 2, 1),
      tile('pit', 14, 0, 6, 4),
      tile('water', 2, 1, 3, 2),
      tile('ladder', 18, 0, 1, 3),
      tile('decorative', 0, -2, 12, 1)
    ],
    spawns: [{
      kind: 'spawn',
      type: 'player-spawn',
      section: 'start & <gate>',
      x: 1,
      y: 0,
      width: 1,
      height: 1
    }],
    checkpoints: [
      { kind: 'checkpoint', type: 'checkpoint', section: 'main', x: 10, y: 0, width: 1, height: 1 },
      { kind: 'checkpoint', type: 'checkpoint', section: 'main', x: 22, y: 0, width: 1, height: 1 }
    ],
    collectibles: [
      collectible('coin', 1, -1, 0.5, 0.5),
      collectible('ammo', 2, -1, 0.5, 0.5),
      collectible('apple', 3, -1, 0.5, 0.5),
      collectible('heart', 4, -1, 0.5, 0.5),
      collectible('moon', 5, -1, 0.5, 0.5),
      collectible('sun', 6, -1, 0.5, 0.5),
      collectible('earth', 7, -1, 0.5, 0.5),
      collectible('musical-note', 16, -1, 0.5, 0.5, { 'note-order': 1 }),
      collectible('key', 17, -1, 0.5, 0.5, { 'key-name': 'red & <key>' }),
      collectible('big-fruit', 24, -1, 2, 2, { collectible: 'strawberry' }),
      collectible('exit-door', 26, -1, 1.5, 1.5)
    ],
    enemies: [
      enemy('triangle-patrol', 2, -1, 'patrol'),
      enemy('square-shooter', 6, -1, 'shooter'),
      enemy('pentagon-flyer', 9, -1, 'flyer'),
      enemy('hexagon-patrol', 23, -1, 'patrol', { boss: true })
    ],
    teleporters: [teleporter(13, -1, { name: 'gate & <x>', 'target-marker': 'marker-a' })],
    markers: [marker(25, -1, 'marker-a')]
  });
}

function wideLayout() {
  return baseLayout({
    sections: [section('wide', 0, 0, 200, 10)],
    tiles: [tile('platform', 0, 0, 200, 1)]
  });
}

function tallLayout(tiles) {
  return baseLayout({
    sections: [section('tall', 0, 0, 200, 36)],
    tiles
  });
}

function manualView(world, scale = 24) {
  return {
    kind: 'chunk',
    world,
    scale,
    pixelWidth: Math.max(
      CHROME.minViewWidth,
      Math.ceil(CHROME.axisLeft + CHROME.right + world.width * scale)
    ),
    pixelHeight: Math.ceil(
      CHROME.header + CHROME.axisTop + CHROME.footer + world.height * scale
    )
  };
}

function overviewOf(layout, options = {}) {
  const bounds = computeStageBounds(layout);
  const views = computeChunks({
    layout,
    bounds,
    scale: options.scale ?? 24,
    maxSize: options.maxSize ?? 1400
  });

  return { bounds, views, svg: renderStageView({ layout, view: views.overview }) };
}

// Mirrors the clip rectangle createContext builds, so tests can assert that a
// label rectangle stays inside the plotted area.
function plotClip(view) {
  const x = CHROME.axisLeft;
  const y = CHROME.header + CHROME.axisTop;

  return {
    x,
    y,
    width: Math.max(0, Math.min(view.world.width * view.scale, view.pixelWidth - x)),
    height: Math.max(0, Math.min(view.world.height * view.scale, view.pixelHeight - y))
  };
}

// Returns only the clipped plot content, so legend and axis text cannot be
// mistaken for object glyphs or labels.
function plotGroup(svg) {
  const marker = '<g clip-path="url(#stage-map-plot-clip)">';
  const start = svg.indexOf(marker);

  if (start === -1) {
    return '';
  }

  const tagPattern = /<g\b|<\/g>/g;
  tagPattern.lastIndex = start + marker.length;
  let depth = 1;

  for (let match = tagPattern.exec(svg); match !== null; match = tagPattern.exec(svg)) {
    depth += match[0] === '</g>' ? -1 : 1;

    if (depth === 0) {
      return svg.slice(start, match.index);
    }
  }

  return '';
}

// Rebuilds label rectangles from the emitted SVG using the same estimate the
// renderer uses, so the assertions test the rectangles that drove placement.
function labelRects(svg) {
  const pattern = /<text x="([^"]+)" y="([^"]+)"[^>]*font-size="([^"]+)"[^>]*text-anchor="([^"]+)">([^<]*)<\/text>/g;
  const rects = [];

  for (const match of svg.matchAll(pattern)) {
    const [, x, y, size, anchor, text] = match;
    const fontSize = Number(size);
    const width = estimateTextWidth(text, fontSize);
    const height = fontSize + 2;
    const baseline = Number(y);
    let left = Number(x);

    if (anchor === 'end') {
      left -= width;
    } else if (anchor === 'middle') {
      left -= width / 2;
    }

    rects.push({
      text,
      left,
      right: left + width,
      top: baseline - fontSize * 0.8,
      bottom: baseline - fontSize * 0.8 + height
    });
  }

  return rects;
}

// Returns the on-screen bounds of the first polygon painted with the given
// fill, so a test can compare a label rectangle against the icon it belongs to
// instead of against a hand-copied coordinate.
function polygonBounds(svg, fill) {
  const match = svg.match(new RegExp(`<polygon points="([^"]+)" fill="${fill}"`));

  if (match === null) {
    return null;
  }

  const points = [...match[1].matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)]
    .map(([, x, y]) => ({ x: Number(x), y: Number(y) }));

  if (points.length === 0) {
    return null;
  }

  return {
    left: Math.min(...points.map((point) => point.x)),
    right: Math.max(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
    bottom: Math.max(...points.map((point) => point.y))
  };
}

function rectInsidePlot(rect, clip) {
  return rect.left >= clip.x
    && rect.right <= clip.x + clip.width
    && rect.top >= clip.y
    && rect.bottom <= clip.y + clip.height;
}

function rectsIntersect(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function lastMatchIndex(source, pattern) {
  let last = -1;

  for (const match of source.matchAll(pattern)) {
    last = match.index;
  }

  return last;
}

function checkpoint(x, y = 0) {
  return { kind: 'checkpoint', type: 'checkpoint', section: 'main', x, y, width: 1, height: 1 };
}

// Mirrors the strawberry-fields "exit-plateau" band seen in chunk-04: the big
// fruit, the exit door and the special teleporter sit a few units apart at the
// right edge of the view.
function exitPlateauLayout() {
  return baseLayout({
    sections: [section('exit-plateau', 230, -22, 15, 8)],
    tiles: [tile('platform', 230, -22, 15, 1)],
    collectibles: [
      collectible('big-fruit', 235, -23.5, 0.5, 0.5, { collectible: 'strawberry' }),
      collectible('exit-door', 240, -23, 0.5, 0.5)
    ],
    teleporters: [teleporter(243, -23, { name: 'to-world-map', 'target-stage': 'map' })]
  });
}

const EXIT_PLATEAU_VIEW = { x: 216, y: -24, width: 29, height: 6 };

// The exit cluster reduced to the two icons under test. The teleporter is
// dropped because its name claims the band next to the exit diamond, which is
// the separate concern covered by the cluster test above.
function sideBySideExitLayout() {
  return { ...exitPlateauLayout(), teleporters: [] };
}

// The chunk-04 fixture starts the plot 18 px above the big fruit center, which
// is tighter than a real chunk: computeChunks pads two world units above the
// content, and an "above" label needs a bit more than those 18 px. This view
// keeps the same right edge and gives the cluster production-like headroom so
// the vertical candidates can actually win.
const SIDE_BY_SIDE_VIEW = { x: 216, y: -26, width: 29, height: 8 };

describe('computeChunks', () => {
  test('overview fits inside maxSize and shows all bounds', () => {
    const bounds = { x: 0, y: 0, width: 200, height: 40 };
    const { overview } = computeChunks({ bounds, scale: 24, maxSize: 1400 });

    expect(overview.kind).toBe('overview');
    expect(overview.world).toEqual(bounds);
    expect(overview.scale).toBeLessThan(24);
    expect(overview.scale).toBeGreaterThanOrEqual(2);
    expect(overview.pixelWidth).toBeLessThanOrEqual(1400);
    expect(overview.pixelHeight).toBeLessThanOrEqual(1400);
  });

  test('wide stage splits into row-major chunks with clamped edges', () => {
    const bounds = { x: 0, y: 0, width: 200, height: 40 };
    const { chunks } = computeChunks({ bounds, scale: 24, maxSize: 1400 });

    expect(chunks).toHaveLength(4);
    expect(chunks.map((chunk) => chunk.world.x)).toEqual([0, 54, 108, 162]);
    expect(chunks.map((chunk) => chunk.world.width)).toEqual([56, 56, 56, 38]);
    expect(chunks.every((chunk) => chunk.world.y === 0)).toBe(true);
    expect(chunks.every((chunk) => chunk.kind === 'chunk')).toBe(true);
  });

  test('interior overlap is two units and clamped to bounds', () => {
    const bounds = { x: -10, y: 5, width: 120, height: 120 };
    const { chunks } = computeChunks({ bounds, scale: 24, maxSize: 1400 });
    const first = chunks[0];
    const second = chunks[1];

    expect(second.world.x - (first.world.x + first.world.width)).toBe(-2);
    expect(chunks.every((chunk) => chunk.world.x >= bounds.x)).toBe(true);
    expect(chunks.every((chunk) => chunk.world.y >= bounds.y)).toBe(true);
    expect(
      chunks.every((chunk) => chunk.world.x + chunk.world.width <= bounds.x + bounds.width)
    ).toBe(true);
    expect(
      chunks.every((chunk) => chunk.world.y + chunk.world.height <= bounds.y + bounds.height)
    ).toBe(true);
    expect(chunks.at(-1).world.x + chunks.at(-1).world.width).toBe(bounds.x + bounds.width);
    expect(chunks.at(-1).world.y + chunks.at(-1).world.height).toBe(bounds.y + bounds.height);
  });

  test('rows are ordered top-to-bottom and columns left-to-right', () => {
    const bounds = { x: 0, y: 0, width: 120, height: 120 };
    const { chunks } = computeChunks({ bounds, scale: 24, maxSize: 1400 });
    const positions = chunks.map((chunk) => [chunk.world.y, chunk.world.x]);
    const expected = [...positions].sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));

    expect(chunks).toHaveLength(9);
    expect(positions).toEqual(expected);
    expect(positions.slice(0, 3)).toEqual([[0, 0], [0, 54], [0, 108]]);
  });

  test('no chunks are generated when the stage fits', () => {
    const bounds = { x: 0, y: 0, width: 20, height: 20 };
    const { chunks } = computeChunks({ bounds, scale: 24, maxSize: 1400 });

    expect(chunks).toEqual([]);
  });

  test('chunk pixel sizes never exceed maxSize', () => {
    const bounds = { x: 0, y: 0, width: 400, height: 300 };
    const { overview, chunks } = computeChunks({ bounds, scale: 24, maxSize: 900 });

    expect(overview.pixelWidth).toBeLessThanOrEqual(900);
    expect(overview.pixelHeight).toBeLessThanOrEqual(900);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((chunk) => chunk.pixelWidth <= 900)).toBe(true);
    expect(chunks.every((chunk) => chunk.pixelHeight <= 900)).toBe(true);
  });

  test('output is deterministic', () => {
    const bounds = { x: 0, y: 0, width: 200, height: 120 };
    const first = computeChunks({ bounds, scale: 24, maxSize: 1400 });
    const second = computeChunks({ bounds, scale: 24, maxSize: 1400 });

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  test('invalid inputs are rejected', () => {
    expect(() => computeChunks()).toThrow(TypeError);
    expect(() => computeChunks({ scale: 24, maxSize: 1400 })).toThrow(TypeError);
    expect(() => computeChunks({ bounds: { x: 0, y: 0, width: -1, height: 1 }, scale: 24, maxSize: 1400 })).toThrow(RangeError);
    expect(() => computeChunks({ bounds: { x: 0, y: 0, width: 10, height: 10 }, scale: 0, maxSize: 1400 })).toThrow(RangeError);
    expect(() => computeChunks({ bounds: { x: 0, y: 0, width: 10, height: 10 }, scale: 24, maxSize: 100 })).toThrow(RangeError);
    expect(() => computeChunks({ bounds: { x: 0, y: 0, width: 10, height: 10 }, scale: 24, maxSize: 1400, overlap: -1 })).toThrow(RangeError);
  });

  test('bounds include sections, tiles and entities', () => {
    const layout = wideLayout();
    const bounds = computeStageBounds(layout);

    expect(bounds).toEqual({ x: 0, y: 0, width: 200, height: 10 });
  });

  test('computeChunkContentBounds measures only objects intersecting the core x range', () => {
    const layout = tallLayout([
      tile('platform', 0, 4, 20, 1),
      tile('platform', 100, 30, 20, 1)
    ]);
    const left = computeChunkContentBounds(layout, { x: 0, width: 54 });
    const middle = computeChunkContentBounds(layout, { x: 60, width: 30 });
    const right = computeChunkContentBounds(layout, { x: 100, width: 54 });

    expect(left).toEqual({ y: 0, height: 10 });
    expect(middle).toEqual({ y: 13, height: 10 });
    expect(right).toEqual({ y: 25.5, height: 10 });
  });

  test('chunk views shrink to the content band instead of the full stage height', () => {
    const layout = tallLayout([tile('platform', 0, 10, 200, 1)]);
    const bounds = computeStageBounds(layout);
    const { overview, chunks } = computeChunks({ layout, bounds, scale: 24, maxSize: 1400 });

    expect(overview.world).toEqual(bounds);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((chunk) => chunk.world.height < bounds.height)).toBe(true);
    expect(chunks.every((chunk) => chunk.world.y >= bounds.y)).toBe(true);
    expect(
      chunks.every((chunk) => chunk.world.y + chunk.world.height <= bounds.y + bounds.height)
    ).toBe(true);
    expect(chunks.every((chunk) => chunk.pixelHeight <= 1400)).toBe(true);
  });

  test('content at both vertical extremes keeps the full chunk height', () => {
    const layout = tallLayout([
      tile('platform', 0, 0, 200, 1),
      tile('platform', 0, 35, 200, 1)
    ]);
    const bounds = computeStageBounds(layout);
    const { chunks } = computeChunks({ layout, bounds, scale: 24, maxSize: 1400 });

    expect(chunks.every((chunk) => chunk.world.y === bounds.y)).toBe(true);
    expect(chunks.every((chunk) => chunk.world.height === bounds.height)).toBe(true);
  });

  test('chunk content bounds keep the two unit horizontal overlap', () => {
    const layout = tallLayout([tile('platform', 0, 10, 200, 1)]);
    const bounds = computeStageBounds(layout);
    const { chunks } = computeChunks({ layout, bounds, scale: 24, maxSize: 1400 });

    expect(chunks.map((chunk) => chunk.world.x)).toEqual([0, 54, 108, 162]);
    expect(chunks.map((chunk) => chunk.world.width)).toEqual([56, 56, 56, 38]);
    expect(chunks[1].world.x - (chunks[0].world.x + chunks[0].world.width)).toBe(-2);
  });

  test('chunk images stay within maxSize after the height shrink', () => {
    const layout = tallLayout([tile('platform', 0, 0, 200, 36)]);
    const bounds = computeStageBounds(layout);
    const { chunks } = computeChunks({ layout, bounds, scale: 24, maxSize: 900 });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((chunk) => chunk.pixelWidth <= 900)).toBe(true);
    expect(chunks.every((chunk) => chunk.pixelHeight <= 900)).toBe(true);
  });
});

describe('renderStageView', () => {
  test('renders title, legend and every required semantic', () => {
    const layout = richLayout();
    const { svg } = overviewOf(layout);
    const chunkSvg = renderStageView({ layout, view: manualView({ x: 0, y: -2, width: 28, height: 7 }) });
    const findings = [
      { stage: layout.id, severity: 'error', code: 'a', message: 'first', evidence: { position: { x: 1, y: 0 } } },
      { stage: layout.id, severity: 'error', code: 'b', message: 'second', evidence: { position: { x: 20, y: 0 } } }
    ];
    const withFindings = renderStageView({ layout, view: computeChunks({ bounds: computeStageBounds(layout), scale: 24, maxSize: 1400 }).overview, findings });

    expect(svg).toContain('Stage map: test-stage');
    expect(svg).toContain('platform');
    expect(svg).toContain('Pits are invisible in-game; shown here.');
    expect(svg).toContain('SPAWN');
    expect(svg).toContain('EXIT');
    expect(svg).toContain('CHECKPOINT 1');
    expect(svg).toContain('CHECKPOINT 2');
    expect(chunkSvg).toContain('NOTE 1');
    expect(chunkSvg).toContain('KEY red &amp; &lt;key&gt;');
    expect(chunkSvg).toContain('BIG FRUIT strawberry');
    expect(chunkSvg).toContain('PIT (deadly)');
    expect(chunkSvg).toContain('SLOPE');
    expect(chunkSvg).toContain('WATER');
    expect(chunkSvg).toContain('LADDER');
    expect(withFindings).toContain('>E1</text>');
    expect(withFindings).toContain('>E2</text>');
  });

  test('enemies render their letters and boss label', () => {
    const layout = richLayout();
    const { svg } = overviewOf(layout);

    expect(svg).toContain('>P</text>');
    expect(svg).toContain('>S</text>');
    expect(svg).toContain('>F</text>');
    expect(svg).toContain('>B</text>');
    expect(svg).toContain('BOSS');
  });

  test('teleporters and markers render glyphs in the overview and names in chunks', () => {
    const layout = richLayout();
    const { svg } = overviewOf(layout);
    const chunkSvg = renderStageView({ layout, view: manualView({ x: 0, y: -2, width: 28, height: 7 }) });

    expect(svg).toContain('>M</text>');
    expect(svg).toContain('>T</text>');
    expect(svg).not.toContain('marker-a');
    expect(svg).not.toMatch(/gate &amp; &lt;x&gt;/);
    expect(chunkSvg).toContain('marker-a');
    expect(chunkSvg).toMatch(/gate &amp; &lt;x&gt; -&gt; marker-a/);
  });

  test('labels are suppressed for out-of-view and sliver objects', () => {
    const view = manualView({ x: 100, y: 0, width: 50, height: 20 });
    const render = (tiles) => renderStageView({
      layout: baseLayout({
        sections: [section('view', 100, 0, 50, 20)],
        tiles
      }),
      view
    });

    expect(render([tile('slope', 90, 5, 2, 2)])).not.toContain('>SLOPE<');
    expect(render([tile('slope', 120, 5, 1, 1)])).toContain('>SLOPE<');
    expect(render([tile('slope', 120, 10, 0.2, 0.2)])).not.toContain('>SLOPE<');

    const sliverPit = render([tile('pit', 149.9, 5, 10, 10)]);
    expect(sliverPit).not.toContain('PIT (deadly)');
    expect(sliverPit).toContain('stroke-dasharray="5 4"');
  });

  test('close section labels use separate rows and identical x positions merge', () => {
    const layout = baseLayout({
      sections: [
        section('alpha-section', 100, 0, 1, 1),
        section('beta-section', 101, 0, 1, 1),
        section('gamma-one', 120, 0, 1, 1),
        section('gamma-two', 120, 0, 1, 1)
      ]
    });
    const view = manualView({ x: 100, y: 0, width: 50, height: 20 });
    const svg = renderStageView({ layout, view });
    const yFor = (name) => {
      const match = svg.match(new RegExp(`<text x="[^"]+" y="([^"]+)"[^>]*>${name}</text>`));
      return match === null ? null : Number(match[1]);
    };
    const alphaY = yFor('alpha-section');
    const betaY = yFor('beta-section');

    expect(alphaY).not.toBeNull();
    expect(betaY).not.toBeNull();
    expect(alphaY).not.toBe(betaY);
    expect(svg).toContain('gamma-one / gamma-two');
    expect(svg.match(/gamma-one/g)).toHaveLength(1);
    expect(svg.match(/gamma-two/g)).toHaveLength(1);
  });

  test('teleporter and marker labels fall back when names are omitted', () => {
    const layout = baseLayout({
      sections: [section('teleporters', 0, 0, 60, 10)],
      teleporters: [
        teleporter(5, 2, { name: undefined, 'target-marker': 'dest' }),
        teleporter(20, 2, { name: 'unnamed', 'target-stage': 'forest' }),
        teleporter(35, 2, { name: 'unnamed', 'target-marker': null, 'target-stage': null })
      ],
      markers: [marker(50, 2, 'unnamed')]
    });
    const svg = renderStageView({ layout, view: manualView({ x: 0, y: 0, width: 60, height: 10 }) });

    expect(svg).toContain('TELEPORTER -&gt; dest');
    expect(svg).toContain('TELEPORTER -&gt; forest');
    expect(svg).toContain('>TELEPORTER<');
    expect(svg).toContain('>MARKER<');
    expect(svg).toContain('>M</text>');
    expect(svg).toContain('>T</text>');
  });

  test('text width estimate is the conservative monospace factor', () => {
    expect(TEXT_WIDTH_FACTOR).toBe(0.75);
    expect(estimateTextWidth('ABCD', 10)).toBe(30);
  });

  test('big fruit and exit labels at the right edge flip inside the plot without overlapping', () => {
    const layout = baseLayout({
      sections: [section('edge', 0, 0, 20, 10)],
      collectibles: [
        collectible('big-fruit', 18, 4, 2, 2, { collectible: 'strawberry' }),
        collectible('exit-door', 18, 4, 1.5, 1.5)
      ]
    });
    const view = manualView({ x: 0, y: 0, width: 20, height: 10 });
    const svg = renderStageView({ layout, view });
    const clip = plotClip(view);
    const rects = labelRects(svg);
    const bigFruit = rects.find((rect) => rect.text === 'BIG FRUIT strawberry');
    const exit = rects.find((rect) => rect.text === 'EXIT');

    expect(bigFruit).toBeDefined();
    expect(exit).toBeDefined();
    expect(rectInsidePlot(bigFruit, clip)).toBe(true);
    expect(rectInsidePlot(exit, clip)).toBe(true);
    expect(rectsIntersect(bigFruit, exit)).toBe(false);
  });

  test('exit cluster keeps big fruit, exit and teleporter labels apart', () => {
    const layout = exitPlateauLayout();
    const view = manualView(EXIT_PLATEAU_VIEW);
    const svg = renderStageView({ layout, view });
    const clip = plotClip(view);
    const labels = labelRects(plotGroup(svg));
    const find = (text) => labels.find((rect) => rect.text === text);
    const bigFruit = find('BIG FRUIT strawberry');
    const exit = find('EXIT');
    const teleporterLabel = find('to-world-map -&gt; map');

    expect(bigFruit).toBeDefined();
    expect(exit).toBeDefined();
    expect(teleporterLabel).toBeDefined();

    for (const rect of [bigFruit, exit, teleporterLabel]) {
      expect(rectInsidePlot(rect, clip)).toBe(true);
    }

    expect(rectsIntersect(bigFruit, exit)).toBe(false);
    expect(rectsIntersect(bigFruit, teleporterLabel)).toBe(false);
    expect(rectsIntersect(exit, teleporterLabel)).toBe(false);
  });

  test('big fruit and exit side by side keep their labels above and below their own diamond', () => {
    const view = manualView(SIDE_BY_SIDE_VIEW);
    const plot = plotGroup(renderStageView({ layout: sideBySideExitLayout(), view }));
    const clip = plotClip(view);
    const labels = labelRects(plot);
    const bigFruit = labels.find((rect) => rect.text === 'BIG FRUIT strawberry');
    const exit = labels.find((rect) => rect.text === 'EXIT');
    const bigFruitIcon = polygonBounds(plot, '#ff4fd8');
    const exitIcon = polygonBounds(plot, '#51cf66');
    const tolerance = 5;

    expect(bigFruit).toBeDefined();
    expect(exit).toBeDefined();
    expect(bigFruitIcon).not.toBeNull();
    expect(exitIcon).not.toBeNull();

    // Vertical association: the fruit label sits above its diamond, the exit
    // label below its own, instead of both sharing one band.
    expect(bigFruit.bottom).toBeLessThanOrEqual(bigFruitIcon.top + tolerance);
    expect(exit.top).toBeGreaterThanOrEqual(exitIcon.bottom - tolerance);

    // Horizontal association: each label is centered on its own diamond.
    expect(
      Math.abs((bigFruit.left + bigFruit.right) / 2 - (bigFruitIcon.left + bigFruitIcon.right) / 2)
    ).toBeLessThanOrEqual(tolerance);
    expect(
      Math.abs((exit.left + exit.right) / 2 - (exitIcon.left + exitIcon.right) / 2)
    ).toBeLessThanOrEqual(tolerance);

    expect(rectsIntersect(bigFruit, exit)).toBe(false);
    expect(rectInsidePlot(bigFruit, clip)).toBe(true);
    expect(rectInsidePlot(exit, clip)).toBe(true);
  });

  test('important labels render after every collectible icon', () => {
    const plot = plotGroup(renderStageView({
      layout: exitPlateauLayout(),
      view: manualView(EXIT_PLATEAU_VIEW)
    }));
    // The exit door is the last collectible icon drawn in this layout.
    const lastCollectibleIcon = lastMatchIndex(plot, /<polygon points="[^"]+" fill="#51cf66"/g);
    const firstLabel = Math.min(
      ...[
        'BIG FRUIT strawberry',
        'EXIT',
        'to-world-map -&gt; map'
      ].map((text) => plot.indexOf(`>${text}</text>`))
    );

    expect(lastCollectibleIcon).toBeGreaterThanOrEqual(0);
    expect(firstLabel).toBeGreaterThanOrEqual(0);
    expect(firstLabel).toBeGreaterThan(lastCollectibleIcon);
  });

  test('checkpoint labels are skipped when the checkpoint center is outside the view', () => {
    const layout = baseLayout({
      sections: [section('view', 100, 0, 50, 10)],
      tiles: [tile('platform', 100, 0, 50, 1)],
      checkpoints: [checkpoint(20), checkpoint(120)]
    });
    const svg = renderStageView({ layout, view: manualView({ x: 100, y: 0, width: 50, height: 10 }) });
    const poles = svg.match(/<line x1="[^"]+" y1="[^"]+" x2="[^"]+" y2="[^"]+" stroke="#4dabf7" stroke-width="2"\/>/g) ?? [];

    // Geometry survives for both checkpoints; only the off-view label is gone.
    expect(poles).toHaveLength(2);
    expect(svg).not.toContain('CHECKPOINT 1');
    expect(svg).toContain('CHECKPOINT 2');
  });

  test('stacked labels fall through the downward lanes instead of overlapping', () => {
    const layout = baseLayout({
      sections: [section('stack', 0, 0, 60, 10)],
      tiles: [tile('platform', 0, 0, 60, 1)],
      checkpoints: Array.from({ length: 6 }, () => checkpoint(10, 2))
    });
    const view = manualView({ x: 0, y: 0, width: 60, height: 10 });
    const svg = renderStageView({ layout, view });
    const clip = plotClip(view);
    const labels = labelRects(plotGroup(svg)).filter((rect) => rect.text.startsWith('CHECKPOINT'));

    expect(labels.map((rect) => rect.text)).toEqual([
      'CHECKPOINT 1',
      'CHECKPOINT 2',
      'CHECKPOINT 3',
      'CHECKPOINT 4',
      'CHECKPOINT 5',
      'CHECKPOINT 6'
    ]);

    for (const rect of labels) {
      expect(rectInsidePlot(rect, clip)).toBe(true);
    }

    for (let index = 0; index < labels.length; index += 1) {
      for (let other = index + 1; other < labels.length; other += 1) {
        expect(rectsIntersect(labels[index], labels[other])).toBe(false);
      }
    }
  });

  test('overview suppresses detailed entity labels while chunks keep them', () => {
    const layout = baseLayout({
      sections: [section('labels', 0, 0, 40, 10)],
      tiles: [tile('platform', 0, 0, 40, 1)],
      spawns: [{
        kind: 'spawn',
        type: 'player-spawn',
        section: 'labels',
        x: 1,
        y: 0,
        width: 1,
        height: 1
      }],
      checkpoints: [
        { kind: 'checkpoint', type: 'checkpoint', section: 'main', x: 8, y: 0, width: 1, height: 1 }
      ],
      collectibles: [
        collectible('musical-note', 5, -1, 0.5, 0.5, { 'note-order': 1 }),
        collectible('key', 10, -1, 0.5, 0.5, { 'key-name': 'red' }),
        collectible('big-fruit', 15, -1, 2, 2, { collectible: 'strawberry' }),
        collectible('exit-door', 30, -1, 1.5, 1.5)
      ],
      teleporters: [teleporter(20, -1, { name: 'gate', 'target-marker': 'marker-b' })],
      markers: [marker(25, -1, 'marker-b')]
    });
    const overviewSvg = overviewOf(layout).svg;
    const chunkSvg = renderStageView({ layout, view: manualView({ x: 0, y: -2, width: 40, height: 8 }) });
    const overviewPlot = plotGroup(overviewSvg);
    const chunkPlot = plotGroup(chunkSvg);

    // Glyphs and icons survive in the overview.
    expect(overviewPlot).toContain('>M</text>');
    expect(overviewPlot).toContain('>T</text>');
    expect(overviewPlot).toContain('<ellipse');
    expect(overviewPlot).toContain('fill="none" stroke="#69ff9c"');
    expect(overviewPlot).toContain('fill="#ff4fd8"');

    for (const text of ['NOTE 1', 'KEY red', 'BIG FRUIT strawberry', 'gate -&gt; marker-b', '>marker-b</text>']) {
      expect(overviewPlot).not.toContain(text);
      expect(chunkPlot).toContain(text);
    }

    // Structural labels stay in the overview.
    expect(overviewPlot).toContain('>SPAWN</text>');
    expect(overviewPlot).toContain('>EXIT</text>');
    expect(overviewPlot).toContain('>CHECKPOINT 1</text>');
    expect(chunkPlot).toContain('>SPAWN</text>');
    expect(chunkPlot).toContain('>EXIT</text>');
  });

  test('slope wedge points differ for inverted and non-inverted slopes', () => {
    const wedgePoints = (inverted) => {
      const layout = baseLayout({
        sections: [section('slope', 0, 0, 4, 2)],
        tiles: [tile('slope', 0, 0, 2, 1, { inverted })]
      });
      const { svg } = overviewOf(layout);
      const match = svg.match(/points="([^"]+)"[^>]*data-role="slope-wedge"/);

      return match?.[1] ?? null;
    };
    const normal = wedgePoints(false);
    const inverted = wedgePoints(true);

    expect(normal).not.toBeNull();
    expect(inverted).not.toBeNull();
    expect(normal).not.toBe(inverted);
  });

  test('XML special characters are escaped', () => {
    const layout = richLayout();
    const { svg } = overviewOf(layout);
    const chunkSvg = renderStageView({ layout, view: manualView({ x: 0, y: -2, width: 28, height: 7 }) });

    expect(svg).toContain('&amp;');
    expect(svg).toContain('&lt;');
    expect(svg).not.toContain('start & <gate>');
    expect(chunkSvg).toContain('&amp;');
    expect(chunkSvg).toContain('&lt;');
    expect(chunkSvg).toContain('&gt;');
    expect(chunkSvg).not.toContain('<key>');
    expect(chunkSvg).not.toContain('start & <gate>');
  });

  test('output is a standalone SVG without external resources or scripts', () => {
    const layout = richLayout();
    const { svg } = overviewOf(layout);
    const withoutNamespace = svg.replace(/xmlns="[^"]*"/g, '');

    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(withoutNamespace).not.toMatch(/https?:\/\//);
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('<image');
    expect(svg).toContain('#0a0a0a');
    expect(svg).toContain('#e8e8e8');
  });

  test('rendering is deterministic', () => {
    const layout = richLayout();
    const first = overviewOf(layout).svg;
    const second = overviewOf(layout).svg;

    expect(first).toBe(second);
  });

  test('invalid layouts and views are rejected', () => {
    const layout = richLayout();
    const { views } = overviewOf(layout);

    expect(() => renderStageView({ layout: null, view: views.overview })).toThrow(TypeError);
    expect(() => renderStageView({ layout, view: null })).toThrow(TypeError);
    expect(() => renderStageView({ layout, view: { ...views.overview, scale: 0 } })).toThrow(RangeError);
  });
});

describe('manifest builders', () => {
  test('stage manifest is deterministic, JSON-safe and ordered', () => {
    const layout = wideLayout();
    const bounds = computeStageBounds(layout);
    const views = computeChunks({ layout, bounds, scale: 24, maxSize: 1400 });
    const findings = [{
      stage: layout.id,
      severity: 'error',
      code: 'sample',
      message: 'sample',
      evidence: { position: { x: 1, y: 0 } }
    }];
    const manifest = buildStageManifest({ layout, bounds, views, scale: 24, findings });
    const again = buildStageManifest({ layout, bounds, views, scale: 24, findings });

    expect(Object.keys(manifest)).toEqual([
      'stage',
      'bounds',
      'playerSize',
      'scale',
      'staticFindings',
      'sections',
      'images'
    ]);
    expect(manifest.stage).toBe('test-stage');
    expect(manifest.bounds).toEqual(bounds);
    expect(manifest.playerSize).toBe(1);
    expect(manifest.scale).toBe(24);
    expect(manifest.staticFindings).toEqual(findings);
    expect(manifest.sections).toEqual([{
      name: 'wide',
      parent: 'root',
      x: 0,
      y: 0,
      width: 200,
      height: 10
    }]);
    expect(manifest.images.map((image) => image.file)).toEqual([
      'overview.png',
      'chunk-00.png',
      'chunk-01.png',
      'chunk-02.png',
      'chunk-03.png'
    ]);
    expect(manifest.images.map((image) => image.svg)).toEqual([
      'overview.svg',
      'chunk-00.svg',
      'chunk-01.svg',
      'chunk-02.svg',
      'chunk-03.svg'
    ]);
    expect(manifest.images[0]).toEqual({
      file: 'overview.png',
      svg: 'overview.svg',
      kind: 'overview',
      world: views.overview.world,
      scale: views.overview.scale,
      pixelWidth: views.overview.pixelWidth,
      pixelHeight: views.overview.pixelHeight
    });
    expect(manifest.images[1].kind).toBe('chunk');
    expect(manifest.images[1].world).toEqual(views.chunks[0].world);
    expect(JSON.parse(JSON.stringify(manifest))).toEqual(manifest);
    expect(again).toEqual(manifest);
  });

  test('stage index sorts stages by id and keeps the documented keys', () => {
    const index = buildStageIndex({
      generatedAt: '2026-01-01T00:00:00.000Z',
      stages: [
        {
          id: 'zeta',
          bounds: { x: 0, y: 0, width: 1, height: 1 },
          images: ['overview.png'],
          findingCounts: { errors: 1, warnings: 0 }
        },
        {
          id: 'alpha',
          bounds: { x: 0, y: 0, width: 2, height: 2 },
          images: ['overview.png', 'chunk-00.png'],
          findingCounts: { errors: 0, warnings: 2 }
        }
      ]
    });

    expect(Object.keys(index)).toEqual(['generatedAt', 'stages']);
    expect(index.generatedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(index.stages.map((stage) => stage.id)).toEqual(['alpha', 'zeta']);
    expect(Object.keys(index.stages[0])).toEqual(['id', 'bounds', 'images', 'findingCounts']);
  });
});

describe('resolveOutputDirectory', () => {
  const root = '/repo';

  test('default and relative output directories are allowed', () => {
    expect(resolveOutputDirectory(root, 'out/stage-maps')).toBe('/repo/out/stage-maps');
    expect(resolveOutputDirectory(root, 'out/foo')).toBe('/repo/out/foo');
  });

  test('absolute output directories outside the repository are allowed', () => {
    expect(resolveOutputDirectory(root, '/tmp/stage-maps')).toBe('/tmp/stage-maps');
  });

  test('the repository root, data and src are rejected', () => {
    expect(() => resolveOutputDirectory(root, '.')).toThrow(CliError);
    expect(() => resolveOutputDirectory(root, 'data/stage-maps')).toThrow(CliError);
    expect(() => resolveOutputDirectory(root, 'data')).toThrow(CliError);
    expect(() => resolveOutputDirectory(root, 'src/foo')).toThrow(CliError);
    expect(() => resolveOutputDirectory(root, 'src')).toThrow(CliError);
  });
});

describe('parseArguments', () => {
  test('defaults match the CLI contract', () => {
    const options = parseArguments([]);

    expect(options).toEqual({
      stageIds: [],
      out: 'out/stage-maps',
      scale: 24,
      maxSize: 1400,
      help: false
    });
  });

  test('repeated and equals forms select stages', () => {
    const options = parseArguments(['--stage', 'alpha', '--stage=beta', '--scale=12', '--max-size', '900']);

    expect(options.stageIds).toEqual(['alpha', 'beta']);
    expect(options.scale).toBe(12);
    expect(options.maxSize).toBe(900);
  });

  test('unknown options, missing values and invalid numbers are rejected', () => {
    expect(() => parseArguments(['--nope'])).toThrow(CliError);
    expect(() => parseArguments(['--stage'])).toThrow(CliError);
    expect(() => parseArguments(['--scale', 'abc'])).toThrow(CliError);
    expect(() => parseArguments(['--scale', '-1'])).toThrow(CliError);
    expect(() => parseArguments(['--max-size', '12.5'])).toThrow(CliError);
    expect(() => parseArguments(['stray'])).toThrow(CliError);
  });

  test('help is recognized', () => {
    expect(parseArguments(['--help']).help).toBe(true);
  });
});
