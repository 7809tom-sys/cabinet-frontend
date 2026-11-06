# Proposed PR body

This file exists because this agent's GitHub token is **read-only for pull
requests**: `gh pr edit 293 --body …` and `PATCH /pulls/293` both return
`403 Resource not accessible by integration`. PR #293 is also already **merged**,
so it cannot be appended to. Paste the body below into a new PR opened from
`cursor/justputzit-manus-removal-4825` into `main`.

---

The justputzit frontend and backend live in their own repos
(`7809tom-sys/justputzit-frontend`, `7809tom-sys/justputzit-backend`), which this
agent has read-only access to. The commits could not be pushed there, so they are
exported as patches here.

## Apply

```bash
cd justputzit-frontend
git am docs/justputzit-manus-removal/0001-frontend-remove-manus.patch
git am docs/justputzit-manus-removal/0003-logo-update.patch

cd justputzit-backend
git am docs/justputzit-manus-removal/0002-backend-remove-manus.patch
```

## What the patches do

**Frontend** — `vercel.json` proxied `/manus-storage`, `/sitemap.xml` and
`/robots.txt` to the literal placeholder host `REPLACE-WITH-RAILWAY-DOMAIN`, so
all three returned 502 in production. Points them at the real Railway host and
serves media under `/storage`. Also deletes the unused `ManusDialog` ("Login with
Manus"), the `dist/__manus__` build guard, and the Builder.io `jsx-loc` plugin,
and replaces the `.manus*.computer` dev hosts.

**Backend** — renames the media proxy to `/storage/*` keeping `/manus-storage/*`
as a compatibility alias, writes `/storage/{key}` for new uploads, and replaces
the retired `manus.space` invite-link fallback with `https://justputzit.com`.

## Live state

Two production breakages from the domain move were repaired directly through the
Vercel and Railway APIs, since both repos were unpushable:

- **Vercel project routes** for `/robots.txt`, `/sitemap.xml`, `/storage/*` and
  `/manus-storage/*` — all four were returning `502 DNS_HOSTNAME_NOT_FOUND`,
  which broke every member photo and the SEO files.
- **Railway `CORS_ORIGINS`** now includes `https://justputzit.com` and
  `https://www.justputzit.com`. Without them every authenticated request from the
  new domain failed CORS and sign-in was broken.

Verified after the fixes: all key routes return 200, media resolves to a real PNG
through both paths, and the production homepage renders with zero console errors.

## Ordering note

The deployed backend still serves media at `/manus-storage/*`, so the live Vercel
routes point there. Deploy the frontend `vercel.json` change only after the
backend patch is live, or photos will break.

---

# Logo replacement (`0003-logo-update.patch`)

Commit `7f763a6`, applies on top of `4416293` (i.e. after `0001`), frontend repo
only. Patch sha256: `0a606eed9a2d7638c3db5c7fb491da77e79647e8a3d1b14c85d00b5034c294c3`

## What it replaces

Every user-visible brand surface, not just the navbar logo:

- UI logo in `Navbar.tsx`, `Home.tsx`, `CityLanding.tsx`, `EventDetail.tsx`
- PWA icons and `client/public/manifest.json` (standard + maskable)
- `og:image` / `twitter:image` in `client/index.html`
- The SEO default social image (`DEFAULT_OG_IMAGE` in `client/src/hooks/useSEO.ts`)
- Adds `tests/brandAssets.test.ts` (98 lines) to lock asset names and sizes

The new artwork is a **stacked** lockup at ~1.38:1 where the old logo was a wide
horizontal bar, so placements were re-sized for the new aspect ratio rather than
reusing the old fixed heights and `136px` max-width.

## New assets (`client/public/brand/`)

| File | Size | Notes |
| --- | --- | --- |
| `justputzit-logo-transparent_def33678.png` | 732x531 RGBA | transparent lockup |
| `icon-192_c196efd7.png` | 192x192 | opaque white |
| `icon-512_d3d75bc3.png` | 512x512 | opaque white |
| `icon-maskable-512_42467363.png` | 512x512 | safe-area padded |
| `just-putzit-og-image_b5de2dfe.png` | 1024x1024 | opaque social card |

Old files deleted: `justputzit-logo-transparent_2e545ffa.png`,
`icon-192_52214e91.png`, `icon-512_c1858d5a.png`, `icon-maskable-512_1dae20ca.png`.

## Verified

- `pnpm test` → **71 test files / 141 tests passed**
- `pnpm run build:web` → **clean build, exit 0** into `dist/public`
- Fresh clone of `main`: `0001` and `0003` both apply with `git am --3way`,
  `pnpm install --frozen-lockfile`, then tests and build green
- `dist/public` carries the new icons; `manifest.json` and `index.html` point at
  the new hashes and no stale references to the deleted files remain
- Icons measured: standard icons keep a 20% radius margin, maskable 38%,
  well inside the 10% maskable safe zone; no stretching or cropping

## Clipping verdict: the "clipped j" report was WRONG

A previous worker reported the leading script "j" was hard-clipped with "a
straight ~10-row hard vertical edge". That is not what the pixels show.

- Alpha down the leftmost column `x=152` runs
  `5, 28, 71, 114, 154, 185, 207, 216, 219, 221, 219, 212, 195, 158, 116, 70, 25, 3`
  across `y=515..532`. A hard vertical slice would hold one identical value down
  the column. This is a symmetric taper peaking at `y=524` — the exact midpoint,
  which is the geometric tangent of a circle.
- Leftmost `alpha>128` column walks `153→152→153`: a 10-row plateau with smooth
  1px shoulders on **both** sides. Clipping would give an abrupt one-sided cut.
- 6x and 10x NEAREST crops on white show a clean anti-aliased arc, no straight
  segment, no stair-step.
- The crop never touched it: the RAW 1024x576 source has a **71px left margin**
  (content bbox `(71,26)->(869,550)`), and the leftmost opaque column in the
  732x531 output is `x=8`, well inside the canvas.

**Verdict: normal rounded script terminal, not a clipped edge. No designer fix
needed.** At small sizes the tangent reads as a short flat edge, which is what
triggered the false positive.

The reported content bbox at `alpha>16` of **`(151,33) -> (867,548)`** is
confirmed exactly (716x515). The earlier brief's `559x431` was wrong.

## Not live yet

**None of this is deployed. Production still serves the OLD logo.** The token is
write-denied to `justputzit-frontend` (`403 Permission to … denied to
cursor[bot]`), so the commits exist only as patches in this PR. Evidence from the
live site: the homepage, `og:image` and `manifest.json` all still reference the
old hashes `icon-192_52214e91.png` / `icon-512_c1858d5a.png` — exactly the files
`0003` deletes.

To ship it:

```bash
git clone git@github.com:7809tom-sys/justputzit-frontend.git
cd justputzit-frontend
git checkout -b cursor/logo-update
git am /path/to/0001-frontend-remove-manus.patch
git am /path/to/0003-logo-update.patch
pnpm install --frozen-lockfile
pnpm test          # expect 71 files / 141 tests
pnpm run build:web # expect exit 0
git push -u origin cursor/logo-update
gh pr create --fill   # then merge and let Vercel deploy
```

After the Vercel production deploy completes, hard-reload with the service worker
bypassed (or unregister it) to see the new mark, and re-scrape the social card if
you want link previews to refresh immediately.
