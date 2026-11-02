# Shaker door rule

HARD RULE (Tom, Nov 1 2026): ALL 2.75 in and 3 in shaker doors start from the DL Shaker blueprint as the base template. Geometry (rail/stile frame, sharp square corners, flat center slab, notch) is proven and must not be changed per style. Only texture/color varies. The door's own color paints the surface (saved render hex, then catalog color hex, then the color name). It is not replaced by the nearest brand swatch.

## What this means in the Designer

The shared builder is `standardShakerDlFacePlan` in `shared/shakerDoorBlueprint.ts`. Every 2.75 inch and 3 inch shaker face goes through it. Slim Shaker, Double Shaker, raised panels, slabs, and a door front labeled five-piece slab do not. Hickory (Hickory Shaker, Rustic Hickory / Forest Rust) keeps its own wood-grain photo. The shaker frame and notch still build; the blueprint does not replace that photo with a DL grain tile or a brand-palette tint.

Closet fronts shorter or narrower than 7 inches stay a plain slab in the door color, because two 2.75 inch rails do not leave a center. Kitchen and vanity drawer fronts keep the shaker frame and notch.

Geometry that stays the same for every one of those doors:

- Square rail and stile boxes. The width is that style's own 2.75 or 3 inches. A plain Shaker record with no stored rail uses 3 inches, which is the Designer default.
- Rail depth is the DL frame depth (`DLC_FRAME_DETAIL.railDepth`).
- The center is a flat slab. The catalog door photo is not pasted onto the slab, because those photos carry a frame.
- The notch is the shared four-sided shaker notch. It is not restyled per finish.

Color on the door surface:

- The color that paints the door is the style's own color. A saved render hex wins, then a catalog color hex, then the color name.
- That color is not snapped to a brand swatch. The Nov 2 correction: snapping every shaker to sample cream `#dedac6`, cream `#fffdf9` / `#f6f3ed`, green `#244338`, or gold `#d7a46c` replaced real door colors and is what made the Designer color wrong.
- Those swatches remain choices an admin can save as the render hex. Saving one is how that swatch becomes the door color.
- The style's own color still picks the closest DL reference grain. Painted colors use the pale painted grain so the tint can reach the color. Wood is only when the style says it is wood.
- The DL grain is retinted toward the door's own color.
- `shared/shakerDoorBlueprint.test.ts` fails if a 2.75/3 inch shaker bypasses the blueprint or if the painted color is not the door's own color.

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

Painted doors inherit a painted reference grain (White Shaker's grain is the pale, near-flat one). Wood doors inherit Versa or Espresso grain. The grain is then tinted toward the door's own color.
