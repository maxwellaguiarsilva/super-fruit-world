class LocaleManager {
  #dataLoader;
  #locales;
  #currentLocale;
  #defaultLocale;
  #localeDir;

  constructor(localeDir, dataLoader, defaultLocale) {
    this.#localeDir = localeDir;
    this.#dataLoader = dataLoader;
    this.#defaultLocale = defaultLocale ?? 'en-us';
    this.#currentLocale = this.#defaultLocale;
    this.#locales = new Map();
  }

  get currentLocale() {
    return this.#currentLocale;
  }

  async loadLocale(locale) {
    if (!this.#locales.has(locale)) {
      await this.#loadLocale(locale);
    }
    this.#currentLocale = locale;
  }

  set currentLocale(locale) {
    this.loadLocale(locale);
  }

  get availableLocales() {
    return [...this.#locales.keys()];
  }

  async #loadLocale(locale) {
    const path = `${this.#localeDir}${locale}.json`;
    try {
      const existingData = this.#dataLoader.all.get(path);
      if (existingData) {
        this.#locales.set(locale, existingData);
        return;
      }
      await this.#dataLoader.loadFile(path);
      this.#locales.set(locale, this.#dataLoader.get(path));
    } catch {
      throw new Error(`Failed to load locale: ${locale}`);
    }
  }

  get(key, placeholders) {
    const localeData = this.#locales.get(this.#currentLocale);
    const defaultData = this.#locales.get(this.#defaultLocale);

    let value = null;

    if (localeData) {
      value = this.#resolvePath(localeData, key);
    }

    if (value === null && defaultData) {
      value = this.#resolvePath(defaultData, key);
    }

    if (value === null) {
      return key;
    }

    if (placeholders && typeof value === 'string') {
      for (const [phKey, phValue] of Object.entries(placeholders)) {
        value = value.replace(new RegExp(`\\{${phKey}\\}`, 'g'), String(phValue));
      }
    }

    return value;
  }

  #resolvePath(obj, path) {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return null;
      }
      if (typeof current !== 'object') {
        return null;
      }
      current = current[part];
    }

    return current ?? null;
  }
}

export { LocaleManager };
