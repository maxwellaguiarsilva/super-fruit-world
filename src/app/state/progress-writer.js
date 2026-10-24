import { completeStageProgress } from '../../game/systems/progression-system.js';

class ProgressWriter {
  #store;
  #buildSnapshot;

  constructor({ store, buildSnapshot } = {}) {
    if (!store || typeof store.save !== 'function') {
      throw new TypeError('ProgressWriter requires a ProgressStore-compatible instance.');
    }
    if (typeof buildSnapshot !== 'function') {
      throw new TypeError('ProgressWriter requires a buildSnapshot function.');
    }

    this.#store = store;
    this.#buildSnapshot = buildSnapshot;
  }

  save(progress) {
    this.#store.save(this.#buildSnapshot(progress));
    return progress;
  }

  completeStage(progress, stageId, mapConfig, inventory) {
    const next = completeStageProgress(progress, stageId, mapConfig, inventory);
    this.save(next);
    return next;
  }
}

export { ProgressWriter };
