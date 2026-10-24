import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'bun:test';

const root = path.resolve(import.meta.dir, '..');
const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const formatterPath = 'src/engine/audio/format-4-beat-music.ts';

describe('music formatter CLI', () => {
  test('declares the script printed by the formatter usage', () => {
    const script = packageJson.scripts['format-4-beat-music'];

    expect(script).toBe(`bun ${formatterPath}`);
    expect(existsSync(path.join(root, formatterPath))).toBe(true);
  });

  test('prints an invocation that matches the declared script', () => {
    const source = readFileSync(path.join(root, formatterPath), 'utf8');
    const usage = 'Usage: bun run format-4-beat-music <path-to-json>';

    expect(source.split(usage)).toHaveLength(3);
  });
});
