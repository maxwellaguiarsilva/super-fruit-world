import { afterEach, describe, expect, test } from 'bun:test';

import { showBootError } from '../src/app/boot-error.js';

function installDocument() {
  const previousDocument = globalThis.document;
  const body = { innerHTML: '' };

  globalThis.document = { body };

  return {
    body,
    restore() {
      if (previousDocument === undefined) {
        delete globalThis.document;
        return;
      }
      globalThis.document = previousDocument;
    }
  };
}

describe('showBootError', () => {
  let host = null;

  afterEach(() => {
    host?.restore();
    host = null;
  });

  test('renders the boot error banner, message and stack into the document body', () => {
    host = installDocument();
    const error = new Error('stage data failed to load');

    showBootError(error);

    expect(host.body.innerHTML).toContain('<pre');
    expect(host.body.innerHTML).toContain('BOOT ERROR:');
    expect(host.body.innerHTML).toContain('stage data failed to load');
    expect(host.body.innerHTML).toContain(String(error.stack));
  });

  test('takes the body surface it needs without any other document API', () => {
    host = installDocument();

    expect(() => showBootError(new Error('no other DOM required'))).not.toThrow();
    expect(host.body.innerHTML.length).toBeGreaterThan(0);
  });
});
