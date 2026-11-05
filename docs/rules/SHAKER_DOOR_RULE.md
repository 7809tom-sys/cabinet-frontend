# Shaker door rule

HARD RULE (Tom, Nov 1 2026): ALL 2.75 in and 3 in shaker doors start from the DL Shaker blueprint as the base template. Geometry (rail/stile frame, sharp square corners, flat center slab, notch) is proven and must not be changed per style. Only texture/color varies. The door's own color paints the surface. It is not replaced by the nearest brand swatch.

## What this means in the Designer

The shared builder is `standardShakerDlFacePlan` in `shared/shakerDoorBlueprint.ts`. Every 2.75 inch and 3 inch shaker face goes through it. Slim Shaker, Double Shaker, raised panels, and slabs do not.

## Any distributor, not only DL (Tom, Nov 4 2026)

The shaker blueprint is the automatic default for **every** distributor and account, not just DL Cabinetry. `shared/doorLibraryProfiles.ts` decides it, and nothing in that file reads a distributor id or a `DL-` style code.

- A style whose construction says shaker gets the shaker library entry (`dl-shaker-frame`). A style whose construction says raised panel gets `raised-panel-five-piece-bevel` from `shared/raisedPanelDoorBlueprint.ts`. The two are exclusive: a "Traditional Shaker" is a shaker, not a raised panel.
- Matching is case-insensitive, so `Shaker`, `shaker`, `SHAKER`, and `sHaKeR` are the same style.
- The construction fields (`doorStyle`, `doorPanelType`, profile notes) decide first. Only when they never mention a family does the style's own name decide, so `Shaker Honey` with a blank `doorStyle` is a shaker. A name never overrules an explicit slab or glass build.
- A WalzCraft wizard record for the style still wins. The wizard lives only in the door editor; nothing here shows wizard UI, and `wizardDoorFacePlan` runs before the library lookup.
- Slim Shaker and Double Shaker keep their own frames and are not the 2.75/3 inch entry. Hickory keeps its own catalog photo rather than a substituted grain.

`findDlcFinishForStyle` and `DL_DISTRIBUTOR_ID` still exist, but they only decide whether DL's own photo crops are available. They never gated this default.

Geometry that stays the same for every one of those doors:

- Square rail and stile boxes. The width is that style's own 2.75 or 3 inches. A plain Shaker record with no stored rail uses 3 inches, which is the Designer default.
- Rail depth is the DL frame depth (`DLC_FRAME_DETAIL.railDepth`).
- The center is a flat slab. The catalog door photo is not pasted onto the slab, because those photos carry a frame.
- The notch is the shared four-sided shaker notch. It is not restyled per finish.

Color on the door surface:

- Precedence, highest first: the latest **accepted render** from `doorStyles.acceptedAppearance` (its texture and the color derived from it), a hand-set render hex, the style's own saved catalog color, the measured swatch table from cabinet-backend PR 72 (`data/door-colors/swatch-hex.json`), a WalzCraft ColorPatterns primary shade (`data/door-colors/ColorPatterns_*.csv`, matched by distributor plus code or door name), a name or DL-photo estimate, then the pre-209 color (DL finish solid, otherwise catalog hex, then the name table).
- **A nearest paint-chip match is never a door's color.** The Shaker Honey row of the swatch table (`#c8a040`) was a nearest paint match, not a measurement, and it painted the door flat gold with no grain. That row is marked `demoted` in `swatch-hex.json` and is never applied. When the accepted-appearance endpoint is not deployed yet it answers NOT_FOUND, and the door falls back to `PRE_PAINT_MATCH_ORIGINALS` in `shared/doorColorResolve.ts` — for Shaker Honey `#d1ba8f`, the name table's honey tone — never to `#c8a040`.
- That color is not snapped to sample cream `#dedac6`, cream `#fffdf9` / `#f6f3ed`, green `#244338`, or gold `#d7a46c`. Those swatches are what the old nearest-match used. `brandDoorSurfaceHex` still names that old snap and is not applied.
- An independent estimator concurs after the pick. Agreement needs CIEDE2000 at most 10, the same paint-versus-stain category, and the same hue family. A disagreement keeps the pre-209 color and flags the door (`needsColorReview`). An accepted render, a hand-set render hex, and a saved catalog color still win, and are flagged rather than replaced.
- Paint renders as an opaque solid of that hex. Stain keeps the grain and a tint toward the hex.
- `shared/shakerDoorBlueprint.test.ts` and `shared/doorColorResolve.test.ts` fail if a 2.75/3 inch shaker bypasses the blueprint or if Stone Gray `#8d8f92` or Slate Rift `#555553` is replaced by brand green or cream.

## The same row drives every 3D surface (Nov 5 2026)

The color above is not only the door front's. `client/src/lib/designerThreeDStyles.ts` is the one place the Designer resolves a placed cabinet's style for the 3D view, and it merges the accepted render before anything reads it.

- `designerThreeDAssignments` returns, per placed cabinet, the accepted-merged style, its catalog door profile (frameless sheen applied), and its door/drawer face plan. `threeDCabinetDoorProfiles`, `threeDCabinetFaces`, the elevation face plan, the panel-kind map, the color trace, and the island cabinet all read it.
- Raised vs shaker comes from `isRaisedPanelStyle` on that same merged row, so an approved raised style is never drawn as a shaker.
- A 3D surface must never read a raw `doorStyles.find(...)`. The approval arrives in the separate `doorStyles.acceptedAppearance` read, so a raw row falls back to a catalog color or to a name-keyword swatch — the linen bucket `#e6dcc6` — while the selected style bar shows the approved door. Carbon Frost (Preston / Skyline `AC`, approved `#34363a`) was the case that exposed it.
- `client/src/lib/designerThreeDStyles.test.ts` holds the precedence, the no-linen rule, the two-tone override, and the designer wiring. `client/src/components/design/InteractiveRoom3D.acceptedColorSurfaces.test.ts` reads the materials actually built for a cabinet: box, sides, and toe kick (which goes through `threeDStructuralFinish`) all carry the approved hex.

## DL references

DL Cabinetry has 11 door-style rows (distributor 450001). They are not all shakers.

Two more standard shakers exist as DLC finish photos and are references even though they are not among those 11 style rows: Grey Shaker (`grey-shaker`, painted) and Espresso Shaker (`expresso-shaker`, wood). The code does not invent a light/medium/dark split. DL does not define those three buckets. Each other 2.75 or 3 inch shaker is matched to the closest of these four by paint-versus-stain and by color distance.

Painted doors inherit a painted reference only as a template id. The face itself is the opaque hex. Wood doors inherit Versa or Espresso grain. The grain is then tinted toward the door's own color.
