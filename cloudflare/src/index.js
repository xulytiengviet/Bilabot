/** Cloudflare Pages Advanced Mode: Olivia-style single-origin UI + Hono.
 * Reuses the hardened XiaoZhi protocol relay in worker/src/index.js.
 */
import { Hono } from 'hono';
import relay from '../../worker/src/index.js';

const app=new Hono();
app.all('/api/*',c=>{
  const siteOrigin=new URL(c.req.url).origin;
  const extras=String(c.env.PAGE_ORIGIN||'').trim();
  const env={...c.env,PAGE_ORIGIN:[siteOrigin,extras].filter(Boolean).join(',')};
  return relay.fetch(c.req.raw,env,c.executionCtx);
});
app.all('*',c=>c.env.ASSETS.fetch(c.req.raw));
export default app;
