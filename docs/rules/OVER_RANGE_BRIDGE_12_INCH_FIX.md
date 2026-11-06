# Over-range bridge size: the wall cabinet over the range must be 12″ (Nov 6 2026)

Owner report (Tom): **"the wall (bridge) cabinet over the range should be 12 inches but the
designer did not apply that size."**

Correct read: it is the **height** of the bridge, not its width. Above a 30″ range with 30″
uppers the box is **W3012 — 30″ wide × 12″ tall × 12″ deep** — hung on the 72″ microwave datum
so its top lands on the 84″ line the 30″ uppers beside it finish on.

## Cause

Two defects, both in the frontend. Nothing in the catalog was missing.

### 1. The Designer's Auto-Design pop-up substituted a 24″ bridge

`rangeBridgeSpec` (`client/src/lib/kitchenAdjacency.ts`) answered a fixed
"24 inch bridge, bottom 72, top 96" for anything hanging under a bridge, whatever height the
uppers beside the range were. `offerAutoDesignBridgeAndMicrowave`
(`client/src/pages/DesignTool.tsx`) called it, found the `W3024` row it named, and **replaced**
the bridge the mandatory build pass had just chosen:

```
proposal.bridge      -> W3012  (12″ tall, top 84″)   // correct, sized by overRangeBridgeFor
bridgeSpec           -> W3024  (24″ tall, top 96″)   // hard-coded, wins
```

On a 30″ kitchen that produced a 24″ box standing 12″ proud of its neighbours — the reported bug.

### 2. A frameless bridge was re-hung off its datum

`normalizeUpperHeights` (`client/src/lib/designerFaceRules.ts`) re-mounts any short upper on the
84/90/96 line by cabinet height. A frameless line stores the 12″ bridge as 12⅝″ (and its 30″
uppers as 30¼″), which the height-keyed rule did not recognise, so it pushed the bridge from 72″
down to 66⅜″ — below the microwave it is meant to rest on.

### Not the cause

- **The catalog is fine.** Every line the Designer can be pointed at already carries
  `W3012` (id `9360085`, 30 × 12 × 12, `placementType = wall`, `subCategory = Standard Wall`):
  lines 330002, 330011, 330014, 330020, 510004, 540005, 540007, 540029. No row is missing and no
  `designerEligible` / `showInDesigner` gate hides it.
- **The mandatory-bridge rule itself was working.** `placeMandatoryOverRangeBridges` placed a
  12″ W3012 correctly; the pop-up then overwrote it.
- **The readiness gates were not involved.** `buildAutoDesignLayout` only refuses to build while
  the catalog is still loading; it does not filter the bridge family.

## Fix

One authority for the bridge, read by every path:

| Where | Before | After |
| --- | --- | --- |
| `overRangeBridgeFor` (`lib/overRangeCompanion.ts`) | height from the nominal 30/36/42 ladder | height from `overRangeBridgeHeightFor`: the **run top line** (54″ + the upper height the line sells), snapped to a stock bridge height |
| `rangeCompanionProposal` (`lib/rangeCompanion.ts`) | its own exact-width, exact-height filter that rejected a frameless 17⅝″ bridge outright | delegates to `overRangeBridgeFor` |
| `offerAutoDesignBridgeAndMicrowave` (`pages/DesignTool.tsx`) | called `rangeBridgeSpec` and overrode the proposal with a 24″ box | uses the proposal's bridge unchanged |
| `rangeBridgeSpec` (`lib/kitchenAdjacency.ts`) | fixed 24″ height, 96″ top | same derived height, snapped to a SKU the line really sells |
| `normalizeUpperHeights` (`lib/designerFaceRules.ts`) | re-hung the bridge by cabinet height | leaves a bridge on its own datum |
| `bridge_hung_height_in` / `bridge_open_height_in` (kitchen rule params) | stored the fixed heights | removed; the height is derived, so it cannot drift |

30″ uppers finish at 84″, so the bridge on the 72″ datum is 12″ → **W3012 over a 30″ range**.
42″ uppers finish at 96″, so that bridge is 24″ — the owner's original rule still holds where it
applies.

## SQL Tom must run

**None.** The 12″ cabinet is present and designer-ready in every line; this was a sizing bug in
the frontend, not missing data. No statement was added under `docs/sql` and no backend patch was
needed under `docs/patches`.

The Kitchen Rules row `owner-bridge-cabinets` in `cabinet_dealz.kitchen_rules` still holds the old
fixed 24″ text in `ruleDescription`. That row is display-only: the Designer reads
`bridge_hung_bottom_in`, `bridge_open_bottom_in` and `bridge_upper_height_in` and derives the
height itself, so the stored text cannot change what is placed. The built-in rule catalog that the
Admin page renders (`client/src/lib/kitchenRulesCatalog.ts`) is corrected in this PR, so the
Designer and the admin list now both say the height is derived. Nothing has to be run.

## Proof

- `client/src/lib/overRangeFill.test.ts` — `"the bridge is 12 inches over 30 inch uppers, not 24"`:
  a 12″ bridge topping on the 84″ line, the 12/18/24 ladder across 30/36/42 uppers, and a frameless
  bridge keeping its 72″ datum.
- `client/src/lib/rangeCompanion.test.ts` — the prompt reports the same W3012 the build places, and
  still offers a bridge on a frameless 36″ run (the 17⅝″ case the old filter refused).
- `client/src/lib/kitchenAdjacency.test.ts` — `rangeBridgeSpec` sizes from the run top line and
  snaps to a real SKU.
- `client/src/pages/DesignTool.overRangeFill.test.ts` — the pop-up handler has no second bridge-size
  override.
- `e2e/over-range-bridge-before-after.spec.ts` — the same real Auto-Design kitchen rendered twice,
  24″ versus 12″, captured to `/opt/cursor/artifacts/over-range-bridge-before-after.png`.
