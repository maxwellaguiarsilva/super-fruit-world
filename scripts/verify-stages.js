import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createGameContext, launchBrowser } from './smoke/browser.js';
import {
  readBootError,
  resetCanvasText,
  waitForBoot,
  waitForCanvasText,
  waitForStageHud,
  watchPage
} from './smoke/page.js';
import { startServer, stopServer } from './smoke/server.js';
import {
  buildProgressStorageEntry,
  collectKeyNames,
  discoverStageIds,
  introLine
} from './verify-stages/catalog.js';

const ROOT = path.resolve(import.meta.dir, '..');
const STAGE_DIRECTORY = path.join(ROOT, 'data', 'stages');
const GAME_CONFIG_PATH = path.join(ROOT, 'data', 'game-config.json');
const MAP_PATH = path.join(ROOT, 'data', 'map', 'fruit-world.json');
const TEXT_PATH = path.join(ROOT, 'data', 'i18n', 'default.json');

const GOTO_TIMEOUT_MS = 15_000;
const BOOT_TIMEOUT_MS = 10_000;
const HUD_TIMEOUT_MS = 10_000;
const DIALOGUE_TIMEOUT_MS = 8_000;
const STAGE_TIMEOUT_MS = 60_000;

class StageTimeoutError extends Error {
  constructor(stageId, timeoutMs) {
    super(`${stageId} did not finish within ${timeoutMs}ms`);
    this.name = 'StageTimeoutError';
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function withTimeout(promise, timeoutMs, stageId) {
  let timer = null;

  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new StageTimeoutError(stageId, timeoutMs)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function checkStage({ browser, url, stageId, stageIds, keyNames, namespace, textConfig }) {
  const failures = [];
  const storageSeed = buildProgressStorageEntry({ namespace, stageId, stageIds, keyNames });
  const context = await createGameContext(browser, { storageSeed });

  let consoleErrors = [];
  let pageErrors = [];

  try {
    const page = await context.newPage();
    ({ consoleErrors, pageErrors } = watchPage(page));

    const check = async () => {
      try {
        const stageConfig = await readJson(path.join(STAGE_DIRECTORY, `${stageId}.json`));
        const intro = introLine(stageConfig, textConfig);

        await page.goto(url, { waitUntil: 'load', timeout: GOTO_TIMEOUT_MS });

        const bootOutcome = await waitForBoot(page, BOOT_TIMEOUT_MS).catch(() => 'timeout');
        if (bootOutcome === 'boot-error') {
          return;
        }
        if (bootOutcome !== 'rendered') {
          failures.push(`the map did not render within ${BOOT_TIMEOUT_MS}ms`);
          return;
        }

        await page.keyboard.press('Enter');

        const hudOutcome = await waitForStageHud(page, HUD_TIMEOUT_MS).catch(() => 'timeout');
        if (hudOutcome === 'boot-error') {
          return;
        }
        if (hudOutcome !== 'stage') {
          failures.push(
            `confirming on the map did not enter ${stageId} with a HUD score label within ${HUD_TIMEOUT_MS}ms`
          );
          return;
        }

        await resetCanvasText(page);

        if (intro.speaker.length === 0 && intro.text.length === 0) {
          failures.push('the stage declares no intro dialogue to verify');
          return;
        }

        if (intro.speaker.length > 0) {
          const speakerOutcome = await waitForCanvasText(page, intro.speaker, DIALOGUE_TIMEOUT_MS)
            .catch(() => 'timeout');
          if (speakerOutcome !== 'found') {
            failures.push(
              `the intro speaker ${JSON.stringify(intro.speaker)} did not appear within ${DIALOGUE_TIMEOUT_MS}ms`
            );
          }
        }

        if (intro.word.length > 0) {
          const wordOutcome = await waitForCanvasText(page, intro.word, DIALOGUE_TIMEOUT_MS)
            .catch(() => 'timeout');
          if (wordOutcome !== 'found') {
            failures.push(
              `the intro text ${JSON.stringify(intro.text)} did not start with ${JSON.stringify(intro.word)} ` +
              `within ${DIALOGUE_TIMEOUT_MS}ms`
            );
          }
        }
      } finally {
        const bootError = await readBootError(page).catch(() => null);
        if (bootError !== null) {
          failures.push(`the page contains a boot error element:\n${bootError}`);
        }
      }
    };

    await withTimeout(check(), STAGE_TIMEOUT_MS, stageId);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  } finally {
    await context.close().catch(() => {});
  }

  if (consoleErrors.length > 0) {
    failures.push(`page console errors:\n${consoleErrors.join('\n')}`);
  }
  if (pageErrors.length > 0) {
    failures.push(`uncaught page errors:\n${pageErrors.join('\n')}`);
  }

  return failures;
}

async function main() {
  let server = null;
  let browser = null;
  let exitCode = 0;

  try {
    const stageIds = await discoverStageIds(STAGE_DIRECTORY);
    if (stageIds.length === 0) {
      throw new Error(`no stage files found in ${STAGE_DIRECTORY}`);
    }

    const gameConfig = await readJson(GAME_CONFIG_PATH);
    const mapConfig = await readJson(MAP_PATH);
    const textConfig = await readJson(TEXT_PATH);
    const namespace = gameConfig['save-namespace'];
    const keyNames = collectKeyNames(mapConfig);

    server = await startServer();
    console.log(`Stage verification: server ready at ${server.url}`);

    browser = await launchBrowser();

    let passed = 0;
    let failed = 0;

    for (const stageId of stageIds) {
      const failures = await checkStage({
        browser,
        url: server.url,
        stageId,
        stageIds,
        keyNames,
        namespace,
        textConfig
      });

      if (failures.length === 0) {
        passed++;
        console.log(`ok - ${stageId}`);
      } else {
        failed++;
        exitCode = 1;
        console.error(`FAIL - ${stageId}`);
        for (const failure of failures) {
          console.error(`       ${failure}`);
        }
      }
    }

    const summary = `Stage verification: ${stageIds.length} stages, ${passed} passed, ${failed} failed.`;
    if (failed === 0) {
      console.log(summary);
    } else {
      console.error(summary);
    }
  } catch (error) {
    console.error(`STAGE VERIFY FAIL: ${error.stack ?? error.message}`);
    if (!process.env.CHROMIUM_EXECUTABLE_PATH) {
      console.error('Hint: run "bunx playwright@1.64.1 install chromium" if the browser is missing.');
    }
    exitCode = 1;
  } finally {
    if (browser) {
      await browser.close().catch((error) => {
        console.error(`Stage verification: failed to close the browser: ${error.message}`);
        exitCode = 1;
      });
    }

    if (server) {
      await stopServer(server.child);
    }
  }

  process.exit(exitCode);
}

await main();
