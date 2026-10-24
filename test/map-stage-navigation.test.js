import { describe, expect, test } from 'bun:test';

import { MapStage } from '../src/game/map/map-stage.js';

function createMapConfig(objects, options = {}) {
  return {
    name: 'test-map',
    sections: [
      {
        name: options.sectionName ?? 'main',
        'parent-section': 'root',
        position: options.position ?? { x: 0, y: 0 },
        size: options.size ?? { width: 100, height: 100 },
        objects
      }
    ]
  };
}

function createNode(stageId, x, y, overrides = {}) {
  return {
    type: 'stage-node',
    'stage-id': stageId,
    display: stageId,
    position: { x, y },
    ...overrides
  };
}

function createPlayer(x = 0, y = 0) {
  return { x, y };
}

function captureConsoleWarn(callback) {
  const messages = [];
  const original = console.warn;
  console.warn = (message) => messages.push(message);

  try {
    const result = callback();
    return { result, messages };
  } finally {
    console.warn = original;
  }
}

describe('MapStage construction', () => {
  test('collects nodes with their world position and default state', () => {
    const config = createMapConfig([createNode('one', 3, 4), createNode('two', 10, 20)], {
      position: { x: 5, y: 6 }
    });

    const stage = new MapStage(config, createPlayer());

    expect(stage.stageNodes).toEqual([
      {
        id: 'one',
        display: 'one',
        state: 'available',
        'unlock-condition': null,
        'data-available': true,
        position: { x: 8, y: 10 }
      },
      {
        id: 'two',
        display: 'two',
        state: 'available',
        'unlock-condition': null,
        'data-available': true,
        position: { x: 15, y: 26 }
      }
    ]);
  });

  test('keeps state, unlock condition and data availability', () => {
    const config = createMapConfig([
      createNode('one', 0, 0, {
        state: 'locked',
        'unlock-condition': { type: 'stage-complete', stage: 'zero' }
      })
    ]);

    const stage = new MapStage(config, createPlayer(), { hasStageData: () => false });

    expect(stage.stageNodes[0]).toMatchObject({
      state: 'locked',
      'unlock-condition': { type: 'stage-complete', stage: 'zero' },
      'data-available': false
    });
  });

  test('resolves display labels from explicit text, the resolver, then the stage id', () => {
    const config = createMapConfig([
      createNode('explicit', 0, 0, { display: 'Explicit' }),
      createNode('keyed', 1, 0, { display: undefined, 'display-name-key': 'stage.keyed' }),
      createNode('fallback', 2, 0, { display: undefined })
    ]);

    const stage = new MapStage(config, createPlayer(), {
      resolveText: (key) => (key === 'stage.keyed' ? 'Keyed Label' : key)
    });

    expect(stage.stageNodes.map((node) => node.display)).toEqual(['Explicit', 'Keyed Label', 'fallback']);
  });

  test('ignores a stage node without a stage id', () => {
    const stage = new MapStage(createMapConfig([
      { type: 'stage-node', display: 'Broken', position: { x: 0, y: 0 } }
    ]), createPlayer());

    expect(stage.stageNodes).toEqual([]);
  });

  test('collects paths, area labels and teleporter markers', () => {
    const config = createMapConfig([
      createNode('one', 0, 0),
      createNode('two', 10, 0),
      { type: 'path', from: 'one', to: 'two', visual: { color: 'green' }, position: { x: 5, y: 0 } },
      { type: 'area-label', name: 'area', 'display-name-key': 'area.key', position: { x: 2, y: 2 } },
      { type: 'teleporter-marker', name: 'marker', position: { x: 7, y: 7 } }
    ]);

    const stage = new MapStage(config, createPlayer(), {
      resolveText: (key) => (key === 'area.key' ? 'Area Label' : key)
    });

    expect(stage.paths).toEqual([
      { from: 'one', to: 'two', visual: { color: 'green' }, position: { x: 5, y: 0 } }
    ]);
    expect(stage.areaLabels).toEqual([
      { name: 'area', display: 'Area Label', position: { x: 2, y: 2 } }
    ]);
    expect(stage.teleporterMarkers).toEqual([{ name: 'marker', position: { x: 7, y: 7 } }]);
  });

  test('warns once for every map teleporter and does not activate it', () => {
    const config = createMapConfig([
      createNode('one', 0, 0),
      { type: 'map-teleporter', name: 'north', position: { x: 0, y: 0 } }
    ]);

    const { messages } = captureConsoleWarn(() => new MapStage(config, createPlayer()));

    expect(messages).toEqual([
      '[map] Map teleporter "north" is ignored: teleporters belong to stages.'
    ]);
  });
});

describe('MapStage active node selection', () => {
  const config = createMapConfig([
    createNode('locked', 0, 0, { state: 'locked' }),
    createNode('available', 10, 0),
    createNode('completed', 20, 0, { state: 'completed' })
  ]);

  test('prefers the requested stage when it is selectable', () => {
    const stage = new MapStage(config, createPlayer(), { preferredStageId: 'completed' });

    expect(stage.activeNode).toBe('completed');
  });

  test('falls back to the first selectable node when the request is locked', () => {
    const stage = new MapStage(config, createPlayer(), { preferredStageId: 'locked' });

    expect(stage.activeNode).toBe('available');
  });

  test('falls back when the requested stage has no data file', () => {
    const stage = new MapStage(config, createPlayer(), {
      preferredStageId: 'completed',
      hasStageData: (stageId) => stageId !== 'completed'
    });

    expect(stage.activeNode).toBe('available');
  });

  test('falls back when the requested stage is unknown', () => {
    const stage = new MapStage(config, createPlayer(), { preferredStageId: 'missing' });

    expect(stage.activeNode).toBe('available');
  });

  test('uses the first node when nothing is selectable', () => {
    const lockedConfig = createMapConfig([
      createNode('first', 0, 0, { state: 'locked' }),
      createNode('second', 10, 0, { state: 'locked' })
    ]);

    const stage = new MapStage(lockedConfig, createPlayer());

    expect(stage.activeNode).toBe('first');
  });

  test('has no active node on an empty map', () => {
    const stage = new MapStage(createMapConfig([]), createPlayer());

    expect(stage.activeNode).toBeNull();
    expect(stage.activeNodePosition).toBeNull();
  });

  test('reports the active node position', () => {
    const stage = new MapStage(config, createPlayer(), { preferredStageId: 'completed' });

    expect(stage.activeNodePosition).toEqual({ x: 20, y: 0 });
  });
});

describe('MapStage navigation', () => {
  const config = createMapConfig([
    createNode('center', 0, 0),
    createNode('right', 10, 0),
    createNode('left', -10, 0),
    createNode('down', 0, 10),
    createNode('down-right', 10, 10)
  ]);

  function createStage() {
    return new MapStage(config, createPlayer());
  }

  test('moves to the nearest node in a direction', () => {
    const stage = createStage();

    expect(stage.navigate('right')).toBe(true);
    expect(stage.activeNode).toBe('right');
  });

  test('moves to a node behind the active node in the opposite direction', () => {
    const stage = createStage();
    stage.navigate('right');

    expect(stage.navigate('left')).toBe(true);
    expect(stage.activeNode).toBe('center');
  });

  test('returns false and keeps the active node when no node lies in that direction', () => {
    const stage = createStage();

    expect(stage.navigate('up')).toBe(false);
    expect(stage.activeNode).toBe('center');
  });

  test('rejects an unknown direction', () => {
    const stage = createStage();

    expect(stage.navigate('sideways')).toBe(false);
    expect(stage.activeNode).toBe('center');
  });

  test('prefers distance over lateral offset', () => {
    const diagonalConfig = createMapConfig([
      createNode('center', 0, 0),
      createNode('near-off-axis', 10, 2),
      createNode('far-on-axis', 12, 0)
    ]);
    const stage = new MapStage(diagonalConfig, createPlayer());

    stage.navigate('right');

    expect(stage.activeNode).toBe('near-off-axis');
  });

  test('breaks equal distances by lateral offset and then by stage id', () => {
    const tieConfig = createMapConfig([
      createNode('center', 0, 0),
      createNode('tie-b', 10, 5),
      createNode('tie-a', 10, -5)
    ]);
    const stage = new MapStage(tieConfig, createPlayer());

    stage.navigate('right');

    expect(stage.activeNode).toBe('tie-a');
  });

  test('moves the player to the new node position', () => {
    const player = createPlayer();
    const stage = new MapStage(config, player);

    stage.navigateTo('down-right');

    expect(player.x).toBe(10);
    expect(player.y).toBe(10);
  });

  test('navigating to a known node updates the active node and the player', () => {
    const player = createPlayer();
    const stage = new MapStage(config, player);

    stage.navigateTo('left');

    expect(stage.activeNode).toBe('left');
    expect(player).toEqual({ x: -10, y: 0 });
  });

  test('navigating to an unknown node changes nothing', () => {
    const player = createPlayer();
    const stage = new MapStage(config, player);

    stage.navigateTo('missing');

    expect(stage.activeNode).toBe('center');
    expect(player).toEqual({ x: 0, y: 0 });
  });
});

describe('MapStage selection', () => {
  const config = createMapConfig([
    createNode('available', 0, 0),
    createNode('completed', 10, 0, { state: 'completed' }),
    createNode('locked', 20, 0, { state: 'locked' }),
    createNode('missing-data', 30, 0)
  ]);

  test('selects an available node', () => {
    const stage = new MapStage(config, createPlayer(), { preferredStageId: 'available' });

    expect(stage.selectNode()).toBe(true);
  });

  test('selects a completed node', () => {
    const stage = new MapStage(config, createPlayer(), { preferredStageId: 'completed' });

    expect(stage.selectNode()).toBe(true);
  });

  test('rejects a locked node', () => {
    const stage = new MapStage(config, createPlayer(), { preferredStageId: 'locked' });

    stage.navigateTo('locked');

    expect(stage.activeNode).toBe('locked');
    expect(stage.selectNode()).toBe(false);
  });

  test('rejects a node whose stage data is missing', () => {
    const stage = new MapStage(config, createPlayer(), {
      hasStageData: (stageId) => stageId !== 'missing-data'
    });

    stage.navigateTo('missing-data');

    expect(stage.activeNode).toBe('missing-data');
    expect(stage.selectNode()).toBe(false);
  });

  test('reports every selectable stage and answers per stage id', () => {
    const stage = new MapStage(config, createPlayer(), {
      hasStageData: (stageId) => stageId !== 'missing-data'
    });

    expect(stage.unlockedStages).toEqual(['available', 'completed']);
    expect(stage.isStageUnlocked('available')).toBe(true);
    expect(stage.isStageUnlocked('locked')).toBe(false);
    expect(stage.isStageUnlocked('missing-data')).toBe(false);
    expect(stage.isStageUnlocked('unknown')).toBe(false);
  });

  test('selecting on an empty map returns false', () => {
    const stage = new MapStage(createMapConfig([]), createPlayer());

    expect(stage.selectNode()).toBe(false);
  });
});

describe('MapStage input dispatch', () => {
  const config = createMapConfig([
    createNode('center', 0, 0),
    createNode('right', 10, 0),
    createNode('down', 0, 10)
  ]);

  test('does nothing without an input manager', () => {
    const stage = new MapStage(config, createPlayer());

    stage.update(0.5);

    expect(stage.activeNode).toBe('center');
  });

  test('navigates once for every pressed direction', () => {
    const stage = new MapStage(config, createPlayer());
    const pressed = new Set(['right', 'down']);
    const inputManager = { isPressed: (direction) => pressed.has(direction) };

    stage.update(0.5, inputManager);

    expect(stage.activeNode).toBe('down');
  });

  test('ignores directions that are not pressed', () => {
    const stage = new MapStage(config, createPlayer());
    const inputManager = { isPressed: () => false };

    stage.update(0.5, inputManager);

    expect(stage.activeNode).toBe('center');
  });
});
