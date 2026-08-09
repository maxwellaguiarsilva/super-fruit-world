function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function resolveColor(name, colorsConfig) {
  if (!name) {
    return null;
  }

  const darkPrefix = name.startsWith('dark-');
  const baseName = darkPrefix ? name.slice(5) : name;
  const colors = colorsConfig && hasOwn(colorsConfig, 'colors') ? colorsConfig['colors'] : null;
  const entry = colors && hasOwn(colors, baseName) ? colors[baseName] : null;

  if (!entry) {
    return name.startsWith('#') ? name : null;
  }

  return darkPrefix ? entry.dark : entry.light;
}

function resolveConfig(config, colorsConfig) {
  if (!config || typeof config !== 'object') {
    return config;
  }

  if (Array.isArray(config)) {
    return config.map((item) => resolveConfig(item, colorsConfig));
  }

  const result = {};
  for (const [key, value] of Object.entries(config)) {
    if (key.endsWith('-color') || key.endsWith('-fill-color') || key === 'color') {
      if (typeof value === 'string') {
        result[key] = resolveColor(value, colorsConfig);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = resolveConfig(value, colorsConfig);
      } else {
        result[key] = value;
      }
    } else if (typeof value === 'object' && value !== null) {
      result[key] = resolveConfig(value, colorsConfig);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export { resolveColor, resolveConfig };
