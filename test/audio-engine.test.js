import { afterEach, describe, expect, test } from 'bun:test';
import {
  AudioEngine,
  flattenBGMNotes,
  resolveBGMPlan
} from '../src/engine/audio/audio-engine.js';
import { NoteFrequencyCalculator } from '../src/engine/audio/note-frequency-calculator.js';

const DEFAULT_ENVELOPE = {
  attack: 0.01,
  decay: 0.10,
  sustain: 0.5,
  release: 0.05
};

const AUDIO_CONFIG = {
  'master-volume': 0.6,
  'bgm-volume': 0.6,
  'sfx-volume': 1.0,
  'sound-enabled': true,
  'bgm-enabled': true,
  'sfx-enabled': true,
  'bgm-crossfade-duration': 0
};

function assertFinite(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(
      `Failed to execute 'setValueAtTime' on 'AudioParam': ` +
      `The provided float value is non-finite (${value}).`
    );
  }
}

class FakeAudioParam {
  constructor() {
    this.value = 0;
    this.events = [];
  }

  setValueAtTime(value, time) {
    assertFinite(value);
    assertFinite(time);
    this.value = value;
    this.events.push(['setValueAtTime', value, time]);
  }

  linearRampToValueAtTime(value, time) {
    assertFinite(value);
    assertFinite(time);
    this.events.push(['linearRampToValueAtTime', value, time]);
  }

  cancelScheduledValues(time) {
    assertFinite(time);
    this.events.push(['cancelScheduledValues', time]);
  }
}

class FakeAudioContext {
  static lastInstance = null;

  constructor() {
    this.currentTime = 0;
    this.destination = { name: 'destination' };
    this.createdGains = [];
    this.createdOscillators = [];
    FakeAudioContext.lastInstance = this;
  }

  createGain() {
    const gain = {
      gain: new FakeAudioParam(),
      connect() {}
    };
    this.createdGains.push(gain);
    return gain;
  }

  createOscillator() {
    const oscillator = {
      type: 'sine',
      frequency: new FakeAudioParam(),
      connect() {},
      start(time) {
        assertFinite(time);
        oscillator.startTime = time;
      },
      stop(time) {
        assertFinite(time);
        oscillator.stopTime = time;
      },
      disconnect() {},
      onended: null
    };
    this.createdOscillators.push(oscillator);
    return oscillator;
  }

  resume() {
    return Promise.resolve();
  }

  suspend() {}
}

class FailingOscillatorContext extends FakeAudioContext {
  createOscillator() {
    throw new Error('oscillator allocation failed');
  }
}

function installAudioContext(ContextClass) {
  globalThis.window = { AudioContext: ContextClass };
}

function createEngine(tracks, sfx = { sounds: {} }, options = {}) {
  const calculator = new NoteFrequencyCalculator({
    'reference-frequency': 440,
    'reference-note': 'a4',
    'note-range': { lowest: 'c4', highest: 'c5' }
  });

  return new AudioEngine(
    AUDIO_CONFIG,
    sfx,
    tracks,
    calculator,
    DEFAULT_ENVELOPE,
    options
  );
}

function captureWarnings(run) {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    run();
  } finally {
    console.warn = originalWarn;
  }
  return warnings;
}

afterEach(() => {
  delete globalThis.window;
  FakeAudioContext.lastInstance = null;
});

describe('resolveBGMPlan', () => {
  test('resolves the legacy single-channel shape', () => {
    const plan = resolveBGMPlan({
      bpm: 100,
      wave: 'sine',
      notes: [['c4', 2], ['d4', 1]]
    }, 0.6);

    expect(plan.problems).toEqual([]);
    expect(plan.beatDuration).toBeCloseTo(0.6, 10);
    expect(plan.channels).toHaveLength(1);
    expect(plan.channels[0].volume).toBe(0.6);
    expect(plan.channels[0].wave).toBe('sine');
    expect(plan.channels[0].entries).toEqual([
      { name: 'c4', beats: 2 },
      { name: 'd4', beats: 1 }
    ]);
  });

  test('prefers the channel volume over the track and engine volume', () => {
    const plan = resolveBGMPlan({
      bpm: 120,
      channels: {
        lead: { wave: 'square', volume: 0.25, notes: [['c4', 1]] }
      }
    }, 0.6);

    expect(plan.channels[0].volume).toBe(0.25);
    expect(plan.problems).toEqual([]);
  });

  test('falls back to the documented engine volume when every volume is missing', () => {
    const plan = resolveBGMPlan({ bpm: 120, notes: [['c4', 1]] }, null);

    expect(plan.channels[0].volume).toBe(0.5);
    expect(plan.problems).toHaveLength(1);
    expect(plan.problems[0]).toContain('channels[0].volume');
  });

  test('falls back to the default tempo when bpm is missing or invalid', () => {
    for (const bpm of [undefined, 0, -60, Number.NaN, Number.POSITIVE_INFINITY, 'fast']) {
      const plan = resolveBGMPlan({ bpm, notes: [['c4', 1]] }, 0.6);

      expect(plan.bpm).toBe(120);
      expect(plan.beatDuration).toBeCloseTo(0.5, 10);
      expect(plan.problems.some((problem) => problem.startsWith('bpm'))).toBe(true);
    }
  });

  test('resolves every note duration to a positive finite number of beats', () => {
    const plan = resolveBGMPlan({
      bpm: 120,
      notes: [
        ['c4', 0.5],
        ['d4', 0],
        ['e4', -1],
        ['f4', Number.NaN],
        ['g4', Number.POSITIVE_INFINITY],
        ['a4'],
        ['b4', 'long'],
        'c5',
        ['rest', 2]
      ]
    }, 0.6);

    const beats = plan.channels[0].entries.map((entry) => entry.beats);
    expect(beats.every((value) => Number.isFinite(value) && value > 0)).toBe(true);
    expect(beats).toEqual([0.5, 1, 1, 1, 1, 1, 1, 1, 2]);
  });

  test('replaces unsupported waveforms with the default wave', () => {
    const plan = resolveBGMPlan({
      bpm: 120,
      channels: {
        lead: { wave: 'noise', volume: 0.5, notes: [['c4', 1]] }
      }
    }, 0.6);

    expect(plan.channels[0].wave).toBe('sine');
    expect(plan.problems.some((problem) => problem.includes('wave'))).toBe(true);
  });

  test('returns no channel entries when notes are not an array', () => {
    const plan = resolveBGMPlan({ bpm: 120, volume: 0.5, notes: 'c4' }, 0.6);

    expect(plan.channels).toHaveLength(1);
    expect(plan.channels[0].entries).toEqual([]);
  });
});

describe('flattenBGMNotes', () => {
  test('expands phrase references and keeps inline notes', () => {
    const track = {
      phrases: {
        'p-1': [['c4', 1], 'p-2'],
        'p-2': [['d4', 2]]
      },
      notes: ['p-1', ['e4', 1]]
    };

    expect(flattenBGMNotes(track, { notes: ['p-2'] })).toEqual([['d4', 2]]);
    expect(flattenBGMNotes(track)).toEqual([['c4', 1], ['d4', 2], ['e4', 1]]);
  });

  test('stops expanding cyclic phrase references', () => {
    const track = {
      phrases: {
        a: ['b'],
        b: ['a']
      },
      notes: ['a']
    };

    expect(flattenBGMNotes(track)).toEqual([]);
  });
});

describe('AudioEngine BGM scheduling', () => {
  test('plays the legacy single-channel shape without throwing', () => {
    installAudioContext(FakeAudioContext);
    const engine = createEngine({
      'world-map': {
        bpm: 100,
        wave: 'sine',
        notes: [['c4', 2], ['d4', 2]],
        loop: false
      }
    });

    const warnings = captureWarnings(() => engine.playBGM('world-map'));
    const context = FakeAudioContext.lastInstance;

    expect(warnings).toEqual([]);
    expect(engine.currentBGM).toBe('world-map');
    expect(context.createdOscillators).toHaveLength(2);
    expect(context.createdOscillators[0].startTime).toBe(0);
    expect(context.createdOscillators[0].stopTime).toBeCloseTo(1.2, 10);
    expect(context.createdOscillators[1].startTime).toBeCloseTo(1.2, 10);
  });

  test('schedules only finite values for a malformed track', () => {
    installAudioContext(FakeAudioContext);
    const engine = createEngine({
      broken: {
        bpm: 'fast',
        volume: Number.NaN,
        wave: 'noise',
        loop: false,
        notes: [['c4', 'long'], ['rest', 0], ['d4']]
      }
    });

    const warnings = captureWarnings(() => engine.playBGM('broken'));
    const context = FakeAudioContext.lastInstance;

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"broken"');
    expect(warnings[0]).toContain('bpm');
    expect(warnings[0]).toContain('channels[0].notes[0][1]');
    expect(warnings[0]).toContain('channels[0].notes[1][1]');
    expect(warnings[0]).toContain('channels[0].notes[2][1]');
    expect(engine.currentBGM).toBe('broken');
    expect(context.createdOscillators).toHaveLength(2);
    expect(context.createdGains[1].gain.value).toBe(0.6);
  });

  test('warns and keeps running when scheduling fails', () => {
    installAudioContext(FailingOscillatorContext);
    const engine = createEngine({
      broken: {
        bpm: 120,
        volume: 0.5,
        loop: false,
        notes: [['c4', 1]]
      }
    });

    const warnings = captureWarnings(() => engine.playBGM('broken'));

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"broken"');
    expect(warnings[0]).toContain('oscillator allocation failed');
    expect(engine.currentBGM).toBeNull();
  });
});

describe('AudioEngine SFX scheduling', () => {
  test('resolves malformed SFX values to finite numbers', () => {
    installAudioContext(FakeAudioContext);
    const engine = createEngine({}, {
      sounds: {
        jump: {
          wave: 'noise',
          freq: 'c4',
          duration: Number.NaN,
          envelope: { attack: Number.NaN, release: -1 }
        }
      }
    });

    expect(engine.playSFX('jump')).toBe(true);

    const oscillator = FakeAudioContext.lastInstance.createdOscillators[0];
    expect(oscillator.type).toBe('sine');
    expect(Number.isFinite(oscillator.startTime)).toBe(true);
    expect(Number.isFinite(oscillator.stopTime)).toBe(true);
  });

  test('returns false and reports an unknown sound once', () => {
    installAudioContext(FakeAudioContext);
    const reports = [];
    const engine = createEngine({}, { sounds: {} }, {
      logger: (message) => reports.push(message)
    });

    expect(engine.playSFX('missing')).toBe(false);
    expect(engine.playSFX('missing')).toBe(false);
    expect(reports).toEqual([
      '[AudioEngine] Unknown sound "missing" in data/audio/sfx.json; playback skipped.'
    ]);
    expect(FakeAudioContext.lastInstance).toBeNull();
  });

  test('returns false and reports a sound without a frequency once', () => {
    installAudioContext(FakeAudioContext);
    const reports = [];
    const engine = createEngine({}, { sounds: { musical: { freq: null } } }, {
      logger: (message) => reports.push(message)
    });

    expect(engine.playSFX('musical')).toBe(false);
    expect(engine.playSFX('musical')).toBe(false);
    expect(reports).toEqual([
      '[AudioEngine] Sound "musical" has no usable frequency in data/audio/sfx.json; playback skipped.'
    ]);
    expect(FakeAudioContext.lastInstance).toBeNull();
  });

  test('plays a sound whose note-name override supplies the frequency', () => {
    installAudioContext(FakeAudioContext);
    const reports = [];
    const engine = createEngine({}, {
      sounds: { musical: { freq: null, wave: 'square' } }
    }, {
      logger: (message) => reports.push(message)
    });

    expect(engine.playSFX('musical', 'c4')).toBe(true);
    expect(reports).toEqual([]);

    const oscillator = FakeAudioContext.lastInstance.createdOscillators[0];
    expect(oscillator.type).toBe('square');
    expect(oscillator.frequency.events[0][0]).toBe('setValueAtTime');
    expect(oscillator.frequency.events[0][1]).toBeCloseTo(261.6256, 3);
  });

  test('returns false and reports an unusable note-name override once', () => {
    installAudioContext(FakeAudioContext);
    const reports = [];
    const engine = createEngine({}, { sounds: { musical: { freq: null } } }, {
      logger: (message) => reports.push(message)
    });

    expect(engine.playSFX('musical', 'not-a-note')).toBe(false);
    expect(engine.playSFX('musical', 'not-a-note')).toBe(false);
    expect(reports).toEqual([
      '[AudioEngine] Sound "musical" has no usable frequency in data/audio/sfx.json; playback skipped.'
    ]);
  });
});
