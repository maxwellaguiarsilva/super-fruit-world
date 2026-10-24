import path from 'node:path';

const ROOT = path.resolve(import.meta.dir, '..');
const DEFAULT_PORT = 8123;
const requestedPort = process.env.PORT === undefined || process.env.PORT === ''
  ? NaN
  : Number(process.env.PORT);
const PORT = Number.isInteger(requestedPort) && requestedPort >= 0 ? requestedPort : DEFAULT_PORT;

const MIME_TYPES = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
});

const NO_CACHE = 'no-cache, no-store, must-revalidate';

function resolveRequestPath(pathname) {
  const relative = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  const filePath = path.resolve(ROOT, `.${relative}`);

  if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${path.sep}`)) {
    return null;
  }

  return filePath;
}

function notFound() {
  return new Response('Not found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': NO_CACHE
    }
  });
}

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);
    let pathname;

    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return new Response('Bad request', { status: 400 });
    }

    const filePath = resolveRequestPath(pathname);
    if (filePath === null) {
      return new Response('Forbidden', { status: 403 });
    }

    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return notFound();
    }

    return new Response(file, {
      headers: {
        'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
        'Cache-Control': NO_CACHE
      }
    });
  }
});

console.log(`Serving ${ROOT} at http://localhost:${server.port}`);
console.log('Press Ctrl+C to stop.');
