import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dir, '..');
const DATA_DIR = path.join(ROOT, 'data');
const INDEX_PATH = path.join(DATA_DIR, 'index.json');
const INDEX_ENTRY = 'data/index.json';

function compare(a, b) {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

async function isFileTarget(absolute) {
  try {
    return (await stat(absolute)).isFile();
  } catch {
    return false;
  }
}

async function collectFiles(directory, root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolute, root));
      continue;
    }

    let isFile = entry.isFile();
    if (!isFile && entry.isSymbolicLink()) {
      isFile = await isFileTarget(absolute);
    }

    if (!isFile || !entry.name.endsWith('.json')) {
      continue;
    }

    const relative = path.relative(root, absolute).split(path.sep).join('/');
    if (relative === INDEX_ENTRY) {
      continue;
    }

    files.push(relative);
  }

  return files;
}

export async function collectDataFiles(root = ROOT) {
  return collectFiles(path.join(root, 'data'), root);
}

export function formatIndex(files) {
  return `${JSON.stringify({ files }, null, 2)}\n`;
}

async function readExistingIndex() {
  try {
    return await readFile(INDEX_PATH, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function main() {
  let files;

  try {
    files = await collectDataFiles(ROOT);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Error: data directory not found at ${DATA_DIR}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  files.sort(compare);
  const output = formatIndex(files);
  const existing = await readExistingIndex();

  if (existing === output) {
    console.log(`data/index.json: ${files.length} files indexed (unchanged)`);
    return;
  }

  await writeFile(INDEX_PATH, output, 'utf8');
  console.log(`data/index.json: ${files.length} files indexed (${existing === null ? 'created' : 'updated'})`);
}

if (import.meta.main) {
  await main();
}
