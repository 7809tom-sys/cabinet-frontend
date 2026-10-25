# Deploying Cabinet Dealz — backend on Railway, frontend on Vercel

## What runs where

| Piece | Host | Notes |
|---|---|---|
| Static site (React/Vite) | **Vercel** | `pnpm exec vite build` → `dist/public` |
| API + storage proxy + SEO files + page shells | **Railway** | `pnpm start` (`node dist/index.js`), API-only (`SERVE_CLIENT=false`) |
| Database | TiDB Cloud | unchanged |
| Auth + file storage | Supabase | Auth, buckets `site-media` and `private-files` |

How requests flow (`vercel.json`):

- **Pages and assets** are served by Vercel directly.
- **`/store/*` and `/3d/*`** are forwarded to Railway (`/_shell/...`). Railway fetches the built `index.html` from the
  frontend (`FRONTEND_SHELL_URL`) and injects the affiliate branding / share-preview tags, exactly as the single server did.
- **`/api/*`, `/manus-storage/*`, `/robots.txt`, `/sitemap.xml`** are proxied to `https://api.cabinetdealz.com`.
- **tRPC** (`/api/trpc`) goes **directly** to `VITE_API_BASE_URL` from the browser (CORS), so long AI calls and large
  uploads don't pass through the Vercel proxy (120 s proxy timeout; request-size limits for proxied bodies are not documented).
- **`<slug>.cabinetdealz.com`** is redirected to `/store/<slug>` by Vercel (replaces the old Express middleware).

`/manus-storage/<key>` is only the URL prefix stored in the database; the files themselves are in Supabase Storage.

## 0. Decisions / things you must provide

- API hostname: this guide and `vercel.json` use **`api.cabinetdealz.com`**. If you use another, change the 7 rewrite
  destinations in `vercel.json` and `VITE_API_BASE_URL`.
- Production `DATABASE_URL` (the value in the local `.env` is the scratch database), and the real `JWT_SECRET`.
- A Google Cloud project for `GOOGLE_MAPS_API_KEY` (Geocoding API only) and the Supabase Google provider.

## 1. Supabase (once)

1. Authentication → URL Configuration: Site URL `https://www.cabinetdealz.com`; Redirect URLs:
   `https://www.cabinetdealz.com/**`, `https://*.cabinetdealz.com/**`, `http://localhost:3000/**`, plus the Vercel preview URL if used.
2. Authentication → Providers: Email on; Google on (client ID/secret from Google Cloud; callback shown in Supabase).
3. Authentication → SMTP: the site's SMTP (the built-in sender is rate-limited).
4. Keep "Confirm email" on. Use the Pro plan for production (free projects pause).

## 2. Railway (backend)

1. New project → Deploy from the GitHub repo. `railway.json` sets build/start, health check `/health`, 1 replica.
   **Keep 1 replica**: a `node-cron` job runs inside the server every minute.
2. Variables — see `.env.example` (BACKEND section). Required: `NODE_ENV=production`, `SERVE_CLIENT=false`, `DATABASE_URL`,
   `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`,
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SMTP_*`, `OWNER_EMAIL`, `OWNER_OPEN_ID`,
   `CORS_ALLOWED_ORIGINS=https://www.cabinetdealz.com,https://*.cabinetdealz.com`,
   `FRONTEND_SHELL_URL=https://www.cabinetdealz.com/index.html`.
3. Settings → Networking → Custom domain `api.cabinetdealz.com`; add the CNAME Railway shows.
4. Stripe Dashboard → Webhooks: endpoint `https://api.cabinetdealz.com/api/stripe/webhook` (or the www URL — it is proxied).
5. QuickBooks (if used): set `QBO_REDIRECT_URI=https://www.cabinetdealz.com/api/qbo/callback` and register the same in the Intuit app.

## 3. Vercel (frontend)

1. Import the repo. Framework: Other. `vercel.json` already sets install/build/output (`dist/public`).
2. Environment variables (build-time, Production + Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
   `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_API_BASE_URL=https://api.cabinetdealz.com`,
   `VITE_AFFILIATE_DNS_TARGET=cname.vercel-dns.com`, `VITE_TAWK_PROPERTY_ID`, `VITE_TAWK_WIDGET_ID`.
   **Do not** add the service-role key or any server secret here.
3. Domains: add `www.cabinetdealz.com` (primary) and `cabinetdealz.com` (redirect to www).
4. **Wildcard for affiliate stores:** add `*.cabinetdealz.com` to the project. Vercel only issues wildcard certificates when the
   domain uses **Vercel's nameservers**; otherwise delegate `_acme-challenge` to Vercel as described in Vercel's docs.

## 4. DNS cutover (at the registrar / Hostinger)

- `www` → Vercel (the target Vercel shows); `*` → Vercel; `api` → Railway.
- **Remove the old wildcard `*` → `cabinetz-dq7pucbp.manus.space`** or every affiliate store keeps pointing at Manus.
- Lower TTLs a day before; keep Manus running until the checks below pass.

## 5. Smoke test after deploy

1. `https://api.cabinetdealz.com/health` → `{"ok":true}`.
2. `https://www.cabinetdealz.com` loads; sign in (email/password and Google); an admin page loads.
3. Open a catalog page, an affiliate logo and an affiliate PDF (images come via `/manus-storage/...`).
4. `https://www.cabinetdealz.com/store/<slug>` → view-source shows the store's `<title>` and canonical URL.
5. `https://<slug>.cabinetdealz.com` redirects to `/store/<slug>`.
6. `https://www.cabinetdealz.com/robots.txt` and `/sitemap.xml` return the dynamic versions.
7. Place a test Stripe order; check the webhook delivers (Stripe → Webhooks → recent deliveries).
8. Run each AI feature once (assistant, OCR, design render, image generation); check an owner-alert email arrives.

## Known limits

- If Railway is down, store pages and `/3d/*` return 502 (they need the backend for the page head); the rest of the static site still loads.
- The page shell is cached 30 s on Railway, so right after a frontend deploy a store page may reference the previous
  build's JS for up to 30 s.
- Weekly CRM price check (`scripts/crm-price-check/`) is not part of either deployment; see that folder's `run-check.sh`.

## Rollback

Vercel: promote the previous deployment. Railway: redeploy the previous deployment. DNS: point `www`/`*` back to the old host
(only possible while Manus is still running).
