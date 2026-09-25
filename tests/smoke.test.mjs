import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('BilaBot browser JavaScript parses', () => {
  execFileSync(process.execPath, ['--check', new URL('../public/static/app.js', import.meta.url).pathname]);
});
test('XiaoZhi OTA, WebSocket, vision routes are present', () => {
  const server = read('src/index.tsx');
  for (const route of ['/api/ota/check', '/api/ota/activate', '/api/ws', '/api/vision/explain']) {
    assert.ok(server.includes(route), 'missing ' + route);
  }
  assert.match(server, /Device-Id/);
  assert.match(server, /Client-Id/);
});
test('auth links target official XiaoZhi website, never collect passwords', () => {
  const server = read('src/index.tsx');
  assert.ok(server.includes('https://xiaozhi.me/console/login?redirect=%2Fconsole%2F'));
  assert.match(server, /activationCode|pairingCodeDisplay/);
  assert.doesNotMatch(server, /<input[^>]*type=["']password/i);
});
test('Opus and MCP are implemented by browser client', () => {
  const js = read('public/static/app.js');
  assert.match(js, /libopus-wasm/);
  assert.match(js, /tools\/list/);
  assert.match(js, /tools\/call/);
  assert.match(js, /listen/);
  assert.match(js, /WebSocket/);
});
test('PWA manifest and package lock are valid JSON', () => {
  const m = JSON.parse(read('public/static/manifest.json'));
  assert.equal(m.short_name, 'BilaBot');
  assert.equal(JSON.parse(read('package.json')).name, JSON.parse(read('package-lock.json')).name);
});
