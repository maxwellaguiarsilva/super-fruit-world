import { describe, expect, test } from 'bun:test';
import { StageBase } from '../src/engine/entities/stage-base.js';
import { Tile } from '../src/game/entities/tile.js';
import { createStage } from './support/stage-fixture.js';

function section(name, x, y, width = 0, height = 0) {
  return {
    name,
    'parent-section': 'root',
    position: { x, y },
    size: { width, height }
  };
}

function tile(x, y, width = 1, height = 1) {
  return new Tile(x, y, width, height, {
    type: 'platform',
    solid: true,
    deadly: false,
    'damage-value': null,
    liquid: false,
    climbable: false,
    inverted: false,
    'slope-angle': null,
    friction: 0.75,
    rendered: true,
    'fill-color': '#FFFFFF',
    'border-color': '#FFFFFF',
    'border-width': 0.2,
    'corner-radius': 0.1
  });
}

describe('stage bounds algorithm', () => {
  test('a stage without sections or entities has empty bounds', () => {
    const stage = new StageBase({ name: 'empty' });

    expect(stage.bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  test('sections extend the bounds from the stage origin', () => {
    const stage = new StageBase({
      name: 'sections',
      sections: [section('alpha', 10, 20, 5, 6)]
    });

    expect(stage.bounds).toEqual({ x: 0, y: 0, width: 15, height: 26 });
  });

  test('recomputeBounds includes entities added after construction', () => {
    const stage = new StageBase({
      name: 'sections',
      sections: [section('alpha', 10, 20, 5, 6)]
    });

    stage.addEntity(tile(-2, 30, 1, 2));
    stage.recomputeBounds();

    expect(stage.bounds).toEqual({ x: -2, y: 0, width: 17, height: 32 });
  });

  test('an entity inside the existing bounds does not change them', () => {
    const stage = new StageBase({
      name: 'sections',
      sections: [section('alpha', 10, 20, 5, 6)]
    });
    const before = stage.bounds;

    stage.addEntity(tile(11, 21));
    stage.recomputeBounds();

    expect(stage.bounds).toEqual(before);
  });

  test('an entity without explicit dimensions counts as one unit', () => {
    const stage = new StageBase({ name: 'markers' });

    stage.addEntity({ x: 2, y: 3 });
    stage.recomputeBounds();

    expect(stage.bounds).toEqual({ x: 0, y: 0, width: 3, height: 4 });
  });

  test('the stage owns recomputeBounds for its dispatched entities', () => {
    const { stage } = createStage({
      stageData: {
        name: 'fixture',
        sections: [section('alpha', 10, 20, 5, 6)]
      }
    });

    expect(stage.bounds).toEqual({ x: 0, y: 0, width: 15, height: 26 });

    stage.addEntity(tile(40, -4, 2, 3));
    stage.recomputeBounds();

    expect(stage.bounds).toEqual({ x: 0, y: -4, width: 42, height: 30 });
  });
});
