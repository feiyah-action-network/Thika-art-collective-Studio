/**
 * Test entry point: build if needed, serve dist, run the static asset check and
 * then the browser checks, and always stop the server on the way out.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.TEST_PORT || '4173';
const BASE = `http://127.0.0.1:${PORT}`;

function run(command, args, options = {}) {
  return new Promise((done, fail) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', ...options });
    child.on('exit', (code) => (code === 0 ? done() : fail(new Error(`${command} ${args.join(' ')} exited ${code}`))));
    child.on('error', fail);
  });
}

async function waitForServer(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE + '/');
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`preview server did not answer on ${BASE}`);
}

if (!existsSync(resolve(root, 'dist')) || process.env.TEST_BUILD !== 'skip') {
  await run('npm', ['run', 'build']);
}

await run('node', ['tests/check-assets.mjs']);

const server = spawn('npx', ['vite', 'preview', '--port', PORT, '--host', '127.0.0.1'], {
  cwd: root,
  stdio: 'ignore',
  detached: true
});

let failure = null;
try {
  await waitForServer();
  await run('node', ['tests/site.mjs'], { env: { ...process.env, TEST_BASE_URL: BASE } });
} catch (error) {
  failure = error;
} finally {
  try {
    process.kill(-server.pid);
  } catch {
    server.kill();
  }
}

if (failure) {
  console.error(String(failure.message));
  process.exit(1);
}
