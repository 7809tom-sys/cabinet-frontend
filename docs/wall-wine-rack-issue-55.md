# Issue #55 — wall wine rack 3015 / 3018 still missing

Status: diagnosis + fix in one draft PR. Not merged.

Issue: [#55](https://github.com/7809tom-sys/cabinet-frontend/issues/55)
Prior attempt: PR #59 (`c620fb5`, merged 2026-10-28 01:46 UTC)

## Short answer

It was both, and the code half was narrower than PR 59 assumed.

PR 59 fixed the **classification** of a wine rack (one row can be "Wall Wine
Rack", "Wine Rack / Open Display", "Accessories / Wine Storage", or
"Specialty / Wine Rack" and still belong on Wall). It did **not** fix three
things that all still drop the same rows, and no later rewrite regressed it —
the storefront redesign, category mapping, distributor-line filter and the
`NOT_A_STRAIGHT_UPPER` rule are all still in place as PR 59 left them. The
gaps below are gaps PR 59 never closed.

| # | Where it drops | Why | Still true on `main` |
| --- | --- | --- | --- |
| 1 | Affiliate storefront Wall tab | `storefront.familyCatalog` filters by **exact** `cabinets.category`. The Wall tab asks for `category: "Wall"` only, so a rack filed as `Accessories / Wine Storage` or `Specialty / Wine Rack` is never returned. PR 59 changed the backend *filter matching* and the *displayed* category, not the category the tab requests. | yes |
| 2 | 3D Designer eligibility | `shared/designerEligibility.ts` decides "is this an accessory?" **before** any wine-rack rule. A rack with `placementType = accessory` or `category = Accessories` is a bill-of-materials line, so `cabinetCanBeRenderedOrPlacedIn3d` returns false and the catalog backfill writes `designerEligible = 0`. The backend Designer list requires `designerEligible = true`. `isWallWineRackCabinet` was never consulted here. | yes |
| 3 | Data: the Skyline 3015 box | `0230` only filled a dimension when it was empty. If `WRC3015` carries a stale non-zero size, the Designer builds the wrong box. If it has no priced published SKU on the White Shaker line, neither the storefront nor the Designer can offer it at all. | possible |

### Site search for `3015` / "wine rack"

Measured, not assumed. `cabinets.list` search (the site search box with no door
style selected) matches a SKU fragment and a case-insensitive description
phrase, and PR 57 already fixed the phrase case. Run against these rows it
returns all of them:

```
3015       -> WRC3015, DN-WRC3015
3018       -> WRC3018, WXR3018
wine rack  -> WRC3015, DN-WRC3015, WRC3018, WXR3018
```

So the search **code** is not the reason search looks empty. Search returns
nothing because the rows never enter the query at all — `cabinets.list` runs the
same public gate (`notInConflict()`: active, priced, published supplier row, not
retired by a `sku_master_alias`). A row that fails that gate is invisible to
search, to the family page, and to the Designer at the same time, which is
exactly the pattern in the report. That makes row 3 the most likely remaining
cause for the 3015 code, and it is a data question the SQL preview answers.

### What PR 59 got wrong (and this PR corrects)

The classifier itself matched too much and too little at once:

- `^(?:WRC|WXR|WWC|LWR)\d` matched **`WRC18L` / `WRC18R`**, which are Wall
  Radius Caps, not wine racks. They were being pushed onto the wine-rack path.
- It required the code to **start** with the prefix, so `DN-WRC3015` and
  `SK-WXR3018` were missed.
- It only matched the whole category/subcategory string, so the combined
  supplier labels the issue names (`Accessories / Wine Storage`,
  `Specialty / Wine Rack`, `Wine Rack / Open Display`) matched only by
  accident, and a rack named only in the description matched never.
- It treated **any** row whose subcategory said "Wine Rack" as an upper,
  including `BOWR30` ("Base w/ Wine Rack") and base/tall wine bins.
- It never touched `designerEligibility`, so a rack filed under Accessories
  stayed ineligible for the Designer even after PR 59 shipped.

## What this PR changes

| File | Change |
| --- | --- |
| `shared/wallWineRack.ts` | Rack code must end in digits (`WRC18L` excluded), vendor prefixes accepted, combined "parent / child" labels parsed, description-only racks recognised, wine coolers / glass holders excluded, and a BASE / TALL / VANITY filing keeps its own tab. |
| `shared/designerEligibility.ts` | A wall wine rack is decided **before** the accessory split, so a rack filed under Accessories is a wall box the Designer can place. |
| `client/src/lib/storefrontWallWineRacks.ts` | New. Which extra categories the Wall tab must also request, and the merge that adds only rack rows to it. |
| `client/src/components/storefront/StorefrontShop.tsx` | The Wall tab now requests the line's accessory/specialty rack buckets and merges the racks in, de-duplicated by record id. No other tab makes an extra request. |
| `client/src/lib/wallWineRackIssue55.test.ts` | The regression test. Fails on the pre-fix code (4 of its 10 cases), passes now. |
| `docs/sql/0261_wall_wine_rack_publish.tidb.sql` | Preview-then-update data fix. |

The regression test pins all four surfaces plus the false positives. It lives in
`client/src/lib/` because it needs both the shared classifier and the client
storefront helpers; it is plain logic, no DOM.

### Not changed on purpose

- `client/src/lib/autoDesignWallCabinets.ts` `NOT_A_STRAIGHT_UPPER` still
  excludes `wine`. Auto-Design must not fill a straight upper run with a wine
  rack; that rule is correct and was never part of the bug. Nothing in the
  Designer picker reuses it.
- The storefront category **redesign** (`sortStorefrontCategoryTabs`,
  `CATEGORY_TILES`) is not the cause and is untouched.
- The distributor-line filter is not the cause: a rack with no SKU on the
  selected line is legitimately absent, and the SQL preview in block 2 is how
  you tell that case apart from the four above.

## Data: verified vs ambiguous

**Verified from this repository** (`docs/pelican-box-coverage.md`, generated
from the catalog fixtures, and the two SQL files already shipped):

| Code | Size | Line | Note |
| --- | --- | --- | --- |
| `WRC3015` | 30 × 15 × 12 | Skyline (Classic Cream) | Cabinet id `9360166`; `0230`/`0231` moved Skyline SKUs back onto it |
| `WRC3018` | 30 × 18 × 12 | U.S. Cabinet Depot | — |
| `WXR3018` | 30 × 18 × 12 | U.S. Cabinet Depot (Shaker White / Shaker Black / Haven Harbor) | — |
| `WWC630` | 30 × 6 × 12 | U.S. Cabinet Depot | — |
| `LWR3015`, `LWR3018` | not printed in this repo | Ashford (CS) | Only referenced by the alias work; **size not verified here** |

**Ambiguous — needs Tom to confirm in Cabinet Config** (this PR does not guess):

1. Which door style `WRC3015` is priced on. `0231` moved 31 Skyline SKU rows
   onto `WRC3015` assuming they were mismatched onto `LWR3015`; whether any of
   them is a **White Shaker** style row is unknown here.
2. Whether "White Shaker" is one `door_styles` row or several (Shaker White,
   White Shaker, Haven Harbor). The fixtures show three separate colours.
3. The real category strings stored today. The issue lists four possible labels;
   block 1 of `0261` prints what is actually in `cabinets.category` for every
   rack-shaped code, including rows this repo has never seen.
4. `LWR3015` / `LWR3018` dimensions.
5. Whether `WRC2430` is a real wine rack — `0230` republished it without any
   size evidence in this repo.

## Verification

```bash
npx vitest run client/src/lib/wallWineRackIssue55.test.ts   # 10 passed
npx vitest run shared/wallWineRack.test.ts \
               shared/designerEligibility.test.ts \
               client/src/lib/familyCategoryFilters.test.ts \
               client/src/lib/tidbSqlFiles.test.ts          # all passed
```

Full suite: 61 failing files before this change, 61 after (the new test file
passes), so this PR introduces no new failures. Those 61 are pre-existing in
this checkout — it has no `server/` directory, so every tRPC type and every
admin page fails to resolve `trpc.*` here.

## Owner steps

1. Run `docs/sql/0261_wall_wine_rack_publish.tidb.sql` block by block.
   **Read block 1 and block 2 first.** Pasting block 4 without reading them is
   how a wrong category gets republished.
2. `published_priced_sku_count` in block 9 must be greater than 0 for each code.
   If it is 0, the SKU has no White Shaker price and this SQL cannot fix it.
3. Redeploy the frontend. The storefront and Designer changes are client-side,
   so they ship with the normal deploy; there is no backend patch in this PR.
