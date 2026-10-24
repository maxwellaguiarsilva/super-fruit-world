import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  computeDialogueLayout,
  measureTextWidth,
  wrapText
} from '../src/engine/dialog/dialogue-engine.js';

function readJson(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

function resolveKey(data, key) {
  return key.split('.').reduce((value, part) => value?.[part], data);
}

const dialogueData = readJson('../data/ui/dialogue.json');
const hudData = readJson('../data/ui/hud.json');
const i18nData = readJson('../data/i18n/en-us.json');
const stageData = readJson('../data/stages/strawberry-fields.json');

const LAYOUT = dialogueData.dialogue;
const HUD_HEIGHT = hudData.hud.height;
const INTRO_KEY = stageData.dialogue.intro[0].text;
const INTRO_TEXT = resolveKey(i18nData, INTRO_KEY);
const VIEWPORTS = [
  [17.78, 10],
  [13, 10],
  [10, 10],
  [30, 10],
  [40, 30]
];

describe('wrapText', () => {
  test('returns no lines for empty text', () => {
    expect(wrapText('', 5, 0.4)).toEqual([]);
  });

  test('wraps at word boundaries and preserves every word', () => {
    const text = 'Welcome to Strawberry Fields! Reach the exit door.';
    const lines = wrapText(text, 4.8, 0.4);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe(text);
    for (const line of lines) {
      expect(measureTextWidth(line, 0.4)).toBeLessThanOrEqual(4.8);
    }
  });

  test('splits a word that is wider than the line', () => {
    const word = 'supercalifragilisticexpialidocious';
    const lines = wrapText(word, 1.2, 0.4);

    expect(lines.join('')).toBe(word);
    for (const line of lines) {
      expect(measureTextWidth(line, 0.4)).toBeLessThanOrEqual(1.2);
    }
  });
});

describe('dialogue layout', () => {
  test('keeps the intro text inside the configured box for every viewport', () => {
    for (const [viewportWidth, viewportHeight] of VIEWPORTS) {
      const base = computeDialogueLayout(viewportWidth, viewportHeight, LAYOUT);
      const lines = wrapText(INTRO_TEXT, base.textWidth, base.fontSize);
      const geometry = computeDialogueLayout(viewportWidth, viewportHeight, LAYOUT, lines.length);

      expect(lines.length).toBeGreaterThan(1);
      expect(lines.join(' ')).toBe(INTRO_TEXT);
      expect(geometry.maxLines).toBeGreaterThanOrEqual(lines.length);

      for (const line of lines) {
        expect(measureTextWidth(line, geometry.fontSize)).toBeLessThanOrEqual(geometry.textWidth);
      }

      const lastBaseline = geometry.textY + geometry.fontSize + (lines.length - 1) * geometry.lineHeight;
      expect(lastBaseline).toBeLessThanOrEqual(geometry.textBottom);
    }
  });

  test('anchors the band to the bottom without overlapping the HUD strip', () => {
    for (const [viewportWidth, viewportHeight] of VIEWPORTS) {
      const geometry = computeDialogueLayout(viewportWidth, viewportHeight, LAYOUT, 2);

      expect(geometry.y).toBeGreaterThanOrEqual(HUD_HEIGHT);
      expect(geometry.y).toBeGreaterThanOrEqual(0);
      expect(geometry.y + geometry.height).toBeLessThanOrEqual(viewportHeight);
      expect(geometry.x).toBeGreaterThanOrEqual(0);
      expect(geometry.x + geometry.width).toBeLessThanOrEqual(viewportWidth);
    }
  });

  test('uses the configured height as the minimum and grows up to the configured maximum', () => {
    const short = computeDialogueLayout(20, 10, LAYOUT, 1);
    const tall = computeDialogueLayout(20, 10, LAYOUT, 8);

    expect(short.height).toBe(LAYOUT.height);
    expect(tall.height).toBeGreaterThan(LAYOUT.height);
    expect(tall.height).toBeLessThanOrEqual(LAYOUT['max-height']);
    expect(tall.y + tall.height).toBeLessThanOrEqual(10);
  });
});
