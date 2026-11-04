# Raised panel door rule

Tom approved the raised-panel profile the 3D Designer already draws (Nov 4 2026). It is now a reusable library entry instead of one-off code, so any door style whose `doorStyle` or `doorPanelType` is a raised panel uses the same face.

## The entry

`shared/raisedPanelDoorBlueprint.ts` — id `raised-panel-five-piece-bevel`.

Geometry is copied from what the renderer built at that date, not redesigned:

- Square five-piece frame. Rail and stile are the style's own measurement, default 3 in (`RAISED_PANEL_BLUEPRINT.frame`).
- Sloped bevel inside the frame. Width 0.75 in; depth 0.28 in, lifted to 0.45 in when it would read as a slab (`RAISED_PANEL_BLUEPRINT.bevel`, `effectiveRaisedBevelDepthIn`).
- Dark groove between frame opening and slope, 0.18 in (`RAISED_PANEL_BLUEPRINT.groove`).
- Raised center panel on top of the bevel (`RAISED_PANEL_BLUEPRINT.panel`).
- Recessed bed behind the front (`RAISED_PANEL_BLUEPRINT.recess`).
- `raisedPanelFrameGeometry()` is that arithmetic, in scene feet, for one face size.

The Casselberry CW sample (330026) is a five-piece **mitered** frame with a multi-step cove/ogee molding. The renderer does not model either yet, so the entry says so in `RAISED_PANEL_BLUEPRINT.todos` rather than inventing dimensions. The CW row also stores no rail or stile, so those stay on the 3 in default and are listed as a TODO.

## Where it applies

Door and drawer fronts only. `RAISED_PANEL_FRONT_ROLES` is the complete list.

Cabinet sides, tops, bottoms, backs, end panels, end skins, carcasses, face frames, toe kicks, shelves, and interiors are flat finished surfaces. They never get the frame, bevel, or raised center. Two gates enforce it:

- `threeDFaceUsesRaisedPanelBevel` in `client/src/components/design/raisedPanelBevel.ts` returns false for any role other than `door` / `drawer`.
- `attachSlopedRaisedPanel` returns without adding anything when given another role.

An end treatment is separate: it appears only when a cabinet's end-side box is checked (`decorativeEnd` left/right/both), and even an end marked as a door stays a flat panel.

Door and drawer counts come from each cabinet's edit config; the entry never invents a count.

## Which profile wins

`raisedPanelApplicationForStyle` decides:

- The WalzCraft wizard dressed this style (`isWizardSavedDoor`) → `wizard`. The wizard's profile is used and the library entry is not applied.
- A raised style the wizard never saw → `library`. The entry is the default, automatically.
- Not raised → `none`.

`designerCatalogDoorProfile` puts the result on every cabinet's profile as `raisedPanelSource`, next to the resolved geometry.

Any distributor gets this default, not only DL Cabinetry. `shared/doorLibraryProfiles.ts` picks the entry; it contains no distributor check. See `docs/rules/SHAKER_DOOR_RULE.md` for the shared rule.

## Painted finishes

`shared/paintedFinish.ts` says a finish is paint when `finishCategory` is `painted`, or `woodSpecies` / `finish` names paint, HDF, or MDF. For a painted style:

- No door photo, no wood-grain tile, no per-piece grain crop. `grainUrl` is null, following the paint rule in `shakerDoorBlueprint.ts`.
- The face is an opaque solid of `resolveDoorColor(style).appliedHex`. An accepted render is the first source in that resolver.
- The color is never snapped to the brand palette.

Stained wood keeps its grain, tinted toward the door's own color.

## Tests

- `shared/raisedPanelDoorBlueprint.test.ts` — selecting the entry, the front-only role gate, the painted-solid contract, wizard precedence, and the face arithmetic.
- `shared/doorLibraryProfiles.test.ts` — the automatic default for any distributor: shaker without a wizard record, case-insensitive and name-variant matching, the wizard winning when a record exists, and the front-only / painted-solid / no-brand-snap rules.
- `client/src/lib/doorStyleAppearance.raisedPanel.test.ts` — the profile the Designer hands the renderer, including the wizard case.
- `client/src/components/design/InteractiveRoom3D.raisedPanelFronts.test.ts` — meshes the live renderer builds: raised geometry on fronts only, end treatments only when checked, painted fronts solid, stain keeping grain, and no grain stamp on paint.
