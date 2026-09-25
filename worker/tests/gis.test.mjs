import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import gateway from '../src/index.js';

test('Google GIS: verified JWT creates a session, invalid audience cannot', async () => {
  if (!globalThis.crypto) globalThis.crypto = webcrypto;
  const keys = await crypto.subtle.generateKey({
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256'
  }, true, ['sign', 'verify']);
  const jwk = { ...await crypto.subtle.exportKey('jwk', keys.publicKey), kid: 'bilabot-test-kid', alg: 'RS256', use: 'sig' };
  const env = {
    PAGE_ORIGIN: 'https://xulytiengviet.github.io',
    GOOGLE_CLIENT_ID: 'bilabot-test-client.apps.googleusercontent.com',
    TURNSTILE_SITE_KEY: 'site-public-test',
    TURNSTILE_SECRET: 'test-turnstile-secret',
    SESSION_SECRET: 'session-secret-at-least-32-characters-test',
    TICKET_KEY: '01'.repeat(32)
  };
  const b64 = x => Buffer.from(typeof x === 'string' ? x : new Uint8Array(x)).toString('base64url');
  async function jwt(audience) {
    const now = Math.floor(Date.now() / 1000);
    const h = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'bilabot-test-kid' }));
    const p = b64(JSON.stringify({
      iss: 'https://accounts.google.com', aud: audience,
      sub: 'google-test-subject', name: 'Bila User',
      email: 'verified@example.org', email_verified: true,
      iat: now, exp: now + 600
    }));
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey,
      new TextEncoder().encode(h + '.' + p));
    return h + '.' + p + '.' + b64(sig);
  }
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    const target = String(url);
    if (target === 'https://www.googleapis.com/oauth2/v3/certs') {
      return Response.json({ keys: [jwk] }, { headers: { 'Cache-Control': 'public,max-age=3600' } });
    }
    if (target === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
      return Response.json({ success: true, hostname: 'xulytiengviet.github.io' });
    }
    throw new Error('Unexpected external HTTP call: ' + target);
  };
  const makeRequest = (url, options = {}) => new Request('https://gateway.test' + url, {
    ...options, headers: { Origin: env.PAGE_ORIGIN, 'Content-Type': 'application/json', ...options.headers }
  });
  try {
    const health = await gateway.fetch(makeRequest('/api/health'), env, {});
    assert.equal(health.status, 200);
    const healthData = await health.json();
    assert.equal(healthData.googleConfigured, true);
    assert.equal(healthData.ready, true);

    const valid = await gateway.fetch(makeRequest('/api/auth/session', {
      method: 'POST', body: JSON.stringify({ turnstileToken: 'test-token-1', googleIdToken: await jwt(env.GOOGLE_CLIENT_ID) })
    }), env, {});
    assert.equal(valid.status, 200);
    const data = await valid.json();
    assert.equal(data.googleVerified, true);
    assert.equal(data.profile.email, 'verified@example.org');
    assert.ok(data.session);

    const me = await gateway.fetch(makeRequest('/api/me', {
      headers: { Authorization: 'Bearer ' + data.session }
    }), env, {});
    assert.equal(me.status, 200);
    assert.equal((await me.json()).transport, 'verified');

    const wrongAudience = await gateway.fetch(makeRequest('/api/auth/session', {
      method: 'POST', body: JSON.stringify({ turnstileToken: 'test-token-2', googleIdToken: await jwt('evil-client.apps.googleusercontent.com') })
    }), env, {});
    assert.notEqual(wrongAudience.status, 200);
    assert.equal((await wrongAudience.json()).error.includes('Google ID token'), true);

    const noToken = await gateway.fetch(makeRequest('/api/auth/session', {
      method: 'POST', body: JSON.stringify({ turnstileToken: 'test-token-3' })
    }), env, {});
    assert.notEqual(noToken.status, 200);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
