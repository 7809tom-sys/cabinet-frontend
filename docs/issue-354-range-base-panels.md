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
| `client/src/lib/sidePanelForExposedSide.ts` (new) | `sidePanelNeeds()` finds (a) a side facing a range, (b) a side facing a microwave, (c) the side a shorter/shallower neighbour leaves showing, and reports the `bottomIn` / `heightIn` of the band that actually shows. `applySidePanels()` seats the book's 3/4" panel (`WEP1523/1530/1535/1542`, `BEP2535`, `TEP3096`, `BP9642` via `selectAefEndPanel`) as a real priced catalog row **mounted on that band** (a 40-1/4" wall beside a 30-1/4" one gets a 10" panel at 84-1/4"–94-1/4", not one hanging at 54"), sliding the run by the 3/4" when the slot is not free. It is **idempotent**: a side that already carries an `autoPlacedForUid`/`autoPlacedSide` panel is skipped, and a settled pass returns `input.placed` **by reference** so the Designer effect cannot re-render in a loop (the same contract `syncExposedSidePanels` and `syncDishwasherPanels` use). `rangesFinishedBySidePanels()` suppresses the old 3" handle-clearance **filler** prompt where the panel finishes the side. |
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

## 6. Frameless wall tops align to the ONE 40-1/4" top line

**Tom's decision (Nov 9 2026, item 5): every frameless wall cabinet top lines up
to 94-1/4" (54" bottom + the book's 40-1/4" box), with no exceptions. The
over-microwave/OTR bridge and the refrigerator bridge also top out at 94-1/4": the
bridge keeps its fixed 72" bottom and the HEIGHT is chosen so its top meets the
line. There is no 30-1/4"-only-run exemption.**

| File | Change |
|---|---|
| `client/src/lib/framelessWallTopAlignment.ts` | `framelessWallTopDatumIn()` is the single 94-1/4" line; `framelessBridgeTopHeightIn()` is 22-1/4" from the 72" datum. `alignFramelessWallCabinetTops()` targets 94-1/4" on **every** frameless wall (it no longer derives the line from whichever boxes happen to be present), and bridges are not exempt: a bridge that still misses the line is named with its shortfall. **A wall counts as frameless when ANY cabinet on it is** (so a marker-less auto-built bridge still belongs to its frameless wall), **but only frameless cabinets and bridges are rewritten** — a framed box on a mixed / two-style wall keeps its own 84" line exactly. `framelessWallTopLineFor()` reports the one 94-1/4" line for any wall the rule touches, independent of which heights are present. |
| `client/src/lib/autoDesignLayout.ts` (`isFramelessWallCatalog`) | Decides the line from the wall catalog: the geometry marker, else the presence of a 40-1/4" wall row (frameless-only — a framed line sells 30/36/42). |
| `client/src/lib/design.ts` (`normalizeStandardWallMounts`) | A `refrigeratorAssemblyRole === "bridge"` box is left to its own bay instead of being re-hung below the line. |
| `client/src/lib/overRangeCompanion.ts` | `microwaveBridgeHeightPick`, `overRangeBridgeFor`, `overRangeBridgeHeightFor`, `overRangeBridgeOptions` accept `topLineIn`; when set, the pick takes the height whose top reaches that line from the fixed datum, and the tallest the line sells when none reaches it. `singleTopLineFor()` answers whether a catalog finishes on a single line. `BRIDGE_STOCK_HEIGHTS` and the bridge code regex now include **23** (the frameless 22-5/8" box: 72 + 22-5/8 = 94-5/8", the closest the line sells to 94-1/4"). |
| `client/src/lib/overRangeFill.ts` | Passes the line into the mandatory bridge seat and raises a visible finding when the tallest bridge the line sells still falls short — the bridge is placed, never dropped, and the shortfall is named. |
| `client/src/lib/rangeCompanion.ts` | Offers the 23" choice and preselects from the single line. |
| `client/src/lib/autoDesignRefrigeratorBay.ts` | On the frameless line the cap is the 22-5/8" box and its top is measured to 94-1/4" (from the 72" clearance datum), not 54 + the requested height. `framelessLine` now defaults to **false** so a framed line never inherits the frameless line. |

**Interaction with the existing rules:**

* The **72" bridge datum** is still the fixed BOTTOM of every over-range bridge.
  What changed is the height: the picker now chooses the box whose top reaches
  94-1/4", so a frameless kitchen takes `W30xx23` (22-5/8") instead of the old
  12" `W3012` that topped out at 84-1/4".
* **Mixed / two-style walls** are safe: the wall marking only decides that the
  rule applies. A framed W3030 sharing a wall with a frameless W2440 stays at
  bottom 54" / top 84" while the frameless box finishes on 94-1/4".
* **Over-range / over-sink** minimums are bottom floors and the pass never lowers
  a bottom, so they cannot be violated.
* **Other lines are untouched**: without a `topLineIn` the neighbour mapping
  (30→12, 36→18, 42→24) and the 84" line apply exactly as before.

## 7. Other frameless data aligned to the book

* `client/src/lib/__fixtures__/ovenCabinetRows.json` — the RB rows now carry the
  book's wording ("Two Drawer Base … for a drop-in cooktop"), and RB3DB is no
  longer described as a three-drawer cabinet. Codes unchanged.

## Exposed sides — the central concept

A **side is exposed when it can be seen**:

* next to an appliance — a range hood, an oven, or a range;
* where cabinet heights change — a shorter cabinet beside a taller one;
* at an open end of a run.

A side **against a wall**, or against an adjoining cabinet **of the same height and
depth**, is **not** exposed.

| Line | What happens on an exposed side |
|---|---|
| **USCD frameless** (altaeuro and every USCD frameless line) | A **3/4" panel is added automatically** on every exposed side, with a notice to the customer. The book sells no 1/4" skins, so this panel *is* the finished face: `WEP1523/1530/1535/1542` (walls by height), `BEP2535` (bases), `TEP3096`/`BP9642` (tall), priced from the door style's catalog SKU. |
| **Framed with finished sides** | **No automatic panel.** The customer adds one with the per-cabinet **Left panel / Right panel** options. |

**Fillers vs panels.** Fillers are only for gaps and door/handle clearance;
panels finish the face. When a side needs a panel and a filler would also apply,
**the required panel wins** and the filler yields
(`dropFillersOvertakenByExposedPanel`).

**Skins vs panels.** A 1/4" **skin** is a thin finished sheet glued onto an
**unfinished side** — the plain box side meant to sit against a wall or another
cabinet. Panels and skins go **only on exposed sides, never on hidden ones**. The
"skin needed for outside" checkbox stays for **non-frameless** lines and uses
these definitions in its label and tooltip; on the USCD frameless lines it is
hidden/disabled with the note that end panels are added automatically, and a skin
is never stacked on top of an auto panel.

**Required automatic panels** (frameless and framed alike, when the line sells the
board):

* the **wall** cabinet side that faces a **range hood**;
* the **base** cabinet side that faces the **oven or range**.

**Pantries.** A side against a pantry that is **not part of the run** is
**optional and never automatic** — it gets a panel only if the customer chooses
one with the Left/Right toggle. A pantry **inside** the run already has its end
treatment, so it gets **no** panel.

**Symmetry is a default.** The same panel on the wall and the base at the same
end of a run, so the look lines up (`symmetricEndPanel`). It is a default, not a
requirement: the customer may change or remove either panel, and the designer
never forces them back to matching. Nothing is added to a hidden side for
symmetry.

**Panels are real width.** A 3/4" panel occupies 3/4" of wall length exactly like
a cabinet or a filler, so cabinets after it shift by 3/4" and the length, fit and
remaining-space maths count it (`exposedSideRunAccounting.ts`). A run that no
longer fits is reported so Auto Design resizes, swaps or refuses with a visible
reason — it never overlaps or silently overruns.

## Tests added

`designerCabinetNames.test.ts`, `rangeBaseGuard.test.ts`,
`sidePanelForExposedSide.test.ts`, `singleDoorTwentyFour.test.ts`,
`framelessWallTopAlignment.test.ts`, `framelessBridgeTopLine.test.ts` — 60 tests,
all passing.

## Verification

* `tsc --noEmit`: **2,295** errors — identical to the main baseline, and no error
  in any file this branch adds or touches.
* `vitest run`: **118 failed / 8,593 passed** (baseline 118 / 8,533). The failing
  file set is byte-identical to main's 66 files; the extra 60 passes are the new
  suites.
* `vite build`: passes (needs `NODE_OPTIONS=--max-old-space-size=6144` on this
  VM; the default 2 GB heap OOMs on the repo's existing bundle size, not on this
  change).

## Before / after

`test-artifacts/issue354-before-after.png` — committed on this branch. Both panes
are rendered by the real 3D engine. Left: the reported plan (B24, dishwasher,
**RB3DB24**, freestanding range). Right: the branch's output — the RB3DB24 is the
plain **B24**, the run shifts, and **BEP2535** finishes the side facing the
range.

Reproduce with `npx vite --port 5178` then
`npx playwright test e2e/issue354-before-after.spec.ts` (the spec writes
`/opt/cursor/artifacts/issue354-before-after.png`; copy it to
`test-artifacts/` to refresh the committed image).
