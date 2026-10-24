import { OnceReporter } from '../core/report-once.js';

class SaveSystem {
  #prefix;
  #reporter;

  constructor(namespace, options = {}) {
    this.#prefix = `${namespace}:`;
    this.#reporter = new OnceReporter(options.logger);
  }

  save(key, data) {
    const storageKey = `${this.#prefix}${key}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
      return true;
    } catch {
      this.#report('save', storageKey);
      return false;
    }
  }

  load(key) {
    const storageKey = `${this.#prefix}${key}`;

    let raw;
    try {
      raw = localStorage.getItem(storageKey);
    } catch {
      this.#report('load', storageKey);
      return null;
    }

    if (raw === null) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch {
      this.#report('load', storageKey);
      return null;
    }
  }

  delete(key) {
    const storageKey = `${this.#prefix}${key}`;
    try {
      localStorage.removeItem(storageKey);
      return true;
    } catch {
      this.#report('delete', storageKey);
      return false;
    }
  }

  has(key) {
    return localStorage.getItem(`${this.#prefix}${key}`) !== null;
  }

  clear() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(this.#prefix)) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  }

  #report(operation, storageKey) {
    this.#reporter.report(
      `${operation}:${storageKey}`,
      `[SaveSystem] ${operation} failed for key "${storageKey}".`
    );
  }
}

export { SaveSystem };
