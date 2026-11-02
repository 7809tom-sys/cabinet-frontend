/**
 * The 3D Designer picks up a door that was made or saved through the WalzCraft wizard.
 *
 * The wizard and the Designer share this one module; there is no wizard UI in the Designer.
 * The wizard writes what the Designer can already read on a door style record:
 *
 *   doorSampleImageUrl   the uploaded profile image (existing door_styles column)
 *   renderHex            the chosen Sherwin-Williams hex (existing column, PR 225 path)
 *   woodSpecies          the grain name for a stain (existing column)
 *   grainDirection       the grain direction, "none" for paint (existing column)
 *
 * door_styles has no stain-vs-paint column, and the backend is on hold, so the wizard also
 * keeps one small browser record per door with the finish it picked. This module reads it.
 * See "Backend dependency (on hold)" in the PR: the column that would replace the browser
 * record is the only backend piece missing.
 *
 * Fallback rule, and the only place it is decided:
 *   a door with a wizard profile renders that profile; a door without one keeps the image it
 *   already had. Nothing here ever returns an empty face for a door that has an image, and a
 *   generic grain is never substituted.
 */
import type { CabinetFacePlan } from "./doorFaceRecognition";
import { DLC_FR26_CATALOG } from "./dlcFr26Catalog.generated";
import { resolveDoorColor } from "./doorColorResolve";
import { retintGrain } from "./shakerDoorBlueprint";
import { PAINT_FINISH, STAIN_FINISH, type WizardFinish } from "./sherwinWilliamsStain";

export const WIZARD_DOOR_FINISH_STORAGE_KEY = "walzcraftWizardDoorFinish.v1";

/** The finish the wizard applied to one door, kept until a door_styles column can hold it. */
export type WizardDoorFinish = {
  finish: WizardFinish;
  /** Sherwin-Williams code, e.g. `SW7005` or `MW230`. */
  code: string;
  /** Display label, e.g. `SW 7005 Pure White`. */
  label: string;
  hex: string;
  /** Grain name the wizard saved for a stain. Null for paint. */
  woodSpecies: string | null;
  grainDirection: "horizontal" | "vertical" | "none";
  /** Profile image the wizard used, when it uploaded one. */
  profileImageUrl: string | null;
};

type MemoryStorage = Pick<Storage, "getItem">;

const STAIN_GRAIN_SLUGS: Record<string, string> = {
  // The frameless grain names the wizard offers, mapped onto the grain the Designer tiles.
  "grey wood": "grey-shaker",
  "dark wood": "expresso-shaker",
  "light wood": "versa-shaker",
};

function trimmed(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  return text.length > 0 ? text : null;
}

/** The grain the Designer tiles for a stain, from the grain name the wizard saved. */
export function stainGrainSlug(woodSpecies: string | null | undefined): string {
  const key = (woodSpecies ?? "").trim().toLowerCase();
  return STAIN_GRAIN_SLUGS[key] ?? "versa-shaker";
}

export function readWizardDoorFinish(styleId: number | string | null | undefined, storage: MemoryStorage | undefined = globalThis.localStorage): WizardDoorFinish | null {
  if (styleId == null || !storage) return null;
  try {
    const all = JSON.parse(storage.getItem(WIZARD_DOOR_FINISH_STORAGE_KEY) ?? "{}");
    if (!all || typeof all !== "object" || Array.isArray(all)) return null;
    const record = (all as Record<string, Partial<WizardDoorFinish>>)[String(styleId)];
    if (!record) return null;
    if (record.finish !== STAIN_FINISH && record.finish !== PAINT_FINISH) return null;
    if (!/^#[0-9a-f]{6}$/i.test(record.hex ?? "")) return null;
    return {
      finish: record.finish,
      code: typeof record.code === "string" ? record.code : "",
      label: typeof record.label === "string" ? record.label : "",
      hex: record.hex!.toLowerCase(),
      woodSpecies: record.woodSpecies ?? null,
      grainDirection: record.grainDirection === "horizontal" || record.grainDirection === "vertical" ? record.grainDirection : "none",
      profileImageUrl: record.profileImageUrl ?? null,
    };
  } catch {
    return null;
  }
}

export type DesignerDoorInput = {
  id?: number | null;
  doorSampleImageUrl?: string | null;
  thumbnailImageUrl?: string | null;
  renderHex?: string | null;
  woodSpecies?: string | null;
  grainDirection?: string | null;
  finishCategory?: WizardFinish | null;
  profileImageUrl?: string | null;
};

/** Stores the finish one door carries, keyed by door style id. Browser-only for now. */
export function writeWizardDoorFinish(styleId: number | string, finish: WizardDoorFinish, storage: Pick<Storage, "getItem" | "setItem"> | undefined = globalThis.localStorage): WizardDoorFinish {
  if (storage) {
    try {
      const all = JSON.parse(storage.getItem(WIZARD_DOOR_FINISH_STORAGE_KEY) ?? "{}");
      const map = all && typeof all === "object" && !Array.isArray(all) ? all as Record<string, WizardDoorFinish> : {};
      map[String(styleId)] = finish;
      storage.setItem(WIZARD_DOOR_FINISH_STORAGE_KEY, JSON.stringify(map));
    } catch {
      /* A full or blocked store leaves the door with its saved fields, which still render. */
    }
  }
  return finish;
}

/** Everything the Designer has for a wizard door, or null when this door never went through it. */
export type WizardDoorPickup = {
  finish: WizardFinish;
  hex: string;
  grainName: string | null;
  grainDirection: "horizontal" | "vertical" | "none";
  /** The wizard's profile image, the door's own sample, or null. */
  imageUrl: string | null;
  source: "browser-finish" | "saved-fields";
};

/**
 * What the wizard left on this door, or null.
 *
 * A door that never went through the wizard returns null, which is what keeps its existing
 * image untouched by this module.
 */
export function wizardDoorPickup(style: DesignerDoorInput | null | undefined, storage?: MemoryStorage): WizardDoorPickup | null {
  if (!style) return null;
  const stored = readWizardDoorFinish(style.id ?? null, storage);
  const savedHex = trimmed(style.renderHex);
  const savedGrain = trimmed(style.woodSpecies);
  const savedDirection = style.grainDirection === "horizontal" || style.grainDirection === "vertical" ? style.grainDirection : null;
  const image = trimmed(style.profileImageUrl) ?? trimmed(style.doorSampleImageUrl) ?? trimmed(style.thumbnailImageUrl);

  if (stored) {
    return {
      finish: stored.finish,
      hex: savedHex ?? stored.hex,
      grainName: stored.woodSpecies ?? savedGrain,
      grainDirection: savedDirection ?? stored.grainDirection,
      imageUrl: stored.profileImageUrl ?? image,
      source: "browser-finish",
    };
  }
  // A finish category on the door is authoritative once door_styles can hold one.
  if (style.finishCategory && savedHex) {
    return {
      finish: style.finishCategory,
      hex: savedHex,
      grainName: savedGrain,
      grainDirection: savedDirection ?? (savedGrain ? "vertical" : "none"),
      imageUrl: image,
      source: "saved-fields",
    };
  }
  // The PR 225 save on its own: a hand-set hex, a grain species, and a grain direction.
  // Those three together are a stain the wizard saved; nothing else writes all three.
  if (savedHex && savedGrain && savedDirection) {
    return { finish: STAIN_FINISH, hex: savedHex, grainName: savedGrain, grainDirection: savedDirection, imageUrl: image, source: "saved-fields" };
  }
  return null;
}

/** True when this door carries a finish the wizard applied. */
export function isWizardSavedDoor(style: DesignerDoorInput | null | undefined, storage?: MemoryStorage): boolean {
  return wizardDoorPickup(style, storage) !== null;
}

/**
 * Face plan for a wizard door, or null when this door never went through the wizard. * `designerFacePlan` calls this first and otherwise behaves exactly as before.
 */
export function wizardDoorFacePlan(style: DesignerDoorInput | null | undefined, placement: string | null | undefined, storage?: MemoryStorage): CabinetFacePlan | null {
  const pickup = wizardDoorPickup(style, storage);
  if (!pickup) return null;
  const wall = (placement ?? "").toLowerCase() === "wall";
  const decision = resolveDoorColor(style);
  const hex = pickup.hex || decision.appliedHex;

  if (pickup.finish === PAINT_FINISH) {
    // Opaque solid of the published chip, with the profile image supplying the door shape.
    return {
      sourceKind: "split",
      doorUrl: pickup.imageUrl,
      drawerUrl: wall ? null : pickup.imageUrl,
      sections: wall ? 1 : 2,
      drawerTextureApplied: !wall && Boolean(pickup.imageUrl),
      grainRotation: 0,
      dlcCrop: {
        slug: "wizard-paint",
        doorSize: [12, 24],
        drawerSize: wall ? null : [12, 7.5],
        drawerSolidColor: null,
        solidColor: hex,
        grainUrl: null,
        faceTileIn: [12, 24],
        faceTileDrawerIn: [12, 7.5],
        normalUrl: null,
        tintHex: null,
      },
    };
  }
  // Stain: the grain stays and is tinted toward the chosen hex.
  const grain = DLC_FR26_CATALOG.find((entry) => entry.slug === stainGrainSlug(pickup.grainName)) ?? DLC_FR26_CATALOG[0];
  const grainUrl = grain?.grainFrameFree ? grain.grain : null;
  const tint = grain ? retintGrain(grain.solidColor, hex) : null;
  // Horizontal grain runs across the face, so the tile's two sides swap.
  const tile: [number, number] | undefined = grain
    ? pickup.grainDirection === "horizontal" ? [grain.faceTileIn[1], grain.faceTileIn[0]] : grain.faceTileIn
    : undefined;
  return grain
    ? {
      sourceKind: "split",
      doorUrl: grain.faceDoor,
      drawerUrl: wall ? null : grain.faceDrawer,
      sections: wall ? 1 : 2,
      drawerTextureApplied: !wall,
      grainRotation: 0,
      dlcCrop: {
        slug: grain.slug,
        doorSize: grain.doorSize,
        drawerSize: grain.drawerSize,
        drawerSolidColor: null,
        solidColor: hex,
        grainUrl,
        faceTileIn: tile,
        faceTileDrawerIn: grain.faceTileDrawerIn,
        normalUrl: grain.faceNormal,
        tintHex: tint && !tint.clamped ? tint.tintHex : null,
      },
    }
    // No grain photo in the data: the door keeps its own image rather than showing a blank face.
    : {
      sourceKind: "split",
      doorUrl: pickup.imageUrl,
      drawerUrl: wall ? null : pickup.imageUrl,
      sections: wall ? 1 : 2,
      drawerTextureApplied: Boolean(pickup.imageUrl),
      grainRotation: 0,
    };
}
