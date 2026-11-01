import { preferredDoorReferenceUrl, preferredDrawerReferenceUrl } from "@/lib/approvedDoorReference";
import { resolveCabinetFaceImages, type CabinetFacePlan, type DoorStyleFaceInput } from "@shared/doorFaceRecognition";

export type DesignerFaceStyle = DoorStyleFaceInput & { approvedReferenceImageUrl?: string | null };

function trimmedImageUrl(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

/**
 * The image that counts as this style's approved face reference.
 * An explicit approved render wins. Otherwise the uploaded picture shoppers
 * see — the door sample, else the thumbnail — is that reference. Empty strings
 * are ignored. Nothing here rejects a photo for quality or swaps in a bundled
 * texture.
 */
export function designerApprovedFaceUrl(style: DesignerFaceStyle | null | undefined): string | null {
  if (!style) return null;
  const approved = trimmedImageUrl(style.approvedReferenceImageUrl);
  if (approved) return approved;
  const door = trimmedImageUrl(style.doorSampleImageUrl);
  if (door) return door;
  const thumbnail = trimmedImageUrl(style.thumbnailImageUrl);
  return thumbnail || null;
}

/**
 * Face plan for one cabinet.
 *
 * An explicit approved render is the door texture, unchanged.
 * With no explicit render, the uploaded sample is the face. Recognition still
 * applies that sample, including a separate drawer photo, a combined swatch,
 * and a DL Cabinetry finish crop. A style name or a missing approval never
 * substitutes a generic grain texture.
 */
export function designerFacePlan(
  style: DesignerFaceStyle | null | undefined,
  placement: string | null | undefined,
): CabinetFacePlan | null {
  if (!style) return null;
  const explicitApproved = trimmedImageUrl(style.approvedReferenceImageUrl);
  if (!explicitApproved) return resolveCabinetFaceImages(style, placement);

  const doorUrl = preferredDoorReferenceUrl(style);
  const drawerReference = preferredDrawerReferenceUrl(style);
  const wall = (placement ?? "").toLowerCase() === "wall";
  if (drawerReference && doorUrl && drawerReference !== doorUrl) {
    return {
      sourceKind: "split",
      doorUrl,
      drawerUrl: wall ? null : drawerReference,
      sections: wall ? 1 : 2,
      drawerTextureApplied: !wall,
      grainRotation: 0,
    };
  }
  return {
    sourceKind: "legacy-door",
    doorUrl,
    drawerUrl: wall ? null : doorUrl,
    sections: 1,
    drawerTextureApplied: !wall && Boolean(doorUrl),
    grainRotation: 0,
  };
}
