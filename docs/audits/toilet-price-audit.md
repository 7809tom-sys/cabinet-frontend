# Toilet price audit (Tom's $1,000 report)

## Summary

Two separate defects were found. Neither is a hardcoded fixture price, a
cents/dollars mistake, a wrong column, or a bad import row: the Pelican cost
base (`pelican_products.listPrice`) is correct on every toilet and matches
Pelican's own price list.

1. **Data** — `cabinet_dealz.pelican_category_markups` holds **18400 bps
   (+184%)** for `Toilets & Bidets`. The repo's rule is **3500 bps (+35%)**.
   Sell price is `listPrice × (1 + markupBps/10000)`, so this one row misprices
   every toilet at once. That is the "$1,000 toilet".
2. **Code (fixed in the draft PR)** — a placed bathroom fixture lost its real
   sell price and reached Materials and the cart at **$0.00**.

## 1. Data: category markup is 149 points too high

Every price on a Pelican product page is computed at read time, never stored:

```
sell = positive_authorized_price_base × (1 + pelican_category_markups.markupBps / 10000)
```

`positive_authorized_price_base` prefers `yourCost`, then falls back to
`listPrice`. Toilets have `yourCost = NULL` and a correct `listPrice`.

The repo's authoritative rule is in three identical server constants
(`server/routers/pelican.ts`, `surfaces.ts`, `fixturePhoto.ts`):

```ts
const DEFAULT_MARKUP_BPS: Record<string, number> = {
  Flooring: 6500,
  "Tile & Mosaic": 5500,
  "Sinks & Faucets": 3800,
  "Toilets & Bidets": 3500,
  "Shower & Bath": 2200,
  "Quartz Slabs (Countertops)": 1800,
};
```

Live production differs only for this category:

| Category | Stored `markupBps` | Repo default |
|---|---|---|
| Flooring | 6500 | 6500 |
| Tile & Mosaic | 20000 | 5500 |
| Sinks & Faucets | 11500 | 3800 |
| **Toilets & Bidets** | **18400** | **3500** |
| Shower & Bath | 13000 | 2200 |
| Quartz Slabs (Countertops) | 8000 | 1800 |

### The SKU Tom saw

`PL-12011 MB` — the first card in the Bathroom Designer's Toilets & Bidets tab.

| | Value |
|---|---|
| SKU / name | `PL-12011 MB` — PL-12011 MB Vortex Toilet (matte black) |
| Wrong price | **$984.06** (reads as "about $1,000") |
| Source cost | `$346.50`, `pelican_products.listPrice` — matches Pelican price list line `PL-12011 MB  $346.50` |
| Cause | category markup 18400 bps: `346.50 × 2.84 = 984.06` |
| Correct price | **$467.78** = `346.50 × 1.35`, from the price list cost + the repo's +35% rule |

`PL-12044 MB` is the same item and the same numbers. Every other toilet is
wrong by the same factor of 2.84 rather than 1.35.

Correct prices for the whole visible set, from Pelican's price list:

| SKU | Price-list cost | Wrong (today) | Correct (+35%) |
|---|---|---|---|
| PL-12005 | 1159.99 | 3294.37 | 1565.99 |
| PL-12005 MB | 1569.99 | 4458.77 | 2119.49 |
| PL-12011 | 222.75 | 632.61 | 300.71 |
| **PL-12011 MB** | **346.50** | **984.06** | **467.78** |
| PL-12027 | 141.75 | 402.57 | 191.36 |
| PL-12044 | 222.75 | 632.61 | 300.71 |
| PL-12044 MB | 346.50 | 984.06 | 467.78 |
| PL-12050 | 202.50 | 575.10 | 273.38 |
| PL-12210 | 171.00 | 485.64 | 230.85 |
| PL-12228 | 141.75 | 402.57 | 191.36 |
| PL-12230 | 889.99 | 2527.57 | 1201.49 |
| PL-12243 | 222.75 | 632.61 | 300.71 |
| PL-12248 | 123.75 | 351.45 | 167.06 |
| PL-12249 | 123.75 | 351.45 | 167.06 |
| PL-12305 | 1019.99 | 2896.77 | 1376.99 |
| PL-12305 MB | 1399.99 | 3975.97 | 1889.99 |
| PL-12318 | 222.75 | 632.61 | 300.71 |
| PL-12335 | 164.25 | 466.47 | 221.74 |
| PL-12382 | 222.75 | 632.61 | 300.71 |
| PL-A249 ADA | 104.99 | 298.17 | 141.74 |

Source for every cost above: the Pelican price list already committed to the
backend repo at `pelican_import/nls.txt` (the file `pelican_import/parse.py`
seeds `listPrice` from). Every toilet `listPrice` in TiDB matches it exactly, so
**no product row needs to change** — only the markup row.

`priceTier2/3/4`, `msrp`, `retailPrice`, `yourCost`, `vendorWholesale` are all
NULL on every toilet, so they are not the cause and are not part of the fix.

### SQL for Tom

`docs/sql/0262_toilet_category_markup.tidb.sql` — a preview `SELECT` (stored
markup, plus current vs correct sell price per toilet), then a single `UPDATE`,
then a confirmation `SELECT`. Nothing was written to the production database.

### Note on the other categories

The same drift affects Tile & Mosaic, Sinks & Faucets, Shower & Bath, and Quartz
Slabs. Those are left untouched because they are a pricing decision, not this
bug report. If the markup tab was edited by hand, expect the same report for
them.

## 2. Code: a placed toilet priced at $0.00 (fixed in the draft PR)

Independent of the markup, a placed bathroom fixture lost its price.

- The Designer refreshes every saved surface selection through
  `surfaces.designSelectionByIds`. That query is **3D-drawability-gated**
  (`isPelicanDesignerSelectable`), and a toilet, bidet, tub, or enclosure is
  never drawable there, so it never comes back.
- `refreshVerifiedSurfaceSelections` treats "not in the response" as stale and
  sets `sellPrice: null`.
- The fixture had already been added to `selectedSurfaces` by
  `placePelicanBathroomFixture`, so it stayed in Materials with no price, and
  `buildSurfaceCartLines` skipped unpriced picks — the picker footer read
  **"1 added · $0.00"** and the toolbar read **$0.00**.

Reproduced against the live catalog, then verified after the fix:

| | Before | After |
|---|---|---|
| Picker footer | `1 added · $0.00` | `1 added · $984.06` |
| Toolbar | `Price & cart $0.00` | `Price & cart $984.06` |

The fix merges the already-available `surfaces.byIds` read (same active,
catalog-visible, source-priced row, no drawability gate) into the refresh, with
the drawable record still winning on any row present in both. An id missing from
both reads is still treated as stale, so a genuinely withdrawn product still
loses its saved amount.

## Verification

```
npx vitest run client/src/lib/surfaceSelection.test.ts \
               client/src/pages/DesignTool.bathroomFixturePricing.test.ts \
               client/src/lib/surfaceCartLines.test.ts \
               client/src/lib/designMaterialsList.test.ts \
               client/src/lib/bathroomPlanning.test.ts \
               client/src/lib/pelicanBathroomFixtureProfiles.test.ts
```

84 tests pass. `tsc --noEmit` reports the same 2286 errors before and after this
change; all are the pre-existing missing-`server/` router types, plus the
unrelated `DesignTool.bathroomVanities.test.ts` assertion that already fails on
`main`.
