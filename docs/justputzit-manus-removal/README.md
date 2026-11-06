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
git am /path/to/0003-logo-update.patch

cd justputzit-backend
git am /path/to/0002-backend-remove-manus.patch
```

`0003` goes **after** `0001` and belongs to the frontend repo only.

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

---

# Logo replacement (`0003-logo-update.patch`)

Commit **`7f763a6`** — "Replace the Just Putzit logo and app icons with the new
mark". Applies on top of **`4416293`** (i.e. after `0001`). Frontend repo only.

Patch sha256: `0a606eed9a2d7638c3db5c7fb491da77e79647e8a3d1b14c85d00b5034c294c3`

## What it replaces

Every user-visible brand surface, not just the navbar logo:

- UI logo in `Navbar.tsx`, `Home.tsx`, `CityLanding.tsx`, `EventDetail.tsx`
- PWA icons and `client/public/manifest.json` (standard + maskable)
- `og:image` / `twitter:image` in `client/index.html`
- The SEO default social image (`DEFAULT_OG_IMAGE` in `client/src/hooks/useSEO.ts`)
- Adds `tests/brandAssets.test.ts` (98 lines) to lock the asset names and sizes

The new artwork is a **stacked** lockup (two high-fiving figures above a "Just
Putzit" wordmark) at ~1.38:1, where the old logo was a wide horizontal bar. The
placements were therefore re-sized for the new aspect ratio instead of reusing
the old fixed heights and `136px` max-width.

## New assets (`client/public/brand/`, content-addressed `<stem>_<hash8>.png`)

| File | Size | Notes |
| --- | --- | --- |
| `justputzit-logo-transparent_def33678.png` | 732x531 RGBA | transparent lockup |
| `icon-192_c196efd7.png` | 192x192 | opaque white |
| `icon-512_d3d75bc3.png` | 512x512 | opaque white |
| `icon-maskable-512_42467363.png` | 512x512 | safe-area padded |
| `just-putzit-og-image_b5de2dfe.png` | 1024x1024 | opaque social card |

Old files deleted: `justputzit-logo-transparent_2e545ffa.png`,
`icon-192_52214e91.png`, `icon-512_c1858d5a.png`,
`icon-maskable-512_1dae20ca.png`. The three app icons are generated from the
figures mark only — the wordmark is illegible at launcher sizes — and flattened
onto white.

## Verified

- `pnpm test` -> **71 files / 141 tests passed**
- `pnpm run build:web` -> **clean, exit 0** (`dist/public`)
- `0001` + `0003` both apply with `git am --3way` on a fresh clone of `main`,
  then install, test and build green
- `dist/public` contains the new icons, and `manifest.json` + `index.html` point
  at the new hashes; no stale references to the deleted files remain

## Clipping verdict: NOT clipped — normal rounded script terminal

An earlier report claimed the leading script "j" was hard-clipped by "a straight
~10-row hard vertical edge". **That claim is wrong.** Evidence:

1. **Alpha profile is a bell curve, not a step.** Down the leftmost column
   (`x=152`) alpha runs `5, 28, 71, 114, 154, 185, 207, 216, 219, 221, 219, 212,
   195, 158, 116, 70, 25, 3` over `y=515..532`. A hard vertical slice would hold
   one identical value down the column. This is a symmetric taper peaking at
   `y=524`, which is the exact midpoint of the span — the geometric tangent of a
   circle.
2. **The leftmost extent walks inward, then back out.** Leftmost `alpha>128`
   column goes `153,153,153,153,152...152,153,153,153,153` — a 10-row plateau
   with smooth 1px shoulders on both sides. Clipping would produce a plateau with
   an abrupt, one-sided cut, not a symmetric arc.
3. **Upscaled 6x and 10x crops are visually smooth.** Rendered with NEAREST onto
   white, the edge is a clean anti-aliased arc with no straight segment and no
   stair-step.
4. **The crop never touched it.** In the RAW 1024x576 source the content bbox is
   `(71,26)->(869,550)`, leaving a **71px left margin**; the shape never
   approaches the canvas edge. In the 732x531 output asset the leftmost opaque
   column is `x=8`, again well inside the canvas.

At small sizes the tangent of the script "J" reads as a short flat edge, which
is what triggered the false positive. **No designer fix is required.**

## Bounding box claim: confirmed

The real content bbox at `alpha>16` is **`(151,33) -> (867,548)`** — 716x515.
Confirmed exactly. The earlier brief's `559x431` was wrong. (For reference:
`alpha>0` gives `(71,26)->(869,550)`, but that outer ring is WebP ringing at
max alpha 3, i.e. compression noise, not artwork.)
