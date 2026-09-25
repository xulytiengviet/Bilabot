import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import relay from '../src/index.js';

test('Turnstile grants a temporary transport session without a second Google login',async()=>{
 if(!globalThis.crypto)globalThis.crypto=webcrypto;
 const origin='https://bilabot-example.pages.dev';
 const env={PAGE_ORIGIN:origin,TURNSTILE_SITE_KEY:'test-public-site-key',
 TURNSTILE_SECRET:'test-secret',
 SESSION_SECRET:'test-secret-longer-than-thirty-two-characters',
 TICKET_KEY:'ab'.repeat(32)};
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async target=>{
  if(String(target)==='https://challenges.cloudflare.com/turnstile/v0/siteverify')
   return Response.json({success:true,hostname:'bilabot-example.pages.dev'});
  throw Error('Unexpected network request: '+String(target));
 };
 const req=(path,method='GET',body,extra={})=>new Request(origin+path,{
  method,headers:{Origin:origin,...extra,...(body?{'Content-Type':'application/json'}:{})},
  body:body?JSON.stringify(body):undefined
 });
 try{
  const health=await relay.fetch(req('/api/health'),env,{waitUntil(){}});
  assert.equal(health.status,200);assert.equal((await health.json()).ready,true);
  const response=await relay.fetch(req('/api/auth/session','POST',{turnstileToken:'valid-token-sample'}),env,{waitUntil(){}});
  assert.equal(response.status,200);const session=await response.json();
  assert.ok(session.session);
  const me=await relay.fetch(req('/api/me','GET',null,{Authorization:'Bearer '+session.session}),env,{waitUntil(){}});
  assert.equal(me.status,200);assert.equal((await me.json()).transport,'verified');
 }finally{globalThis.fetch=oldFetch;}
});
