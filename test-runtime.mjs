import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  channel: 'msedge'
});

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const errors = [];
const consoleMsgs = [];

page.on('console', (msg) => {
  consoleMsgs.push(`[${msg.type()}] ${msg.text()}`);
});
page.on('pageerror', (err) => {
  errors.push(`PAGE ERROR: ${err.message}\n${err.stack}`);
});

await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 10000 });
await page.waitForTimeout(2000);

console.log('=== Before Enter ===');
console.log('Console:', consoleMsgs.length, 'messages');
console.log('Errors:', errors.length, 'errors');
errors.forEach(e => console.log(e));

// Inject error handler
await page.evaluate(() => {
  window.addEventListener('error', (e) => {
    document.title = 'ERROR: ' + e.message;
  });
  window.addEventListener('unhandledrejection', (e) => {
    document.title = 'REJECTION: ' + e.reason;
  });
});

// Press Enter to trigger confirm
await page.keyboard.press('Enter');
await page.waitForTimeout(2000);

console.log('\n=== After Enter ===');
console.log('Console:', consoleMsgs.length, 'messages');
consoleMsgs.slice(-10).forEach(m => console.log(m));
console.log('Errors:', errors.length, 'errors');
errors.forEach(e => console.log(e));

// Check page title for injected errors
const title = await page.title();
console.log('\nPage title:', title);

// Check if canvas still exists and has content
const canvasInfo = await page.evaluate(() => {
  const canvas = document.querySelector('#game-canvas');
  if (!canvas) return 'no canvas';
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let nonBlackPixels = 0;
  for (let i = 0; i < imageData.data.length; i += 4) {
    if (imageData.data[i] > 0 || imageData.data[i+1] > 0 || imageData.data[i+2] > 0) {
      nonBlackPixels++;
    }
  }
  return `canvas ${canvas.width}x${canvas.height}, non-black pixels: ${nonBlackPixels}`;
});
console.log('Canvas:', canvasInfo);

// Check body content for error messages
const bodyText = await page.evaluate(() => document.body.innerText);
if (bodyText) console.log('Body text:', bodyText);

await browser.close();
console.log('\n=== Done ===');
