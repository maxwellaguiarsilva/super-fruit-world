import { describe, expect, test } from 'bun:test';

import { MapStage } from '../src/game/map/map-stage.js';
import { clampLabelX } from '../src/game/map/label-layout.js';

const VIEW = { minX: 0, maxX: 100 };

function mapConfig(nodes) {
  return {
    name: 'label-test-map',
    sections: [
      {
        name: 'main',
        'parent-section': 'root',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 20 },
        objects: nodes.map(({ id, display, x }) => ({
          type: 'stage-node',
          'stage-id': id,
          display,
          position: { x, y: 10 }
        }))
      }
    ]
  };
}

function createPlayer() {
  return { x: 0, y: 0 };
}

function createRenderer(widths) {
  const labels = [];
  return {
    labels,
    measureText(text) {
      return widths[text] ?? 0;
    },
    drawLine() {},
    drawCircle() {},
    drawText(text, x, y) {
      labels.push({ text, x, y });
    }
  };
}

describe('clampLabelX', () => {
  test('keeps a label centered when it fits', () => {
    expect(clampLabelX(50, 10, VIEW)).toBe(50);
  });

  test('shifts a label left at the right edge', () => {
    expect(clampLabelX(98, 10, VIEW)).toBe(95);
  });

  test('shifts a label right at the left edge', () => {
    expect(clampLabelX(2, 10, VIEW)).toBe(5);
  });

  test('does not shift a label in the middle', () => {
    expect(clampLabelX(40, 20, VIEW)).toBe(40);
  });

  test('anchors an oversized label to the left edge', () => {
    const x = clampLabelX(50, 120, VIEW);

    expect(x).toBe(60);
    expect(x - 60).toBe(VIEW.minX);
  });

  test('returns the node position when the viewport has no width', () => {
    expect(clampLabelX(42, 10, { minX: 30, maxX: 30 })).toBe(42);
    expect(clampLabelX(42, 10, null)).toBe(42);
  });
});

describe('MapStage node label placement', () => {
  const config = mapConfig([
    { id: 'left', display: 'Left', x: 1 },
    { id: 'middle', display: 'Middle', x: 50 },
    { id: 'right', display: 'Right', x: 99 }
  ]);
  const widths = { Left: 8, Middle: 16, Right: 8 };
  const camera = { x: 0, y: 0, width: 100, height: 20 };

  function renderLabels() {
    const stage = new MapStage(config, createPlayer());
    const renderer = createRenderer(widths);
    stage.render(renderer, camera);
    return { stage, renderer };
  }

  test('clamps edge labels while leaving the middle label centered', () => {
    const { renderer } = renderLabels();

    expect(renderer.labels).toEqual([
      { text: 'Left', x: 4, y: 11.2 },
      { text: 'Middle', x: 50, y: 11.2 },
      { text: 'Right', x: 96, y: 11.2 }
    ]);
  });

  test('clamping does not move the nodes or their interaction positions', () => {
    const { stage } = renderLabels();

    expect(stage.stageNodes.map((node) => node.position.x)).toEqual([1, 50, 99]);
  });

  test('labels stay centered on their nodes when no camera is supplied', () => {
    const stage = new MapStage(config, createPlayer());
    const renderer = createRenderer(widths);

    stage.render(renderer);

    expect(renderer.labels.map((label) => label.x)).toEqual([1, 50, 99]);
  });

  test('a label wider than the viewport starts at the left edge', () => {
    const stage = new MapStage(mapConfig([{ id: 'wide', display: 'Wide', x: 80 }]), createPlayer());
    const renderer = createRenderer({ Wide: 140 });

    stage.render(renderer, camera);

    expect(renderer.labels).toEqual([{ text: 'Wide', x: 70, y: 11.2 }]);
  });
});
