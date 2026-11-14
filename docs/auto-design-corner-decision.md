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
