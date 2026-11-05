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

# Above the range (Nov 5 2026)

The design questions ask what goes above the range: a **hood**, a **bridge + over-range microwave**, or **nothing**. PR 174 removed the in-build hood so that question could decide, and left the range open — which is correct during the build, but the answer was never saved and `planOverRangeCompanions` only ever ran inside `autoDesignLayout.ts`. A loaded plan therefore sat with a bare range.

`client/src/lib/overRangeFill.ts` closes the loop.

## The chain

1. **The saved answer wins.** It lives on the room as `overRangeAnswer` and is persisted with the layout, so a reload re-uses it and nobody is asked twice.
2. **No answer → the fallback chain runs, add-only:**
   - a `W30xx` bridge (height from the upper line via `bridgeHeightForWallHeight`) plus the `MW-` microwave that matches the range width;
   - else a `HOOD-` item.
3. **Nothing above the range → nothing to do.** The pass skips a range that already has a hood, a bridge, or a microwave.

## Rules

- **Add-only.** It never deletes, replaces, or moves a placement. Every addition goes through `appendCollisionFreePlacements`; anything that does not fit is reported instead.
- **Never deletes an existing bridge or microwave.** A manually placed `MW-` is left exactly where it is.
- **Microwave codes stay `MW-…`.** `isMicrowaveOverRangePair` in `client/src/lib/design.ts` recognises an over-range appliance only by that prefix, so the fallback places a real `MW-` row.
- The pass runs **after every build** and **on every layout load**, keyed off a plan epoch so a cabinet the person deleted is not silently re-added.

## Persistence

`setOverRangeAnswer` is the single writer. `overRangeAnswerToPersist` never overwrites a saved answer with a fallback: an `open` range stays open, and a range the fallback dressed keeps "no answer" so the next load re-runs the same chain instead of claiming the person chose something.

## Tests

- `client/src/lib/overRangeFill.test.ts` — answer precedence, the bridge chain, the hood fallback, the no-delete rule, the manual-microwave rule, the no-range no-op, and the honest "nothing could be added" note.
- `client/src/pages/DesignTool.overRangeFill.test.ts` — the Designer wiring: the pass after build and load, every answer persisting (including "leave it open"), the design-question seed, the load restore, and the `MW-` compatibility.
- `client/src/lib/autoDesignMatrix.test.ts` — the coverage PR 174 removed, restored against the add-only pass: every bare range in the matrix must end up dressed.
