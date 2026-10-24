import { createGameContext, launchBrowser } from './smoke/browser.js';
import {
  readCanvasSignature,
  readCanvasText,
  waitForStageHud,
  waitForTitle,
  watchPage
} from './smoke/page.js';
import { startServer, stopServer } from './smoke/server.js';

const MIN_DISTINCT_COLORS = 2;
const MIN_NON_BLACK_SAMPLES = 100;

class SmokeAssertionError extends Error {}

function assert(condition, message) {
  if (!condition) {
    throw new SmokeAssertionError(message);
  }
}

function pass(message) {
  console.log(`ok - ${message}`);
}

function describeBootError(page) {
  return page.evaluate(() => document.querySelector('pre')?.textContent ?? '');
}

function describeTextTail(text, length = 20) {
  return text.slice(-length).map((entry) => JSON.stringify(entry)).join(', ');
}

async function runSmoke({ url, page, consoleErrors, pageErrors }) {
  await page.goto(url, { waitUntil: 'load', timeout: 15_000 });

  let titleOutcome;
  try {
    titleOutcome = await waitForTitle(page);
  } catch {
    titleOutcome = 'timeout';
  }

  if (titleOutcome === 'boot-error') {
    throw new SmokeAssertionError(`page reported a boot error:\n${await describeBootError(page)}`);
  }
  assert(titleOutcome === 'rendered', 'the page did not render the title screen within 10s');

  const bootError = await page.evaluate(() => {
    const element = document.querySelector('pre');
    return element && element.textContent.includes('BOOT ERROR') ? element.textContent : null;
  });
  assert(bootError === null, `the page contains a boot error element:\n${bootError}`);
  pass('the page booted without a boot-error element');

  const signature = await readCanvasSignature(page);
  assert(signature.exists, 'the #game-canvas element is missing');
  assert(signature.width > 0 && signature.height > 0, 'the canvas has no drawing surface');
  assert(signature.distinctColors >= MIN_DISTINCT_COLORS, `the canvas looks blank (${signature.distinctColors} distinct colors)`);
  assert(signature.nonBlackSamples >= MIN_NON_BLACK_SAMPLES, `the canvas looks blank (${signature.nonBlackSamples} non-black samples)`);
  pass(
    `the canvas is present and non-blank (${signature.width}x${signature.height}, ` +
    `${signature.distinctColors} distinct colors, ${signature.nonBlackSamples} non-black samples)`
  );

  assert(consoleErrors.length === 0, `page console errors before input:\n${consoleErrors.join('\n')}`);
  assert(pageErrors.length === 0, `uncaught page errors before input:\n${pageErrors.join('\n')}`);
  pass('no page console errors or uncaught exceptions during boot');

  await page.keyboard.press('Enter');

  let stageOutcome;
  try {
    stageOutcome = await waitForStageHud(page);
  } catch {
    stageOutcome = 'timeout';
  }

  if (stageOutcome === 'boot-error') {
    throw new SmokeAssertionError(`page reported a boot error after confirm:\n${await describeBootError(page)}`);
  }

  const text = await readCanvasText(page);
  assert(
    stageOutcome === 'stage',
    `pressing Enter once did not reach a stage with a HUD score label; last canvas text: ${describeTextTail(text)}`
  );
  pass(`pressing Enter reached the stage (HUD text ${JSON.stringify(text.find((entry) => entry.includes('Score:')))})`);

  assert(consoleErrors.length === 0, `page console errors after entering the stage:\n${consoleErrors.join('\n')}`);
  assert(pageErrors.length === 0, `uncaught page errors after entering the stage:\n${pageErrors.join('\n')}`);
  pass('no page console errors or uncaught exceptions after entering the stage');
}

async function main() {
  let server = null;
  let browser = null;

  try {
    server = await startServer();
    console.log(`Smoke: server ready at ${server.url}`);

    browser = await launchBrowser();
    const context = await createGameContext(browser);

    const page = await context.newPage();
    const { consoleErrors, pageErrors } = watchPage(page);

    await runSmoke({ url: server.url, page, consoleErrors, pageErrors });

    console.log('Smoke test passed.');
  } catch (error) {
    if (error instanceof SmokeAssertionError) {
      console.error(`SMOKE FAIL: ${error.message}`);
    } else {
      console.error(`SMOKE FAIL: ${error.stack ?? error.message}`);
    }
    if (!process.env.CHROMIUM_EXECUTABLE_PATH) {
      console.error('Hint: run "bunx playwright@1.64.1 install chromium" if the browser is missing.');
    }
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close().catch((error) => {
        console.error(`Smoke: failed to close the browser: ${error.message}`);
        process.exitCode = 1;
      });
    }

    if (server) {
      await stopServer(server.child);
    }
  }
}

await main();
