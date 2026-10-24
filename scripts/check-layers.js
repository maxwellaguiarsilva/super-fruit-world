import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dir, '..');
const SOURCE_ROOT = 'src';

// Allowed import targets per source layer. The application layer is the only
// composer; the game layer may use engine primitives; the engine layer is
// self-contained.
const ALLOWED_TARGETS = {
  engine: new Set(['engine']),
  game: new Set(['engine', 'game']),
  app: new Set(['engine', 'game', 'app']),
  main: new Set(['app'])
};

const STATIC_IMPORT = /\bimport\b(?!\s*\()\s+(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]/g;
const REEXPORT = /\bexport\s+(?:\*|\{[^}]*\})\s*from\s*['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function layerOf(relativePath) {
  const normalized = toPosix(relativePath).replace(/^\.\//, '');
  const segments = normalized.split('/');

  if (segments[0] !== SOURCE_ROOT || segments.length < 2) {
    return null;
  }

  if (segments[1] === 'main.js') {
    return 'main';
  }

  if (segments.length < 3) {
    return null;
  }

  return Object.hasOwn(ALLOWED_TARGETS, segments[1]) ? segments[1] : null;
}

function resolveTarget(fromPath, specifier) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
    return null;
  }

  return path.posix.normalize(path.posix.join(path.posix.dirname(toPosix(fromPath)), specifier));
}

function collectImports(source) {
  const found = [];

  for (const pattern of [STATIC_IMPORT, REEXPORT, DYNAMIC_IMPORT]) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      const specifier = match[1];
      const line = source.slice(0, match.index).split('\n').length;
      found.push({ specifier, line });
    }
  }

  return found.sort((a, b) => a.line - b.line || a.specifier.localeCompare(b.specifier));
}

// Pure check over an array of { path, source } entries. Paths and import
// specifiers are repository-relative POSIX paths or relative module paths.
function findLayerViolations(files) {
  const violations = [];

  for (const file of files) {
    const fromLayer = layerOf(file.path);
    if (!fromLayer) {
      continue;
    }

    for (const entry of collectImports(file.source)) {
      const targetPath = resolveTarget(file.path, entry.specifier);
      if (!targetPath) {
        continue;
      }

      const toLayer = layerOf(targetPath);
      if (!toLayer) {
        continue;
      }

      if (toLayer === 'main') {
        violations.push({
          file: toPosix(file.path),
          line: entry.line,
          specifier: entry.specifier,
          target: targetPath,
          fromLayer,
          toLayer,
          rule: 'no module may import src/main.js'
        });
        continue;
      }

      if (!ALLOWED_TARGETS[fromLayer].has(toLayer)) {
        violations.push({
          file: toPosix(file.path),
          line: entry.line,
          specifier: entry.specifier,
          target: targetPath,
          fromLayer,
          toLayer,
          rule: `${fromLayer} may import only ${[...ALLOWED_TARGETS[fromLayer]].join(', ')} modules`
        });
      }
    }
  }

  return violations;
}

async function collectSourceFiles(root) {
  const start = path.join(root, SOURCE_ROOT);
  const files = [];

  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.js')) {
        continue;
      }
      files.push({
        path: toPosix(path.relative(root, absolute)),
        source: await readFile(absolute, 'utf8')
      });
    }
  }

  await walk(start);
  return files;
}

async function checkLayers({ root = ROOT } = {}) {
  const files = await collectSourceFiles(root);
  return { files, violations: findLayerViolations(files) };
}

function formatViolation(violation) {
  return `${violation.file}:${violation.line} imports "${violation.specifier}" (${violation.fromLayer} -> ${violation.toLayer}); ${violation.rule}`;
}

if (import.meta.main) {
  const { files, violations } = await checkLayers();

  for (const violation of violations) {
    console.error(`error: ${formatViolation(violation)}`);
  }

  if (violations.length > 0) {
    console.error(`Layer check failed: ${violations.length} violation(s) across ${files.length} source files.`);
    process.exitCode = 1;
  } else {
    console.log(`Layer check passed: ${files.length} source files.`);
  }
}

export {
  ALLOWED_TARGETS,
  checkLayers,
  collectImports,
  collectSourceFiles,
  findLayerViolations,
  formatViolation,
  layerOf,
  resolveTarget
};
