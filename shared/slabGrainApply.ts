/**
 * Put a repeating wood-grain tile and a color on a slab door.
 * The catalog photo is not cropped. Used by the door-editor wizard for
 * frameless slabs such as White Pine and Grey Wood.
 */
import { DLC_FR26_CATALOG } from "./dlcFr26Catalog.generated";
import type { CabinetFacePlan } from "./doorFaceRecognition";
import { resolveDoorColor, type DoorColorInput } from "./doorColorResolve";
import { retintGrain } from "./shakerDoorBlueprint";

export const SLAB_GRAIN_STORAGE_KEY = "walzcraftSlabGrain.v1";

export const SLAB_GRAIN_OPTIONS = [
  { id: "versa-shaker", label: "Light wood" },
  { id: "expresso-shaker", label: "Dark wood" },
  { id: "grey-shaker", label: "Grey wood" },
] as const;

export type SlabGrainId = (typeof SLAB_GRAIN_OPTIONS)[number]["id"];

export type SlabGrainChoice = {
  grainId: SlabGrainId;
  /** Chosen paint/stain hex. Empty means the grain's own color, with no tint. */
  hex: string | null;
};

type MemoryStorage = Pick<Storage, "getItem" | "setItem">;

function exactHex(value: string | null | undefined): string | null {
  const match = /^#([0-9a-f]{6})$/i.exec((value ?? "").trim());
  return match ? `#${match[1]!.toLowerCase()}` : null;
}

export function isSlabDoor(style: { doorStyle?: string | null; ourName?: string | null; aliasName?: string | null; styleCode?: string | null } | null | undefined): boolean {
  const text = `${style?.doorStyle ?? ""} ${style?.ourName ?? ""} ${style?.aliasName ?? ""} ${style?.styleCode ?? ""}`.toLowerCase();
  if (/\bslab\b/.test(text)) return true;
  return /\b(?:white pine|grey wood|gray wood|dark wood)\b/.test(text) || /^(?:twp|tgw|tdw)$/.test((style?.styleCode ?? "").trim().toLowerCase());
}

export function slabGrainColorPlan(style: DoorColorInput, choice: SlabGrainChoice): CabinetFacePlan {
  const entry = DLC_FR26_CATALOG.find((item) => item.slug === choice.grainId);
  if (!entry) throw new Error(`Unknown slab grain ${choice.grainId}`);
  const chosen = exactHex(choice.hex);
  const own = chosen ?? exactHex(resolveDoorColor(style).appliedHex);
  const tint = own && own !== entry.solidColor.toLowerCase() ? retintGrain(entry.solidColor, own) : null;
  return {
    sourceKind: "split",
    doorUrl: entry.grainFrameFree ? entry.grain : entry.faceDoor,
    drawerUrl: entry.faceDrawer,
    sections: 2,
    drawerTextureApplied: true,
    grainRotation: 0,
    dlcCrop: {
      slug: entry.slug,
      doorSize: entry.doorSize,
      drawerSize: entry.drawerSize,
      drawerSolidColor: null,
      solidColor: own ?? entry.solidColor.toLowerCase(),
      grainUrl: entry.grainFrameFree ? entry.grain : null,
      faceTileIn: entry.faceTileIn,
      faceTileDrawerIn: entry.faceTileDrawerIn,
      normalUrl: entry.faceNormal,
      tintHex: tint && !tint.clamped ? tint.tintHex : null,
    },
  };
}

function readMap(storage: MemoryStorage | undefined): Record<string, SlabGrainChoice> {
  try {
    const parsed = JSON.parse(storage?.getItem(SLAB_GRAIN_STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeSlabGrainChoice(styleId: number | string, choice: SlabGrainChoice | null, storage: MemoryStorage | undefined = globalThis.localStorage) {
  const all = readMap(storage);
  if (choice) all[String(styleId)] = choice;
  else delete all[String(styleId)];
  storage?.setItem(SLAB_GRAIN_STORAGE_KEY, JSON.stringify(all));
  return all;
}

export function readSlabGrainChoice(styleId: number | string | null | undefined, storage: MemoryStorage | undefined = globalThis.localStorage): SlabGrainChoice | null {
  if (styleId == null) return null;
  const choice = readMap(storage)[String(styleId)];
  if (!choice || !SLAB_GRAIN_OPTIONS.some((option) => option.id === choice.grainId)) return null;
  return { grainId: choice.grainId, hex: exactHex(choice.hex) };
}

/** Browser-only. No saved choice means the door keeps its current face. */
export function appliedSlabGrainPlan(style: (DoorColorInput & { id?: number | null }) | null | undefined): CabinetFacePlan | null {
  if (!style?.id || typeof globalThis.localStorage === "undefined") return null;
  const choice = readSlabGrainChoice(style.id);
  if (!choice) return null;
  return slabGrainColorPlan(style, choice);
}
