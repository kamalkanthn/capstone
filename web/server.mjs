import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(root, '..');
const port = Number(process.env.PORT || 4173);
const python = process.platform === 'win32'
  ? join(projectRoot, '.venv', 'Scripts', 'python.exe')
  : join(projectRoot, '.venv', 'bin', 'python');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.md':'text/markdown; charset=utf-8'};

let api = null;
if (existsSync(python)) {
  api = spawn(python, ['-m', 'uvicorn', 'isl_communication.api:app', '--app-dir', join(projectRoot, 'src'), '--host', '127.0.0.1', '--port', '4174'], {
    cwd: projectRoot,
    stdio: 'inherit',
    windowsHide: true,
  });
  api.on('error', error => console.error(`Could not start the local ISL API: ${error.message}`));
}

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const relative = pathname === '/' ? 'index.html' : normalize(pathname.replace(/^\/+/, ''));
  const base = pathname.startsWith('/docs/') ? projectRoot : root;
  const file = join(base, relative);
  if (!file.startsWith(base) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}).end('Not found');
    return;
  }
  response.writeHead(200, {'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'});
  createReadStream(file).pipe(response);
}).listen(port, '127.0.0.1', () => console.log(`SignBridge is running at http://127.0.0.1:${port}`));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    api?.kill();
    process.exit(0);
  });
}
