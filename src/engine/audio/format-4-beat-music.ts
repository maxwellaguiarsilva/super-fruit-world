#!/usr/bin/env bun
/**
 * Checks if a BGM JSON file has 4/4 time signature (matching title-screen.json).
 *
 * Usage: bun run format-4-beat-music <path-to-json>
 *
 * If the file has time-signature [4, 4], processes each track through handleTrack.
 * Otherwise, exits silently.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { crc32 } from "node:zlib";

const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: bun run format-4-beat-music <path-to-json>");
  process.exit(1);
}

let data: unknown;
try {
  const raw = readFileSync(filePath, "utf-8");
  data = JSON.parse(raw);
} catch {
  // File not found or invalid JSON — exit silently
  process.exit(0);
}

const d = data as Record<string, unknown>;
const is4by4 =
  data &&
  typeof data === "object" &&
  "time-signature" in data &&
  Array.isArray(d["time-signature"]) &&
  d["time-signature"][0] === 4 &&
  d["time-signature"][1] === 4;

if (!is4by4) {
  process.exit(0);
}

type Note = [string, number];

function smallestPrimeDivisor(n: number): number {
  if (n % 2 === 0) return 2;
  for (let p = 3; p * p <= n; p += 2) {
    if (n % p === 0) return p;
  }
  return n;
}

function expandPhrase(items: unknown[], phrases: Record<string, unknown>): Note[] {
  const result: Note[] = [];
  for (const item of items) {
    if (typeof item === "string") {
      const sub = phrases[item];
      if (Array.isArray(sub)) {
        result.push(...expandPhrase(sub, phrases));
      }
    } else if (Array.isArray(item)) {
      result.push(item as Note);
    }
  }
  return result;
}

function handleTrack(
  trackName: string,
  _trackData: unknown,
  phrases: Record<string, unknown>,
): { rootKey: string; phrases: Record<string, unknown>; expandedNotes: Note[] } {
  const trackData = _trackData as { notes: unknown[] };
  const expandedNotes: Note[] = expandPhrase(trackData.notes, phrases);

  const cells: Note[][] = [];
  let i = 0;
  while (i < expandedNotes.length) {
    const cell: Note[] = [];
    let acc = 0;
    while (i < expandedNotes.length && acc < 2) {
      cell.push(expandedNotes[i]);
      acc += expandedNotes[i][1];
      i++;
    }
    cells.push(cell);
  }

  const cellsDict: Record<string, Note[]> = {};
  const cellsTrack: string[] = [];
  for (const cell of cells) {
    const letters = cell.map((n) => n[0].replace(/\d/g, "")).join("");
    const hash = crc32(JSON.stringify(cell)).toString(36).padStart(7, "0").slice(0, 4);
    const key = `${trackName}-${letters}-${hash}`;
    if (!(key in cellsDict)) {
      cellsDict[key] = cell;
    }
    cellsTrack.push(key);
  }

  const cellDuration = (key: string): number =>
    cellsDict[key].reduce((sum, n) => sum + n[1], 0);

  const barsDict: Record<string, string[]> = {};
  const barsTrack: string[] = [];
  let j = 0;
  while (j < cellsTrack.length) {
    const barCells: string[] = [];
    let acc = 0;
    while (j < cellsTrack.length && acc < 4) {
      const cellKey = cellsTrack[j];
      barCells.push(cellKey);
      acc += cellDuration(cellKey);
      j++;
    }
    const letters = barCells.map((k) => k.split("-")[1]).join("");
    const hash = crc32(JSON.stringify(barCells)).toString(36).padStart(7, "0").slice(0, 4);
    const barKey = `${trackName}-${letters}-${hash}`;
    if (!(barKey in barsDict)) {
      barsDict[barKey] = barCells;
    }
    barsTrack.push(barKey);
  }

  const phrasesDict: Record<string, unknown> = { ...cellsDict };
  for (const [key, val] of Object.entries(barsDict)) {
    if (!(key in phrasesDict)) {
      phrasesDict[key] = val;
    }
  }

  let currentLevelTrack: string[] = barsTrack;
  let level = 1;
  while (currentLevelTrack.length > 1) {
    const N = currentLevelTrack.length;
    const X = smallestPrimeDivisor(N);
    const P = N / X;
    const nextLevelTrack: string[] = [];
    for (let item = 0; item < P; item++) {
      const subItems = currentLevelTrack.slice(item * X, item * X + X);
      const key = `${trackName}-l${level}-i${item + 1}`;
      phrasesDict[key] = subItems;
      nextLevelTrack.push(key);
    }
    currentLevelTrack = nextLevelTrack;
    level++;
  }

  // Inline 1-to-1 expansions: collapse chains where a key's value is a single reference.
  const resolveInline = (key: string, visiting: Set<string>): unknown => {
    const v = phrasesDict[key];
    if (!Array.isArray(v) || v.length !== 1) return v;
    const only = v[0];
    if (typeof only !== "string" || !(only in phrasesDict)) return v;
    if (visiting.has(only)) return v; // cycle guard
    visiting.add(only);
    const resolved = resolveInline(only, visiting);
    visiting.delete(only);
    return resolved;
  };

  for (const key of Object.keys(phrasesDict)) {
    const v = phrasesDict[key];
    if (Array.isArray(v) && v.length === 1 && typeof v[0] === "string" && v[0] in phrasesDict) {
      phrasesDict[key] = resolveInline(key, new Set([key]));
    }
  }

  // Remove unreachable keys (orphans after inlining), keeping the root entry point.
  const rootKey = currentLevelTrack[0];
  const reachable = new Set<string>();
  const stack = [rootKey];
  while (stack.length > 0) {
    const k = stack.pop()!;
    if (reachable.has(k)) continue;
    reachable.add(k);
    const v = phrasesDict[k];
    if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === "string" && item in phrasesDict && !reachable.has(item)) {
          stack.push(item);
        }
      }
    }
  }
  for (const key of Object.keys(phrasesDict)) {
    if (!reachable.has(key)) {
      delete phrasesDict[key];
    }
  }

  return { rootKey, phrases: phrasesDict, expandedNotes };
}

const dataObj = data as Record<string, unknown>;
const channels = dataObj.channels as Record<string, { notes: unknown[] }>;
const inputPhrases = dataObj.phrases as Record<string, unknown>;

const mergedPhrases: Record<string, unknown> = {};
for (const [trackName, trackData] of Object.entries(channels)) {
  const { rootKey, phrases: trackPhrases, expandedNotes } = handleTrack(trackName, trackData, inputPhrases);

  // Verify expansion correctness: re-expanding the root through the new dict
  // must reproduce the original flat note sequence.
  const reexpanded = expandPhrase([rootKey], trackPhrases);
  if (JSON.stringify(reexpanded) !== JSON.stringify(expandedNotes)) {
    console.error(`Expansion mismatch for track "${trackName}"`);
    process.exit(1);
  }

  trackData.notes = [rootKey];
  Object.assign(mergedPhrases, trackPhrases);
}

dataObj.phrases = mergedPhrases;

// Custom serialization: phrase values are rendered inline (one line each),
// matching the style [ [ "c5", 1 ], [ "e5", 1 ] ]. The rest stays at 2-space indent.
const renderInline = (value: unknown): string => {
  if (!Array.isArray(value)) return JSON.stringify(value);
  if (value.length === 0) return "[]";
  const items = value.map((item) =>
    Array.isArray(item)
      ? `[ ${JSON.stringify(item[0])}, ${JSON.stringify(item[1])} ]`
      : JSON.stringify(item),
  );
  return `[ ${items.join(", ")} ]`;
};

const { phrases: outPhrases, ...rest } = dataObj;
const phrasesStr = Object.entries(outPhrases as Record<string, unknown>)
  .map(([k, v]) => `    ${JSON.stringify(k)}: ${renderInline(v)}`)
  .join(",\n");
const out =
  JSON.stringify(rest, null, 2).slice(0, -1).trimEnd() +
  `,\n  "phrases": {\n${phrasesStr}\n  }\n}`;

const outPath = filePath.replace(/\.json$/, "-formatted.json");
writeFileSync(outPath, out + "\n", "utf-8");
console.log(`Wrote ${outPath}`);


