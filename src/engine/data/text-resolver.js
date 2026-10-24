const DEFAULT_MISSING_HANDLER = (key) => {
  console.warn(`[text] Missing text key "${key}"; rendering the key instead.`);
};

// A missing or unresolvable key falls back to the key itself and is reported once,
// so presentation code can render without guarding every lookup and never throws.
class TextResolver {
  #lookup;
  #onMissing;
  #reported;

  constructor(lookup, options = {}) {
    if (typeof lookup !== 'function') {
      throw new TypeError('TextResolver requires a lookup function.');
    }

    this.#lookup = lookup;
    this.#onMissing = typeof options.onMissing === 'function'
      ? options.onMissing
      : DEFAULT_MISSING_HANDLER;
    this.#reported = new Set();
  }

  has(key) {
    return this.#read(key) !== null;
  }

  text(key) {
    const value = this.#read(key);
    if (value !== null) {
      return value;
    }

    this.#report(key);
    return typeof key === 'string' ? key : '';
  }

  #read(key) {
    if (typeof key !== 'string' || key.length === 0) {
      return null;
    }

    let value;
    try {
      value = this.#lookup(key);
    } catch {
      return null;
    }

    return typeof value === 'string' ? value : null;
  }

  #report(key) {
    const label = typeof key === 'string' ? key : String(key);
    if (this.#reported.has(label)) {
      return;
    }

    this.#reported.add(label);
    this.#onMissing(label);
  }
}

export { TextResolver };
