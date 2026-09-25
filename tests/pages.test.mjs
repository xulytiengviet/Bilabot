import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const src=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const check=(p)=>execFileSync(process.execPath,['--check',new URL('../'+p,import.meta.url).pathname]);
test('GitHub Pages, Gateway JavaScript syntax',()=>{
  for (const f of ['docs/config.js','docs/auth.js','docs/static/app.js','worker/src/index.js']) check(f);
});
test('Site assets, OAuth UI and relative paths',()=>{
 const html=src('docs/index.html');
 for(const f of ['docs/config.js','docs/auth.js','docs/landing.css','docs/static/app.js',
 'docs/static/style.css','docs/static/manifest.json','docs/static/logo/favicon.svg']){
   assert.ok(existsSync(new URL('../'+f,import.meta.url)),f);
 }
 assert.match(html,/\.\/static\/app\.js/);
 assert.match(html,/https:\/\/accounts\.google\.com\/gsi\/client/);
 assert.match(html,/bb-google-btn/);
});
test('Real OTA auto pairing, Opus and MCP',()=>{
 const a=src('docs/static/app.js'),b=src('docs/auth.js');
 assert.match(a,/BilaBotGateway\.fetch\('\/api\/ota\/check'/);
 assert.match(a,/BilaBotGateway\.fetch\('\/api\/ota\/activate'/);
 assert.match(a,/BilaBotGateway\.websocketTicket/);
 assert.match(a,/tools\/list/);
 assert.match(a,/libopus-wasm/);
 assert.match(b,/XiaozhiDebug\.quickTest/);
});
test('Worker verifies Google signatures, encrypts WS ticket and checks origin',()=>{
 const a=src('worker/src/index.js');
 assert.match(a,/verifyGoogle/);
 assert.match(a,/crypto\.subtle\.verify/);
 assert.match(a,/AES-GCM/);
 assert.match(a,/allowedOrigin/);
});
