# Auto Design corner decision

The door line never picks a default corner cabinet. Auto Design recognizes each true 90° inside corner of the cabineted runs first and reserves the inside-corner square (24 inches along each meeting leg, the standard base depth) before any fill — leftover gaps, “use every inch,” and the 15-rule intake repack included. A plain `B##` base is never placed in that square.

After fixed appliances are seated at their measured positions, the engine chooses the *type* of corner cabinet from appliance proximity and the run math:

- If an appliance, or a required clearance such as the 15-inch refrigerator landing, sits near the corner on either leg, the type is a **blind corner**. A blind corner always carries its 3-inch filler and may be pulled along the longer leg.
- If both legs have room for a two-leg cabinet (the smallest priced lazy Susan or diagonal, or 36 inches when the line has not published one) and would still leave the 15-inch landing beside a nearby appliance, the type is a **diagonal corner**, then a **lazy Susan**.

The engine then picks a source-priced SKU of that type from the selected line. If the line sells none of that type, it tries the next valid type in the order above. If it sells no corner cabinet at all, the square stays blocked and the review finding `corner-cabinet-not-seated` is raised. There is no fallback to a straight base.

A normal or diagonal corner base still gets a diagonal corner upper. A refrigerator stays at the start or end of an L run. The 15-inch fridge-landing minimum is one of the clearances that can force a blind corner.

Vendor blind prefixes `BBC`, `WBC`, `BBL`, `BBR`, `WBL`, `WBR`, `BLB`, and `BCB` (and any code containing `BLIND`) are recognized as true blinds.

See `client/src/lib/autoDesignCornerDecision.ts`.
