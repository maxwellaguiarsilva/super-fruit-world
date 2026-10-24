function requireDependencies(owner, dependencies, keys) {
  if (dependencies === null || typeof dependencies !== 'object') {
    throw new Error(
      `${owner} requires a dependency object. Declared dependencies: ${keys.join(', ')}.`
    );
  }

  for (const key of keys) {
    if (!Object.hasOwn(dependencies, key)) {
      throw new Error(
        `${owner} is missing required dependency "${key}". Declared dependencies: ${keys.join(', ')}.`
      );
    }
  }

  return dependencies;
}

export { requireDependencies };
