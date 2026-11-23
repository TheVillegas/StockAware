import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const root = new URL('../dist/browser/', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

test('offline shell preserves a non-interactive login draft through recovery', { timeout: 30000 }, async () => {
  const profile = await mkdtemp(join(tmpdir(), 'pwa-draft-'));
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      const file = path === '/' || !extname(path) ? '/index.html' : path;
      const body = await readFile(join(root, file));
      res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = spawn('/usr/bin/chromium', ['--headless', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let socket;
  try {
    let port;
    for (let i = 0; i < 100 && !port; i++) {
      try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch { await delay(100); }
    }
    assert.ok(port, 'Chromium debugging port');
    const target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json());
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let id = 0;
    const pending = new Map();
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (!message.id) return;
      const entry = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message)); else entry.resolve(message.result);
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const key = ++id; pending.set(key, { resolve, reject }); socket.send(JSON.stringify({ id: key, method, params }));
    });
    const evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result.value;
    };
    const waitFor = async (expression) => {
      for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(100); }
      assert.fail(`Timed out: ${expression}`);
    };
    await send('Network.enable');
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
    await waitFor('!!document.querySelector("app-login input[name=user]")');
    await evaluate(`window.draft = document.querySelector('app-login input[name=user]');
      draft.value = 'borrador'; draft.dispatchEvent(new Event('input', { bubbles: true }));`);
    await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await waitFor('!!document.querySelector(".offline")');
    assert.equal(await evaluate(`document.querySelector('app-login input[name=user]') === window.draft`), true, 'same input stays mounted');
    assert.equal(await evaluate(`draft.value`), 'borrador');
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.offline')).display !== 'none'`), true);
    assert.equal(await evaluate(`draft.getClientRects().length === 0 && !!draft.closest('[inert]')`), true, 'draft hidden and inert');
    await evaluate('draft.focus()');
    assert.equal(await evaluate('document.activeElement === draft'), false, 'offline input cannot receive focus');
    await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await waitFor('!document.querySelector(".offline")');
    assert.equal(await evaluate(`document.querySelector('app-login input[name=user]') === window.draft && draft.value === 'borrador' && draft.getClientRects().length > 0 && !draft.closest('[inert]')`), true, 'same visible draft after reconnect');
  } finally {
    socket?.close();
    browser.kill();
    await new Promise((resolve) => browser.once('exit', resolve));
    await new Promise((resolve) => server.close(resolve));
    await rm(profile, { recursive: true, force: true });
  }
});
