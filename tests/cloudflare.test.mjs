import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import app from '../cloudflare/src/index.js';

test('single-origin Hono serves Pages assets and protected API',async()=>{
 const seen=[],ctx={waitUntil(){}};
 const site='https://bilabot-example.pages.dev';
 const env={ASSETS:{fetch(request){seen.push(new URL(request.url).pathname);return new Response('static asset');}}};
 const page=await app.fetch(new Request(site+'/'),env,ctx);
 assert.equal(page.status,200);assert.equal(await page.text(),'static asset');
 assert.deepEqual(seen,['/']);
 const health=await app.fetch(new Request(site+'/api/health',{headers:{Origin:site}}),env,ctx);
 assert.equal(health.status,200);
 assert.equal((await health.json()).ready,false);
 const cross=await app.fetch(new Request(site+'/api/health',{headers:{Origin:'https://unknown.example'}}),env,ctx);
 assert.equal(cross.status,403);
 assert.deepEqual(seen,['/']);
});
test('Pages deployment contains shared web UI and one worker',()=>{
 const entry=readFileSync(new URL('../cloudflare/src/index.js',import.meta.url),'utf8');
 const config=readFileSync(new URL('../docs/config.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
 assert.match(entry,/ASSETS\.fetch/);assert.match(entry,/relay\.fetch/);
 assert.match(config,/location\.origin/);
 assert.ok(existsSync(new URL('../docs/deploy.js',import.meta.url)));
 assert.doesNotMatch(html,/accounts\.google\.com\/gsi/);
});
