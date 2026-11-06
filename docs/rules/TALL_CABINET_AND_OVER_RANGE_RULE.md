# Tall cabinets seat the end of a run (Nov 5 2026)

Owner rule: an oven tower or pantry goes at the **end** of a run. It closes the run — the end of a wall run, or the end of the free span that closes a run — and never opens the middle of the first gap that happens to fit.

`planAutoDesignTallFit` in `client/src/lib/autoDesignTallCabinets.ts` is the one place that decides it.

## What changed

The old behavior measured `freeSegmentsOnWall` and dropped the box at each span's **start**, so a pantry landed between the corner base and the sink and left the run open past it.

Per wall (in run order), then per free span, the order of preference is now:

1. the span's run END, when the box butts the wall end there (`seat: "end"`);
2. the span's run START, when the box butts the wall end there (`seat: "start"`);
3. the span's end, then its start, when the box closes an interior gap (`seat: "free"`).

Only a fit that passes the collision gate and stays inside the refrigerator panel limit is a candidate; the best-scoring one wins across every wall, so a blocked first span cannot hide a later fit.

## What still holds

- Never past a wall end (`boundedWallPlacementAt`).
- Never across the refrigerator panel limit, through an opening or corner clearance, or over another cabinet.
- The box's real height must clear that wall's lowest ceiling.
- **Nothing moves to make room.** Range, sink, and refrigerator anchors keep their existing 2-inch wiggle limit, and a window never moves. A tall box that cannot seat is reported, not forced.

## Several tall cabinets in one build

Allowed. `runAutoDesignLayout` seats the picks in order and re-reads the plan between them, so a second pantry closes the run the first one left. Each pick either places or lands on the review list.

## Reporting

`planAutoDesignTallFit` returns a `code` on every failure so the review list and the toast are specific:

| code | meaning |
| --- | --- |
| `tall-cabinet-unavailable` | the picked row is no longer a source-priced tall box in this line's catalog |
| `tall-cabinet-blocked` | it is a real tall box but no run end can take it (ceiling, refrigerator panels, or no clear span) |

A successful fit adds a layout note saying it seated `at the end of the run` (or `at the start of the run`).

## Tests

- `client/src/lib/autoDesignTallCabinets.test.ts` — run-end seating on an empty wall, closing a run that stops short of the wall end, the interior-span case, several talls in turn, the ceiling and no-span codes.
- `client/src/lib/autoDesignSinkAndTall.build.test.ts` — the measured build: the tower closes the run at the far wall end with nothing beyond it, two picks both seat without overlapping, and every dropped pick is named with a reason.

# Above the range (HARD RULE, Nov 5 2026)

**A bridge wall cabinet is always placed above the range.** It is not optional, not skippable by the pop-up answer, and not skippable by any fallback chain. It goes in **first** — before any microwave or hood — on every build and on every layout load, in both build paths (`runAutoDesignLayout` and the DesignTool builder).

`client/src/lib/overRangeFill.ts` owns the rule.

## 1. The mandatory bridge

`placeMandatoryOverRangeBridges` seats a real bridge box over every range before the upper run tiles, so the wall run treats it as an occupied upper and **never lays an ordinary cabinet over the range** (nor leaves a sliver beside the bridge).

Bridge selection (`overRangeBridgeFor` in `overRangeCompanion.ts`), in order:

1. the width that matches the **range width** — a 36″ range takes the 36″ bridge;
2. else the nearest stock bridge width the line sells;
3. the height that lands the bridge top on the upper run line (`overRangeBridgeHeightFor`), else the nearest real height that still **clears the wall's ceiling**.

The bridge family is a real solid wall box 12″–24″ tall, matched from the line's own catalog (`W30xx`, `W36xx`, …). Spice (`WSC30`), glass, open-box and refrigerator boxes are never a bridge. It hangs at the fixed **72″** datum, centered on the range, and is flagged `overRangeMicrowaveBridge: true`.

### The bridge height is derived, not a fixed 24 inches (Nov 6 2026)

The owner reported that **the wall cabinet over the range came out 24 inches when it should be 12**. Two things caused it, and both are fixed:

1. **`rangeBridgeSpec` hard-coded the answer.** It returned "24 inch bridge, bottom 72, top 96" whatever the uppers beside the range were doing, and the Auto-Design pop-up (`offerAutoDesignBridgeAndMicrowave` in `DesignTool.tsx`) used it to *replace* the bridge the build had already chosen. On a 30″ kitchen that swapped the correct W3012 for a 24″ box standing 12″ above its neighbours.
2. **The bridge datum was keyed off cabinet height.** `normalizeUpperHeights` re-hung any short upper on the 84/90/96 line, so a frameless 17⅝″ bridge was pushed from 72″ down to 66⅜″, below the microwave it rests on.

The height now comes from one place: `overRangeBridgeHeightFor` reads the **run top line** (54″ + the upper height the line actually sells) and snaps to a stock bridge height. A 30″ run finishes at 84″, so the bridge is **12″ — W3012 over a 30″ range**, which is what the owner asked for. A 42″ run finishes at 96″, so that bridge is 24″. The bridge keeps whatever datum its own rule gave it; the ordinary upper-line normalizer does not touch it.

Every path reads that one selector, so a bridge cannot be one size in the plan and another size in a prompt: `overRangeBridgeFor` (the mandatory build pass), `rangeCompanionProposal` (the Designer's pop-up and the legacy WSC30 repair), and `rangeBridgeSpec` (the review list).

## 2. Microwave and hood, add-only

With the bridge in place, the pop-up answer decides what sits on top of it:

- `microwave-bridge` → the `MW-` microwave matching the range width;
- `hood` → a `HOOD-` item;
- `open` → neither (the bridge is still there);
- no answer → the fallback chain: the `MW-` microwave, else a `HOOD-` item.

The answer lives on the room as `overRangeAnswer`, is persisted with the layout, and is re-used on every load so nobody is asked twice.

## Rules

- **Never deletes, replaces, or moves anything.** Every addition goes through `appendCollisionFreePlacements`. An existing bridge — flagged or a bridge-family box hung at the 72″ datum — is kept exactly as it is, and a manually placed `MW-` is left where it is.
- **A bridge that genuinely cannot fit is reported**, never silently skipped. `overRangeFill` returns a `range-bridge-blocked` finding naming the range and the reason (no bridge in the line, ceiling too low for a 12″ box at the 72″ datum, or the span is occupied). The Designer puts it on the review list; the build adds it to `reviewFindings`.
- **Microwave codes stay `MW-…`.** `isMicrowaveOverRangePair` in `client/src/lib/design.ts` recognises an over-range appliance only by that prefix.
- **Ordinary wall runs never tile over the range.** `upperReservedZones` (`autoDesignSeamFillers.ts`) always returns the range span as reserved.
- The pass is **idempotent** and runs **after every build** and **on every layout load**, keyed off a plan epoch so a cabinet the person deleted is not silently re-added.

## Persistence

`setOverRangeAnswer` is the single writer. `overRangeAnswerToPersist` never overwrites a saved answer with a fallback: an `open` range stays open above its bridge, and a range the fallback dressed keeps "no answer" so the next load re-runs the same chain instead of claiming the person chose something. The mandatory bridge is independent of the answer.

## Tests

- `client/src/lib/overRangeBridgeMatrix.test.ts` — **the matrix**: six cabinet lines, every layout shape, range widths 30/36/42, with and without a microwave, all four answers, and saved layouts. Every case asserts a bridge is present, centered, at the 72″ datum, under the ceiling, collision-free, and matched to the range width; also that no ordinary upper tiles over the range and no sub-filler sliver is left beside the bridge.
- `client/src/lib/overRangeFill.test.ts` — the bridge is mandatory whatever the answer; idempotency; width matching; ceiling-aware height; the no-delete and manual-microwave rules; the blocking findings. The `"the bridge is 12 inches over 30 inch uppers, not 24"` block is the regression test for the owner's report: a 12″ bridge whose top lands on the 84″ line, the 12/18/24 ladder for 30/36/42 uppers, and a frameless bridge keeping its 72″ datum.
- `client/src/lib/rangeCompanion.test.ts` — bridge selection: range-width match, nearest stock width, spice/glass exclusion, low-ceiling fallback, and that the Designer's prompt reports the same 12″ W3012 the build places (and still offers a bridge on a frameless 36″ run, where the old exact-height filter refused 17⅝″).
- `client/src/lib/kitchenAdjacency.test.ts` — `rangeBridgeSpec` sizes the bridge from the run top line (W3012 at 84″ for 30″ uppers, W3024 at 96″ for 42″) and snaps to a bridge box the line really sells.
- `client/src/pages/DesignTool.overRangeFill.test.ts` — the Designer wiring: the bridge seated **before** the upper run tiles in both build paths, the blocked finding on the review list, the pass after build and load, every answer persisting, the load restore, the `MW-` compatibility, and that the pop-up handler has no second bridge-size override.
- `client/src/lib/autoDesignMatrix.test.ts` — the whole auto-design matrix now also asserts a bridge above every range.

## Screenshot

`e2e/auto-design-bridge-screenshot.spec.ts` builds a real kitchen with `runAutoDesignLayout` and renders it with the real 3D engine (`client/dev/bridge-shot.html` + `client/src/bridgeScreenshotHarness.ts`), then captures `/opt/cursor/artifacts/auto-design-bridge.png`. The bridge is tinted green and the caption names the SKU, the datum, and the width.

`e2e/over-range-bridge-before-after.spec.ts` is the before/after proof for the 12″ bug: the same real kitchen rendered twice (`client/dev/bridge-before-after.html` + `client/src/bridgeBeforeAfterHarness.ts`), once with the 24″ box the pop-up used to substitute and once with the fixed 12″ W3012, captured to `/opt/cursor/artifacts/over-range-bridge-before-after.png`. The left caption reads "24″ tall, top 96″, 12″ proud of the 84″ upper line"; the right reads "12″ tall, top 84″, flush with the 84″ upper line".

# A faucet is always placed at the sink (HARD RULE, Nov 5 2026)

**Every build places a faucet at the sink.** Mandatory, like the bridge above the range: not optional, not skippable. It is placed on every build — `runAutoDesignLayout` and the DesignTool builder — and on every layout load, so an older saved plan without one gets one.

## How a faucet is modelled

A faucet is **not** a cabinet and not a separate entity. It is a property of the `SinkFixture` record:

| Field | Meaning |
| --- | --- |
| `faucet` | the flag |
| `pelicanFaucetProductId` / `…Name` / `…Image` | the chosen catalog row (absent when the default fixture is used) |
| `pelicanFaucetProfileId` | the verified Pelican profile identity |
| `faucetForm` | `pull-down` \| `standard-arc` \| `pull-out` \| `articulated-swing` \| `wall-mounted-bridge` |
| `faucetOverallHeight` / `faucetSpoutLength` / `faucetSpoutHeight` | published inches — the only numbers the 3D assembly is built from |
| `faucetFinish` | `brushed-nickel` \| `matte-black` \| `brushed-gold` \| `chrome` \| `oil-rubbed-bronze` |
| `faucetRearDeckOffsetIn` | the rear-deck datum (1.25″; absent for a farmhouse apron front) |
| `defaultFaucet` | true when this is the built-in default fixture, not a catalog pick |

Because it lives on the sink, the faucet **moves, deletes, and saves with the sink** — no separate entity to keep in sync.

**Why a flag alone is not enough.** `makeSink` sets `faucet: true` on every new sink before any faucet has been chosen. Treating that flag as "already has a faucet" is exactly the bug: the 3D assembly needs a form and all three dimensions, so `sinkHasRenderableFaucet` / `sinkFaucetIsSatisfied` gate on those instead.

## Where it sits — in front of the window (owner clarification)

Centered on the **sink base's own run axis**, on the **countertop**, behind the basin's rear rim — and **in front of the window**.

**The window never moves.** No coordinate and no dimension (offset, width, sill,
height) is changed by a faucet, ever. A sink under glazing is the normal kitchen, so
the faucet standing in front of the window aperture is **expected**: it is never
omitted for that reason and never treated as a blocking conflict.

`resolveDeckFaucetPlacement` still moves the faucet forward on the rear deck where it
can, but when the deck cannot clear the sill it keeps the forward-most point that is
still on the deck behind the basin and **draws the faucet in front of the glazing**.
`inFrontOfWindow` reports the (expected) arrangement; `raiseWindowsForDeckFaucet` now
returns the openings untouched, always, and raises no warning.
 `resolveDeckFaucetPlacement` (`client/src/lib/faucetPlacement.ts`) is the one resolver: it keeps the spout off the wall, out of the window frame, and on the measured counter, and `addSinkFixture` builds the base, riser, and spout from the published dimensions. A window is only ever shortened (sill raised, top fixed) through `raiseWindowsForDeckFaucet` — the same single rule every other faucet already used.

## Selection

1. The chosen catalog faucet, if the sink already has a drawable one — **kept exactly as it is**.
2. Otherwise a source-verified single-hole kitchen faucet from the selected line's catalog (`defaultAutoDesignFaucet`).
3. Otherwise the **built-in default fixture**, `DEFAULT_PELICAN_KITCHEN_FAUCET` — a real Pelican part (`PL-8237 BN`) whose published spec sheet supplies every dimension the 3D assembly uses. It is **reported**, never silently substituted: the build note names it and `usedDefaultFaucet` is set.

## Rules

- **Add-only.** Nothing is deleted, replaced, reordered, or removed. A sink that already has a drawable faucet is returned untouched.
- **Windows are preserved exactly.** Sink and window anchor limits are unchanged.
- **Reported.** The build returns `everySinkHasFaucet` and `usedDefaultFaucet`, and a note naming the faucet (or the default fixture) reaches the layout notes.

## Tests

- `client/src/lib/autoDesignFaucetMandatory.test.ts` — **every build path** (six cabinet lines, every layout shape, with and without a catalog faucet): a faucet is present over the sink with a real form and real dimensions, anchored, on the countertop, with no window conflict; centered on the sink base's run axis; the default fixture is used and reported; an existing faucet is never replaced; idempotency; multi-sink.
- `client/src/components/design/InteractiveRoom3D.mandatoryFaucet.test.ts` — **real meshes**: the build's sink produces a faucet base and a spout in 3D, both for a catalog faucet and for the default fixture, standing above the countertop.
- `client/src/pages/DesignTool.mandatoryFaucet.test.ts` — the wiring: both build paths and the load pass, the once-per-plan guard, the add-only gate, and that the renderer draws from the published dimensions.

# A tall box closes a run, never an occupied inside corner (Nov 5 2026)

The owner's screenshot showed a pantry seated in the inside corner instead of at the
end of a run. `planAutoDesignTallFit` now scores each candidate seat:

| score | seat |
| --- | --- |
| 0 | a run end that meets another wall carrying **no** kitchen run — the clearest end of a run |
| 1 | a run end that meets a wall this build will fill |
| 2 | a run end that is an inside corner another run already occupies |
| 10+ | an occupied inside corner (last resort) |
| 20+ | an interior span (only when no run end is free) |

Two signals decide "occupied", because a tall box is seated **before** the base runs
tile: anything already placed on the adjoining wall, and — the one that fixes the
reported case — `runWallIds`, the walls this build is going to fill. A tall box must
not claim a corner the runs are about to use.

The scoring loop keeps the **best** candidate across every span and wall. It used to
`break` on the first accepted one, which is why a worse-scoring corner could win.

If the only free seat is an occupied inside corner and it cannot be used, the tall is
reported as `tall-cabinet-blocked` explaining that a tall box closes a run rather than
a shared corner.

## Tests

- `client/src/lib/autoDesignTallCabinets.test.ts` — the corner check (occupied vs
  empty vs interior), a corner shared with a wall this build *will* fill, preferring
  an open run end over an occupied corner, and the blocked report.
