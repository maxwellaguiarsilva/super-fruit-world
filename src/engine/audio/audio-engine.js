import { NoteFrequencyCalculator } from './note-frequency-calculator.js';
import { OnceReporter } from '../core/report-once.js';

// Engine defaults applied when a BGM track omits or malforms a value. They are
// documented here because this module is the single place where track data is
// resolved into finite Web Audio parameters.
// - track, channel and audio-config volumes are used before the volume default;
// - bpm falls back to 120, which gives a beat duration of 0.5s;
// - a note without a usable duration lasts one beat;
// - an unknown waveform falls back to a sine wave.
const DEFAULT_BGM_VOLUME = 0.5;
const DEFAULT_BGM_BPM = 120;
const DEFAULT_NOTE_BEATS = 1;
const DEFAULT_WAVE = 'sine';
const DEFAULT_MASTER_VOLUME = 1;
const DEFAULT_CROSSFADE_DURATION = 0;
const DEFAULT_FREQUENCY = 440;
const DEFAULT_SFX_DURATION = 0.2;
const DEFAULT_SFX_ENVELOPE = Object.freeze({
  attack: 0.01,
  decay: 0.10,
  sustain: 0.5,
  release: 0.05
});
const SUPPORTED_WAVES = new Set(['sine', 'square', 'sawtooth', 'triangle']);

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function describeValue(value) {
  if (value === undefined) return 'missing';
  if (typeof value === 'string') return JSON.stringify(value);
  return String(value);
}

function sanitizeNonNegative(value, fallback) {
  if (!isFiniteNumber(value)) return fallback;
  return value < 0 ? 0 : value;
}

function sanitizeVolume(value, fallback) {
  if (!isFiniteNumber(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function sanitizeWave(value) {
  return typeof value === 'string' && SUPPORTED_WAVES.has(value) ? value : DEFAULT_WAVE;
}

function sanitizeFrequency(value) {
  return isFiniteNumber(value) && value > 0 ? value : DEFAULT_FREQUENCY;
}

function resolveFiniteValue(value, fallback, problems, field) {
  if (isFiniteNumber(value)) {
    return value;
  }
  problems.push(`${field} is ${describeValue(value)}`);
  return fallback;
}

function resolvePositiveValue(value, fallback, problems, field) {
  const resolved = resolveFiniteValue(value, fallback, problems, field);
  if (resolved > 0) {
    return resolved;
  }
  problems.push(`${field} is ${describeValue(value)} (must be greater than zero)`);
  return fallback;
}

function resolveVolumeValue(value, fallback, problems, field) {
  const resolved = resolveFiniteValue(value, fallback, problems, field);
  if (resolved >= 0 && resolved <= 1) {
    return resolved;
  }
  problems.push(`${field} is ${describeValue(value)} (outside 0..1)`);
  return Math.max(0, Math.min(1, resolved));
}

function getBGMChannels(bgm) {
  const channels = bgm?.['channels'];
  if (Array.isArray(channels)) {
    return channels.filter((channel) => channel && typeof channel === 'object');
  }
  if (channels && typeof channels === 'object') {
    return Object.values(channels).filter((channel) => channel && typeof channel === 'object');
  }
  return [
    {
      'wave': bgm?.['wave'],
      'volume': bgm?.['volume'],
      'phrases': bgm?.['phrases'],
      'notes': bgm?.['notes']
    }
  ];
}

function flattenBGMNotes(bgm, channel = null) {
  const trackPhrases = bgm?.['phrases'];
  const channelPhrases = channel?.['phrases'];
  const phrases = { ...trackPhrases, ...channelPhrases };
  const rawSequence = channel ? channel['notes'] : bgm?.['notes'];

  if (!Array.isArray(rawSequence)) {
    return [];
  }

  const result = [];
  const expand = (entries, visited = new Set()) => {
    for (const entry of entries) {
      if (typeof entry === 'string' && Array.isArray(phrases[entry])) {
        if (visited.has(entry)) {
          continue;
        }
        visited.add(entry);
        expand(phrases[entry], visited);
        visited.delete(entry);
      } else {
        result.push(entry);
      }
    }
  };

  expand(rawSequence);
  return result;
}

function resolveChannelVolume(channel, bgm, configVolume, problems, field) {
  const candidates = [channel?.['volume'], bgm?.['volume'], configVolume];
  for (const candidate of candidates) {
    if (isFiniteNumber(candidate)) {
      return resolveVolumeValue(candidate, DEFAULT_BGM_VOLUME, problems, field);
    }
  }
  problems.push(
    `${field} is ${describeValue(channel?.['volume'])} and no track or engine volume is usable`
  );
  return DEFAULT_BGM_VOLUME;
}

function resolveChannelWave(channel, bgm, problems, field) {
  const raw = channel?.['wave'] ?? bgm?.['wave'];
  if (typeof raw === 'string' && SUPPORTED_WAVES.has(raw)) {
    return raw;
  }
  if (raw !== undefined) {
    problems.push(`${field} is ${describeValue(raw)}`);
  }
  return DEFAULT_WAVE;
}

function resolveNoteEntry(entry, problems, field) {
  if (typeof entry === 'string') {
    return { name: entry, beats: DEFAULT_NOTE_BEATS };
  }
  if (!Array.isArray(entry)) {
    problems.push(`${field} is ${describeValue(entry)}`);
    return { name: 'rest', beats: DEFAULT_NOTE_BEATS };
  }

  const rawName = entry[0];
  let name = rawName;
  if (typeof rawName !== 'string') {
    problems.push(`${field}[0] is ${describeValue(rawName)}`);
    name = 'rest';
  }

  return {
    name,
    beats: resolvePositiveValue(entry[1], DEFAULT_NOTE_BEATS, problems, `${field}[1]`)
  };
}

// Converts a BGM track definition into finite playback parameters. Every value
// that reaches a Web Audio call is resolved here, and each malformed value is
// recorded in `problems` so the caller can emit a single warning per track.
function resolveBGMPlan(bgm, configVolume = null) {
  const problems = [];
  const track = bgm && typeof bgm === 'object' ? bgm : {};
  const bpm = resolvePositiveValue(track['bpm'], DEFAULT_BGM_BPM, problems, 'bpm');
  const beatDuration = 60 / bpm;

  const channels = getBGMChannels(track).map((channel, index) => {
    const field = `channels[${index}]`;
    const entries = flattenBGMNotes(track, channel).map((entry, noteIndex) => (
      resolveNoteEntry(entry, problems, `${field}.notes[${noteIndex}]`)
    ));

    return {
      wave: resolveChannelWave(channel, track, problems, `${field}.wave`),
      volume: resolveChannelVolume(channel, track, configVolume, problems, `${field}.volume`),
      entries
    };
  });

  return {
    bpm,
    beatDuration,
    loop: track['loop'] !== false,
    channels,
    problems
  };
}

class AudioEngine {
  #audioCtx;
  #calculator;
  #masterVolume;
  #bgmVolume;
  #sfxVolume;
  #isEnabled;
  #bgmEnabled;
  #sfxEnabled;
  #sfxDefs;
  #defaultEnvelope;
  #bgmTracks;
  #activeOscillators;
  #activeBGMOscillators;
  #currentBGM;
  #bgmTimeout;
  #bgmFadeTimeout;
  #crossfadeDuration;
  #reporter;

  #bgmMasterGain;

  constructor(audioConfig, sfxConfig, bgmConfig, noteCalculator, defaultEnvelope, options = {}) {
    this.#calculator = noteCalculator;
    this.#sfxDefs = sfxConfig;
    this.#defaultEnvelope = defaultEnvelope;
    this.#bgmTracks = bgmConfig;
    this.#reporter = new OnceReporter(options.logger);

    this.#masterVolume = sanitizeVolume(audioConfig['master-volume'], DEFAULT_MASTER_VOLUME);
    this.#bgmVolume = sanitizeVolume(audioConfig['bgm-volume'], DEFAULT_BGM_VOLUME);
    this.#sfxVolume = sanitizeVolume(audioConfig['sfx-volume'], DEFAULT_MASTER_VOLUME);
    this.#isEnabled = audioConfig['sound-enabled'];
    this.#bgmEnabled = audioConfig['bgm-enabled'];
    this.#sfxEnabled = audioConfig['sfx-enabled'];
    this.#crossfadeDuration = sanitizeNonNegative(
      audioConfig['bgm-crossfade-duration'],
      DEFAULT_CROSSFADE_DURATION
    );

    this.#audioCtx = null;
    this.#activeOscillators = [];
    this.#activeBGMOscillators = [];
    this.#currentBGM = null;
    this.#bgmTimeout = null;
    this.#bgmFadeTimeout = null;
  }

  init() {
    if (!this.#audioCtx) {
      this.#audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.#bgmMasterGain = this.#audioCtx.createGain();
      this.#bgmMasterGain.connect(this.#audioCtx.destination);
    }
    return this.#audioCtx.resume().catch(() => {});
  }

  #ensureContext() {
    if (!this.#audioCtx) {
      this.#audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.#bgmMasterGain = this.#audioCtx.createGain();
      this.#bgmMasterGain.connect(this.#audioCtx.destination);
    }
    return this.#audioCtx;
  }

  get masterVolume() { return this.#masterVolume; }
  set masterVolume(v) { this.#masterVolume = sanitizeVolume(v, this.#masterVolume); }

  get bgmVolume() { return this.#bgmVolume; }
  set bgmVolume(v) { this.#bgmVolume = sanitizeVolume(v, this.#bgmVolume); }

  get sfxVolume() { return this.#sfxVolume; }
  set sfxVolume(v) { this.#sfxVolume = sanitizeVolume(v, this.#sfxVolume); }

  get isAudioEnabled() { return this.#isEnabled; }

  get bgmEnabled() { return this.#bgmEnabled; }
  set bgmEnabled(v) { this.#bgmEnabled = !!v; }

  get sfxEnabled() { return this.#sfxEnabled; }
  set sfxEnabled(v) { this.#sfxEnabled = !!v; }

  get currentBGM() { return this.#currentBGM; }

  #resolveEnvelope(sfx) {
    const envelope = {
      ...DEFAULT_SFX_ENVELOPE,
      ...this.#defaultEnvelope,
      ...sfx['envelope']
    };

    return {
      attack: sanitizeNonNegative(envelope.attack, DEFAULT_SFX_ENVELOPE.attack),
      decay: sanitizeNonNegative(envelope.decay, DEFAULT_SFX_ENVELOPE.decay),
      sustain: sanitizeVolume(envelope.sustain, DEFAULT_SFX_ENVELOPE.sustain),
      release: sanitizeNonNegative(envelope.release, DEFAULT_SFX_ENVELOPE.release)
    };
  }

  playSFX(name, freqOverride = null) {
    if (!this.#isEnabled || !this.#sfxEnabled) {
      return false;
    }

    const sounds = this.#sfxDefs.sounds;
    if (!Object.hasOwn(sounds, name)) {
      this.#reporter.report(
        `sfx-unknown:${name}`,
        `[AudioEngine] Unknown sound "${name}" in data/audio/sfx.json; playback skipped.`
      );
      return false;
    }
    const sfx = sounds[name];

    const rawFreq = freqOverride ?? sfx.freq;
    const frequency = this.#resolveSFXFrequency(name, rawFreq);
    if (frequency === null) {
      return false;
    }

    const ctx = this.#ensureContext();
    const now = this.#contextTime(ctx);
    const volume = this.#masterVolume * this.#sfxVolume;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = sanitizeWave(sfx.wave);
    osc.frequency.setValueAtTime(frequency, now);

    const envelope = this.#resolveEnvelope(sfx);
    const attack = envelope.attack;
    const decay = envelope.decay;
    const sustain = envelope.sustain;
    const release = envelope.release;
    const duration = sanitizeNonNegative(sfx['duration'], DEFAULT_SFX_DURATION);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + attack);
    gain.gain.linearRampToValueAtTime(volume * sustain, now + attack + decay);

    const stopTime = now + attack + decay + duration + release;
    gain.gain.linearRampToValueAtTime(0, stopTime);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(stopTime);

    this.#activeOscillators.push(osc);
    osc.onended = () => {
      const idx = this.#activeOscillators.indexOf(osc);
      if (idx !== -1) {
        this.#activeOscillators.splice(idx, 1);
      }
    };

    return true;
  }

  // Only a numeric or note-name value reaches the audio graph. A missing or
  // unparseable value reports once per sound and skips playback instead of
  // throwing into the gameplay code that requested the effect.
  #resolveSFXFrequency(name, rawFreq) {
    if (rawFreq === null || rawFreq === undefined) {
      this.#reportSFXFrequency(name);
      return null;
    }

    let hz = rawFreq;
    if (typeof rawFreq !== 'number') {
      try {
        hz = this.#calculator.frequency(rawFreq);
      } catch {
        this.#reportSFXFrequency(name);
        return null;
      }
    }

    return sanitizeFrequency(hz);
  }

  #reportSFXFrequency(name) {
    this.#reporter.report(
      `sfx-frequency:${name}`,
      `[AudioEngine] Sound "${name}" has no usable frequency in ` +
      `data/audio/sfx.json; playback skipped.`
    );
  }

  playBGM(name, crossfade) {
    if (!this.#isEnabled || !this.#bgmEnabled) {
      return;
    }

    if (this.#currentBGM === name) {
      return;
    }

    if (this.#bgmFadeTimeout !== null) {
      clearTimeout(this.#bgmFadeTimeout);
      this.#bgmFadeTimeout = null;
    }

    const ctx = this.#ensureContext();
    const now = this.#contextTime(ctx);
    const fadeTime = isFiniteNumber(crossfade) && crossfade >= 0
      ? crossfade
      : this.#crossfadeDuration;

    if (this.#currentBGM && fadeTime > 0) {
      this.#bgmMasterGain.gain.cancelScheduledValues(now);
      this.#bgmMasterGain.gain.setValueAtTime(this.#bgmMasterGain.gain.value, now);
      this.#bgmMasterGain.gain.linearRampToValueAtTime(0, now + fadeTime);

      this.#bgmFadeTimeout = setTimeout(() => {
        this.#bgmFadeTimeout = null;
        this.#startNewBGM(name, ctx, fadeTime);
      }, fadeTime * 1000);
    } else {
      this.#startNewBGM(name, ctx, fadeTime);
    }
  }

  #startNewBGM(name, ctx, fadeTime) {
    this.stopBGM();
    this.#currentBGM = name;

    const bgm = this.#bgmTracks[name];
    if (!bgm) {
      return;
    }

    const plan = resolveBGMPlan(bgm, this.#bgmVolume);
    if (plan.problems.length > 0) {
      console.warn(
        `[AudioEngine] Invalid BGM values in track "${name}"; using engine defaults: ` +
        plan.problems.join('; ')
      );
    }

    try {
      const now = this.#contextTime(ctx);
      if (fadeTime > 0) {
        this.#bgmMasterGain.gain.cancelScheduledValues(now);
        this.#bgmMasterGain.gain.setValueAtTime(0, now);
        this.#bgmMasterGain.gain.linearRampToValueAtTime(
          this.#masterVolume * this.#bgmVolume,
          now + fadeTime
        );
      } else {
        this.#bgmMasterGain.gain.setValueAtTime(
          this.#masterVolume * this.#bgmVolume,
          now
        );
      }
    } catch (error) {
      this.#reportBGMFailure(name, error);
      return;
    }

    this.#scheduleBGMSafely(ctx, plan, name);
  }

  #reportBGMFailure(name, error) {
    console.warn(
      `[AudioEngine] Failed to schedule BGM "${name}" ` +
      `(${error?.message ?? error}); playback skipped`
    );
    this.stopBGM();
  }

  #contextTime(ctx) {
    return isFiniteNumber(ctx.currentTime) ? ctx.currentTime : 0;
  }

  #scheduleBGMSafely(ctx, plan, name, loopStartTime = null) {
    try {
      this.#scheduleBGMSequence(ctx, plan, name, loopStartTime);
    } catch (error) {
      this.#reportBGMFailure(name, error);
    }
  }

  #scheduleBGMSequence(ctx, plan, name, loopStartTime = null) {
    if (plan.channels.length === 0) {
      return;
    }

    const beatDuration = plan.beatDuration;
    const now = this.#contextTime(ctx);
    const startTime = isFiniteNumber(loopStartTime) ? loopStartTime : now;
    let maxTrackDuration = 0;
    const channelDurations = [];

    for (const channel of plan.channels) {
      const sequence = channel.entries;
      if (sequence.length === 0) {
        continue;
      }

      const channelGain = ctx.createGain();
      channelGain.gain.setValueAtTime(channel.volume, startTime);
      channelGain.connect(this.#bgmMasterGain);

      let time = startTime;

      for (const entry of sequence) {
        const noteName = entry.name;
        const duration = beatDuration * entry.beats;

        if (noteName !== 'rest' && noteName !== '-') {
          let hz;
          try {
            hz = this.#calculator.frequency(noteName);
          } catch {
            hz = 261.63;
          }
          const frequency = sanitizeFrequency(hz);

          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = channel.wave;
          osc.frequency.setValueAtTime(frequency, time);

          gain.gain.setValueAtTime(0, time);
          gain.gain.linearRampToValueAtTime(1, time + 0.01);
          gain.gain.setValueAtTime(1, time + duration * 0.8);
          gain.gain.linearRampToValueAtTime(0, time + duration);

          osc.connect(gain);
          gain.connect(channelGain);

          osc.start(time);
          osc.stop(time + duration);

          this.#activeBGMOscillators.push(osc);
          osc.onended = () => {
            const idx = this.#activeBGMOscillators.indexOf(osc);
            if (idx !== -1) {
              this.#activeBGMOscillators.splice(idx, 1);
            }
          };
        }

        time += duration;
      }

      const channelDuration = time - startTime;
      channelDurations.push(channelDuration);
      if (channelDuration > maxTrackDuration) {
        maxTrackDuration = channelDuration;
      }
    }

    this.#validateChannelSync(name, channelDurations, beatDuration);

    if (plan.loop && name === this.#currentBGM && maxTrackDuration > 0) {
      const nextLoopStart = startTime + maxTrackDuration;
      const lookAhead = 0.1;
      const delay = Math.max(0, (nextLoopStart - lookAhead - now) * 1000);
      this.#bgmTimeout = setTimeout(() => {
        if (this.#currentBGM === name) {
          this.#scheduleBGMSafely(ctx, plan, name, nextLoopStart);
        }
      }, delay);
    }
  }

  #validateChannelSync(name, durations, beatDuration) {
    if (durations.length <= 1) {
      return;
    }

    const min = Math.min(...durations);
    const max = Math.max(...durations);
    const tolerance = beatDuration * 0.001;

    if (max - min > tolerance) {
      const diffBeats = (max - min) / beatDuration;
      const detail = durations.map((d) => (d / beatDuration).toFixed(2) + ' beats').join(', ');
      console.warn(
        `[AudioEngine] Channel desync in track "${name}": ` +
        `channels differ by ${diffBeats.toFixed(3)} beats (${(max - min).toFixed(4)}s). ` +
        `Durations: ${detail}`
      );
    }
  }

  stopBGM() {
    this.#currentBGM = null;
    if (this.#bgmTimeout !== null) {
      clearTimeout(this.#bgmTimeout);
      this.#bgmTimeout = null;
    }
    if (this.#bgmFadeTimeout !== null) {
      clearTimeout(this.#bgmFadeTimeout);
      this.#bgmFadeTimeout = null;
    }
    for (const osc of this.#activeBGMOscillators) {
      try {
        osc.stop();
      } catch {}
      try {
        osc.disconnect();
      } catch {}
    }
    this.#activeBGMOscillators = [];
    if (this.#bgmMasterGain && this.#audioCtx) {
      const now = this.#contextTime(this.#audioCtx);
      this.#bgmMasterGain.gain.cancelScheduledValues(now);
      this.#bgmMasterGain.gain.setValueAtTime(0, now);
    }
  }

  pauseBGM() {
    if (this.#audioCtx) {
      this.#audioCtx.suspend();
    }
  }

  resumeBGM() {
    if (this.#audioCtx) {
      this.#audioCtx.resume();
    }
  }
}

export { AudioEngine, resolveBGMPlan, flattenBGMNotes };
