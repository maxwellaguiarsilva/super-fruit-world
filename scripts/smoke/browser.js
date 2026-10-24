import { chromium } from 'playwright-core';

import { installPageHooks } from './page.js';

const VIEWPORT = { width: 1280, height: 720 };

function launchOptions() {
  const options = { headless: true };
  if (process.env.CHROMIUM_EXECUTABLE_PATH) {
    options.executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
  }
  return options;
}

export async function launchBrowser() {
  return chromium.launch(launchOptions());
}

export async function createGameContext(browser, { viewport = VIEWPORT, storageSeed = null } = {}) {
  const context = await browser.newContext({ viewport });
  installPageHooks(context);

  if (storageSeed) {
    await context.addInitScript((entries) => {
      for (const [key, value] of Object.entries(entries)) {
        try {
          localStorage.setItem(key, value);
        } catch {
          // Storage may be unavailable before the document origin exists.
        }
      }
    }, storageSeed);
  }

  return context;
}
