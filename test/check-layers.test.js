import { describe, expect, test } from 'bun:test';

import {
  checkLayers,
  collectImports,
  findLayerViolations,
  layerOf,
  resolveTarget
} from '../scripts/check-layers.js';

function sources(entries) {
  return Object.entries(entries).map(([path, source]) => ({ path, source }));
}

describe('layer classification', () => {
  test('maps source paths to their layer', () => {
    expect(layerOf('src/main.js')).toBe('main');
    expect(layerOf('src/engine/index.js')).toBe('engine');
    expect(layerOf('src/engine/renderer/camera.js')).toBe('engine');
    expect(layerOf('src/game/scenes/scenes.js')).toBe('game');
    expect(layerOf('src/app/app.js')).toBe('app');
  });

  test('ignores paths outside the layer tree', () => {
    expect(layerOf('scripts/check-layers.js')).toBeNull();
    expect(layerOf('test/camera.test.js')).toBeNull();
    expect(layerOf('src/engine')).toBeNull();
  });

  test('resolves relative specifiers against the importing file', () => {
    expect(resolveTarget('src/app/app.js', '../engine/index.js')).toBe('src/engine/index.js');
    expect(resolveTarget('src/game/map/map-stage.js', './label-layout.js')).toBe('src/game/map/label-layout.js');
    expect(resolveTarget('src/app/app.js', 'bun:test')).toBeNull();
    expect(resolveTarget('src/app/app.js', '/absolute.js')).toBeNull();
  });
});

describe('import collection', () => {
  test('collects static imports, side-effect imports, re-exports and dynamic imports', () => {
    const source = [
      "import { a } from '../engine/index.js';",
      "import '../engine/side-effect.js';",
      "export { b } from '../game/x.js';",
      "const c = await import('../app/y.js');"
    ].join('\n');

    expect(collectImports(source)).toEqual([
      { specifier: '../engine/index.js', line: 1 },
      { specifier: '../engine/side-effect.js', line: 2 },
      { specifier: '../game/x.js', line: 3 },
      { specifier: '../app/y.js', line: 4 }
    ]);
  });

  test('does not treat a string assignment as an import', () => {
    expect(collectImports("export const label = 'not an import';")).toEqual([]);
  });
});

describe('layer direction', () => {
  test('accepts every allowed direction', () => {
    const files = sources({
      'src/main.js': "import './app/app.js';",
      'src/app/app.js': "import '../engine/index.js';\nimport '../game/scenes/scenes.js';\nimport './state/progress-writer.js';",
      'src/game/scenes/scenes.js': "import '../../engine/core/scene.js';\nimport '../systems/health-system.js';",
      'src/engine/index.js': "export { Camera } from './renderer/camera.js';"
    });

    expect(findLayerViolations(files)).toEqual([]);
  });

  test('rejects an engine module importing game', () => {
    const violations = findLayerViolations(sources({
      'src/engine/audio/audio-engine.js': "import { Inventory } from '../../game/systems/inventory.js';"
    }));

    expect(violations).toEqual([
      {
        file: 'src/engine/audio/audio-engine.js',
        line: 1,
        specifier: '../../game/systems/inventory.js',
        target: 'src/game/systems/inventory.js',
        fromLayer: 'engine',
        toLayer: 'game',
        rule: 'engine may import only engine modules'
      }
    ]);
  });

  test('rejects an engine module importing app', () => {
    const violations = findLayerViolations(sources({
      'src/engine/index.js': "import { SceneRouter } from '../app/navigation/scene-router.js';"
    }));

    expect(violations.map((violation) => violation.toLayer)).toEqual(['app']);
  });

  test('rejects a game module importing app', () => {
    const violations = findLayerViolations(sources({
      'src/game/scenes/scenes.js': "import { SceneRouter } from '../../app/navigation/scene-router.js';"
    }));

    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe('game may import only engine, game modules');
  });

  test('rejects any import of main.js', () => {
    const violations = findLayerViolations(sources({
      'src/app/app.js': "import { booted } from '../main.js';",
      'src/engine/index.js': "import '../main.js';"
    }));

    expect(violations).toHaveLength(2);
    expect(violations.map((violation) => violation.rule)).toEqual([
      'no module may import src/main.js',
      'no module may import src/main.js'
    ]);
  });

  test('rejects a violation behind a dynamic import and reports its line', () => {
    const violations = findLayerViolations(sources({
      'src/game/map/map-stage.js': [
        "import { StageBase } from '../../engine/entities/stage-base.js';",
        '',
        "const router = await import('../../app/navigation/scene-router.js');"
      ].join('\n')
    }));

    expect(violations).toEqual([
      {
        file: 'src/game/map/map-stage.js',
        line: 3,
        specifier: '../../app/navigation/scene-router.js',
        target: 'src/app/navigation/scene-router.js',
        fromLayer: 'game',
        toLayer: 'app',
        rule: 'game may import only engine, game modules'
      }
    ]);
  });

  test('ignores bare specifiers and targets outside src', () => {
    const files = sources({
      'src/engine/data/save-system.js': "import { readFileSync } from 'node:fs';",
      'src/app/app.js': "import { helper } from '../../scripts/helper.js';"
    });

    expect(findLayerViolations(files)).toEqual([]);
  });
});

describe('the real tree', () => {
  test('has no layer violations', async () => {
    const { files, violations } = await checkLayers();

    expect(files.length).toBeGreaterThan(0);
    expect(files.map((file) => file.path)).toContain('src/main.js');
    expect(files.map((file) => file.path)).toContain('src/engine/index.js');
    expect(files.map((file) => file.path)).toContain('src/game/scenes/scenes.js');
    expect(files.map((file) => file.path)).toContain('src/app/app.js');
    expect(violations).toEqual([]);
  });
});
