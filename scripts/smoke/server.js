import { spawn } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dir, '..', '..');
const READY_PATTERN = /http:\/\/localhost:(\d+)/;
const START_TIMEOUT_MS = 10_000;
const STOP_TIMEOUT_MS = 3_000;

function waitForExit(child) {
  if (child.exitCode !== null) {
    return Promise.resolve(child.exitCode);
  }

  return new Promise((resolve) => {
    child.once('exit', (code) => resolve(code));
  });
}

function withTimeout(promise, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('timeout'), timeoutMs);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

export async function stopServer(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  child.kill('SIGTERM');
  const exited = await withTimeout(waitForExit(child), STOP_TIMEOUT_MS);

  if (exited === 'timeout' && child.exitCode === null) {
    child.kill('SIGKILL');
    await waitForExit(child);
  }
}

export async function startServer() {
  const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'serve.js')], {
    cwd: ROOT,
    env: { ...process.env, PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const url = await new Promise((resolve, reject) => {
    let stdout = '';
    let settled = false;

    const finish = (callback, value) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      child.stdout.off('data', onStdout);
      child.off('exit', onExit);
      callback(value);
    };

    const fail = (error) => {
      finish(reject, error);
      if (child.exitCode === null) {
        child.kill('SIGKILL');
      }
    };

    const timer = setTimeout(() => {
      fail(new Error(`server did not print its URL within ${START_TIMEOUT_MS}ms\n${stderr}`));
    }, START_TIMEOUT_MS);

    const onStdout = (chunk) => {
      stdout += chunk.toString();
      const match = stdout.match(READY_PATTERN);
      if (match) {
        finish(resolve, `http://localhost:${match[1]}`);
      }
    };

    const onExit = (code) => {
      finish(reject, new Error(`server exited with code ${code} before becoming ready\n${stderr}`));
    };

    child.stdout.on('data', onStdout);
    child.on('exit', onExit);
    child.on('error', fail);
  });

  child.stdout.resume();
  child.stdout.on('data', () => {});

  return { url, child };
}
