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
3. the height that lands the bridge top on the upper run line (`bridgeHeightForWallHeight`), else the nearest real height that still **clears the wall's ceiling**.

The bridge family is a real solid wall box 12″–24″ tall, matched from the line's own catalog (`W30xx`, `W36xx`, …). Spice (`WSC30`), glass, open-box and refrigerator boxes are never a bridge. It hangs at the fixed **72″** datum, centered on the range, and is flagged `overRangeMicrowaveBridge: true`.

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
- `client/src/lib/overRangeFill.test.ts` — the bridge is mandatory whatever the answer; idempotency; width matching; ceiling-aware height; the no-delete and manual-microwave rules; the blocking findings.
- `client/src/lib/overRangeCompanion.test.ts` — bridge selection: range-width match, nearest stock width, spice/glass exclusion, low-ceiling fallback.
- `client/src/pages/DesignTool.overRangeFill.test.ts` — the Designer wiring: the bridge seated **before** the upper run tiles in both build paths, the blocked finding on the review list, the pass after build and load, every answer persisting, the load restore, and the `MW-` compatibility.
- `client/src/lib/autoDesignMatrix.test.ts` — the whole auto-design matrix now also asserts a bridge above every range.

## Screenshot

`e2e/auto-design-bridge-screenshot.spec.ts` builds a real kitchen with `runAutoDesignLayout` and renders it with the real 3D engine (`client/dev/bridge-shot.html` + `client/src/bridgeScreenshotHarness.ts`), then captures `/opt/cursor/artifacts/auto-design-bridge.png`. The bridge is tinted green and the caption names the SKU, the datum, and the width.
