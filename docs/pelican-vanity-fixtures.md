# Pelican bathroom vanity sinks and vanity faucets

Owner request (Tom, Nov 6 2026): the Bathroom Designer showed **one** Pelican
bathroom faucet and did not know which Pelican items are vanity sinks. Goal: find
every Pelican bathroom vanity sink and bathroom (vanity) faucet, tag them, and
make the Bathroom Designer read those tags.

## What was actually wrong

`cabinet_dealz.pelican_products` has no product-type column beyond the imported
`category` and `subCategory`. Those two values are shared by kitchen and bathroom
products:

| Stored value | Contains |
| --- | --- |
| `Sinks & Faucets` / `Sinks` | 297 rows: stainless kitchen sinks, fireclay farm sinks, granite-composite kitchen sinks, **and** every porcelain vanity basin and cultured-marble vanity top |
| `Sinks & Faucets` / `Faucets` | 113 rows: every pull-down kitchen faucet, pot filler, tub filler, **and** every vanity faucet |

The Bathroom Designer worked around this with three hard-coded SKUs —
`isVerifiedPelicanVanitySink` matched `PL-3099` and `PL-3608`, and
`isVerifiedPelicanVanityFaucet` matched only `PL-8112 BN` / `PL-8112 CHR`. That
single faucet pair is why the picker offered one bathroom faucet.

## What was identified

Counts are of **exact purchasable `pelicanCode` rows**, because one Pelican model
ships as several rows (finish, colour, packaging, pre-drilled spread).

### Vanity sinks — 59 rows, 45 models

| Mount | Rows | Models |
| --- | --- | --- |
| Undermount porcelain basin | 33 | PL-1606, PL-1634, PL-1637, PL-1646, PL-1647, PL-3033, PL-3044, PL-3059, PL-3064, PL-3072, PL-3088, PL-3099, PL-3608, PL-3611, PL-3639 |
| Vessel (above-counter) porcelain basin | 8 | PL-3001, PL-3002, PL-3014, PL-3053, PL-3060, PL-3079, PL-3081, PL-3082 |
| Drop-in / self-rimming basin | 4 | PL-3086, PL-5053-1, PL-1011 Spread 4", PL-1011 Spread 8" |
| Integrated cultured-marble vanity top | 14 | PL-R1917W, PL-R2519W, PL-R2522W, PL-R3119W, PL-R3122W, PL-R3722W, PL-R4322W, PL-R4922W, PL-O2519WBS, PL-O2522WBS, PL-O3122WBS, PL-O3719WBS, PL-O3722WBS, PL-O4922WBS |

**Single bowl: 59 rows. Double bowl: 0 rows.** This is the answer to "how many
single vs double". It is not an omission:

- Pelican's own storefront publishes a `Double Bowl` tag on 27 products. Every one
  of them is a kitchen or laundry sink (`Kitchen` + `Laundry` tags; the
  stainless/fireclay/cast-iron lines). None carries Pelican's `Bathroom` tag.
- Pelican's `bathroom-sinks` collection holds 41 products, all tagged
  `Single Bowl`.
- Every vanity-basin specification sheet read for this work states
  `Bowl Configuration: Single`.
- The widest Pelican vanity products are the integrated tops (49 in.), and each
  has one moulded bowl.

So there is currently no double-bowl Pelican vanity sink to offer. The
`PELICAN_DOUBLE_BOWL_MIN_VANITY_WIDTH_IN = 48` rule the request asked about is
implemented and enforced, but dormant: it will only take effect if Pelican ever
publishes a two-bowl basin. It is a width gate on the **vanity**, not on the
basin — a two-bowl basin is only offered on a vanity at least 48 in. wide.

### Vanity faucets — 29 rows, 10 models

| Mount | Rows | Models |
| --- | --- | --- |
| Single hole | 19 | PL-8107 (3), PL-8112 (2, vessel height), PL-8113 (4), PL-8116 (3), PL-8136 (1, vessel height), PL-8142 (4), PL-8162 (2) |
| Three hole, 4" centerset | 6 | PL-8104 (2), PL-8330 (4) |
| Three hole, 8" widespread | 4 | PL-8312 (4) |
| Vessel height (`Works with Vessel Style Sinks`) | 3 | PL-8112 BN, PL-8112 CHR, PL-8136 BN |

Deliberately **not** tagged as vanity faucets, even though Pelican files them
under `Bathroom`:

| Item | Why excluded |
| --- | --- |
| PL-8515, PL-8522, PL-8538 | Floor-mounted freestanding **tub fillers**. Their sheets say floor mount; they are already the Designer's tub-filler line. |
| PL-86H55, PL-86H15, PL-86A33, PL-86A23, PL-86S22 | Hydra **pressure-balance shower valve sets**, imported as `Shower Valves & Systems`. |
| PL-8410, PL-8461 | 8" center **kitchen** wall faucets (Pelican tags them `Kitchen`). |
| PL-8369 | Kitchen pot filler. |
| PL-8480 | Kitchen bridge faucet. |

## Where the evidence comes from

Every mount type, bowl count, exterior dimension and pre-drilled hole count in
`shared/pelicanBathroomFixtures.ts` is read from the Pelican specification sheet
for that exact model, and each row carries its `specificationUrl`. For example:

- `PL-3099-Spec-Sheet.pdf` — `Installation: Undermount`, `Exterior Measurements: 20 7/8" x 15 5/8" x 7 3/4"`, `Bowl Configuration: Single`
- `PL-3001.pdf` — `Installation: Vessel`, `Above-Counter Contemporary Look`, `Exterior Measurements: 16" x 16" x 6 1/4"`
- `PL-8312-Spec.pdf` — `Installation: Three Hole, 8" Spread`, `Overall Height: 10 7/16"`, `Spout Length: 7 1/16"`
- `PL-8330-Spec-Sheet.pdf` — `Installation: Centerset, 4" Spread`
- `PL-R4922W-Spec.pdf` — `Integrated Rectangular Bowl`, `3 Pre-Drilled Faucet Holes`, `Designed For Drop-In Cabinet Installation`
- `PL-1011-4inch-Spec-Sheet.pdf` / `PL-1011-8inch-Spec-Sheet.pdf` — `Three Pre-Drilled Faucet Holes`, `4" Spread Between Holes` / `8" Spread Between Holes`

Nothing in the table is inferred from a product name, a photograph, or a category
label. Where the importer's own text disagrees with the sheet, the sheet wins —
for instance the imported description for `PL-3099 Bone` calls it a "Farmhouse
Reserve 33″ Farmhouse Apron-Front" sink, while Pelican's sheet and the current
Pelican listing both say it is an 18" × 13" porcelain **undermount vanity** basin.

## What the tag column stores

`cabinet_dealz.pelican_products.bathroomFixtureTags` — `VARCHAR(191)`, nullable,
comma-delimited. Null on every other Pelican row, so no kitchen behaviour changes.

| Tag | Meaning |
| --- | --- |
| `bathroom-vanity-sink` | The row is a vanity basin or integrated vanity top |
| `bathroom-vanity-faucet` | The row is a vanity faucet |
| `mount-undermount` `mount-drop-in` `mount-vessel` `mount-integrated` | Basin installation, from the sheet |
| `bowl-single` `bowl-double` | Source-stated bowl count |
| `faucet-holes-1` `faucet-holes-3` | Source-stated pre-drilled holes |
| `faucet-spread-4` `faucet-spread-8` | Source-stated hole spacing (three-hole only) |
| `faucet-for-vessel-sink` | Sheet says "Works with Vessel Style Sinks" |

## How the Bathroom Designer reads them

- `shared/pelicanBathroomFixtures.ts` is the single source of truth: the model
  table, the exact SKU lists, the tag vocabulary, and the faucet-to-basin match.
- `client/src/lib/bathroomVanityCatalog.ts` reads the tag first and falls back to
  the exact-SKU list, so an API deployment that does not yet return the column
  still works. A row is never accepted on its category or its name.
- `DesignTool.tsx` filters the vanity sink step with `isBathroomVanitySinkRow` and
  `vanitySinkFitsVanityWidth`, and the vanity faucet step with
  `bathroomVanityFaucetOptions`, which matches the chosen basin's pre-drilled hole
  count (and spread where the sheet publishes one).
- `PelicanProductPickers.tsx` now lists 12 vanity faucet cards up front instead of
  6, and says which mounting forms it is showing. The faucet step also prints the
  basin's drilling so "no spread published" is never read as "confirmed to fit".
- `VanityFixtureFacts.tsx` prints the source mount, dimensions and drilling on the
  sink and faucet cards.
- `bathroomFixtureChecklist` counts a basin and a faucet through the same catalog, so
  the checklist can no longer disagree with what the picker offered. Saved designs
  keep their existing profile ids.
- `isPelicanDesignerPaletteAvailable` and the backend `pelicanFixtureRole` both
  exclude every vanity SKU from the kitchen palette, so nothing crosses over.

## Still needs Tom

These are the items where the catalog or the source data does not let anyone
decide safely. None of them are tagged.

1. **Six glass vessel basins: PL-609, PL-618, PL-624, PL-645, PL-661, PL-697.**
   The imported descriptions call all six "…Glass Vessel Bathroom Sink". None of
   the six appears in Pelican's current catalog, no specification sheet exists for
   them, and Pelican's live `Bathroom Sinks` collection does not list them. Confirm
   whether Pelican still sells them; if so, ask Pelican for the sheets and they can
   be added in one block.
2. **PL-7201 Spread 4" — pedestal sink.** The sheet exists
   (`PL-7201-(3).pdf`, 19 1/4" × 17 1/8" × 32 5/8", 3 hole 4" spread) and confirms
   it is a white porcelain pedestal lavatory. It is a *pedestal*, not a vanity-top
   or under-counter basin, and a pedestal cannot be installed in a vanity cabinet.
   Decide whether the Bathroom Designer should offer a standalone pedestal sink; it
   is currently left out of the vanity list.
3. **PL-8114 BN / PL-8114 CHR, PL-8164 BN, PL-8303 BN / PL-8303 CHR.** The imported
   descriptions say "Single Hole Vessel Bathroom Faucet" / "Three Hole Bathroom
   Faucet", but none of the five is in Pelican's current catalog, its `Bathroom
   Faucets` collection, or its product feed, and no specification sheet is
   published. Not tagged — no source to verify the hole count against.
4. **Deck Plate Bathroom BG / BN / CHR / MB.** Real, purchasable, and genuinely
   bathroom — but they are escutcheon/deck plates, not sinks or faucets. They are
   not tagged as vanity fixtures. Say if you want a separate accessory tag.
5. **PL-CI6004 / PL-CI6012 are imported as `Faucets` but are cast-iron
   double-bowl *kitchen* sinks.** They are already handled correctly by the
   kitchen role logic and are not in this change. Flagging only so the category
   anomaly is on the record; no data was moved.
6. **The oval Cove tops are imported as `Tile & Mosaic` / `Tile`**
   (PL-O2519WBS … PL-O4922WBS), while their rectangular siblings are
   `Sinks & Faucets`. This change tags them through the exact-SKU list so the
   Designer can read them, but the stored category stays wrong. Moving the category
   would change storefront placement and is left to you.
7. **Hole spacing on the Cove cultured-marble tops.** Their sheets state
   "3 Pre-Drilled Faucet Holes" but publish no spacing. Both 4" centerset and 8"
   widespread faucets are therefore offered for them, and the picker says so. If
   Pelican can confirm the spacing, add `faucet-spread-4` or `faucet-spread-8` and
   the picker narrows automatically.
8. **Three-hole faucets on a basin whose sheet states no holes.** An undermount or
   vessel basin is drilled in the countertop, not in the china, so every vanity
   faucet is offered for those and the picker asks for the deck drilling to be
   confirmed. Say if you would rather restrict them to single-hole faucets.

## Run order

1. `docs/sql/0249_pelican_vanity_fixtures_preview.tidb.sql` — read-only. Confirms
   the candidate rows and shows the deliberately excluded items.
2. `docs/sql/0250_pelican_vanity_fixtures_tag.tidb.sql` — adds the column and tags
   88 exact rows. Re-runnable.
3. `docs/patches/cabinet-backend-pelican-vanity-fixtures.patch` — backend drizzle
   column and the tag-aware `pelicanFixtureRole` helpers. Apply **after** step 2;
   `pelican.byCategory` selects every column, so it errors until the column exists.
4. Deploy the frontend. Until step 2 has run, the frontend still resolves vanity
   fixtures from the exact-SKU list, so nothing breaks; the picker fills in fully
   once the tags are present.

## Verification

- `npx vitest run shared/pelicanBathroomFixtures.test.ts client/src/lib/bathroomVanityCatalog.test.ts`
  covers the catalog, the tag vocabulary, the hole/spread match, the 48-inch
  double-bowl gate, and that no kitchen SKU resolves to a vanity record.
- Both SQL files parse as MySQL. `0250` contains 88 `UPDATE`s on 88 distinct
  `pelicanCode` values, one statement per line, no `IF NOT EXISTS`, every table
  `cabinet_dealz.`-qualified, and three read-only guards that must return `0`,
  `0` and `88`.
- The full suite has the same failing test files before and after this change (61
  files, all pre-existing — the README documents them). No new failures.
