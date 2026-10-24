const KEBAB_PATTERN = /^[a-z0-9-]+$/;

class DataDriven {
  #basePath;
  #indexSource;
  #data;

  constructor(basePath, indexSource) {
    this.#basePath = basePath;
    this.#indexSource = indexSource;
    this.#data = new Map();
  }

  static create(basePath, indexSource) {
    const instance = new DataDriven(basePath, indexSource);

    return new Proxy(instance, {
      get(target, prop) {
        if (typeof prop !== 'string' || prop in target) {
          const value = Reflect.get(target, prop, target);
          return typeof value === 'function' ? value.bind(target) : value;
        }
        return target.resolveAccessor(prop);
      }
    });
  }

  static toPlain(value) {
    if (Array.isArray(value)) {
      return value.map(DataDriven.toPlain);
    }
    if (value !== null && typeof value === 'object') {
      const result = {};
      for (const key of Object.keys(value)) {
        result[key] = DataDriven.toPlain(value[key]);
      }
      return result;
    }
    return value;
  }

  get all() {
    return new Map(this.#data);
  }

  async load() {
    const response = await fetch(this.#indexSource);
    if (!response.ok) {
      throw new Error(
        `Failed to load data index: HTTP ${response.status} ${response.statusText} (${this.#indexSource})`
      );
    }

    let index;
    try {
      index = await response.json();
    } catch {
      throw new Error(`Invalid JSON in data index: ${this.#indexSource}`);
    }

    const files = index.files;
    if (!Array.isArray(files)) {
      throw new Error(`Data index ${this.#indexSource} is missing a "files" array`);
    }

    for (const path of files) {
      if (typeof path !== 'string') {
        throw new Error(`Data index ${this.#indexSource} contains a non-string entry`);
      }
      this.#validateKebabPath(path);
      await this.#loadFile(path);
    }
  }

  #validateKebabPath(path) {
    const relative = path.replace(/^data\//, '').replace(/\.json$/, '');
    const segments = relative.split('/');
    for (const segment of segments) {
      if (!KEBAB_PATTERN.test(segment)) {
        throw new Error(
          `R5.3 violation in ${path}: path segment "${segment}" is not lower-kebab-case ` +
          `(^[a-z0-9-]+$). All .json file basenames and directory names under data/ must match.`
        );
      }
    }
  }

  async #loadFile(path) {
    const response = await fetch(`${this.#basePath}${path}`);
    if (!response.ok) {
      throw new Error(`Failed to load ${path}: HTTP ${response.status} ${response.statusText}`);
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(`Invalid JSON in ${path}`);
    }

    this.validateKeys(data, path);
    this.#data.set(path, data);
  }

  validateKeys(obj, path) {
    if (obj === null || typeof obj !== 'object') {
      return;
    }

    for (const key of Object.keys(obj)) {
      if (typeof key !== 'string') {
        continue;
      }

      if (!KEBAB_PATTERN.test(key)) {
        throw new Error(
          `R5.2 violation in ${path}: JSON key "${key}" uses invalid characters. ` +
          `All keys must be lower-kebab-case (^[a-z0-9-]+$).`
        );
      }

      const value = obj[key];
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        this.validateKeys(value, path);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== null && typeof item === 'object') {
            this.validateKeys(item, path);
          }
        }
      }
    }
  }

  resolveAccessor(accessor) {
    const segments = accessor.split('.');

    for (let i = segments.length; i >= 1; i--) {
      const filePath = `data/${segments.slice(0, i).join('/')}.json`;
      const data = this.#data.get(filePath);
      if (data !== undefined) {
        const value = this.#resolveKeyPath(data, segments.slice(i), filePath, accessor);
        return this.#deep(value, filePath);
      }
    }

    throw new Error(`Data not found: ${accessor} (no file under data/ matches the path)`);
  }

  #resolveKeyPath(data, keys, filePath, accessor) {
    let current = data;

    for (const key of keys) {
      if (
        current === null ||
        typeof current !== 'object' ||
        !Object.hasOwn(current, key)
      ) {
        throw new Error(
          `Key not found: ${keys.join('.')} in ${filePath} (accessor: ${accessor})`
        );
      }
      current = current[key];
    }

    return current;
  }

  #deep(value, filePath) {
    if (value === null || typeof value !== 'object') {
      return value;
    }

    return new Proxy(value, {
      get: (target, prop) => {
        if (typeof prop === 'symbol') {
          return Reflect.get(target, prop, target);
        }
        if (prop in target) {
          return this.#deep(Reflect.get(target, prop, target), filePath);
        }
        throw new Error(`Key not found: ${prop} in ${filePath}`);
      },
      has: (target, prop) => Reflect.has(target, prop),
      ownKeys: (target) => Reflect.ownKeys(target),
      getOwnPropertyDescriptor: (target, prop) => Reflect.getOwnPropertyDescriptor(target, prop)
    });
  }
}

export { DataDriven };
