# Kitchen rules

The rules Auto Design and the designer follow when laying out a kitchen. Each rule
is in Tom's words (owner voice) with the date it was given. Rules are grouped into
subsections by topic; add new topics as sibling `##` sections under this heading.

## Corner rules

Applies at every inside corner Auto Design recognizes: 90°, 45° (a 135° inside
angle) and any other angle, from the wall list (rule 12).

### Corner cabinets

1. **No standard cabinet in a corner.** A B42 (or any straight base) is never placed in a corner, converted into a corner or blind cabinet, or given a blind attachment. Seat a real corner cabinet from the live catalog (diagonal, lazy Susan / easy-reach, or blind) flush in the corner, then lay out the rest around it. (Oct 27, Nov 2 and Nov 22, 2026)
2. **Corner cabinet placement math: PENDING CLARIFICATION, not built.** "A 6-inch corner cabinet takes 36 inches of space; if a sink is centered at 18.5 inches on that wall, then 18 + 36 = 54, so a corner cabinet is expected at 54 inches from the start of that wall." Open: 6 in vs 36 in, 18.5 vs 18, and whether 54 measures to the cabinet's start or to the corner. (Nov 24, 2026, 12:28 PM CT)

### Corner fillers

3. **Plain filler on both sides of every 45° turn: mandatory (PERMANENT / HIGH-PRIORITY).** "Whenever a 45-degree turn is recognized, Auto Design puts plain F fillers on both sides automatically as part of the build, with no option and no prompt. It is mandatory." (Nov 24, 2026, 12:38 PM CT)
4. **Every recognized angle, build or hand placement.** "Auto Design should automatically place the appropriate plain non-fluted filler at every angle it recognizes, wherever a filler is needed, during a build or when a cabinet is placed by hand." A cabinet placed by hand at a 45° gets its corner filler automatically too. (Nov 24, 2026, 12:39–12:40 PM CT)
5. **Shape and angle match the corner; blanks are trimmed.** The filler's shape and angle match the opening. Use the smallest plain blank at least as wide and tall as the opening and trim it to the exact width (the order keeps the blank SKU, for example "F342 trimmed to 2-3/8 in"). Size alone is never a reason to flag. Flag only when the line has no plain blank of that shape, or the opening is wider than its largest blank. (Nov 24, 2026, 12:40–12:41 PM CT)
6. **No fluted or BFF fillers in a generated plan (PERMANENT).** They stay in the catalog for manual use only. (Nov 24, 2026, 11:58 AM CT)
7. **Never stack two fillers on a 930 (W930, the 9 by 30 piece).** It is a bug if it happens. Recorded; no guard built yet. (Nov 24, 2026, 12:34 PM CT)
8. **Corner fillers are clearance fillers, shown with a reason.** (Nov 18, 2026)

9. **Any appliance in the corner: a dishwasher panel makes the 45° transition. Status: Recorded, not built (awaiting Tom go).** "When any appliance is placed in the corner (range, refrigerator, dishwasher or other), a dishwasher panel connects the countertop to the appliance, forming a 45-degree transition." (Nov 24, 2026, 12:58 PM CT; this replaces the range-only wording Tom gave a moment earlier.)
   - Related code today: on main, `client/src/lib/dishwasherPanelRule.ts:264` `syncDishwasherPanels` adds a DWR panel only for a **dishwasher** at a run end or a 45° turn (the 45° reason is at :338). The rule is described at `designerLayoutRules.ts:379-381` and `kitchenRulesCatalog.ts:455-456`, and its switch is `dishwasher_panel_forty_five_enabled`. Branch `fix/auto-design-dishwasher-corner` (not merged) cuts that panel on the 22.5° miter and adds `closeDishwasherPanelAngledCorners` (one 22.5° board from the next wall against the panel). Nothing adds a panel next to a range, refrigerator or other appliance in a corner yet.

### Corner backsplash

10. **Backsplash runs continuously into every corner. Status: Pending Tom go (needs frozen 3D change).** Backsplash is always placed in corners where needed. Wherever countertop meets the wall on either side of an inside corner, the backsplash runs into the corner on both walls with no gap at the vertex, and both sides meet at the corner. A check runs after every build. (Nov 24, 2026, 12:50 PM CT)
   - Backsplash is not a placed item. It is computed at render time in the frozen `InteractiveRoom3D.tsx` (`threeDSupportsBacksplash` and `threeDBacksplashCoverageIntervals`), and the 2D `ElevationView.tsx` uses the same function. A build-time check cannot add tile without changing that file, so it waits for Tom's go.
   - Known gaps on main 52b9219:
     - Budget economic corner: in a 144x120 L, the top wall's 120–144 in (the 24 in void at the corner, 36–54 in high) is bare wall. The void holds no cabinet, the DCW above it belongs to the other wall, and 24 in is wider than the 12 in bridge. The countertop runs over the void, so the counter meets bare wall there.
     - A 45° wall longer than 36 in with one cabinet leaves its far stretch bare. Only walls of 36 in or less are tiled end to end, and only gaps of 12 in or less are bridged.
11. **Per-cabinet backsplash toggle. Status: Pending Tom go (needs frozen 3D change).** Each cabinet gets an on/off switch for the backsplash behind it. Not built: the attribute would only do something once the frozen render reads it, so it is documented here and nothing was added. Tom to confirm the exact behavior when he gives the go.

### Recognizing corners and shapes

12. **Wall list with angles.** Auto Design lists every wall in order (Wall 1, Wall 2, ...), each tagged with its angle to the next wall, so a 45° turn is a corner between two walls. (Nov 24, 2026, 12:50 PM CT)
13. **Shape from real geometry.** The shape label comes from the walls and their turns (for example "L with 45° corner" or "five-wall U with chamfers"), not just L-shape, galley or U-shape. (Nov 24, 2026, 12:50 PM CT)
14. **Empty walls still count.** A wall with no cabinets stays in the list as an empty run and still counts toward the wall total (for example, Wall 4 cleared for a future door). (Nov 24, 2026, 12:50 PM CT)
15. **Recognize oddball patterns at wall entry.** Recorded, not built (touches the frozen Wall Builder). "For 45-degree turns and other oddball kitchen patterns, Auto Design must recognize the oddball pattern right away when the wall layout is entered, before placing cabinets." (Nov 24, 2026, 12:30 PM CT)
