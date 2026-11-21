# Shaker door rule

## Platform default starter style (Tom, voice, Nov 21 2026, 1:54 PM CT)

DL Shaker is the default starter door style and blueprint for every distributor. It is one constant, `PLATFORM_DEFAULT_DOOR_STYLE` in `shared/platformDoorDefaults.ts` (door style type `Shaker`, drawn by `dlShakerDoorBox`). The approved styles offered alongside it are listed in `PLATFORM_APPROVED_DOOR_STYLES`: DL Raised Panel, DL Slim Shaker, and Slab.

- New records start on DL Shaker. The admin New Door Style dialog opens with type `Shaker`, and the vendor sample-measurement sheet starts on `Shaker`. The Door Box Blueprint screen leads with DL Shaker and links the other approved styles.
- Existing records are not rewritten. A saved door style always wins (`starterDoorStyleFor`). A style saved blank stays blank until someone picks one. The door editors show the default as a hint and give one-click choices.
- No database default and no SQL. Distributor signup creates no door-style or blueprint rows, so the UI falls back to this constant.

## FIRM RULE (Tom, voice, Nov 21 2026, 11:59 AM CT): every shaker door uses the DL shaker style

Whenever a shaker door is chosen or rendered, it uses the DL shaker style: the DL Shaker blueprint below (square rail and stile frame, flat center slab, shared notch, the door's own color). This cannot be skipped.

- Stated in code as `DL_SHAKER_FIRM_RULE` in `shared/shakerDoorBlueprint.ts` and enforced by `matchStandardShakerToDl` / `standardShakerDlFacePlan`.
- There is no non-DL shaker fallback. A plain shaker whose stored rail width is not 2.75 or 3 inches used to drop to a non-DL catalog photo. It now gets the DL shaker face too, keeping its own stored rail width.
- Kept exceptions, all set earlier by Tom: a WalzCraft wizard record for the style wins; Slim Shaker and Double Shaker keep their own frames; hickory keeps its own catalog door photo; a front under 7 inches tall or wide renders as a plain slab; a slab or glass build is never a shaker, and a five-piece slab stays a five-piece slab.
- Pinned by `shared/dlShakerFirmRule.test.ts`. Listed in Kitchen Rules as `owner-shaker-always-dl`.
- Admins can see the DL shaker door box (rails, stiles, center panel, dimensions) and the canonical slab door reference under Admin → Products & Catalog → Door styles → **Door Box Blueprint** (`/admin?tab=door-box-blueprint`). Geometry: `shared/doorBoxBlueprint.ts`.

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

## Visible edges on every painted shaker front (Tom, Nov 18 2026, 10:02 PM CT)

This overrides two earlier decisions: the Nov 1 rule that soft inner-frame edges render on Driftwood only (`DLC_FRAME_STRIP_FINISHES` in `shared/dlcFr26Textures.ts`), and the earlier removal of door-front outlines.

- Every painted or solid-color shaker front in the 3D Designer (door and drawer front, any distributor, any picked Sherwin-Williams or hex color) gets one merged edge outline: the outer rectangle plus the opening rectangle of the frame. Raised panels, glass frames and photo faces are unchanged.
- Driftwood keeps its own soft shadow and highlight strips as well.
- The outline is `attachShakerFrameOutline` in `client/src/lib/shakerFrameOutline.ts`, called from one line in `addShakerFrame` (`InteractiveRoom3D.tsx`). It is a single `LineSegments` per frame (one draw call), drawn as its own paint-derived color (darker than the paint, lighter on a very dark paint) with the tone map off. It owns its geometry and material, so the Designer's `disposeObject` frees it on every rebuild; nothing is cached or shared.
- Phones (`threeDRenderQualityProfile` tier `mobile`) draw the opening edge only and fainter. The Designer has a "Door edges" on/off toggle (remembered in the browser) that hides or shows built outlines without a rebuild.
- The door audit and the four-source cabinet preview use `outlineEdges` from the same module.
