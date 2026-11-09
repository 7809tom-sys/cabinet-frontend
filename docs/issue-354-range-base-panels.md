# Issue #354 — RB3DB24 beside a freestanding range

Branch `cursor/issue-354-range-base-panels-e346`.

Source of truth: U.S. Cabinet Depot **altaeuro Collection Full Spec Book V8.2**
(digest: `spec-digest_9df2.md`). All work is designer-side; nothing in the
catalog data was deleted, renamed, aliased, or repriced.

## 1. Designer-facing names — no RB prefix, no "range base"

| File | Change |
|---|---|
| `client/src/lib/designerCabinetNames.ts` (new) | `designerCabinetName()` renders a `RB2DB*` / `RB3DB*` row as the book's cabinet — "Two Drawer Base … for a drop-in cooktop" / "Two Drawer Base with One False Front for a drop-in cooktop" — and strips any supplier-baked `RB` code or "range base" wording from every other row. `designerCabinetCodeLabel()` labels an RB code "Order code RB3DB24" instead of renaming it. |
| `client/src/pages/DesignTool.tsx` (palette `CatalogPaletteCard description`) | Uses `designerCabinetName(c)`. |
| `client/src/components/design/InteractiveRoom3D.tsx:2313` | `threeDSelectedCabinetDescription()` (the selected-cabinet card from the screenshot) uses the same helper. |

Codes are untouched: `PlacedCabinet.masterCode` / `DesignCabinet.masterCode`
still carry `RB3DB24`, which is what `designCartLines.ts` sends to cart, quote
and the distributor PO.

## 2. Range bases only under a cooktop (Auto Design + placement + pop-up)

| File | Change |
|---|---|
| `client/src/lib/rangeBaseGuard.ts` (new) | `isRangeBaseCabinetCode`, `standardBaseForRangeBase` (same-width plain base), `rangeBaseHasCooktop` / `rangeBaseCooktopFor` (a `countertop-opening` cooktop over the base; a freestanding range never counts), `repairRangeBasesWithoutCooktop`, `rangeBaseCooktopPromptWidth`. |
| `client/src/lib/autoDesignAutoBuild.ts:479` | `autoBuildStraightBaseCatalog` drops the RB family, so Auto Design can never tile one into a run. |
| `client/src/pages/DesignTool.tsx` (`addCabinet`) | Picking an RB base opens `range-base-cooktop-dialog`: "This will have a cooktop" (confirmed) or "Use the 24″ base instead" (places the plain same-width base). Cancel leaves the plan unchanged. |
| `client/src/pages/DesignTool.tsx` (`loadSavedDesign`) | Restoring a plan repairs any RB base with no cooktop above it to the plain same-width base and tells the customer which swap happened. |

## 3 + 4. Exposed sides get a 3/4" book panel; no filler prompt beside a range

| File | Change |
|---|---|
| `client/src/lib/sidePanelForExposedSide.ts` (new) | `sidePanelNeeds()` finds (a) a side facing a range, (b) a side facing a microwave, (c) the side a shorter/shallower neighbour leaves showing. `applySidePanels()` seats the book's 3/4" panel (`WEP1523/1530/1535/1542`, `BEP2535`, `TEP3096`, `BP9642` via `selectAefEndPanel`) as a real priced catalog row, sliding the run by the 3/4" when the slot is not free. `rangesFinishedBySidePanels()` suppresses the old 3" handle-clearance **filler** prompt where the panel finishes the side. |
| `client/src/pages/DesignTool.tsx` (new effect) | Frameless lines only; places the panels and raises the notices. |
| `client/src/pages/DesignTool.tsx` (`designCheckWarnings`) | The design-check rail now lists "A 3/4″ side panel (BEP2535) was added to the right side of B24 because that side is exposed beside the range." |
| `client/src/pages/DesignTool.tsx` (`rangeClearanceUids`) | Deletes a range from the filler-violation set when the panels cover both its sides. |

Fillers remain for gaps only (`OF*`, `AF3006`, `SM8` scribe).

## 5. Two doors at 24" and up, one door at 21" and under

| File | Change |
|---|---|
| `shared/genericCabinetDrawerReference.ts` (header comment) | Documents the book's 24" single-door rows and why the drawn/default reference is the double. |
| `client/src/lib/singleDoorTwentyFour.ts` (new) | `isSingleDoorTwentyFourCode` (`B24S`, `B24SFH`, `SB24S`, `VSB24S`, `W2430S`), `defaultPickRows`, and `singleDoorTwentyFourReport` — which lists every place the 24" single-door row is still selectable. |
| `client/src/lib/autoDesignAutoBuild.ts` | Auto Design skips the 24" single-door rows (`B24S` never picked over `B24`). |

**Where 24" single-door SKUs remain selectable** (nothing deleted):

1. The Designer catalog palette, by hand (Base / Wall tabs). They are never a
   default pick and never an Auto-Design pick.
2. Catalog administration, the distributor import, and the spec-book data.
3. An existing saved plan / order line that already carries the code — the
   cart re-sends exactly what was saved.

## 6. Frameless wall tops align to the 40-1/4" top line

| File | Change |
|---|---|
| `client/src/lib/framelessWallTopAlignment.ts` (new) | `alignFramelessWallCabinetTops()` raises every shorter frameless wall cabinet on a wall until its top meets the tallest box on that wall, and never below the 40-1/4" datum (94-1/4" from the 54" bottom). `framelessWallTopDatumIn`, `framelessWallTopLineFor`, `framelessWallHeightClass`, `isFramelessLine`, `isFramelessStyle`. |
| `client/src/lib/autoDesignLayout.ts:1372` | Runs after `normalizeUpperHeights`; reports each raised box and any box whose ceiling will not allow it. |
| `client/src/pages/DesignTool.tsx` (wall-mount effect, restore, draft restore) | Same pass so a manual or loaded plan settles on the same line. |

**Interaction with the existing datums (unchanged, and guarded):**

* The **72" bridge datum** (`OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM`) is a
  *bottom* line set by the OTR microwave. The pass never moves a bridge and never
  measures a bridge into the run line; a bridge that sits off the line is named,
  never shortened or dropped. A kitchen whose uppers are all 30-1/4" keeps its
  84-1/4" line, so its 12" W3012 bridge still tops out exactly on it.
* **Over-range / over-sink** minimums are bottom floors; the pass only ever
  raises a bottom, so `OVER_RANGE_UPPER_MIN_BOTTOM_IN` and
  `OVER_SINK_WALL_MOUNT_BOTTOM` can never be violated.
* **Other lines** never enter the pass: it keys off the frameless geometry
  marker (`hasAefPrintedGeometry`), so a framed line keeps its 84" line.

## 7. Other frameless data aligned to the book

* `client/src/lib/__fixtures__/ovenCabinetRows.json` — the RB rows now carry the
  book's wording ("Two Drawer Base … for a drop-in cooktop"), and RB3DB is no
  longer described as a three-drawer cabinet. Codes unchanged.

## Tests added

`designerCabinetNames.test.ts`, `rangeBaseGuard.test.ts`,
`sidePanelForExposedSide.test.ts`, `singleDoorTwentyFour.test.ts`,
`framelessWallTopAlignment.test.ts` — 43 tests, all passing.

## Verification

* `tsc --noEmit`: **2,295** errors — identical to the main baseline, and no error
  in any file this branch adds or touches.
* `vitest run`: **118 failed / 8,576 passed** (baseline 118 / 8,533). The failing
  file set is byte-identical to main's 66 files; the extra 43 passes are the new
  suites.
* `vite build`: passes (needs `NODE_OPTIONS=--max-old-space-size=6144` on this
  VM; the default 2 GB heap OOMs on the repo's existing bundle size, not on this
  change).

## Before / after

`test-artifacts/issue354-before-after.png` — both panes are rendered by the real
3D engine. Left: the reported plan (B24, dishwasher, **RB3DB24**, freestanding
range). Right: the branch's output — the RB3DB24 is the plain **B24**, the run
shifts, and **BEP2535** finishes the side facing the range.

Reproduce with `npx vite --port 5178` then
`npx playwright test e2e/issue354-before-after.spec.ts`.
