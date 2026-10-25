# Cabinet Dealz — frontend

React 19 + Vite + Tailwind single-page app. Deployed on **Vercel**; the API lives in the separate backend repository
(`cabinet-backend`, on Railway).

- Auth: Supabase Auth in the browser; every tRPC request sends the user's access token as `Authorization: Bearer`
- API: tRPC calls go straight to `VITE_API_BASE_URL` (CORS); images/files, `robots.txt`, `sitemap.xml` and store/3D page heads are
  proxied to the backend by `vercel.json`
- Affiliate stores: `<slug>.cabinetdealz.com` is redirected to `/store/<slug>` by Vercel

## Develop

```bash
pnpm install --frozen-lockfile
cp .env.example .env          # fill in
pnpm exec vite                # dev server (needs the backend running, or VITE_API_BASE_URL pointing at one)
pnpm exec vite build          # production build -> dist/public (what Vercel runs)
pnpm exec vitest run          # tests
```

See `DEPLOY.md` for the Vercel/Railway/DNS setup and the smoke-test checklist.

## Notes

- This repository contains only the frontend plus the `shared/` modules it imports. It has no server code.
- `package.json` is shared with the backend and still lists server dependencies and scripts; only the Vite scripts apply here.
- `pnpm check` (TypeScript) needs the backend's `server/routers` for the `AppRouter` type, so run it in the full project, not here.
- About 50 tests currently fail (existing, unrelated to the split); the rest pass.
- Never put server secrets in a `VITE_` variable: they are bundled into public JavaScript.
