/**
 * Finish -> grain swatch (Tom, Nov 23 2026).
 *
 * A shaker door's finish picks its grain from the frame-free grain images that already ship in
 * the repo (`client/public/textures/dlc-fr26/grain/`, catalog in `dlcFr26Catalog.generated.ts`).
 * Nothing is invented: a finish gets a swatch only when its name is exactly a catalog finish
 * name, or the style is itself a DL Cabinetry finish. Every other finish returns null and keeps
 * the current behavior (`standardShakerDlFacePlan`).
 *
 * The swatch is delivered through the EXISTING `dlcCrop` fields (grainUrl, normalUrl,
 * faceTileIn, tintHex, solidColor), so the 3D renderer and the DesignTool whitelist are
 * unchanged. Painted finishes resolve to the finish's solid paint color (no grain), via the
 * same `withResolvedDoorColor` step every DL face plan uses.
 *
 * Geometry is never decided here: rails, stiles and panel stay the locked DL Shaker blueprint
 * (DL_SHAKER_FIRM_RULE).
 */
import type { DlcFr26CatalogEntry } from "./dlcFr26Catalog.generated";
import { findDlcFinishForStyle, normalizeFinishName, DLC_UNMAPPED_SLUGS } from "./dlcFr26Mapping";
import { DLC_FR26_CATALOG } from "./dlcFr26Catalog.generated";
import { dlcEntryFacePlan, type CabinetFacePlan, type DoorStyleFaceInput } from "./doorFaceRecognition";
import { isHickoryDoor, shakerDoorFamily, type ShakerStyleInput } from "./shakerDoorBlueprint";

/**
 * Finish name (normalized) -> catalog slug. Only catalog finishes with a real frame-free grain
 * and a distinctive finish name are listed. Pecan has no frame-free grain (a 2.74 in patch) and Midnight Cove (MC) is
 * unmapped until Tom confirms it, so neither has a swatch.
 */
export const FINISH_GRAIN_SWATCH_SLUGS: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const entry of DLC_FR26_CATALOG) {
    if (DLC_UNMAPPED_SLUGS.has(entry.slug) || !entry.grainFrameFree) continue;
    // "White Shaker", "Grey Shaker", "Versa Shaker", "Espresso Shaker" and the Slim Shaker
    // finishes are generic door-style names other distributors use too. They stay on the DL
    // Shaker blueprint (shakerFrameUnchangedByWizard.test.ts, PR 209), never name-matched.
    if (/shaker$/.test(entry.slug) || entry.slug.startsWith("slim-shaker")) continue;
    for (const name of entry.names) map.set(normalizeFinishName(name), entry.slug);
  }
  return map;
})();

const BY_SLUG = new Map(DLC_FR26_CATALOG.map((entry) => [entry.slug, entry] as const));

/** The catalog finish whose grain this style's finish uses, or null (no swatch for it). */
export function grainSwatchForFinish(style: ShakerStyleInput & DoorStyleFaceInput & { styleCode?: string | null; distributorId?: number | null }): DlcFr26CatalogEntry | null {
  if (!style) return null;
  if (shakerDoorFamily(style) !== "shaker" || isHickoryDoor(style)) return null;
  const own = findDlcFinishForStyle(style);
  if (own) return own.grainFrameFree ? own : null;
  for (const name of [style.ourName, style.aliasName, style.finish, style.color]) {
    const slug = FINISH_GRAIN_SWATCH_SLUGS.get(normalizeFinishName(name));
    const entry = slug ? BY_SLUG.get(slug) : undefined;
    if (entry) return entry;
  }
  return null;
}

/** Face plan with the finish's grain swatch, or null when the finish has none. */
export function finishGrainSwatchFacePlan(
  style: (ShakerStyleInput & DoorStyleFaceInput & { styleCode?: string | null; distributorId?: number | null }) | null | undefined,
  placement: string | null | undefined,
): CabinetFacePlan | null {
  if (!style) return null;
  const entry = grainSwatchForFinish(style);
  return entry ? dlcEntryFacePlan(entry, style, placement) : null;
}
