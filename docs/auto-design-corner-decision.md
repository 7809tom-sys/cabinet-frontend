# Auto Design corner decision

The door line never picks a default corner cabinet. Auto Design recognizes each true 90° inside corner of the cabineted runs first and reserves the inside-corner square (24 inches along each meeting leg, the standard base depth) before any fill — leftover gaps, “use every inch,” and the 15-rule intake repack included. A plain `B##` base is never placed in that square.

After fixed appliances are seated at their measured positions, the engine measures the **available run** on each meeting leg: from the inside corner to the nearest fixed appliance, or to that appliance’s required clearance when one applies (the 15-inch refrigerator landing is one). The shorter of the two legs is the relevant measurement. That number selects the *type*. The selected line’s live, source-priced catalog then selects the SKU and size. Cabinet widths are never hardcoded.

## Type bands (available run, inches)

| Available run | Type |
| --- | --- |
| 45 or more | Lazy Susan |
| 43.5 up to (not including) 45 | Pull-out / sliding / adjustable corner that slides 3–6 in. If the line sells none, try the next valid type (a blind that can pull 3–6 in, then a lazy Susan that fits). |
| 42 up to (not including) 43.5 | A catalog lazy Susan plus a 9 in cabinet beside it. See the 9 in interpretation below. If the line has no 9 in SKU, or no lazy Susan that leaves 9 in beside it, fall to the next valid type. |
| 33 up to (not including) 42 | Best catalog fit: a lazy Susan whose published width fits the available run, or a blind corner with its 3 in filler and its catalog pull distance. |
| 27 up to (not including) 33 | Always a corner cabinet, and it must be a blind. The blind is turned so its open leg (base depth + the 3 in filler, 27 in on a standard 24 in base) sits on the tight leg, and its width runs along the more open leg. 27 in is that open-leg geometry, not a hardcoded cabinet size. |
| Under 27 | Keep the square blocked and raise `corner-cabinet-not-seated`. |

These bands replace the earlier “tight L prefers a blind at about 42 in” rule.

## Interpretation of Tom’s “9 inch tall cabinet”

Tom said the 42 in band takes “a 33 in lazy Susan plus a 9 inch tall cabinet.” The 33 in figure is an example, not a hardcoded SKU: the lazy Susan comes from whatever widths the line actually sells (a line that only has LS33 uses LS33; a line with no lazy Susan at a width that leaves 9 in falls to the next valid type).

The 9 in figure is the *width* looked up in the catalog, never invented and never priced by us. Prefer a 9 in **base, pull-out, or tray base** so the countertop stays continuous. Use a 9 in-wide **tall** only when the line sells no 9 in-wide base. Do not use a 9 in wall cabinet (that would break the counter). This is an interpretation so Tom can correct it.

## What does not change

- A blind always carries its 3 in filler. The 1.8 in filler target lives only on the DeepSeek branch and is not used here.
- A lazy Susan or diagonal base still gets a diagonal corner upper.
- A refrigerator stays at the start or end of an L run.
- Vendor blind prefixes `BBC`, `WBC`, `BBL`, `BBR`, `WBL`, `WBR`, `BLB`, and `BCB` (and any code containing `BLIND`) are recognized as true blinds.
- If the line sells no corner cabinet of any valid type, the square stays blocked and `corner-cabinet-not-seated` is raised. There is no fallback to a straight base.

See `client/src/lib/autoDesignCornerDecision.ts`.


## Blind-corner orientation and face (Tom, Nov 14 2026, 2:00 and 2:08 PM CT)

A blind corner cabinet has a door (and a drawer, when the SKU has one) **only on the exposed / open half**. The other half is a blank panel, buried against the wall and the adjoining run in the corner — no door and no drawer on that half.

This is the meaning of “the drawers should face outward (the open side) and the door should face the wall.” The door + drawer face sit only on the open half, toward the open run. The 2D elevation and the 3D render both draw it that way, for left-hand and right-hand blinds in every corner direction. Handedness (swing) puts the open half toward the open run and the blank half toward the corner.

On the 27–33 in available-run band, `rotateBlind` seats the cabinet width on the more open leg (`openWallId`) so that open half actually faces the open run. The required 3 in pull filler stays on the tight / adjoining run, priced from the live catalog (or a visible finding / placeholder when the line sells no filler SKU). Later leftover and tighten passes must not consume that slot: if they do, the leftover is evicted and the required filler is reseated.

## Remaining gaps, fillers, and exact openings (Tom, Nov 14 2026, 2:03 and 2:06 PM CT)

After every Auto Design pass (leftover fill, 15-rule retile, corner seating, sink and bridge placement) a close-remaining-gaps pass fills any leftover on every wall run (base and upper): biggest catalog cabinets first, then one priced catalog filler per gap where possible. Fillers are never invented and never used to bridge a window (designerFaceRules rule 9 + 3 in clearance). If the line sells no covering filler, a visible finding is raised.

A final tighten/snap pass then makes adjacent cabinets butt flush (0 gap, within 1/16 in) and makes appliance openings (range, refrigerator, dishwasher, microwave / OTR, bridge over the range, bridge over the sink) equal the appliance’s nominal width exactly — a 30 in range leaves a 30.0 in opening, not 31 or 31.5. Leftover space is collected as one catalog filler at the run end or corner, never into an opening or between cabinets. Upper bridges and microwave cabinets are recentered on, and match, the opening below.

The extra 1–1.5 in that used to appear beside a range came from leftover packing leaving slivers next to appliances, a “bare gap at a finished end” rule that kept 1–1.5 in open, `closeSmallOpeningsWithStock` only growing neighbors for openings ≤ the 3 in filler cap, and seam snap only closing 1/16 in. Those slivers sat in the opening instead of being collected at the run end.

## Sink under a window, or a matching bridge (Tom, Nov 14 2026, 2:01 and 2:02 PM CT)

The Auto Design intake places an accessible “window” checkbox, with a check-mark icon, immediately next to the sink measurement. It reuses the existing `sinkWindowCenter` field (no duplicate input). Checked: the sink base is centered under the window on that wall (an existing window is used; otherwise a window is created from the entered or sink center) and uppers stay clear of it. Unchecked: a short catalog bridge is placed over the sink base, the same width as the sink, with height paired to the neighboring wall cabinets the same way as the range bridge (12 in next to 30 in uppers, 15/18 in next to 36, 24 in next to 42, or the catalog’s matching bridge heights, mounted at the 72 in datum). If the line sells no matching width, the existing bridge fallback is used or a visible reason is raised. SKUs and prices are never invented.
