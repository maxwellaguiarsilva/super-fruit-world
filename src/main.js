import { App } from './app/app.js';
import { showBootError } from './app/boot-error.js';

// Error policy: only failures before App.start() resolves are boot failures and
// replace the page with the boot-error screen. Errors raised after boot are
// runtime errors of a running game, so they are reported to the console and the
// page is left untouched.
let booted = false;

window.addEventListener('error', (event) => {
  if (booted) {
    console.error(event.error ?? event.message);
    return;
  }
  if (event.error) {
    showBootError(event.error);
  }
});

new App().start()
  .then(() => {
    booted = true;
  })
  .catch(showBootError);
