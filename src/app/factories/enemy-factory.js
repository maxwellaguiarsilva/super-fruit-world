import { PatrolEnemy, ShooterEnemy, FlyerEnemy, BossEnemy } from '../../game/entities/enemy-types.js';
import { createKindRegistry } from '../content/kind-registry.js';

const ENEMY_KIND_ENTRIES = [
  ['patrol', (config, stage, deps) => new PatrolEnemy(config, stage, deps)],
  ['shooter', (config, stage, deps) => new ShooterEnemy(config, stage, deps)],
  ['flyer', (config, stage, deps) => new FlyerEnemy(config, stage, deps)],
  ['boss', (config, stage, deps) => new BossEnemy(config, stage, deps)]
];

function enemyKind(config) {
  return config['is-boss'] ? 'boss' : (config.behavior ?? 'patrol');
}

function createEnemyFactory(deps = {}) {
  const registry = createKindRegistry('enemy kind', ENEMY_KIND_ENTRIES);

  return function createEnemy(config, stage) {
    const create = registry.resolve(enemyKind(config));
    return create(config, stage, deps);
  };
}

export { createEnemyFactory, ENEMY_KIND_ENTRIES };
