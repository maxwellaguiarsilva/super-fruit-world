import { describe, expect, test } from 'bun:test';

import { UIElement, anchorPosition } from '../src/engine/ui/ui-element.js';

function createElement(overrides = {}) {
  return new UIElement({
    x: 0,
    y: 0,
    anchor: 'top-left',
    visible: true,
    width: 4,
    height: 2,
    'fill-color': 'white',
    border: 'black',
    ...overrides
  });
}

describe('UIElement state', () => {
  test('stores its configuration', () => {
    const element = createElement({ x: 3, y: 4, anchor: 'center' });

    expect(element.x).toBe(3);
    expect(element.y).toBe(4);
    expect(element.anchor).toBe('center');
    expect(element.visible).toBe(true);
    expect(element.width).toBe(4);
    expect(element.height).toBe(2);
    expect(element.fillColorName).toBe('white');
    expect(element.borderName).toBe('black');
  });

  test('allows position and visibility to change', () => {
    const element = createElement();

    element.x = 1;
    element.y = 2;
    element.visible = false;

    expect(element.x).toBe(1);
    expect(element.y).toBe(2);
    expect(element.visible).toBe(false);
  });
});

describe('UIElement anchor placement', () => {
  const camera = { x: 10, y: 5, width: 40, height: 30 };

  test('places a top-left element at its offset', () => {
    const element = createElement({ x: 2, y: 3, anchor: 'top-left' });

    expect(element.computeScreenPosition(camera)).toEqual({ x: 12, y: 8 });
  });

  test('places a top-right element against the right edge', () => {
    const element = createElement({ x: 2, y: 3, anchor: 'top-right' });

    expect(element.computeScreenPosition(camera)).toEqual({ x: 10 + 40 - 2 - 4, y: 8 });
  });

  test('places a top-center element along the horizontal center', () => {
    const element = createElement({ x: 2, y: 3, anchor: 'top-center' });

    expect(element.computeScreenPosition(camera)).toEqual({ x: 10 + (40 - 4) / 2 + 2, y: 8 });
  });

  test('places a center element at the horizontal and vertical center', () => {
    const element = createElement({ x: 2, y: 3, anchor: 'center' });

    expect(element.computeScreenPosition(camera)).toEqual({
      x: 10 + (40 - 4) / 2 + 2,
      y: 5 + (30 - 2) / 2 + 3
    });
  });

  test('places a bottom-left element against the bottom edge', () => {
    const element = createElement({ x: 2, y: 3, anchor: 'bottom-left' });

    expect(element.computeScreenPosition(camera)).toEqual({ x: 12, y: 5 + 30 - 3 - 2 });
  });

  test('places a bottom-right element against both edges', () => {
    const element = createElement({ x: 2, y: 3, anchor: 'bottom-right' });

    expect(element.computeScreenPosition(camera)).toEqual({
      x: 10 + 40 - 2 - 4,
      y: 5 + 30 - 3 - 2
    });
  });

  test('places a bottom-center element along the horizontal center and the bottom edge', () => {
    const element = createElement({ x: 2, y: 3, anchor: 'bottom-center' });

    expect(element.computeScreenPosition(camera)).toEqual({
      x: 10 + (40 - 4) / 2 + 2,
      y: 5 + 30 - 3 - 2
    });
  });

  test('treats an unknown anchor as top-left', () => {
    const element = createElement({ x: 2, y: 3, anchor: 'somewhere' });

    expect(element.computeScreenPosition(camera)).toEqual({ x: 12, y: 8 });
  });

  test('uses a 40 by 30 default viewport when no camera is supplied', () => {
    const element = createElement({ x: 0, y: 0, width: 4, height: 2, anchor: 'bottom-right' });

    expect(element.computeScreenPosition(null)).toEqual({ x: 36, y: 28 });
  });

  test('does not add a camera offset when no camera is supplied', () => {
    const element = createElement({ x: 1, y: 2, anchor: 'top-left' });

    expect(element.computeScreenPosition()).toEqual({ x: 1, y: 2 });
  });

  test('places every anchor through the shared engine helper', () => {
    const anchors = [
      'top-left',
      'top-right',
      'top-center',
      'center',
      'bottom-left',
      'bottom-right',
      'bottom-center'
    ];

    for (const anchor of anchors) {
      const element = createElement({ x: 2, y: 3, anchor });
      const expected = anchorPosition(anchor, { x: 2, y: 3 }, 4, 2, 40, 30);

      expect(element.computeScreenPosition(camera)).toEqual({
        x: expected.x + camera.x,
        y: expected.y + camera.y
      });
    }
  });
});

describe('UIElement children', () => {
  test('adds and removes children in order', () => {
    const parent = createElement();
    const first = createElement();
    const second = createElement();

    parent.addChild(first);
    parent.addChild(second);
    expect(parent.children).toEqual([first, second]);

    parent.removeChild(first);
    expect(parent.children).toEqual([second]);

    parent.removeChild(first);
    expect(parent.children).toEqual([second]);
  });

  test('updates every child once per update', () => {
    const parent = createElement();
    const calls = [];
    parent.addChild({ update: (dt) => calls.push(['first', dt]) });
    parent.addChild({ update: (dt) => calls.push(['second', dt]) });

    parent.update(0.5);

    expect(calls).toEqual([['first', 0.5], ['second', 0.5]]);
  });

  test('renders every child while visible', () => {
    const parent = createElement();
    const renderer = {};
    const calls = [];
    parent.addChild({ render: (value) => calls.push(value) });

    parent.render(renderer);

    expect(calls).toEqual([renderer]);
  });

  test('skips children while hidden', () => {
    const parent = createElement({ visible: false });
    let rendered = false;
    parent.addChild({ render: () => { rendered = true; } });

    parent.render({});

    expect(rendered).toBe(false);
  });

  test('ignores input by default', () => {
    const element = createElement();

    expect(element.handleInput({ isPressed: () => true })).toBeUndefined();
  });
});
