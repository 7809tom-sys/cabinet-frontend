# Just Putzit — Manus removal (handoff)

This agent was granted read-only access to `7809tom-sys/justputzit-frontend` and
`7809tom-sys/justputzit-backend`, so the changes below could not be pushed. They
are exported as patches here for you to apply.

The production site was already repaired live through the Vercel and Railway
APIs; these patches bring the repos back in line with what is running.

## Apply

```bash
cd justputzit-frontend
git am /path/to/0001-frontend-remove-manus.patch

cd justputzit-backend
git am /path/to/0002-backend-remove-manus.patch
```

## Already fixed live (no action needed)

- Vercel project routes now serve `/robots.txt`, `/sitemap.xml`, `/storage/*`
  and `/manus-storage/*` from the Railway API. All four previously returned
  **502 `DNS_HOSTNAME_NOT_FOUND`** because `vercel.json` pointed at the literal
  placeholder `REPLACE-WITH-RAILWAY-DOMAIN`. Member photos and SEO files were
  broken in production.
- Railway `CORS_ORIGINS` now includes `https://justputzit.com` and
  `https://www.justputzit.com`. Without them every authenticated call from the
  new domain failed CORS and sign-in was broken.

## Note on the backend route

The deployed backend still serves media at `/manus-storage/*`, so the Vercel
routes point there. The backend patch renames the handler to `/storage/*` and
keeps `/manus-storage/*` as a compatibility alias. Apply the Vercel deploy of
`vercel.json` only after that backend patch is live, or media will break.
