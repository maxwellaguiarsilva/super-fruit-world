import { NoteFrequencyCalculator } from './note-frequency-calculator.js';

class AudioEngine {
  #audioCtx;
  #calculator;
  #masterVolume;
  #bgmVolume;
  #sfxVolume;
  #isEnabled;
  #sfxDefs;
  #bgmTracks;
  #activeOscillators;
  #activeBGMOscillators;
  #currentBGM;
  #bgmTimeout;
  #bgmFadeTimeout;
  #crossfadeDuration;

  #bgmMasterGain;

  constructor(audioConfig, sfxConfig, bgmConfig, noteCalculator) {
    this.#calculator = noteCalculator;
    this.#sfxDefs = sfxConfig;
    this.#bgmTracks = bgmConfig;

    this.#masterVolume = audioConfig['master-volume'];
    this.#bgmVolume = audioConfig['bgm-volume'];
    this.#sfxVolume = audioConfig['sfx-volume'];
    this.#isEnabled = audioConfig['sound-enabled'];
    this.#crossfadeDuration = audioConfig['bgm-crossfade-duration'];

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
  set masterVolume(v) { this.#masterVolume = Math.max(0, Math.min(1, v)); }

  get bgmVolume() { return this.#bgmVolume; }
  set bgmVolume(v) { this.#bgmVolume = Math.max(0, Math.min(1, v)); }

  get sfxVolume() { return this.#sfxVolume; }
  set sfxVolume(v) { this.#sfxVolume = Math.max(0, Math.min(1, v)); }

  get isAudioEnabled() { return this.#isEnabled; }

  get currentBGM() { return this.#currentBGM; }

  playSFX(name) {
    if (!this.#isEnabled) {
      return;
    }

    const sfx = this.#sfxDefs[name];
    if (!sfx) {
      return;
    }

    const ctx = this.#ensureContext();
    const volume = this.#masterVolume * this.#sfxVolume;

    const hz = typeof sfx.frequency === 'number'
      ? sfx.frequency
      : this.#calculator.frequency(sfx.frequency);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = sfx['wave-type'];
    osc.frequency.setValueAtTime(hz, ctx.currentTime);

    const envelope = sfx.envelope;
    const attack = envelope.attack;
    const decay = envelope.decay;
    const sustain = envelope.sustain;
    const release = envelope.release;

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + attack);
    gain.gain.linearRampToValueAtTime(volume * sustain, ctx.currentTime + attack + decay);

    const stopTime = ctx.currentTime + attack + decay + sfx.duration + release;
    gain.gain.linearRampToValueAtTime(0, stopTime);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(stopTime);

    this.#activeOscillators.push(osc);
    osc.onended = () => {
      const idx = this.#activeOscillators.indexOf(osc);
      if (idx !== -1) {
        this.#activeOscillators.splice(idx, 1);
      }
    };
  }

  playBGM(name, crossfade) {
    if (!this.#isEnabled) {
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
    const fadeTime = crossfade ?? this.#crossfadeDuration;

    if (this.#currentBGM && fadeTime > 0) {
      this.#bgmMasterGain.gain.cancelScheduledValues(ctx.currentTime);
      this.#bgmMasterGain.gain.setValueAtTime(this.#bgmMasterGain.gain.value, ctx.currentTime);
      this.#bgmMasterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeTime);
      
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

    if (fadeTime > 0) {
      this.#bgmMasterGain.gain.cancelScheduledValues(ctx.currentTime);
      this.#bgmMasterGain.gain.setValueAtTime(0, ctx.currentTime);
      this.#bgmMasterGain.gain.linearRampToValueAtTime(this.#masterVolume * this.#bgmVolume, ctx.currentTime + fadeTime);
    } else {
      this.#bgmMasterGain.gain.setValueAtTime(this.#masterVolume * this.#bgmVolume, ctx.currentTime);
    }

    this.#scheduleBGMSequence(ctx, bgm, name);
  }

  #flattenNotes(bgm, channel = null) {
    const trackPhrases = bgm['phrases'];
    const channelPhrases = channel?.['phrases'];
    const phrases = { ...trackPhrases, ...channelPhrases };
    const rawSequence = channel ? channel['notes'] : bgm['notes'];

    const result = [];
    const expand = (entries, visited = new Set()) => {
      for (const entry of entries) {
        if (typeof entry === 'string' && phrases[entry]) {
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

  #getChannels(bgm) {
    if (bgm['channels']) {
      if (Array.isArray(bgm['channels'])) {
        return bgm['channels'];
      }
      if (typeof bgm['channels'] === 'object') {
        return Object.values(bgm['channels']);
      }
    }
    return [
      {
        'wave': bgm['wave'],
        'volume': bgm['volume'],
        'phrases': bgm['phrases'],
        'notes': bgm['notes']
      }
    ];
  }

  #scheduleBGMSequence(ctx, bgm, name, loopStartTime = null) {
    const channels = this.#getChannels(bgm);
    if (channels.length === 0) {
      return;
    }

    const bpm = bgm['bpm'];
    const beatDuration = 60 / bpm;
    const startTime = loopStartTime ?? ctx.currentTime;
    let maxTrackDuration = 0;
    const channelDurations = [];

    for (const channel of channels) {
      const sequence = this.#flattenNotes(bgm, channel);
      if (sequence.length === 0) {
        continue;
      }

      const waveType = channel['wave'] ?? bgm['wave'];
      const channelVol = channel['volume'];

      const channelGain = ctx.createGain();
      channelGain.gain.setValueAtTime(channelVol, startTime);
      channelGain.connect(this.#bgmMasterGain);

      let time = startTime;

      for (const entry of sequence) {
        const noteName = typeof entry === 'string' ? entry : entry[0];
        const durationBeats = typeof entry === 'string' ? 1 : entry[1];
        const duration = beatDuration * durationBeats;

        if (noteName !== 'rest' && noteName !== '-') {
          let hz;
          try {
            hz = this.#calculator.frequency(noteName);
          } catch {
            hz = 261.63;
          }

          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = waveType;
          osc.frequency.setValueAtTime(hz, time);

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

    if (bgm.loop !== false && name === this.#currentBGM && maxTrackDuration > 0) {
      const nextLoopStart = startTime + maxTrackDuration;
      const lookAhead = 0.1;
      const delay = Math.max(0, (nextLoopStart - lookAhead - ctx.currentTime) * 1000);
      this.#bgmTimeout = setTimeout(() => {
        if (this.#currentBGM === name) {
          this.#scheduleBGMSequence(ctx, bgm, name, nextLoopStart);
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
      this.#bgmMasterGain.gain.cancelScheduledValues(this.#audioCtx.currentTime);
      this.#bgmMasterGain.gain.setValueAtTime(0, this.#audioCtx.currentTime);
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

export { AudioEngine };
