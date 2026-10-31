/**
 * Designer-facing door appearance. Profile rules live in
 * `@shared/doorStyleAppearance`. Finish color uses the same keyword table as
 * the elevation and the swatches (`finishColors`), then the Aspen Charcoal
 * stain overrides that table so a color *name* never reaches WebGL.
 */
import { doorPanelKind, finishColors, type DoorPanelKind, type FinishColors } from "@/lib/design";
import { designerDoorFrameMetrics } from "@/lib/doorFrameMetrics";
import {
  ASPEN_CHARCOAL_STAIN,
  exactDoorFinishHex,
  isAspenCharcoal,
  resolveDoorProfile,
  type DoorStyleAppearanceInput,
  type ResolvedDoorProfile,
} from "@shared/doorStyleAppearance";
import { resolveRenderHex } from "@shared/doorRenderIdentity";
import { findDlcFinishForStyle } from "@shared/dlcFr26Mapping";

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
 * Always a #rrggbb. Hex catalog values win. Aspen Charcoal is a stained birch,
 * not the light gray left behind when "Espresso Brown" is ignored. Every other
 * style uses the Designer keyword table, including styles whose color column
 * is empty — those used to fall back to a light gray slab.
 */
export function resolveDoorFinishHex(style: DoorStyleAppearanceInput | null | undefined): string {
  const identity = identityOf(style);
  const override = exactDoorFinishHex(identity.renderHex);
  if (override) return override;
  // A DL style that maps to a DLC_FR26 finish: sides, ends and skins take the colour of the door
  // the shopper sees (median of the processed door crop), not a keyword guess or a stale hex.
  const dlc = findDlcFinishForStyle(identity as Parameters<typeof findDlcFinishForStyle>[0]);
  if (dlc) return dlc.solidColor;
  const supplied = exactDoorFinishHex(identity.color);
  if (supplied) return supplied;
  if (isAspenCharcoal(identity)) return ASPEN_CHARCOAL_STAIN;
  const named = resolveRenderHex(identity);
  if (named) return named;
  return finishColors(
    identity.ourName,
    identity.name,
    identity.color,
    identity.finish,
    identity.woodSpecies,
  ).face;
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
 */
export function designerCatalogDoorProfile(style: DoorStyleAppearanceInput | null | undefined): ResolvedDoorProfile | null {
  if (!style) return null;
  const frame = designerDoorFrameMetrics(style);
  const appearance = resolveDoorStyleAppearance({
    ...style,
    railWidth: frame?.railWidth ?? style.railWidth ?? style.doorProfile?.railWidth ?? null,
    stileWidth: frame?.stileWidth ?? style.stileWidth ?? style.doorProfile?.stileWidth ?? null,
  });
  return appearance.profile;
}
