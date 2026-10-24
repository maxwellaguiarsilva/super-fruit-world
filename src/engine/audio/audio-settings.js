import { requireDependencies } from '../core/dependency-contract.js';

const SETTINGS_SCHEMA_VERSION = 1;
const SETTINGS_STORAGE_KEY = 'settings';

const SETTING_PROPERTIES = Object.freeze({
  'master-volume': 'masterVolume',
  'bgm-volume': 'bgmVolume',
  'sfx-volume': 'sfxVolume'
});

const AUDIO_SETTINGS_DEPENDENCIES = ['engine', 'store', 'settingKeys'];

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isVolume(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function normalizeSettings(raw) {
  const result = {};
  if (!isPlainObject(raw)) {
    return result;
  }

  for (const key of Object.keys(SETTING_PROPERTIES)) {
    const value = raw[key];
    if (isVolume(value)) {
      result[key] = value;
    }
  }

  return result;
}

function serializeSettings(values = {}) {
  return {
    version: SETTINGS_SCHEMA_VERSION,
    ...normalizeSettings(values)
  };
}

class SettingsStore {
  #saves;
  #storageKey;

  constructor(saveSystem, storageKey = SETTINGS_STORAGE_KEY) {
    if (!saveSystem || typeof saveSystem.load !== 'function' || typeof saveSystem.save !== 'function') {
      throw new TypeError('SettingsStore requires a SaveSystem-compatible instance.');
    }

    this.#saves = saveSystem;
    this.#storageKey = storageKey;
  }

  get storageKey() { return this.#storageKey; }

  load() {
    const entry = this.#saves.load(this.#storageKey);
    if (!isPlainObject(entry)) {
      return null;
    }

    if (entry.version !== SETTINGS_SCHEMA_VERSION) {
      this.#saves.delete(this.#storageKey);
      return null;
    }

    return normalizeSettings(entry);
  }

  save(values) {
    this.#saves.save(this.#storageKey, serializeSettings(values));
  }

  clear() {
    this.#saves.delete(this.#storageKey);
  }
}

function findPropertyDescriptor(target, property) {
  let current = target;

  while (current !== null) {
    const descriptor = Object.getOwnPropertyDescriptor(current, property);
    if (descriptor) {
      return descriptor;
    }
    current = Object.getPrototypeOf(current);
  }

  return null;
}

function bindEngineProperty(engine, property, onChange) {
  const descriptor = findPropertyDescriptor(engine, property);
  if (!descriptor) {
    return null;
  }

  let read;
  let write;

  if (typeof descriptor.get === 'function' || typeof descriptor.set === 'function') {
    read = () => (typeof descriptor.get === 'function' ? descriptor.get.call(engine) : undefined);
    write = (value) => {
      if (typeof descriptor.set === 'function') {
        descriptor.set.call(engine, value);
      }
      onChange();
    };
  } else {
    let current = descriptor.value;
    read = () => current;
    write = (value) => {
      current = value;
      onChange();
    };
  }

  Object.defineProperty(engine, property, {
    configurable: true,
    enumerable: descriptor.enumerable ?? false,
    get: read,
    set: write
  });

  return { property, read };
}

class AudioSettings {
  #engine;
  #store;
  #bindings;

  constructor(dependencies) {
    const { engine, store, settingKeys } = requireDependencies(
      'AudioSettings',
      dependencies,
      AUDIO_SETTINGS_DEPENDENCIES
    );

    if (!store || typeof store.load !== 'function' || typeof store.save !== 'function') {
      throw new TypeError('AudioSettings requires a settings store with load and save methods.');
    }
    if (!Array.isArray(settingKeys)) {
      throw new TypeError('AudioSettings requires settingKeys to be an array.');
    }

    this.#engine = engine;
    this.#store = store;
    this.#bindings = new Map();

    for (const settingKey of new Set(settingKeys)) {
      const property = SETTING_PROPERTIES[settingKey];
      if (!property) {
        continue;
      }

      const binding = bindEngineProperty(engine, property, () => this.save());
      if (binding) {
        this.#bindings.set(settingKey, binding);
      }
    }
  }

  get settingKeys() {
    return [...this.#bindings.keys()];
  }

  get(settingKey) {
    const binding = this.#bindings.get(settingKey);
    return binding ? binding.read() : 0;
  }

  set(settingKey, value) {
    const binding = this.#bindings.get(settingKey);
    if (!binding) {
      return;
    }

    this.#engine[binding.property] = value;
  }

  values() {
    const result = {};
    for (const [settingKey, binding] of this.#bindings) {
      result[settingKey] = binding.read();
    }
    return result;
  }

  save() {
    this.#store.save(this.values());
  }

  load() {
    return this.#store.load();
  }

  apply(values) {
    if (!isPlainObject(values)) {
      return;
    }

    for (const [settingKey, value] of Object.entries(values)) {
      if (this.#bindings.has(settingKey) && isVolume(value)) {
        this.set(settingKey, value);
      }
    }
  }
}

function restoreAudioSettings(dependencies) {
  const settings = new AudioSettings(dependencies);
  settings.apply(settings.load());
  return settings;
}

export {
  SettingsStore,
  SETTINGS_SCHEMA_VERSION,
  restoreAudioSettings
};
