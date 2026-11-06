# Mosaic backsplash waste rule (Nov 6 2026)

Owner rule (Tom): when mosaic tile is used for a backsplash, the cart must automatically add **5% waste**
to the square footage. If the backsplash needs X sq ft of mosaic, the cart quantity is **X × 1.05**,
rounded up to the product's sellable unit if the cart already rounds units.

It applies to mosaics in backsplash designs only. Everything else is unchanged.

## Where it is implemented

| Question | Answer |
| --- | --- |
| Where does backsplash square footage feed the cart? | `client/src/pages/DesignTool.tsx` measures the supported wall segments with `threeDBacksplashSegments(...)` into `RoomAreas.backsplashSqFt`, then calls `buildSurfaceCartLines(...)`. |
| Where is the waste applied? | `client/src/lib/surfaceCartLines.ts` → `buildSurfaceCartLines`, the `isBacksplash` branch that already turns area into whole boxes. |
| Where is the rule itself? | `client/src/lib/mosaicBacksplashWaste.ts` — the factor, the detection, and the cart note. |
| Where is the note shown? | The cart line's `qtyNote` reads `… (includes 5% waste)`. `Cart.tsx` also renders it as `Mosaic backsplash quantity includes 5% waste.` (test id `cart-mosaic-backsplash-waste`). |

The cart already rounds area-priced tile up to whole sellable units, so the formula is applied
before that rounding, not instead of it:

```
sheets = ceil( X × 1.05 / sq ft per sheet )
```

`X` is the same measured backsplash area the cart used before this rule — the 3D-supported wall
segments only, never total room wall area, and never cabinet faces.

### Which sellable unit, and why

A mosaic is sold **by the sheet**, and every current Pelican mosaic has `coverageSqFt` empty. Before
this change that meant the cart could not turn a mosaic backsplash area into a quantity at all: it
fell back to `qty 1`. The rule needs a unit size to round to, so `mosaicSheetSquareFeet()` reads the
catalog row's published `size` — `"11.81 x 11.81 x 8"` is an 11.81 in square sheet; the trailing `8`
is the 8 mm thickness and is not used as a dimension.

Precedence, strongest first:

1. a structured `coverageSqFt` the vendor has entered (unchanged behaviour — note reads `sq ft/box`),
2. the published sheet size for a verified mosaic (note reads `sq ft/sheet`),
3. nothing — the line stays at qty 1 and the note says the 5% could not be added.

The third case is deliberate: the cart never prints "includes 5% waste" on a line whose quantity
does not actually include it.

## What does not change

| Surface | Waste |
| --- | --- |
| Mosaic on the backsplash | **5%** (this rule) |
| Field tile / any other backsplash tile | 15% (unchanged) |
| Flooring (planks, tile-look) | 10%, or 20% for herringbone (unchanged) |
| Mosaic installed as the floor | Flooring waste — a floor is not a backsplash (unchanged) |
| Countertops, sinks, faucets, fixtures | Untouched |

## How a mosaic is detected — and what is still uncertain

`pelican_products` has **no mosaic flag and no product-type column**; the only type data it carries is
free-text `category` / `subCategory`. The rule therefore reads two existing sources, strongest first,
and `readMosaicProduct()` reports which one matched:

1. **`catalog-subcategory`** — category `Tile & Mosaic` with subCategory `Mosaic`. This is the identical
   test the Designer's own floor picker uses (`isMosaicCatalogItem`), so the cart and the picker agree
   on what a mosaic is.
2. **`catalog-record`** — the row resolves to a verified Pelican mosaic in the Designer's catalog
   (`MOSAIC_CATALOG`, distributor SKUs read from buildpelican.com), matched on exact SKU or on the
   catalog name embedded in a decorated name. Rows the distributor files under Tile & Mosaic that are
   *not* mosaics — the cultured-marble vanity tops in `NON_MOSAIC_TILE_ROWS` — are excluded first.

Anything else is **not** treated as a mosaic, and a Flooring row is never a mosaic even when its name
advertises a "mosaic look".

### The uncertainty, stated plainly

- **No exact flag exists.** Both signals are text a vendor typed. A mosaic saved with subCategory
  `Tile`, or a field tile saved with subCategory `Mosaic`, follows that typo. There is no product-type
  field to fall back on, so this is a data-quality limit, not a code bug.
- **A name-only match is not used.** A tile row whose only mosaic evidence is the word "mosaic" in its
  name keeps the 15% tile overage. Guessing would take 10 points of waste off a row that may be field
  tile. `uncertainMosaicCandidate()` and `mosaicDetectionUncertainty()` report those rows so the
  sub-category can be corrected; the rule row in `kitchen_rules` says the same thing.
- **No sq ft per box means no unit count.** A mosaic with no `coverageSqFt` **and** no parseable
  published sheet size cannot be converted from square feet to sheets. It keeps the existing qty 1
  fallback and the cart note says the 5% could not be added — the cart never claims waste it did not
  apply.
- **A box is not necessarily a sheet.** A mosaic the vendor sells in boxes of several sheets has no
  sq-ft-per-box number today; the sheet size is used, so the count is sheets. If Pelican later
  publishes a box quantity, entering `coverageSqFt` on that row takes precedence automatically.

## Tests

- `client/src/lib/mosaicBacksplashWaste.test.ts` — the 1.05 factor, the sheet-area derivation, the
  detection signals, the uncertain-candidate reporting, reading the note back off a saved cart line,
  and the "mosaic backsplash" condition (floor and countertop excluded).
- `client/src/lib/surfaceCartLines.test.ts` — the cart math: mosaic backsplash at 5%, field tile still
  at 15%, rounding up to whole sheets from the real catalog row shape, the note text, the
  missing-unit-size case, the zero-area case and the quote-only case.
- `client/src/lib/mosaicBacksplashWaste.wiring.test.ts` — the rule is actually called from the cart
  builder and the note actually reaches the Cart and the Designer drawer.
- `client/src/lib/kitchenRulesCatalog.test.ts` — the rule is seeded as an implemented `auto` owner rule.

## Rollout

Frontend only: no backend procedure or schema change was needed. The rule row for the admin Kitchen
Rules screen is `docs/sql/0249_mosaic_backsplash_waste.tidb.sql` (one statement, `cabinet_dealz.`
prefix, `INSERT IGNORE`, no `IF NOT EXISTS`).
