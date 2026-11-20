import { preferredDoorReferenceUrl, preferredDrawerReferenceUrl } from "@/lib/approvedDoorReference";
import { resolveCabinetFaceImages, type CabinetFacePlan, type DoorStyleFaceInput } from "@shared/doorFaceRecognition";
import { findDlcFinishForStyle } from "@shared/dlcFr26Mapping";
import { resolveDoorColor } from "@shared/doorColorResolve";
import { standardShakerDlFacePlan } from "@shared/shakerDoorBlueprint";
import { appliedSlabGrainPlan } from "@shared/slabGrainApply";
import { WIZARD_DOOR_FINISH_STORAGE_KEY, wizardDoorFacePlan, type WizardDoorFinish } from "@shared/walzcraftDesignerPickup";
import {
  effectiveDoorColorSource,
  selectionForStyle,
  styleForDoorColorSource,
  type DoorColorSourceSelection,
} from "@shared/doorColorSourceSelection";
import { PAINT_FINISH } from "@shared/sherwinWilliamsStain";
import { withCheckedDoorImage } from "@/lib/acceptedDoorAppearance";

export type DesignerFaceStyle = DoorStyleFaceInput & {
  approvedReferenceImageUrl?: string | null;
  approvedVersionId?: number | null;
  /** The official AI (Gemini) profile picture saved in the editor (0281). */
  aiProfileImageUrl?: string | null;
  id?: number | null;
  doorColorSource?: string | null;
  doorColorSourceValue?: unknown;
  doorColorSourceUpdatedAt?: string | Date | null;
  doorColorSourceSelection?: unknown;
  checkedDoorSource?: "uploaded-sample" | "ai-image" | "hex" | "sherwin-williams" | null;
  uploadedSampleHex?: string | null;
  aiImageHex?: string | null;
};

function trimmedImageUrl(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

/**
 * The accepted render as a face plan: the signed-off texture on the door, and the
 * color derived from that render. Null unless a run was actually accepted, so a
 * photo that merely sits on the style cannot claim to be an accepted appearance.
 *
 * A wall cabinet shows one door and no drawer, matching the other plans.
 */
export function acceptedRenderFacePlan(
  style: DesignerFaceStyle | null | undefined,
  placement: string | null | undefined,
): CabinetFacePlan | null {
  if (!style || style.approvedVersionId == null) return null;
  const textureUrl = trimmedImageUrl(style.approvedReferenceImageUrl);
  if (!textureUrl) return null;
  const decision = resolveDoorColor({ ...style, approvedVersionId: style.approvedVersionId });
  const wall = (placement ?? "").toLowerCase() === "wall";
  return {
    sourceKind: "legacy-door",
    doorUrl: textureUrl,
    drawerUrl: wall ? null : textureUrl,
    sections: 1,
    drawerTextureApplied: !wall,
    grainRotation: 0,
    acceptedColorHex: decision.appliedHex,
  } as CabinetFacePlan;
}

/**
 * A saved Gemini picture (the official AI profile picture) as a face plan. The
 * picture itself is the door face, and the AI image's own color (sampled from it,
 * or the render hex PR 475 sampled when it was chosen) rides with it, so no other
 * layer recolors the cabinet around it.
 */
export function savedAiPictureFacePlan(
  style: DesignerFaceStyle | null | undefined,
  placement: string | null | undefined,
): CabinetFacePlan | null {
  const textureUrl = trimmedImageUrl(style?.aiProfileImageUrl);
  if (!style || !textureUrl) return null;
  const wall = (placement ?? "").toLowerCase() === "wall";
  return {
    sourceKind: "legacy-door",
    doorUrl: textureUrl,
    drawerUrl: wall ? null : textureUrl,
    sections: 1,
    drawerTextureApplied: !wall,
    grainRotation: 0,
    acceptedColorHex: style.aiImageHex ?? null,
  } as CabinetFacePlan;
}

/**
 * The uploaded sample photo itself as the face, for a checkmarked "Original image"
 * (Tom, Nov 20 2026: the checkmarked image is used as-is). Its sampled color rides
 * with it. Null when the style has no sample photo.
 */
export function uploadedSamplePhotoFacePlan(
  style: DesignerFaceStyle | null | undefined,
  placement: string | null | undefined,
): CabinetFacePlan | null {
  const door = trimmedImageUrl(style?.doorSampleImageUrl) || trimmedImageUrl(style?.thumbnailImageUrl);
  if (!style || !door) return null;
  const drawer = trimmedImageUrl(style.drawerSampleImageUrl);
  const wall = (placement ?? "").toLowerCase() === "wall";
  const split = Boolean(drawer && drawer !== door);
  return {
    sourceKind: split ? "split" : "legacy-door",
    doorUrl: door,
    drawerUrl: wall ? null : split ? drawer : door,
    sections: wall || !split ? 1 : 2,
    drawerTextureApplied: !wall,
    grainRotation: 0,
    acceptedColorHex: style.uploadedSampleHex ?? null,
  } as CabinetFacePlan;
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

/** A one-door read-only store holding a finish record, for reusing the wizard's face plan. */
function singleFinishStorage(styleId: number | string, finish: WizardDoorFinish): Pick<Storage, "getItem"> {
  const value = JSON.stringify({ [String(styleId)]: finish });
  return { getItem: (key: string) => (key === WIZARD_DOOR_FINISH_STORAGE_KEY ? value : null) };
}

/**
 * Face plan for an explicit door color source choice (the one selector in the door
 * editor; docs/rules/DOOR_COLOR_SOURCE_RULE.md). The explicit choice wins over every
 * automatic layer:
 *
 *   original-image     the style's own door and drawer images, with a typed render hex
 *                      and any accepted run removed so neither overrides the photo.
 *   approved-ai-image  the accepted render; with none accepted, the supplier photo.
 *   sherwin-williams   the confirmed chip through the wizard's own paint / stain plan.
 *   hex                the confirmed hex as an opaque paint through the same plan.
 *
 * It only picks a source. It never starts or changes AI image generation.
 */
export function selectedDoorColorFacePlan(
  style: DesignerFaceStyle,
  placement: string | null | undefined,
  selection: DoorColorSourceSelection,
): CabinetFacePlan | null {
  const effective = effectiveDoorColorSource(selection, style);
  const photoStyle = styleForDoorColorSource(style, { source: "original-image", chosenAt: selection.chosenAt });
  if (effective.source === "original-image") {
    const photo = resolveCabinetFaceImages(photoStyle, placement);
    // A real DL finish keeps its own frame-free grain (tinted to the sample's color by
    // the resolver). Any other style whose plan came back without an image (a
    // substitute solid or grain) shows the checkmarked sample photo itself.
    if (photo.doorUrl && !photo.dlcCrop) return photo;
    if (findDlcFinishForStyle(style)) return photo;
    return uploadedSamplePhotoFacePlan(photoStyle, placement) ?? photo;
  }
  if (effective.source === "approved-ai-image") {
    // A checkmarked AI choice whose only picture is the accepted render of the
    // uploaded sample shows that photo (acceptedRenderFacePlan below).
    // The checkmarked tile shows the saved Gemini picture first (aiTilePicture), so
    // that picture is the face; an older accepted render must not replace it.
    return savedAiPictureFacePlan(style, placement)
      ?? acceptedRenderFacePlan(style, placement)
      ?? resolveCabinetFaceImages(photoStyle, placement);
  }
  const key = style.id ?? "selected";
  const finish: WizardDoorFinish | null = selection.source === "sherwin-williams"
    ? { ...selection.color }
    : selection.source === "hex"
      ? { finish: PAINT_FINISH, code: "", label: selection.hex, hex: selection.hex, woodSpecies: null, grainDirection: "none", profileImageUrl: null }
      : null;
  if (!finish) return resolveCabinetFaceImages(photoStyle, placement);
  const colored = styleForDoorColorSource({ ...style, id: style.id ?? null }, selection);
  return wizardDoorFacePlan({ ...colored, id: key as number }, placement, singleFinishStorage(key, finish))
    ?? resolveCabinetFaceImages(photoStyle, placement);
}

/**
 * Face plan for one cabinet.
 *
 * An explicit door color source choice (Original image, Approved AI image, a
 * confirmed Sherwin-Williams chip or a confirmed Hex) is resolved first and wins.
 * With nothing chosen, the order below is unchanged.
 *
 * A door the WalzCraft wizard made or saved is resolved first, by the wizard's own
 * shared module; the Designer shows it without any wizard UI.
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
  // The checkmarked source and the door images' own colors ride on the style, so
  // every color read below (grain tint, paint solid, accepted color) follows them.
  style = withCheckedDoorImage(style as never) as DesignerFaceStyle;
  // An explicit, confirmed door color source choice wins (one selector, Tom Nov 12 2026).
  // The server value is the source of truth for every shopper; localStorage is a fallback/cache.
  const selection = selectionForStyle(style);
  if (selection) {
    const chosen = selectedDoorColorFacePlan(style, placement, selection);
    if (chosen) return chosen;
  }
  // A door made or saved through the WalzCraft wizard renders its own profile, grain and
  // color. A door the wizard never touched returns null here and takes the normal path.
  const wizard = wizardDoorFacePlan(style, placement);
  if (wizard) return wizard;
  // Tom's accepted render is the source of truth for the door's appearance: its
  // texture and its derived color. It outranks the DL blueprint, a slab grain, and
  // any catalog photo, because it is the appearance an operator signed off on.
  const accepted = acceptedRenderFacePlan(style, placement);
  if (accepted) return accepted;
  const slabGrain = appliedSlabGrainPlan(style);
  if (slabGrain) return slabGrain;
  // A real DL finish keeps its own grain and color. Other 2.75/3 inch shakers
  // still use that blueprint, and do not paint a framed catalog photo on the slab.
  if (findDlcFinishForStyle(style)) return resolveCabinetFaceImages(style, placement);
  const adopted = standardShakerDlFacePlan(style, placement);
  if (adopted) return adopted;
  // Door color rule (Tom, Nov 11 2026, docs/rules/DOOR_COLOR_SOURCE_RULE.md): the
  // saved library entries are never an automatic COLOR override. A shaker or raised
  // style with no wizard record keeps the library SHAPE (rails, stiles, panel, bevel),
  // which the door profile carries (`designerCatalogDoorProfile`), but its face and
  // color come from the style's own door image below, not from a library solid.
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
