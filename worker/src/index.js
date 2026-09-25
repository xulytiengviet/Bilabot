/** BilaBot relay for the official XiaoZhi DEVICE protocol.
 * Google/XiaoZhi website authentication stays exclusively at xiaozhi.me.
 * The relay issues a short transport session after Turnstile verification.
 * No Google login, Google OAuth Client ID, or XiaoZhi cookie is handled here.
 */
const OTA_HOSTS = new Set(['api.tenclass.net', 'api.xiaozhi.me', 'xiaozhi.me', 'www.xiaozhi.me']);
const WS_HOSTS = new Set(['api.tenclass.net', 'api.xiaozhi.me']);
const VISION_HOSTS = new Set(['api.xiaozhi.me']);
const MAX_JSON_BYTES = 32_768;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const utf8 = new TextEncoder();
const fromUTF8 = new TextDecoder();
function toB64url(value) {
  const bytes = value instanceof Uint8Array ? value : utf8.encode(value);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function fromB64url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid base64url');
  const bin = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(bin, ch => ch.charCodeAt(0));
}
function jsonB64(text) { return JSON.parse(fromUTF8.decode(fromB64url(text))); }
function bad(status, message, headers) {
  return Response.json({ error: message }, { status, headers });
}
function configured(env){
  return Boolean(env.TURNSTILE_SECRET && env.TURNSTILE_SITE_KEY &&
    env.SESSION_SECRET?.length>=32 &&
    /^[a-fA-F0-9]{64}$/.test(env.TICKET_KEY||'') && env.PAGE_ORIGIN);
}
function allowedOrigin(origin, env) {
  const list = String(env.PAGE_ORIGIN || 'https://xulytiengviet.github.io')
    .split(',').map(s => s.trim()).filter(Boolean);
  return list.includes(origin);
}
function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Vision-Url, X-Vision-Token, X-Device-Id, X-Client-Id',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  };
}
// Cloudflare Turnstile protects the public transport gateway against abuse;
// this is NOT XiaoZhi login and does not authorize a console account.
async function verifyTurnstile(token,request,env){
  if(typeof token!=='string'||token.length<8||token.length>4096)
    throw new Error('Invalid Turnstile token');
  const params=new URLSearchParams({
    secret:env.TURNSTILE_SECRET,
    response:token,
    remoteip:request.headers.get('CF-Connecting-IP')||''
  });
  const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
    method:'POST',body:params
  });
  if(!r.ok)throw new Error('Turnstile verification unavailable');
  const data=await r.json();
  const domain=new URL(request.headers.get('Origin') || request.url).hostname;
  if(data.success!==true || data.hostname!==domain)
    throw new Error('Invalid Turnstile challenge or hostname');
  return true;
}
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', utf8.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign','verify']);
}
async function makeSession(user, secret) {
  const now = Math.floor(Date.now() / 1000);
  const payload = toB64url(JSON.stringify({ sub: user.sub, exp: now + 3600, iat: now, aud: 'bilabot-worker' }));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), utf8.encode(payload));
  return { session: payload + '.' + toB64url(new Uint8Array(sig)),
    expiresAt: (now + 3600) * 1000 };
}
async function authenticate(request, env) {
  const h = request.headers.get('Authorization') || '';
  if (!h.startsWith('Bearer ')) throw new Error('BilaBot transport session required');
  const pair = h.slice(7).split('.');
  if (pair.length !== 2) throw new Error('Invalid session');
  const key = await hmacKey(env.SESSION_SECRET);
  const valid = await crypto.subtle.verify('HMAC', key, fromB64url(pair[1]), utf8.encode(pair[0]));
  if (!valid) throw new Error('Invalid session signature');
  const claims = jsonB64(pair[0]);
  if (claims.aud !== 'bilabot-worker' || claims.exp < Math.floor(Date.now()/1000) ||
      typeof claims.sub !== 'string') throw new Error('Expired session');
  return claims;
}
function validID(body) {
  if (!/^([a-f0-9]{2}:){5}[a-f0-9]{2}$/.test(body.deviceId || body.device_id || '')) throw new Error('Invalid Device-Id');
  if (!/^[a-f0-9-]{36}$/i.test(body.clientId || body.client_id || '')) throw new Error('Invalid Client-Id');
}
function allowedUrl(raw, hosts, scheme, prefix) {
  const u = new URL(raw);
  if (u.protocol !== scheme || !hosts.has(u.hostname) ||
      (prefix && !u.pathname.startsWith(prefix)) ||
      u.username || u.password || u.port && !['443'].includes(u.port)) throw new Error('Upstream URL is not allowed');
  return u;
}
async function parseJson(request, max = MAX_JSON_BYTES) {
  if (Number(request.headers.get('Content-Length') || 0) > max) throw new Error('Request is too large');
  const text = await request.text();
  if (utf8.encode(text).length > max) throw new Error('Request is too large');
  return JSON.parse(text);
}
function otaHeaders(d, activation) {
  return {
    'Activation-Version': '1', 'Device-Id': d.deviceId, 'Client-Id': d.clientId,
    'User-Agent': 'BilaBot-Web/1.0', 'Accept-Language': 'vi-VN',
    'Content-Type': 'application/json'
  };
}
async function otaProxy(request, env, action, responseHeaders) {
  const d = await parseJson(request);
  validID(d);
  const u = allowedUrl(d.otaUrl, OTA_HOSTS, 'https:', '/xiaozhi/ota');
  if (action === 'activate') u.pathname = u.pathname.replace(/\/?$/, '/activate');
  const upstream = await fetch(u.toString(), {
    method: 'POST', headers: otaHeaders(d),
    body: JSON.stringify(d.payload || {})
  });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { ...responseHeaders, 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' }
  });
}
function hexBytes(input) {
  return Uint8Array.from(input.match(/../g).map(pair => parseInt(pair, 16)));
}
async function aesKey(env) {
  return crypto.subtle.importKey('raw', hexBytes(env.TICKET_KEY), 'AES-GCM', false, ['encrypt','decrypt']);
}
async function makeTicket(data, env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv },
    await aesKey(env), utf8.encode(JSON.stringify(data)));
  return toB64url(iv) + '.' + toB64url(new Uint8Array(enc));
}
async function openTicket(value, env) {
  if (typeof value !== 'string' || value.length > 16_000) throw new Error('Invalid ticket');
  const parts = value.split('.');
  if (parts.length !== 2) throw new Error('Invalid ticket');
  const iv = fromB64url(parts[0]);
  if (iv.byteLength !== 12) throw new Error('Invalid ticket IV');
  const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv },
    await aesKey(env), fromB64url(parts[1]));
  const data = JSON.parse(fromUTF8.decode(bytes));
  if (data.expires < Date.now() || data.expires > Date.now() + 61_000) throw new Error('Expired ticket');
  validID(data);
  allowedUrl(data.url, WS_HOSTS, 'wss:', '/xiaozhi/');
  return data;
}
function wrapBearer(token) {
  return /\s/.test(token) ? token : 'Bearer ' + token;
}
async function websocketRelay(request, env, ctx, responseHeaders) {
  if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
    return bad(426, 'WebSocket upgrade required', responseHeaders);
  }
  const ticket = await openTicket(new URL(request.url).searchParams.get('ticket'), env);
  const pair = new WebSocketPair();
  const browser = pair[0], local = pair[1];
  local.accept({ allowHalfOpen: true });
  let upstream = null, done = false;
  const pending = [];
  const safelyClose = (sock, code = 1000, reason = '') => {
    try { if (sock && sock.readyState < 2) sock.close(code, reason.slice(0,100)); } catch {}
  };
  const forward = async (socket, data) => {
    if (data instanceof Blob) data = await data.arrayBuffer();
    if (socket?.readyState === 1) socket.send(data);
  };
  local.addEventListener('message', async evt => {
    if (upstream?.readyState === 1) await forward(upstream, evt.data);
    else if (pending.length < 80) pending.push(evt.data);
    else safelyClose(local, 1013, 'Audio buffer full');
  });
  local.addEventListener('close', evt => { done = true; safelyClose(upstream, evt.code || 1000, evt.reason); });
  local.addEventListener('error', () => safelyClose(upstream, 1011, 'Browser transport error'));
  const launch = async () => {
    try {
      // Cloudflare Workers opens upstream WS via HTTPS Upgrade.
      const u = ticket.url.replace(/^wss:/, 'https:');
      const r = await fetch(u, { headers: {
        Upgrade: 'websocket', Connection: 'Upgrade',
        Authorization: wrapBearer(ticket.token),
        'Protocol-Version': ticket.protocol_version,
        'Device-Id': ticket.device_id,
        'Client-Id': ticket.client_id
      }});
      upstream = r.webSocket;
      if (!upstream) throw new Error('XiaoZhi refused WebSocket upgrade');
      upstream.binaryType = 'arraybuffer';
      upstream.accept({ allowHalfOpen: true });
      for (const frame of pending) await forward(upstream, frame);
      pending.length = 0;
      upstream.addEventListener('message', async evt => {
        if (!done) await forward(local, evt.data);
      });
      upstream.addEventListener('close', evt => safelyClose(local, evt.code || 1000, evt.reason));
      upstream.addEventListener('error', () => safelyClose(local, 1011, 'XiaoZhi transport error'));
    } catch {
      safelyClose(local, 1011, 'Unable to connect to XiaoZhi');
    }
  };
  ctx.waitUntil(launch());
  return new Response(null, { status: 101, webSocket: browser, headers: responseHeaders });
}
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || (request.method === 'GET' && url.pathname !== '/api/ws' ? url.origin : '');
    if (!allowedOrigin(origin, env)) return bad(403, 'Origin not allowed', { 'Cache-Control': 'no-store' });
    const headers = cors(origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method === 'GET' && url.pathname === '/api/health') {
      return Response.json({ ready: configured(env), turnstileSiteKey: env.TURNSTILE_SITE_KEY||'', version: 2 }, { headers });
    }
    if (!configured(env)) return bad(503, 'Worker secrets not configured', headers);
    try {
      if(request.method==='POST' && url.pathname==='/api/auth/session'){
        const body=await parseJson(request,8192);
        await verifyTurnstile(body.turnstileToken,request,env);
        const session=await makeSession({sub:'browser:'+crypto.randomUUID()},env.SESSION_SECRET);
        return Response.json(session,{headers});
      }
            if (request.method === 'GET' && url.pathname === '/api/ws') {
        // Tickets are opaque AES-GCM messages valid for 60 s, not raw tokens in URLs.
        return await websocketRelay(request, env, ctx, headers);
      }
      const claims = await authenticate(request, env);
      if (request.method === 'GET' && url.pathname === '/api/me') {
        return Response.json({ transport: 'verified', expiresAt: claims.exp*1000 }, { headers });
      }
      if (request.method === 'POST' && url.pathname === '/api/ws-ticket') {
        const d = await parseJson(request);
        validID(d);
        allowedUrl(d.url, WS_HOSTS, 'wss:', '/xiaozhi/');
        if (typeof d.token !== 'string' || d.token.length < 1 || d.token.length > 8_192) throw new Error('Invalid XiaoZhi device token');
        const version = String(d.protocol_version || '1');
        if (!['1','2','3'].includes(version)) throw new Error('Unsupported protocol version');
        const ticket = await makeTicket({
          url: d.url, token: d.token, device_id: d.device_id,
          client_id: d.client_id, protocol_version: version,
          expires: Date.now() + 60_000, sub: claims.sub
        }, env);
        return Response.json({ ticket, expiresIn: 60 }, { headers });
      }
      if (request.method === 'POST' && url.pathname === '/api/ota/check')
        return await otaProxy(request, env, 'check', headers);
      if (request.method === 'POST' && url.pathname === '/api/ota/activate')
        return await otaProxy(request, env, 'activate', headers);
      if (request.method === 'POST' && url.pathname === '/api/vision/explain') {
        const raw = request.headers.get('X-Vision-Url');
        if (!raw) return bad(400, 'Vision URL required', headers);
        const u = new URL(raw.replace(/^http:/, 'https:'));
        allowedUrl(u.toString(), VISION_HOSTS, 'https:', '/vision/explain');
        const length = Number(request.headers.get('Content-Length') || 0);
        if (length > MAX_IMAGE_BYTES) return bad(413, 'Image exceeds 4MB', headers);
        const body = await request.arrayBuffer();
        if (body.byteLength > MAX_IMAGE_BYTES) return bad(413, 'Image exceeds 4MB', headers);
        const d = {
          deviceId: request.headers.get('X-Device-Id'),
          clientId: request.headers.get('X-Client-Id')
        };
        validID(d);
        const token = request.headers.get('X-Vision-Token') || '';
        const upstream = await fetch(u.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': request.headers.get('Content-Type') || 'application/octet-stream',
            Authorization: wrapBearer(token),
            'Device-Id': d.deviceId,
            'Client-Id': d.clientId
          },
          body
        });
        return new Response(upstream.body, { status: upstream.status, headers: {
          ...headers, 'Content-Type': upstream.headers.get('Content-Type') || 'application/json'
        }});
      }
      return bad(404, 'Route not found', headers);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected gateway error';
      const clientError = /Invalid|Expired|login|session|required|not allowed|large|Unsupported|Malformed|verified|signature|algorithm|Turnstile/i.test(message);
      return bad(clientError ? 400 : 502, message, headers);
    }
  }
};
