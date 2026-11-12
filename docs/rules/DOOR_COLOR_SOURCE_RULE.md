# Door color source rule

HARD RULE (Tom, Nov 11 2026, 4:31 PM CT, by phone). Shipped with the partial revert of #240.

1. Door color comes from the door image first.
2. If the image color match is not approved, fall back to the hex deck or the Gemini image maker for approval.
3. A saved library color is used ONLY when someone explicitly selects it. It is never an automatic override.
4. If nobody picks a library color, it is removed and the color is taken from the image.

## Shape versus color

The saved door library entries (`shared/doorLibraryProfiles.ts`) carry two different things, and this rule treats them differently:

- **Shape stays automatic.** A shaker or raised-panel style with no WalzCraft wizard record still gets the library's door shape and profile attributes (rails, stiles, panel, bevel, no notches) on its door and drawer fronts. That reaches the renderer through the door profile (`designerCatalogDoorProfile` in `client/src/lib/doorStyleAppearance.ts`, `raisedPanelApplicationForStyle`, `shakerDoorFamily`). `shared/doorLibraryProfiles.ts`, `shared/shakerDoorBlueprint.ts`, `shared/raisedPanelDoorBlueprint.ts`, `shared/doorProfileIdentity.ts` and the library entries are unchanged.
- **Color is never automatic.** The face plan (`designerFacePlan` in `client/src/lib/designerFacePlan.ts` and `resolveCabinetFaceImages` in `shared/doorFaceRecognition.ts`) no longer calls `libraryDoorFacePlan`, so the library's flat solid color is not put on a door ahead of the style's own image. A style that is not a DL finish and not taken by the 2.75/3 in shaker blueprint now falls through to its own door (and drawer) image.

## Order the face plan follows

1. A WalzCraft wizard record (an explicit pick in the door editor).
2. An accepted render (approved image and its derived color).
3. A slab grain the editor applied.
4. A real DL finish's own photo crops.
5. The 2.75/3 in shaker blueprint (`standardShakerDlFacePlan`, unchanged by this revert).
6. The style's own door and drawer images.

## Tests

- `shared/doorColorSourceRule.test.ts`: raised-panel styles keep the library shape but take their face from the vendor image; base cabinets keep a separate drawer image (two-drawer bases), walls show none; the shaker blueprint path is unchanged.
- `shared/doorLibraryProfiles.test.ts`: the library entries and wizard precedence, updated so the raised-panel case asserts shape, not color.
