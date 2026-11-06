# Substituted grain on a shaker door

Tom reported that the Natura maple door looks bad in the 3D Kitchen Designer. Natura
Maple is the Ashford `Designer Natural` row (`door_styles` id 330004, style code `DN`,
color `#D4B896`, a maple stain). It is not a DL Cabinetry finish, and it is not a
painted style.

## What the Designer was drawing

A 2.75/3 inch shaker that is not itself a DL finish is built from the DL Shaker
blueprint (`shared/shakerDoorBlueprint.ts`). Geometry always comes from that
blueprint. For a **stained** door the blueprint also borrows the grain photo of the
closest standard DL wood reference — Versa Shaker (`#c7b695`) or Espresso Shaker — and
tints it toward the door's own color. Natura Maple borrows Versa Shaker's grain.

Two defects in that substitution made the door render `#776d5a` instead of `#D4B896`
(CIEDE2000 26.7):

1. **The tint could not express a brightening.** `retintGrain` measured the multiplier
   in sRGB and clamped each channel at 255. Natura Maple is *lighter* than Versa
   Shaker's grain, so every channel overflowed, the tint clamped to `#ffffff`, and the
   door rendered with no tint at all — at the template's darker tone.
2. **The DL photo light compensation was applied to a photo the door never had.**
   `dlcPhotoLightCompensation` is calibrated against a DL finish's own studio-lit
   photo: it cancels the Designer rig's light sum so that photo reproduces on screen.
   Running it over a borrowed grain darkened the substitution further.

## The rule

- The door's recorded color is the appearance. A substituted grain is tinted to it and
  never stands in for it.
- A borrowed grain carries `grainSubstituted: true` on its face crop. The DL photo
  light compensation applies only when that flag is absent, i.e. only when the finish
  has its own measured photo. A borrowed grain keeps the scene tone map instead.
- The crop ships `tintLinear`, the unclamped multiplier in linear light, because a hex
  cannot express a brightening. The renderer multiplies the grain with that value, so
  the door reaches `#D4B896` exactly.
- The fronts, rails, stiles, drawer fronts, box, sides and toe kick all take the same
  appearance. Skins still layer on top of it; they do not replace it.
- Door and drawer counts still come from the cabinet edit config. Nothing here changes
  geometry.

Real DL finishes are untouched: Versa Shaker, Driftwood, European White Oak and the
rest keep their own photos and their own light compensation.

## Verification

`e2e/natura-door-screenshot.spec.ts` renders one Natura Maple base cabinet through the
real `addCabinet` pipeline. `?before=1` restores the pre-fix appearance. Measured
panel color in that rig:

| | rendered | vs `#D4B896` |
| --- | --- | ---: |
| before | `#776d5a` | ΔE2000 26.7 |
| after | `#b09b7c` | ΔE2000 8.9 |

After the fix the grain face matches a flat `#D4B896` control rendered in the same rig
exactly, so the remaining difference from the hex is the rig's own shading, not the
appearance. Unit coverage lives in `shared/substitutedGrainColour.test.ts` and
`client/src/components/design/InteractiveRoom3D.substitutedGrain.test.ts`.

No TiDB change is needed for this defect. `door_styles` already holds the color the
door renders; if Tom later accepts a render for this style, `doorStyles.acceptedAppearance`
outranks it with no further step.
