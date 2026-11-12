import { preferredDoorReferenceUrl, preferredDrawerReferenceUrl } from "@/lib/approvedDoorReference";
import { resolveCabinetFaceImages, type CabinetFacePlan, type DoorStyleFaceInput } from "@shared/doorFaceRecognition";
import { findDlcFinishForStyle } from "@shared/dlcFr26Mapping";
import { resolveDoorColor } from "@shared/doorColorResolve";
import { standardShakerDlFacePlan } from "@shared/shakerDoorBlueprint";
import { appliedSlabGrainPlan } from "@shared/slabGrainApply";
import { WIZARD_DOOR_FINISH_STORAGE_KEY, wizardDoorFacePlan, type WizardDoorFinish } from "@shared/walzcraftDesignerPickup";
import {
  effectiveDoorColorSource,
  readDoorColorSourceSelection,
  styleForDoorColorSource,
  type DoorColorSourceSelection,
} from "@shared/doorColorSourceSelection";
import { PAINT_FINISH } from "@shared/sherwinWilliamsStain";

export type DesignerFaceStyle = DoorStyleFaceInput & {
  approvedReferenceImageUrl?: string | null;
  approvedVersionId?: number | null;
  id?: number | null;
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
  if (effective.source === "original-image") return resolveCabinetFaceImages(photoStyle, placement);
  if (effective.source === "approved-ai-image") {
    return acceptedRenderFacePlan(style, placement) ?? resolveCabinetFaceImages(photoStyle, placement);
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
  // An explicit, confirmed door color source choice wins (one selector, Tom Nov 12 2026).
  const selection = readDoorColorSourceSelection(style.id ?? null);
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
