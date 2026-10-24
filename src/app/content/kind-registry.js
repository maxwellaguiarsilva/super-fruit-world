function createKindRegistry(kindName, entries) {
  const table = new Map();

  for (const [value, entry] of entries) {
    if (table.has(value)) {
      throw new Error(`Duplicate ${kindName} registration "${value}".`);
    }
    table.set(value, entry);
  }

  return Object.freeze({
    kindName,

    has(value) {
      return table.has(value);
    },

    values() {
      return [...table.keys()];
    },

    entries() {
      return [...table.entries()];
    },

    resolve(value) {
      if (!table.has(value)) {
        throw new Error(
          `Unknown ${kindName} "${String(value)}". Registered values: ${[...table.keys()].join(', ')}.`
        );
      }
      return table.get(value);
    }
  });
}

export { createKindRegistry };
