import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { Renderer } from '../src/engine/renderer/renderer.js';

function createContext() {
  const calls = [];

  const record = (name) => (...args) => {
    calls.push({ name, args });
  };

  return {
    calls,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineJoin: 'miter',
    lineCap: 'butt',
    font: '',
    textAlign: '',
    save: record('save'),
    restore: record('restore'),
    setTransform: record('setTransform'),
    fillRect: record('fillRect'),
    beginPath: record('beginPath'),
    closePath: record('closePath'),
    rect: record('rect'),
    arc: record('arc'),
    arcTo: record('arcTo'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    fill: record('fill'),
    stroke: record('stroke'),
    measureText(text) {
      calls.push({ name: 'measureText', args: [text] });
      return { width: text.length * 10 };
    },
    fillText: record('fillText')
  };
}

function createEnvironment({ canvas = true } = {}) {
  const context = createContext();
  const element = canvas
    ? { width: 0, height: 0, style: {}, getContext: () => context }
    : null;
  const listeners = new Map();

  globalThis.document = {
    querySelector: (selector) => (selector === '#game-canvas' ? element : null)
  };
  globalThis.window = {
    innerWidth: 1000,
    innerHeight: 500,
    addEventListener: (type, listener) => listeners.set(type, listener)
  };

  return { context, element, listeners };
}

function callsNamed(context, name) {
  return context.calls.filter((call) => call.name === name);
}

const originalDocument = globalThis.document;
const originalWindow = globalThis.window;

beforeEach(() => {
  createEnvironment();
});

afterEach(() => {
  globalThis.document = originalDocument;
  globalThis.window = originalWindow;
});

describe('Renderer construction', () => {
  test('throws when the canvas is missing', () => {
    createEnvironment({ canvas: false });

    expect(() => new Renderer('#game-canvas', { unitHeight: 10, viewportPercent: 90 }))
      .toThrow('Canvas not found: #game-canvas');
  });

  test('rejects an unusable unit height', () => {
    for (const unitHeight of [undefined, null, 0, -1, '10']) {
      expect(() => new Renderer('#game-canvas', { unitHeight, viewportPercent: 90 }))
        .toThrow('Renderer requires a positive numeric "unitHeight"');
    }
  });

  test('rejects an unusable viewport percentage', () => {
    for (const viewportPercent of [undefined, null, 0, -1, '90']) {
      expect(() => new Renderer('#game-canvas', { unitHeight: 10, viewportPercent }))
        .toThrow('Renderer requires a positive numeric "viewportPercent"');
    }
  });

  test('sizes the canvas to the viewport percentage', () => {
    const { element } = createEnvironment();
    const renderer = new Renderer('#game-canvas', { unitHeight: 10, viewportPercent: 90 });

    expect(element.width).toBe(900);
    expect(element.height).toBe(450);
    expect(element.style.width).toBe('900px');
    expect(element.style.height).toBe('450px');
    expect(renderer.canvas).toBe(element);
  });

  test('derives the unit scale and viewport in visual units', () => {
    const renderer = new Renderer('#game-canvas', { unitHeight: 10, viewportPercent: 90 });

    expect(renderer.unitScale).toBe(45);
    expect(renderer.viewportWidth).toBe(20);
    expect(renderer.viewportHeight).toBe(10);
  });

  test('resizes when the window fires a resize event', () => {
    const { element, listeners } = createEnvironment();
    const renderer = new Renderer('#game-canvas', { unitHeight: 10, viewportPercent: 50 });

    expect(element.width).toBe(500);
    expect(renderer.viewportWidth).toBe(20);

    globalThis.window.innerWidth = 2000;
    globalThis.window.innerHeight = 1000;
    listeners.get('resize')();

    expect(element.width).toBe(1000);
    expect(element.height).toBe(500);
    expect(renderer.unitScale).toBe(50);
    expect(renderer.viewportWidth).toBe(20);
    expect(renderer.viewportHeight).toBe(10);
  });
});

describe('Renderer clearing and camera transform', () => {
  test('fills the whole canvas with black', () => {
    const { context, element } = createEnvironment();
    const renderer = new Renderer('#game-canvas', { unitHeight: 10, viewportPercent: 90 });

    renderer.clear();

    expect(context.fillStyle).toBe('#000000');
    expect(callsNamed(context, 'fillRect')).toEqual([
      { name: 'fillRect', args: [0, 0, element.width, element.height] }
    ]);
  });

  test('applies an integer-pixel camera translation and restores it', () => {
    const { context } = createEnvironment();
    const renderer = new Renderer('#game-canvas', { unitHeight: 10, viewportPercent: 90 });

    renderer.cameraTransform = { x: 1.4, y: 2.6 };
    renderer.restoreCameraTransform();

    expect(callsNamed(context, 'save')).toHaveLength(1);
    expect(callsNamed(context, 'setTransform')).toEqual([
      { name: 'setTransform', args: [1, 0, 0, 1, -63, -117] }
    ]);
    expect(callsNamed(context, 'restore')).toHaveLength(1);
  });

  test('draws a white flash over the canvas', () => {
    const { context, element } = createEnvironment();
    const renderer = new Renderer('#game-canvas', { unitHeight: 10, viewportPercent: 90 });

    renderer.applyFlash(0.25);

    expect(context.fillStyle).toBe('rgba(255, 255, 255, 0.25)');
    expect(callsNamed(context, 'fillRect')).toEqual([
      { name: 'fillRect', args: [0, 0, element.width, element.height] }
    ]);
  });
});

describe('Renderer primitives', () => {
  test('scales a circle position, radius and border width', () => {
    const { context } = createEnvironment();
    const renderer = new Renderer('#game-canvas', { unitHeight: 10, viewportPercent: 90 });

    renderer.drawCircle(2, 3, 1, '#ff0000', '#ffffff', 0.1);

    expect(callsNamed(context, 'arc')).toEqual([
      { name: 'arc', args: [90, 135, 45, 0, Math.PI * 2] }
    ]);
    expect(context.fillStyle).toBe('#ff0000');
    expect(context.strokeStyle).toBe('#ffffff');
    expect(context.lineWidth).toBe(4.5);
  });

  test('skips the fill and stroke when they are not requested', () => {
    const { context } = createEnvironment();
    const renderer = new Renderer('#game-canvas', { unitHeight: 10, viewportPercent: 90 });

    renderer.drawCircle(0, 0, 1, null, '#ffffff', 0);
    renderer.drawCircle(0, 0, 1, '#ff0000', null, 1);

    expect(callsNamed(context, 'fill')).toHaveLength(1);
    expect(callsNamed(context, 'stroke')).toHaveLength(0);
  });

  test('draws a sharp rectangle with the rectangle path', () => {
    const { context } = createEnvironment();
    const renderer = new Renderer('#game-canvas', { unitHeight: 10, viewportPercent: 90 });

    renderer.drawRect(1, 2, 3, 4, 0, '#123456');

    expect(callsNamed(context, 'rect')).toEqual([
      { name: 'rect', args: [45, 90, 135, 180] }
    ]);
    expect(callsNamed(context, 'arcTo')).toHaveLength(0);
    expect(callsNamed(context, 'fill')).toHaveLength(1);
  });

  test('draws a rounded rectangle with four corner arcs and clamps the radius', () => {
    const { context } = createEnvironment();
    const renderer = new Renderer('#game-canvas', { unitHeight: 10, viewportPercent: 90 });

    renderer.drawRect(0, 0, 1, 1, 10, '#123456');
    renderer.drawRect(0, 0, 1, 1, 0.1, '#123456', '#ffffff', 0.02);

    expect(callsNamed(context, 'arcTo')).toHaveLength(8);
    expect(callsNamed(context, 'arcTo')[0].args[4]).toBe(22.5);
    expect(callsNamed(context, 'closePath')).toHaveLength(2);
    expect(context.lineWidth).toBe(0.9);
  });

  test('ignores a polygon path with fewer than three points', () => {
    const { context } = createEnvironment();
    const renderer = new Renderer('#game-canvas', { unitHeight: 10, viewportPercent: 90 });

    renderer.drawPolygonPath([], '#ffffff');
    renderer.drawPolygonPath([{ x: 0, y: 0 }, { x: 1, y: 1 }], '#ffffff');
    renderer.drawPolygonPath('not-a-list', '#ffffff');

    expect(context.calls).toEqual([]);
  });

  test('draws a polygon path with a rounded join and resets it afterwards', () => {
    const { context } = createEnvironment();
    const renderer = new Renderer('#game-canvas', { unitHeight: 10, viewportPercent: 90 });

    renderer.drawPolygonPath(
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
      '#ff0000',
      '#ffffff',
      0.1
    );

    expect(callsNamed(context, 'moveTo')).toEqual([{ name: 'moveTo', args: [0, 0] }]);
    expect(callsNamed(context, 'lineTo')).toEqual([
      { name: 'lineTo', args: [45, 0] },
      { name: 'lineTo', args: [0, 45] }
    ]);
    expect(context.lineJoin).toBe('miter');
    expect(context.lineWidth).toBe(4.5);
  });

  test('draws a polygon with one vertex per side', () => {
    const { context } = createEnvironment();
    const renderer = new Renderer('#game-canvas', { unitHeight: 10, viewportPercent: 90 });

    renderer.drawPolygon(5, 5, 1, 6, 0, '#ff0000', '#ffffff', 0.1);

    expect(callsNamed(context, 'moveTo')).toHaveLength(1);
    expect(callsNamed(context, 'lineTo')).toHaveLength(5);
    expect(callsNamed(context, 'closePath')).toHaveLength(1);
    expect(context.fillStyle).toBe('#ff0000');
    expect(context.strokeStyle).toBe('#ffffff');
    expect(context.lineWidth).toBe(4.5);
  });

  test('draws a line with a scaled width and a round cap', () => {
    const { context } = createEnvironment();
    const renderer = new Renderer('#game-canvas', { unitHeight: 10, viewportPercent: 90 });

    renderer.drawLine(1, 2, 3, 4, '#abcdef', 0.2);

    expect(callsNamed(context, 'moveTo')).toEqual([{ name: 'moveTo', args: [45, 90] }]);
    expect(callsNamed(context, 'lineTo')).toEqual([{ name: 'lineTo', args: [135, 180] }]);
    expect(context.strokeStyle).toBe('#abcdef');
    expect(context.lineWidth).toBe(9);
    expect(context.lineCap).toBe('round');
  });
});

describe('Renderer text', () => {
  test('scales the first pixel size in the font string', () => {
    const { context } = createEnvironment();
    const renderer = new Renderer('#game-canvas', { unitHeight: 10, viewportPercent: 90 });

    renderer.drawText('Hello', 2, 3, "0.4px 'Comic Sans Ms'", '#ffffff', 'center');

    expect(context.font).toBe("18px 'Comic Sans Ms'");
    expect(context.textAlign).toBe('center');
    expect(callsNamed(context, 'fillText')).toEqual([
      { name: 'fillText', args: ['Hello', 90, 135] }
    ]);
  });

  test('measures text in visual units and restores the context', () => {
    const { context } = createEnvironment();
    const renderer = new Renderer('#game-canvas', { unitHeight: 10, viewportPercent: 90 });

    const width = renderer.measureText('abcd', '0.4px monospace');

    expect(width).toBe(40 / 45);
    expect(context.font).toBe('18px monospace');
    expect(callsNamed(context, 'measureText')).toEqual([
      { name: 'measureText', args: ['abcd'] }
    ]);
    expect(callsNamed(context, 'save')).toHaveLength(1);
    expect(callsNamed(context, 'restore')).toHaveLength(1);
  });

  test('returns zero for empty or non-string text', () => {
    const { context } = createEnvironment();
    const renderer = new Renderer('#game-canvas', { unitHeight: 10, viewportPercent: 90 });

    expect(renderer.measureText('', '1px monospace')).toBe(0);
    expect(renderer.measureText(null, '1px monospace')).toBe(0);
    expect(renderer.measureText(undefined, '1px monospace')).toBe(0);
    expect(context.calls).toEqual([]);
  });
});
