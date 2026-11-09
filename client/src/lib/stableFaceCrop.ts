import { useMemo } from "react";
import type { DlcFaceCrop } from "@shared/dlcFr26Textures";

/** The 3D face crop fields the room scene reads from a face plan's DLC crop. */
export function faceCropFromPlanCrop(crop: DlcFaceCrop | null | undefined): DlcFaceCrop | null {
  if (!crop) return null;
  return {
    slug: crop.slug,
    doorSize: crop.doorSize,
    drawerSize: crop.drawerSize,
    drawerSolidColor: crop.drawerSolidColor,
    solidColor: crop.solidColor,
    grainUrl: crop.grainUrl,
    faceTileIn: crop.faceTileIn,
    faceTileDrawerIn: crop.faceTileDrawerIn,
    normalUrl: crop.normalUrl,
    tintHex: crop.tintHex,
    tintLinear: crop.tintLinear,
    grainSubstituted: crop.grainSubstituted,
  };
}

/**
 * The same crop object for as long as its values are unchanged. The room
 * scene rebuilds whenever `catalogFaceCrop` changes identity, so a crop rebuilt
 * from an equal style on every render would rebuild the whole 3D scene.
 */
export function useStableFaceCrop(crop: DlcFaceCrop | null | undefined): DlcFaceCrop | null {
  const next = faceCropFromPlanCrop(crop);
  const key = next ? JSON.stringify(next) : "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => next, [key]);
}
