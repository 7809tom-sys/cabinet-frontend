/**
 * Designer-facing door appearance. Profile rules live in
 * `@shared/doorStyleAppearance`. Finish color uses the door-color precedence
 * (render hex, swatch table, WalzCraft shade, estimator, pre-209 color).
 */
import { doorPanelKind, type DoorPanelKind } from "@/lib/doorPanelKind";
import { finishColors, type FinishColors } from "@/lib/design";
import { designerDoorFrameMetrics } from "@/lib/doorFrameMetrics";
import {
  isAspenCharcoal,
  resolveDoorProfile,
  type DoorStyleAppearanceInput,
  type ResolvedDoorProfile,
} from "@shared/doorStyleAppearance";
import { resolveDoorColor } from "@shared/doorColorResolve";
import { isPaintedFinish } from "@shared/paintedFinish";
import { isSolidSlabFace } from "@shared/solidSlabFace";
import { raisedPanelApplicationForStyle } from "@shared/raisedPanelDoorBlueprint";
import { isWizardSavedDoor } from "@shared/walzcraftDesignerPickup";

export {
  ASPEN_CHARCOAL_STAIN,
  ASPEN_RAISED_EDGE,
  RAISED_PANEL_BEVEL_DEPTH_IN,
  RAISED_PANEL_BEVEL_WIDTH_IN,
  isAspenCharcoal,
  isSkylineAspenRaised,
  isSkylineDistributor,
} from "@shared/doorStyleAppearance";

export type DoorStyleAppearance = {
  finishHex: string;
  stainedWood: boolean;
  profile: ResolvedDoorProfile;
};

function identityOf(style: DoorStyleAppearanceInput | null | undefined): DoorStyleAppearanceInput {
  return { ...(style ?? {}), ...(style?.doorProfile ?? {}) };
}

/**
 * Always a #rrggbb. A hand-set render hex wins, then the measured swatch,
 * then a WalzCraft shade, then the estimator, then the pre-209 color.
 */
export function resolveDoorFinishHex(style: DoorStyleAppearanceInput | null | undefined): string {
  const identity = identityOf(style);
  // Same precedence as the door face: render hex, swatch table, WalzCraft shade,
  // estimator, then the pre-209 color. A DL catalog solid is that pre-209 color
  // when no higher layer agrees. It is not a brand snap.
  return resolveDoorColor(identity).appliedHex;
}

export function resolveDoorStyleAppearance(style: DoorStyleAppearanceInput | null | undefined): DoorStyleAppearance {
  const identity = identityOf(style);
  const profile = resolveDoorProfile(identity);
  return {
    finishHex: resolveDoorFinishHex(identity),
    stainedWood: isAspenCharcoal(identity),
    profile,
  };
}

/** Elevation panel treatment. Aspen White is stored as "Shaker" but builds as raised. */
export function resolveDoorProfilePanelKind(style: DoorStyleAppearanceInput | null | undefined): DoorPanelKind {
  if (!style) return doorPanelKind(null);
  const profile = resolveDoorStyleAppearance(style).profile;
  return doorPanelKind(profile.doorStyle ?? style.ourName ?? style.name);
}

/** Elevation / canvas finish, with the resolved hex when the keyword table is not enough. */
export function doorStyleFinishColors(style: DoorStyleAppearanceInput | null | undefined): FinishColors {
  const identity = identityOf(style);
  const base = finishColors(identity.ourName, identity.name, identity.color, identity.finish, identity.woodSpecies);
  const hex = resolveDoorFinishHex(identity);
  if (hex.toLowerCase() === base.face.toLowerCase()) return base;
  return finishColors(hex);
}

/**
 * Profile passed into the 3D Designer. Rail and stile stay on the verified
 * frame measurement; bevel, edge, and raised-panel family come from the mapping.
 *
 * Two facts ride along for the renderer:
 * - `paintedFinish`: the style states paint / HDF / MDF, so its fronts are solid.
 * - `raisedPanelSource`: "library" when the raised-panel entry in
 *   `shared/raisedPanelDoorBlueprint.ts` is the default profile (a raised style the
 *   WalzCraft wizard never dressed), "wizard" when the wizard's profile wins.
 */
export function designerCatalogDoorProfile(
  style: DoorStyleAppearanceInput | null | undefined,
  options: { wizardProfile?: boolean } = {},
): DesignerCatalogDoorProfile | null {
  if (!style) return null;
  const frame = designerDoorFrameMetrics(style);
  const appearance = resolveDoorStyleAppearance({
    ...style,
    railWidth: frame?.railWidth ?? style.railWidth ?? style.doorProfile?.railWidth ?? null,
    stileWidth: frame?.stileWidth ?? style.stileWidth ?? style.doorProfile?.stileWidth ?? null,
  });
  // A profile the WalzCraft wizard saved for this style wins over the library entry.
  const wizardProfile = options.wizardProfile ?? isWizardSavedDoor(style as never);
  const raisedPanel = raisedPanelApplicationForStyle(style, { wizardProfile });
  return {
    ...appearance.profile,
    // A slab in a solid colour is flat too, even when nobody wrote "paint" in the
    // finish text (Tom, Nov 14 2026: "most is a slab door with a solid color").
    paintedFinish: isPaintedFinish(style) || isSolidSlabFace(style as never),
    raisedPanelSource: raisedPanel.source,
  };
}

export type DesignerCatalogDoorProfile = ResolvedDoorProfile & {
  paintedFinish: boolean;
  raisedPanelSource: "wizard" | "library" | "none";
};
