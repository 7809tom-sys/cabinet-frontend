import { aefFramelessSpec, isAefFramelessStyleCode } from "@shared/aefFramelessSpecs";
import { exactDoorFinishHex, type DoorFinishSheen } from "@shared/doorStyleAppearance";

const SHEENS = ["satin", "matte", "gloss"] as const;

export type FramelessExposedFinishStyle = {
  styleCode?: string | null;
  ourName?: string | null;
  aliasName?: string | null;
  color?: string | null;
  renderHex?: string | null;
  finishSheen?: string | null;
};

/**
 * Luxe / Zenit / Syncron / Torino store the style code in `color` ("LSA") and
 * leave `renderHex` empty. The door photograph is the finish. A real hex is an
 * explicit color and keeps the solid side finish used by every other line.
 */
export function framelessExposedSidesMatchDoorFace(
  style: FramelessExposedFinishStyle | null | undefined,
): boolean {
  if (!style) return false;
  if (!isAefFramelessStyleCode(style.styleCode)) return false;
  if (exactDoorFinishHex(style.renderHex) || exactDoorFinishHex(style.color)) return false;
  return true;
}

/** Catalog sheen wins. AltaEuro spec sheen fills a blank column (Luxe is gloss). */
export function framelessDoorFinishSheen(
  style: FramelessExposedFinishStyle | null | undefined,
): DoorFinishSheen | null {
  const stored = (style?.finishSheen ?? "").trim().toLowerCase();
  if ((SHEENS as readonly string[]).includes(stored)) return stored as DoorFinishSheen;
  if (!style || !isAefFramelessStyleCode(style.styleCode)) return null;
  return aefFramelessSpec(style.styleCode ?? "")?.finishSheen ?? null;
}

export function withFramelessExposedFinish<T extends { finishSheen?: DoorFinishSheen | string | null }>(
  style: FramelessExposedFinishStyle | null | undefined,
  profile: T | null,
): (T & { finishSheen: DoorFinishSheen | null; exposedSidesMatchDoorFace: boolean }) | null {
  if (!profile) return null;
  const stored = (profile.finishSheen ?? "").toString().trim().toLowerCase();
  const finishSheen = (SHEENS as readonly string[]).includes(stored)
    ? stored as DoorFinishSheen
    : framelessDoorFinishSheen(style);
  return {
    ...profile,
    finishSheen,
    exposedSidesMatchDoorFace: framelessExposedSidesMatchDoorFace(style),
  };
}
