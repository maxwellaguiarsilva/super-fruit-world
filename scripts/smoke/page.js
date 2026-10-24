const IGNORED_CONSOLE_PATTERNS = [
  /favicon/i
];

function isIgnoredConsoleError(message) {
  const text = message.text();
  const location = message.location()?.url ?? '';

  if (/favicon\.ico/i.test(location)) {
    return true;
  }

  return IGNORED_CONSOLE_PATTERNS.some((pattern) => pattern.test(text));
}

export function installPageHooks(context) {
  return context.addInitScript(() => {
    const smoke = {
      text: []
    };

    Object.defineProperty(window, '__smoke', {
      configurable: true,
      value: smoke
    });

    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function fillText(text, ...rest) {
      smoke.text.push(String(text));
      if (smoke.text.length > 4000) {
        smoke.text.splice(0, 2000);
      }
      return originalFillText.call(this, text, ...rest);
    };

    try {
      localStorage.clear();
    } catch {
      // Storage may be unavailable before the document origin exists.
    }

    try {
      Object.defineProperty(navigator, 'getGamepads', {
        configurable: true,
        value: () => []
      });
    } catch {
      // A browser without Gamepad support already reports no gamepads.
    }
  });
}

export function watchPage(page) {
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error' && !isIgnoredConsoleError(message)) {
      consoleErrors.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.stack ?? error.message);
  });

  return { consoleErrors, pageErrors };
}

export async function readCanvasSignature(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#game-canvas');
    if (!(canvas instanceof HTMLCanvasElement)) {
      return { exists: false };
    }

    const context = canvas.getContext('2d');
    if (!context || canvas.width === 0 || canvas.height === 0) {
      return { exists: true, blank: true, width: canvas.width, height: canvas.height };
    }

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = new Set();
    let nonBlackSamples = 0;

    for (let index = 0; index < pixels.length; index += 16) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const alpha = pixels[index + 3];

      if (alpha === 0) {
        continue;
      }

      if (red !== 0 || green !== 0 || blue !== 0) {
        nonBlackSamples++;
      }

      colors.add(`${red},${green},${blue}`);
    }

    return {
      exists: true,
      blank: false,
      width: canvas.width,
      height: canvas.height,
      distinctColors: colors.size,
      nonBlackSamples
    };
  });
}

export async function readCanvasText(page) {
  return page.evaluate(() => window.__smoke?.text ?? []);
}

export async function resetCanvasText(page) {
  await page.evaluate(() => {
    if (window.__smoke) {
      window.__smoke.text.length = 0;
    }
  });
}

export async function readBootError(page) {
  return page.evaluate(() => {
    const element = document.querySelector('pre');
    return element && element.textContent.includes('BOOT ERROR') ? element.textContent : null;
  });
}

export async function waitForBoot(page, timeoutMs = 10_000) {
  const handle = await page.waitForFunction(() => {
    const bootError = document.querySelector('pre');
    if (bootError && bootError.textContent.includes('BOOT ERROR')) {
      return 'boot-error';
    }

    return (window.__smoke?.text.length ?? 0) > 5 ? 'rendered' : false;
  }, null, { timeout: timeoutMs });

  return handle.jsonValue();
}

export function waitForTitle(page, timeoutMs = 10_000) {
  return waitForBoot(page, timeoutMs);
}

export async function waitForCanvasText(page, needle, timeoutMs = 10_000) {
  const handle = await page.waitForFunction((text) => {
    const bootError = document.querySelector('pre');
    if (bootError && bootError.textContent.includes('BOOT ERROR')) {
      return 'boot-error';
    }

    return (window.__smoke?.text ?? []).some((entry) => entry.includes(text)) ? 'found' : false;
  }, needle, { timeout: timeoutMs });

  return handle.jsonValue();
}

export async function waitForStageHud(page, timeoutMs = 10_000) {
  const handle = await page.waitForFunction(() => {
    const bootError = document.querySelector('pre');
    if (bootError && bootError.textContent.includes('BOOT ERROR')) {
      return 'boot-error';
    }

    const text = window.__smoke?.text ?? [];
    return text.some((entry) => entry.includes('Score:')) ? 'stage' : false;
  }, null, { timeout: timeoutMs });

  return handle.jsonValue();
}
