/**
 * The door style every 3D surface reads, with the accepted render merged in.
 *
 * Owner rule: the approved door render is the kitchen's color, ahead of catalog
 * colors and hardcoded swatches. A style row read straight from
 * `doorStyles.list` does not carry that approval — it arrives in the separate
 * `doorStyles.acceptedAppearance` read — so a 3D surface that looks up a raw row
 * falls back to a catalog color, or to a name-keyword swatch such as the linen
 * `#e6dcc6`, even while the selected style bar shows the approved door.
 *
 * `withAcceptedAppearance` is the one merge. Every 3D lookup goes through
 * `designerThreeDAssignments` here so the door fronts, the box, the sides, and
 * the toe kick are all resolved from the same merged row:
 *
 * - the face plan (door/drawer image) is the accepted render's texture;
 * - the finish color is the accepted render's color;
 * - raised vs shaker comes from the same style (`isRaisedPanelStyle`).
 *
 * Nothing here snaps a color to a brand palette. A style with no accepted row is
 * passed through untouched.
 */
import { withAcceptedAppearance, type AcceptedAppearanceRow } from "./acceptedDoorAppearance";
import { effectiveStyleId } from "./design";
import { designerFacePlan, type DesignerFaceStyle } from "./designerFacePlan";
import { designerCatalogDoorProfile } from "./doorStyleAppearance";
import { withFramelessExposedFinish } from "./framelessExposedFinish";
import type { CabinetFacePlan } from "@shared/doorFaceRecognition";
import { isRaisedPanelStyle } from "@shared/raisedPanelDoorBlueprint";

/** A door style row as the Designer holds it: catalog fields plus an id. */
export type DesignerStyleRow = DesignerFaceStyle & { id: number };

/** One style, with an accepted render merged in when one exists for it. */
export type DesignerAcceptedStyle = DesignerStyleRow & {
  renderHex?: string | null;
  approvedReferenceImageUrl?: string | null;
  approvedVersionId?: number | null;
};

export type DesignerThreeDStyleAssignment = {
  uid: string;
  styleId: number | null;
  /** The style row the renderer must read: accepted appearance already merged. */
  style: DesignerAcceptedStyle | null;
  /** Catalog door profile for this cabinet (frameless sheen applied), or null. */
  profile: ReturnType<typeof designerCatalogDoorProfile> | null;
  /** Door/drawer face images for this cabinet, or null when there is no face. */
  facePlan: CabinetFacePlan | null;
  /** True when the merged style is a raised-panel build. */
  raisedPanel: boolean;
};

/** Accepted rows keyed by style id, so a lookup is one read per cabinet. */
export function acceptedAppearanceRowMap(
  rows: readonly AcceptedAppearanceRow[] | null | undefined,
): Map<number, AcceptedAppearanceRow> {
  const map = new Map<number, AcceptedAppearanceRow>();
  for (const row of rows ?? []) {
    if (row?.styleId != null && row.styleId > 0) map.set(row.styleId, row);
  }
  return map;
}

/**
 * Merge one style's accepted appearance, or return the row untouched when
 * nothing was accepted for it. Never invents a color.
 */
export function styleWithAccepted(
  style: DesignerStyleRow | null | undefined,
  acceptedById: ReadonlyMap<number, AcceptedAppearanceRow>,
): DesignerAcceptedStyle | null {
  if (!style) return null;
  const row = acceptedById.get(style.id);
  if (!row) return style as DesignerAcceptedStyle;
  return withAcceptedAppearance(style, row) as DesignerAcceptedStyle;
}

/**
 * Every placed cabinet's style, face plan, and profile, resolved once from the
 * accepted-merged rows. The default style applies where a cabinet has no
 * per-cabinet override (two-tone island, individual finish changes).
 */
export function designerThreeDAssignments(input: {
  placed: readonly { uid: string; styleId?: number | null; placement?: string | null }[];
  defaultStyleId: number | null;
  doorStyles: readonly DesignerStyleRow[] | null | undefined;
  acceptedRows: readonly AcceptedAppearanceRow[] | null | undefined;
}): DesignerThreeDStyleAssignment[] {
  const acceptedById = acceptedAppearanceRowMap(input.acceptedRows);
  const styles = input.doorStyles ?? [];
  return input.placed.map((cabinet) => {
    const styleId = effectiveStyleId(cabinet as { styleId?: number | null }, input.defaultStyleId);
    const style = styleWithAccepted(styles.find((row) => row.id === styleId), acceptedById);
    const profile = style
      ? withFramelessExposedFinish(style, designerCatalogDoorProfile(style))
      : null;
    return {
      uid: cabinet.uid,
      styleId,
      style,
      profile,
      facePlan: style ? designerFacePlan(style, cabinet.placement ?? null) : null,
      raisedPanel: isRaisedPanelStyle(style),
    };
  });
}
