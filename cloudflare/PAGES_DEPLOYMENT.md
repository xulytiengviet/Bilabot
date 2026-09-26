# BilaBot — Cloudflare Pages

Cloudflare Pages project: `bilabot-web`

- Git repository: `xulytiengviet/Bilabot`, production branch: `main`
- Root directory: `/`
- Build command: `npm run build:pages`
- Build output directory: `dist`
- No custom deploy command when using Pages Git integration

The `build:pages` script first copies `docs/` into `dist/`, then bundles the Hono proxy as `dist/_worker.js`. Cloudflare Pages advanced mode serves `_worker.js` as a Pages Function; the function should forward non-API requests to `env.ASSETS.fetch(request)`.

Set private gateway secrets in Cloudflare Pages project settings, not in GitHub. Keep the former Workers project until Pages deployment and `/api/health` have been verified.
