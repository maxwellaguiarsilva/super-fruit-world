import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

import { StageBase } from '../src/engine/entities/stage-base.js';

const STAGE_IDS = [
  'avocado-grove',
  'banana-beach',
  'blueberry-peaks',
  'fruit-basket-citadel',
  'pitaya-canyon',
  'starfruit-caverns',
  'starfruit-caverns-branch',
  'strawberry-fields'
];

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8'));
}

const registry = readJson('data/audio/bgm.json');
const stages = STAGE_IDS.map((stageId) => ({
  stageId,
  data: readJson(`data/stages/${stageId}.json`)
}));

describe('stage bgm data', () => {
  test('every declared stage track is registered in data/audio/bgm.json', () => {
    for (const { stageId, data } of stages) {
      expect({ stageId, bgm: data.bgm, registered: Boolean(registry.tracks[data.bgm]) }).toEqual({
        stageId,
        bgm: data.bgm,
        registered: true
      });
    }
  });

  test('the secret branch declares a track that differs from its stage name', () => {
    const branch = stages.find(({ stageId }) => stageId === 'starfruit-caverns-branch');

    expect(branch.data.bgm).toBe('secret-waterfall');
    expect(branch.data.bgm).not.toBe(branch.data.name);
  });

  test('a stage exposes its declared bgm track from the stage data', () => {
    for (const { data } of stages) {
      expect(new StageBase(data).bgm).toBe(data.bgm);
    }
  });

  test('a stage without a declared track exposes no bgm', () => {
    expect(new StageBase({ name: 'fixture' }).bgm).toBe(null);
  });
});
