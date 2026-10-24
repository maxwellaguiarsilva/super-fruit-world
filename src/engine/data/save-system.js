class SaveSystem {
  #namespace;
  #prefix;

  constructor(namespace) {
    this.#namespace = namespace;
    this.#prefix = `${namespace}:`;
  }

  save(key, data) {
    try {
      localStorage.setItem(`${this.#prefix}${key}`, JSON.stringify(data));
    } catch {
    }
  }

  load(key) {
    try {
      const raw = localStorage.getItem(`${this.#prefix}${key}`);
      if (raw === null) {
        return null;
      }
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  delete(key) {
    localStorage.removeItem(`${this.#prefix}${key}`);
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
}

export { SaveSystem };
