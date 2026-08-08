import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = 'data';
const INDEX_FILE = 'index.json';
const KEBAB_PATTERN = /^[a-z0-9-]+$/;

function validateKebab(segment, fullPath) {
  if (!KEBAB_PATTERN.test(segment)) {
    throw new Error(
      `R5.3 violation in ${fullPath}: path segment "${segment}" is not lower-kebab-case (^[a-z0-9-]+$). ` +
      `All .json file basenames and directory names under data/ must match.`
    );
  }
}

function walk(dir, base, out) {
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const abs = join(dir, entry.name);
    const rel = join(base, entry.name);

    let isDirectory = false;
    let isFile = false;
    try {
      const stats = statSync(abs);
      isDirectory = stats.isDirectory();
      isFile = stats.isFile();
    } catch {
      continue;
    }

    if (isDirectory) {
      validateKebab(entry.name, rel);
      walk(abs, rel, out);
    } else if (isFile && entry.name.endsWith('.json')) {
      validateKebab(entry.name.replace(/\.json$/, ''), rel);
      if (rel !== INDEX_FILE) {
        out.push(`data/${rel.split('/').join('/')}`);
      }
    }
  }
}

function generateDataIndex() {
  const files = [];
  walk(DATA_DIR, '', files);
  return { files };
}

export { generateDataIndex };
