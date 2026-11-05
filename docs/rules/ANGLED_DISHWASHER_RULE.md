# Angled dishwasher rule

Owner rule (Nov 5 2026): a dishwasher at a 45-degree angle — a diagonal or angled corner run —
is treated like a cabinet. The countertop runs over it and continues from one cabinet to the next,
blending seamlessly with the neighbours exactly as it would across any other base cabinet.
No gap, no break, mitered/joined at the angle.

Second half of the same rule: when a dishwasher ends a run **or** the run turns at an angle such as
45 degrees at the dishwasher, a **dishwasher panel** is auto-placed there. The panel is code `DWR`
(a panel item, never an accessory and never a cabinet box). `BP` is also a panel for this rule.

## What the Designer already had

A floor dishwasher is a counter-bearing base-height appliance, not an accessory and not an opening:

- `bearsCountertop()` in `client/src/lib/design.ts` accepts it through `isBaseHeightAppliance()`, so a
  straight run merges its top into one slab and its toe kick, chassis and face are built by
  `InteractiveRoom3D`.
- `shouldRenderCountertopOverSceneItem()` and `ElevationView` already draw a top over it.

The one place it fell out of the cabinet rule was the measured-wall 45-degree miter. The miter evidence
gate (`measuredWallCountertopEndpointCabinet`) filtered for `placement === "base"` only, so an angled
run that **ended on a dishwasher** never produced a miter or a corner infill. The two adjacent tops
stayed untrimmed rotated rectangles that overlapped at the wall vertex — the visible break at the angle.

## What the code now does

`client/src/lib/design.ts`

- `measuredWallCountertopEndpointCabinet()` accepts a base **or** a counter-bearing appliance
  (`isBaseHeightAppliance`) at the run endpoint. The 45-degree join then goes through the same path as
  any cabinet: `measuredWallCountertopMiterSurfaces()` → `miteredMeasuredWallCountertopSurfaces()` →
  one real mitered seam on both slabs, plus the wall-side corner infill that closes the pocket the
  mandatory 11-inch inside-corner holds leave open.
- Nothing else changed: a range, a refrigerator, a tall cabinet and a panel still never carry the top.

`client/src/lib/dishwasherPanelRule.ts` (new)

- `isDishwasherItem()` — a floor dishwasher (code `DW*` or a description that says dishwasher),
  excluding ranges, refrigerators, hoods, wine coolers and microwaves.
- `isDishwasherPanelStock()` / `dishwasherPanelStock()` — the line's own panel stock for this rule:
  `DWR`, a dishwasher panel description, or a `BP` / `BEP` panel board. A refrigerator, wall, or tall
  panel is never substituted. The printed `DWR` family wins; a line with no such panel gets a
  design-check warning, never a `$0` line and never an invented SKU.
- `syncDishwasherPanels()` — places at most one panel per open dishwasher end, keyed
  `auto-dw-panel:<dishwasher uid>:<start|end>`, so a repeat sync returns the same plan by reference:
  - **end of run** — reason `dw-run-end-panel`. The DWR continues the run past the dishwasher's
    finished end, so the top runs over the panel and stops at the finished end of the run exactly as
    it would past a cabinet.
  - **45° turn** — reason `dw-forty-five-turn-panel`. The DWR fills the fitted corner slot at the
    dishwasher's end, inside the 11-inch hold (`insideCornerHoldIn(45, depth)`), which is the same
    pocket the countertop miter and its corner infill close. The top therefore runs continuously over
    the angled dishwasher and the panel.
  - A **90° corner** is a flush corner already closed by the adjoining run, so no panel is added
    unless the dishwasher's side is genuinely open.
  - A side already finished by a user-chosen panel, or a side covered by an adjoining cabinet, is left
    alone. A real obstruction refuses the panel and reports it.

`client/src/pages/DesignTool.tsx`

- The rule runs after the exposed-side pass (so the dishwasher's measured run end is final) and its
  warnings join the existing Design check notice.

## Parameters

`dishwasher_panel_enabled` (default `1`) is the switch in `client/src/lib/kitchenRuleParameters.ts`.
The rule is listed in `client/src/lib/kitchenRulesCatalog.ts` as `owner-dw-panel-run-end` and
`owner-dw-panel-forty-five`, and in `DESIGNER_LAYOUT_RULES` as `dishwasher-panel-run-end-or-turn`
in `client/src/lib/designerLayoutRules.ts`.

## Tests that hold the rule

- `client/src/lib/measuredWallCountertopMiter.test.ts` — a dishwasher at the 45° join produces the
  same two mitred slabs, sharing one exact seam edge, as a base cabinet in its place.
- `client/src/components/design/InteractiveRoom3D.dishwasherCountertop.test.ts` — the 3D scene renders
  the same two mitred slabs over the angled dishwasher as an all-cabinet turn, the finished top is hit
  by a downward ray over the dishwasher and over the seam, and the two slab outlines share vertices.
- `client/src/lib/dishwasherPanelRule.test.ts` — both cases: a DWR at the end of a run and a DWR in the
  fitted 45° corner slot; one panel per dishwasher, idempotent sync, a warning instead of a `$0` line,
  and the panel removed again once the end is closed.
