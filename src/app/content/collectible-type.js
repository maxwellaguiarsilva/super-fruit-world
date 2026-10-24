const COLLECTIBLE_DIRECTORY = 'data/collectibles/';
const JSON_EXTENSION = '.json';

function collectibleTypeFromPath(path) {
  if (!path.startsWith(COLLECTIBLE_DIRECTORY) || !path.endsWith(JSON_EXTENSION)) {
    return null;
  }

  return path.slice(COLLECTIBLE_DIRECTORY.length, -JSON_EXTENSION.length);
}

export { collectibleTypeFromPath };
