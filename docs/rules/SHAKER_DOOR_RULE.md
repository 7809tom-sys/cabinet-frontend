# Shaker door rule

HARD RULE (Tom, Nov 1 2026): ALL 2.75 in and 3 in shaker doors start from the DL Shaker blueprint as the base template. Geometry (rail/stile frame, sharp square corners, flat center slab, notch) is proven and must not be changed per style. Only texture/color varies; any applied color must be from the brand palette (cream #fffdf9/#f6f3ed, green #244338, gold #d7a46c), never outside blue/teal/off-brand green. Deviation requires Tom's explicit override.

## What this means in the Designer

The shared builder is `standardShakerDlFacePlan` in `shared/shakerDoorBlueprint.ts`. Every 2.75 inch and 3 inch shaker face goes through it. Slim Shaker, Double Shaker, raised panels, and slabs do not.

Geometry that stays the same for every one of those doors:

- Square rail and stile boxes. The width is that style's own 2.75 or 3 inches. A plain Shaker record with no stored rail uses 3 inches, which is the Designer default.
- Rail depth is the DL frame depth (`DLC_FRAME_DETAIL.railDepth`).
- The center is a flat slab. The catalog door photo is not pasted onto the slab, because those photos carry a frame.
- The notch is the shared four-sided shaker notch. It is not restyled per finish.

Color that is allowed to change:

- The door finish stays that style's own catalog or photo color. It is not replaced with a brand-palette color and not replaced with the DL reference color.
- That color is applied by retinting the matched DL shaker's grain.
- UI tints inside the blueprint module may only be the brand palette listed above.

## DL references

DL Cabinetry has 11 door-style rows (distributor 450001). They are not all shakers.

| DL style | Stored door style | Used as a standard shaker reference? |
| --- | --- | --- |
| White Shaker | Shaker | Yes. Painted reference `white-shaker`. |
| Versa Shaker | Shaker | Yes. Wood reference `versa-shaker`. |
| Slim Shaker Alabaster | Slim Shaker | No. Narrow frame. |
| Slim Shaker Ebony | Slim Shaker | No. Narrow frame. |
| Pearl White | Raised Panel | No. |
| Dark Caramel | Raised Panel | No. |
| European White Oak | Traditional Panel | No. |
| Glacier White | not stored | No. The row does not say shaker. |
| Driftwood | not stored | No. The row does not say shaker. |
| Dove Grey | not stored | No. The row does not say shaker. |
| Cyber Grey | not stored | No. The row does not say shaker. |

Two more standard shakers exist as DLC finish photos and are references even though they are not among those 11 style rows: Grey Shaker (`grey-shaker`, painted) and Espresso Shaker (`expresso-shaker`, wood). The code does not invent a light/medium/dark split. DL does not define those three buckets. Each other 2.75 or 3 inch shaker is matched to the closest of these four by paint-versus-wood and by color distance.

Painted doors inherit a painted reference grain (White Shaker's grain is the pale, near-flat one). Wood doors inherit Versa or Espresso grain. The grain is then tinted toward the style's own color.
