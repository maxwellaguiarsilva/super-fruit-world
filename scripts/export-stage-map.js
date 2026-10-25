import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { analyzeStage } from './stage-analysis/checks.js';
import { computeChunks, computeStageBounds } from './stage-analysis/chunks.js';
import { renderStageView } from './stage-analysis/render.js';
import {
  discoverStageIds,
  loadStageLayout,
  loadStageLayouts
} from './stage-analysis/model.js';
import { launchBrowser } from './smoke/browser.js';

const ROOT = path.resolve(import.meta.dir, '..');
const STAGE_DIRECTORY = 'data/stages';
const DEFAULT_OUT = 'out/stage-maps';
const DEFAULT_SCALE = 24;
const DEFAULT_MAX_SIZE = 1400;
const INDEX_FILE = 'index.json';
const MANIFEST_FILE = 'manifest.json';
const HINT = 'Hint: run "bunx playwright@1.64.1 install chromium" if the browser is missing.';

const VALUE_OPTIONS = new Set(['--stage', '--out', '--scale', '--max-size']);

export class CliError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CliError';
  }
}

export function usage() {
  return [
    'Usage: bun scripts/export-stage-map.js [options]',
    '',
    'Options:',
    '  --stage <id>       Export only this stage. Repeatable, also accepts --stage=<id>.',
    '  --out <dir>        Output directory, relative to the repository root.',
    `                     Default: ${DEFAULT_OUT}`,
    `  --scale <px>       Pixels per world unit. Default: ${DEFAULT_SCALE}`,
    `  --max-size <px>    Maximum image width and height. Default: ${DEFAULT_MAX_SIZE}`,
    '  --help             Show this help.'
  ].join('\n');
}

function parseNumberOption(name, value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new CliError(`${name} requires a positive number, received "${value}"`);
  }

  return number;
}

export function parseArguments(argv = []) {
  const options = {
    stageIds: [],
    out: DEFAULT_OUT,
    scale: DEFAULT_SCALE,
    maxSize: DEFAULT_MAX_SIZE,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (typeof argument !== 'string') {
      throw new CliError('arguments must be strings');
    }

    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }

    if (!argument.startsWith('--')) {
      throw new CliError(`unexpected argument: ${argument}`);
    }

    const equalsIndex = argument.indexOf('=');
    const name = equalsIndex === -1 ? argument : argument.slice(0, equalsIndex);

    if (!VALUE_OPTIONS.has(name)) {
      throw new CliError(`unknown option: ${name}`);
    }

    let value;

    if (equalsIndex !== -1) {
      value = argument.slice(equalsIndex + 1);
    } else {
      const next = argv[index + 1];
      if (typeof next !== 'string' || next.startsWith('--')) {
        throw new CliError(`missing value for ${name}`);
      }
      value = next;
      index += 1;
    }

    if (value.length === 0) {
      throw new CliError(`missing value for ${name}`);
    }

    if (name === '--stage') {
      options.stageIds.push(value);
    } else if (name === '--out') {
      options.out = value;
    } else if (name === '--scale') {
      options.scale = parseNumberOption('--scale', value);
    } else {
      const maxSize = parseNumberOption('--max-size', value);
      if (!Number.isInteger(maxSize)) {
        throw new CliError(`--max-size requires an integer, received "${value}"`);
      }
      options.maxSize = maxSize;
    }
  }

  return options;
}

export function resolveOutputDirectory(root, out) {
  const resolved = path.resolve(root, out);
  const relative = path.relative(root, resolved);
  const isWithin = (directory) => relative === directory || relative.startsWith(`${directory}${path.sep}`);

  if (relative === '' || isWithin('data') || isWithin('src')) {
    throw new CliError(`--out must not be the repository root, data or src: received "${out}"`);
  }

  return resolved;
}

function imageBaseName(kind, chunkIndex) {
  return kind === 'overview' ? 'overview' : `chunk-${String(chunkIndex).padStart(2, '0')}`;
}

function imageEntries(views) {
  const entries = [{ view: views.overview, base: imageBaseName('overview', 0) }];

  views.chunks.forEach((view, index) => {
    entries.push({ view, base: imageBaseName('chunk', index) });
  });

  return entries;
}

function numberOr(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function compareText(a, b) {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

function deterministicSections(layout) {
  return (Array.isArray(layout.sections) ? layout.sections : [])
    .filter((section) => section !== null && typeof section === 'object')
    .map((section) => ({
      name: typeof section.name === 'string' ? section.name : '',
      parent: section.parent ?? null,
      x: numberOr(section.position?.x),
      y: numberOr(section.position?.y),
      width: numberOr(section.size?.width),
      height: numberOr(section.size?.height)
    }))
    .sort((a, b) => (a.x - b.x) || (a.y - b.y) || compareText(a.name, b.name));
}

export function buildStageManifest({ layout, bounds, views, scale, findings = [] }) {
  if (layout === null || typeof layout !== 'object' || typeof layout.id !== 'string') {
    throw new TypeError('layout with a string id is required');
  }

  if (views === null || typeof views !== 'object' || !views.overview || !Array.isArray(views.chunks)) {
    throw new TypeError('views must contain an overview and a chunks array');
  }

  const entries = imageEntries(views);

  return {
    stage: layout.id,
    bounds: {
      x: numberOr(bounds?.x),
      y: numberOr(bounds?.y),
      width: numberOr(bounds?.width),
      height: numberOr(bounds?.height)
    },
    playerSize: numberOr(layout.playerSize, 1),
    scale,
    staticFindings: Array.isArray(findings) ? findings : [],
    sections: deterministicSections(layout),
    images: entries.map(({ view, base }) => ({
      file: `${base}.png`,
      svg: `${base}.svg`,
      kind: view.kind,
      world: {
        x: view.world.x,
        y: view.world.y,
        width: view.world.width,
        height: view.world.height
      },
      scale: view.scale,
      pixelWidth: view.pixelWidth,
      pixelHeight: view.pixelHeight
    }))
  };
}

export function buildStageIndex({ generatedAt, stages = [] } = {}) {
  const ordered = [...stages].sort((a, b) => compareText(String(a.id), String(b.id)));

  return {
    generatedAt,
    stages: ordered.map((stage) => ({
      id: stage.id,
      bounds: stage.bounds,
      images: stage.images,
      findingCounts: stage.findingCounts
    }))
  };
}

function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function renderHtml(svg) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8">'
    + '<style>html,body{margin:0;padding:0;background:#000;overflow:hidden}svg{display:block}</style>'
    + `</head><body>${svg}</body></html>`;
}

function prepareStage(layout, options) {
  const bounds = computeStageBounds(layout);
  const views = computeChunks({ layout, bounds, scale: options.scale, maxSize: options.maxSize });
  const findings = analyzeStage(layout);
  const manifest = buildStageManifest({ layout, bounds, views, scale: options.scale, findings });
  const images = imageEntries(views).map(({ view, base }) => ({
    view,
    pngFile: `${base}.png`,
    svgFile: `${base}.svg`,
    svg: renderStageView({ layout, view, findings })
  }));

  return { id: layout.id, bounds, findings, manifest, images };
}

async function loadSelectedLayouts(stageIds) {
  if (stageIds.length === 0) {
    return await loadStageLayouts({ root: ROOT });
  }

  const known = await discoverStageIds(path.join(ROOT, STAGE_DIRECTORY));
  const selected = [...new Set(stageIds)].sort();
  const unknown = selected.filter((stageId) => !known.includes(stageId));

  if (unknown.length > 0) {
    throw new CliError(
      `unknown stage id: ${unknown.join(', ')}. Known stages: ${known.join(', ') || '(none)'}`
    );
  }

  const layouts = [];
  for (const stageId of selected) {
    layouts.push(await loadStageLayout({ root: ROOT, stageId }));
  }

  return layouts;
}

async function exportStage({ page, outDir, stage }) {
  const stageDirectory = path.join(outDir, stage.id);
  const errors = [];
  let failed = 0;

  try {
    await mkdir(stageDirectory, { recursive: true });
  } catch (error) {
    errors.push(`${stage.id}: cannot create ${stageDirectory}: ${message(error)}`);
  }

  for (const image of stage.images) {
    try {
      await Bun.write(path.join(stageDirectory, image.svgFile), image.svg);
      await page.setViewportSize({
        width: image.view.pixelWidth,
        height: image.view.pixelHeight
      });
      await page.setContent(renderHtml(image.svg), { waitUntil: 'load' });
      await page.screenshot({ path: path.join(stageDirectory, image.pngFile), type: 'png' });
    } catch (error) {
      failed += 1;
      errors.push(`${image.pngFile}: ${message(error)}`);
    }
  }

  try {
    await Bun.write(path.join(stageDirectory, MANIFEST_FILE), serializeJson(stage.manifest));
  } catch (error) {
    failed += 1;
    errors.push(`${MANIFEST_FILE}: ${message(error)}`);
  }

  return {
    errors,
    failed,
    imageCount: stage.images.length,
    indexEntry: {
      id: stage.id,
      bounds: stage.bounds,
      images: stage.images.map((image) => image.pngFile),
      findingCounts: {
        errors: stage.findings.filter((finding) => finding.severity === 'error').length,
        warnings: stage.findings.filter((finding) => finding.severity === 'warning').length
      }
    }
  };
}

function message(error) {
  return error instanceof Error ? error.message : String(error);
}

async function main() {
  let options;

  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`Error: ${message(error)}`);
    console.error('');
    console.error(usage());
    return 1;
  }

  if (options.help) {
    console.log(usage());
    return 0;
  }

  let layouts;

  try {
    layouts = await loadSelectedLayouts(options.stageIds);
  } catch (error) {
    console.error(`Error: ${message(error)}`);
    console.error('');
    console.error(usage());
    return 1;
  }

  const stages = (() => {
    try {
      return layouts.map((layout) => prepareStage(layout, options));
    } catch (error) {
      console.error(`Error: ${message(error)}`);
      console.error('');
      console.error(usage());
      return null;
    }
  })();

  if (stages === null) {
    return 1;
  }

  let outDir;

  try {
    outDir = resolveOutputDirectory(ROOT, options.out);
  } catch (error) {
    console.error(`Error: ${message(error)}`);
    console.error('');
    console.error(usage());
    return 1;
  }
  const indexStages = [];
  let browser = null;
  let context = null;
  let totalImages = 0;
  let failures = 0;

  try {
    browser = await launchBrowser();
  } catch (error) {
    console.error(`STAGE MAP EXPORT FAIL: cannot launch the browser: ${message(error)}`);

    if (!process.env.CHROMIUM_EXECUTABLE_PATH) {
      console.error(HINT);
    }

    return 1;
  }

  try {
    context = await browser.newContext({
      deviceScaleFactor: 1,
      viewport: { width: 800, height: 600 }
    });
    const page = await context.newPage();

    for (const stage of stages) {
      const result = await exportStage({ page, outDir, stage });
      totalImages += result.imageCount;
      failures += result.failed;
      indexStages.push(result.indexEntry);

      if (result.errors.length === 0) {
        console.log(`ok - ${stage.id}: ${result.imageCount} images`);
      } else {
        console.error(`FAIL - ${stage.id}: ${result.failed} failure(s) across ${result.imageCount} images`);
        for (const error of result.errors) {
          console.error(`       ${error}`);
        }
      }
    }

    try {
      await mkdir(outDir, { recursive: true });
      const index = buildStageIndex({
        generatedAt: new Date().toISOString(),
        stages: indexStages
      });
      await Bun.write(path.join(outDir, INDEX_FILE), serializeJson(index));
    } catch (error) {
      failures += 1;
      console.error(`FAIL - ${INDEX_FILE}: ${message(error)}`);
    }
  } catch (error) {
    failures += 1;
    console.error(`STAGE MAP EXPORT FAIL: ${message(error)}`);
  } finally {
    if (context !== null) {
      await context.close().catch(() => {});
    }

    if (browser !== null) {
      await browser.close().catch((error) => {
        failures += 1;
        console.error(`Stage map export: failed to close the browser: ${message(error)}`);
      });
    }
  }

  const summary = `Stage map export: ${stages.length} stages, ${totalImages} images, ${failures} failed.`;

  if (failures === 0) {
    console.log(summary);
  } else {
    console.error(summary);
  }

  return failures === 0 ? 0 : 1;
}

if (import.meta.main) {
  process.exit(await main());
}
