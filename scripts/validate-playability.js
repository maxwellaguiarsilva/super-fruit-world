import path from 'node:path';

import { analyzeLayouts } from './stage-analysis/checks.js';
import { loadStageLayouts } from './stage-analysis/model.js';

const ROOT = path.resolve(import.meta.dir, '..');

const HELP = [
  'Usage: bun scripts/validate-playability.js [--stage <stage-id>]...',
  '',
  'Validates that every stage in data/stages can be played. Collectibles must sit in free playable space and must be reachable from the player spawn.',
  '',
  'Options:',
  '  --stage <stage-id>  Validate only the given stage. Repeat the flag to validate several stages.',
  '  --help              Show this help text.',
  '',
  'Exit codes:',
  '  0  No errors were found. Warnings do not fail the command.',
  '  1  At least one error was found, or the stage data tree could not be read.'
].join('\n');

export function parseArguments(argv) {
  const stageIds = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--help' || argument === '-h') {
      return { help: true, stageIds: [] };
    }

    if (argument === '--stage') {
      const stageId = argv[index + 1];
      if (stageId === undefined || stageId.length === 0) {
        throw new Error('--stage requires a stage id');
      }
      stageIds.push(stageId);
      index += 1;
      continue;
    }

    if (argument.startsWith('--stage=')) {
      const stageId = argument.slice('--stage='.length);
      if (stageId.length === 0) {
        throw new Error('--stage requires a stage id');
      }
      stageIds.push(stageId);
      continue;
    }

    throw new Error(`unknown argument "${argument}"`);
  }

  return { help: false, stageIds };
}

function selectLayouts(layouts, stageIds) {
  if (stageIds.length === 0) {
    return layouts;
  }

  const layoutsById = new Map(layouts.map((layout) => [layout.id, layout]));
  const selected = [];
  const seen = new Set();

  for (const stageId of stageIds) {
    const id = path.basename(stageId).replace(/\.json$/i, '');
    const layout = layoutsById.get(id);

    if (layout === undefined) {
      throw new Error(`unknown stage id "${stageId}"; expected a file in data/stages`);
    }

    if (!seen.has(id)) {
      seen.add(id);
      selected.push(layout);
    }
  }

  return selected;
}

export async function validatePlayability({ root = ROOT, stageIds = [] } = {}) {
  const layouts = await loadStageLayouts({ root });
  const stages = selectLayouts(layouts, stageIds);
  const findings = analyzeLayouts(stages);
  const errors = findings.filter((finding) => finding.severity === 'error');
  const warnings = findings.filter((finding) => finding.severity === 'warning');

  return { stages, findings, errors, warnings };
}

function printFindings(findings) {
  for (const finding of findings) {
    const line = `${finding.severity}: ${finding.stage}: ${finding.message}`;
    if (finding.severity === 'error') {
      console.error(line);
    } else {
      console.log(line);
    }
  }
}

function printSummary({ stages, errors, warnings }) {
  if (errors.length > 0) {
    console.error(`Playability validation failed: ${stages.length} stages, ${errors.length} error(s), ${warnings.length} warning(s).`);
    return;
  }

  console.log(`Playability validation passed: ${stages.length} stages, 0 errors, ${warnings.length} warning(s).`);
}

if (import.meta.main) {
  let options = null;

  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`error: ${error.message}`);
    console.error(HELP);
    process.exitCode = 1;
  }

  if (options?.help === true) {
    console.log(HELP);
  } else if (options !== null) {
    try {
      const result = await validatePlayability({ stageIds: options.stageIds });
      printFindings(result.findings);
      printSummary(result);

      if (result.errors.length > 0) {
        process.exitCode = 1;
      }
    } catch (error) {
      console.error(`Unable to validate stage playability: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
