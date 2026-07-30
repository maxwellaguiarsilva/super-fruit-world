class DataLoader {
  #basePath;
  #data;

  constructor(basePath) {
    this.#basePath = basePath;
    this.#data = new Map();
  }

  async loadAll(fileList) {
    const results = await Promise.allSettled(
      fileList.map((path) => this.loadFile(path))
    );

    const failures = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'rejected') {
        failures.push({ path: fileList[i], error: result.reason });
      }
    }

    if (failures.length > 0) {
      const messages = failures.map((f) => `${f.path}: ${f.error.message}`);
      throw new Error(`Failed to load ${failures.length} file(s):\n${messages.join('\n')}`);
    }
  }

  async loadFile(path) {
    const url = `${this.#basePath}${path}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} — ${response.statusText}`);
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(`Invalid JSON in ${path}`);
    }

    this.validateKeys(data, path);
    this.#data.set(path, data);
    return data;
  }

  get(path) {
    const data = this.#data.get(path);
    if (data === undefined) {
      throw new Error(`Data not loaded: ${path}`);
    }
    return data;
  }

  get all() {
    return new Map(this.#data);
  }

  validateKeys(obj, path) {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }

    for (const key of Object.keys(obj)) {
      if (typeof key !== 'string') {
        continue;
      }

      if (!/^[a-z0-9-]+$/.test(key)) {
        throw new Error(
          `R5.2 violation in ${path}: JSON key "${key}" uses invalid characters. ` +
          `All keys must be lower-kebab-case (^[a-z0-9-]+$).`
        );
      }

      const value = obj[key];
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        this.validateKeys(value, path);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            this.validateKeys(item, path);
          }
        }
      }
    }
  }
}

export { DataLoader };
