const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createServer: createTcpServer } = require('node:net');
const { test } = require('node:test');
const { startHealthServer } = require('../dist/health.js');

/** Runs the exact compiled probe used by Docker. */
const runProbe = () => new Promise((resolve, reject) => {
  const probe = spawn(process.execPath, ['dist/healthcheck.js'], { stdio: 'ignore' });
  probe.once('error', reject);
  probe.once('exit', resolve);
});

test('health follows startup, gateway loss, recovery and shutdown', async () => {
  let ready = false;
  const server = await startHealthServer(() => ready);
  try {
    assert.equal(server.address().address, '127.0.0.1');
    const startup = await fetch('http://127.0.0.1:8080/healthz');
    assert.equal(startup.status, 503);
    assert.deepEqual(await startup.json(), { status: 'unhealthy' });
    assert.equal(startup.headers.get('cache-control'), 'no-store');
    assert.equal(await runProbe(), 1);

    ready = true;
    const healthy = await fetch('http://127.0.0.1:8080/healthz');
    assert.equal(healthy.status, 200);
    assert.deepEqual(await healthy.json(), { status: 'healthy' });
    assert.equal(await runProbe(), 0);
    ready = false;
    assert.equal(await runProbe(), 1);
    ready = true;
    assert.equal(await runProbe(), 0);
    assert.equal((await fetch('http://127.0.0.1:8080/')).status, 404);
    assert.equal((await fetch('http://127.0.0.1:8080/healthz', { method: 'POST' })).status, 404);
    await assert.rejects(startHealthServer(() => true), { code: 'EADDRINUSE' });
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
  assert.equal(await runProbe(), 1);
});

test('probe times out if the event loop stops responding', { timeout: 5000 }, async () => {
  const sockets = new Set();
  const server = createTcpServer(socket => sockets.add(socket));
  await new Promise(resolve => server.listen(8080, '127.0.0.1', resolve));
  try {
    assert.equal(await runProbe(), 1);
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => server.close(resolve));
  }
});
