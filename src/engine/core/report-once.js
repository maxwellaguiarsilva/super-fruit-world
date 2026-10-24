const DEFAULT_LOGGER = (message) => {
  console.warn(message);
};

// Delivers the first report for each key to an injectable logger. Recurring
// failures stay visible once without flooding the console, and callers decide
// the key granularity and the message text.
class OnceReporter {
  #logger;
  #reported;

  constructor(logger) {
    this.#logger = typeof logger === 'function' ? logger : DEFAULT_LOGGER;
    this.#reported = new Set();
  }

  report(key, message) {
    if (this.#reported.has(key)) {
      return false;
    }

    this.#reported.add(key);
    this.#logger(message);
    return true;
  }
}

export { OnceReporter };
