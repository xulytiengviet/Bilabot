import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const check=p=>execFileSync(process.execPath,['--check',new URL('../'+p,import.meta.url).pathname]);

test('Pages scripts and Cloudflare Worker compile as JavaScript',()=>{
 for(const p of ['docs/config.js','docs/auth.js','docs/static/app.js','worker/src/index.js'])check(p);
});
test('BilaBot sends Google login ONLY to official XiaoZhi Agent console',()=>{
 const html=src('docs/index.html');
 for(const p of ['docs/config.js','docs/auth.js','docs/landing.css','docs/static/app.js',
   'docs/static/style.css','docs/static/manifest.json','docs/static/logo/favicon.svg'])assert.ok(
     existsSync(new URL('../'+p,import.meta.url)),p);
 assert.match(html,/https:\/\/xiaozhi\.me\/console\/agents/);
 assert.match(html,/id="bb-pair-start"/);
 assert.doesNotMatch(html,/accounts\.google\.com\/gsi/);
 assert.doesNotMatch(src('docs/auth.js'),/google\.accounts|googleClientId/);
});
test('OTA code comes from real XiaoZhi response; direct official WS is rejected',()=>{
 const app=src('docs/static/app.js'), auth=src('docs/auth.js');
 assert.match(app,/BilaBotGateway\.fetch\('\/api\/ota\/check'/);
 assert.match(app,/BilaBotGateway\.fetch\('\/api\/ota\/activate'/);
 assert.match(app,/Custom|custom headers|custom WebSocket headers/i);
 assert.match(app,/api\.xiaozhi\.me/);
 assert.match(auth,/XiaozhiDebug\.quickTest/);
 assert.match(auth,/turnstile\.render/);
 assert.match(app,/libopus-wasm/);
 assert.match(app,/tools\/list/);
});
test('Worker requires Turnstile, uses encrypted WS ticket and checks Origin',()=>{
 const w=src('worker/src/index.js');
 assert.match(w,/TURNSTILE_SECRET/);
 assert.match(w,/verifyTurnstile/);
 assert.match(w,/\/api\/auth\/session/);
 assert.match(w,/AES-GCM/);
 assert.match(w,/allowedOrigin/);
 assert.doesNotMatch(w,/\/api\/auth\/google/);
});
test('Worker health remains closed until configured',async()=>{
 const mod=await import('../worker/src/index.js');
 const origin='https://xulytiengviet.github.io';
 const req=new Request('https://gateway.example/api/health',{headers:{Origin:origin}});
 const health=await mod.default.fetch(req,{PAGE_ORIGIN:origin},{waitUntil(){}});
 assert.equal(health.status,200);
 const body=await health.json();
 assert.equal(body.ready,false);
 const forbidden=await mod.default.fetch(
  new Request('https://gateway.example/api/health',{headers:{Origin:'https://attacker.example'}}),
  {PAGE_ORIGIN:origin},{waitUntil(){}});
 assert.equal(forbidden.status,403);
});
