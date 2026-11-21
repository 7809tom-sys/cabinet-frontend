import { isDoorStyleVerified } from "@shared/doorFaceRecognition";

/** A door-style row as the Designer color picker sees it. */
export type ColorStylePickerRow = {
  id: number;
  ourName?: string | null;
  aliasName?: string | null;
  thumbnailImageUrl?: string | null;
  doorSampleImageUrl?: string | null;
  distributorId?: number | null;
  styleCode?: string | null;
  styleVerified?: boolean | number | null;
};

export type ColorStyleChoice = {
  id: number;
  name: string;
};

/**
 * Door styles offered in the Designer toolbar and the 3D color-style picker.
 *
 * The catalog may be scoped to one supply line, and unverified styles are
 * hidden from new picks. The style already selected on the plan (and the
 * design default, and any two-tone slot) must still appear, or the 3D picker
 * shows "No color styles" while the plan is clearly using that finish.
 */
export function uniqueColorStylesForPicker(input: {
  styles: readonly ColorStylePickerRow[];
  selectedStyleIds?: readonly (number | null | undefined)[];
  scopeDistributorId?: number | null;
  nameOf: (style: ColorStylePickerRow) => string;
}): ColorStylePickerRow[] {
  const selected = new Set(
    (input.selectedStyleIds ?? []).filter((id): id is number => typeof id === "number" && id > 0),
  );
  const map = new Map<string, ColorStylePickerRow>();
  for (const style of input.styles) {
    const inScope = input.scopeDistributorId == null || style.distributorId === input.scopeDistributorId;
    const isSelected = selected.has(style.id);
    if (!inScope && !isSelected) continue;
    if (!isDoorStyleVerified(style) && !isSelected) continue;
    const key = `${style.distributorId ?? "_"}::${(input.nameOf(style) || String(style.id)).toLowerCase()}`;
    if (!map.has(key)) map.set(key, style);
  }
  return Array.from(map.values()).sort((a, b) => input.nameOf(a).localeCompare(input.nameOf(b)));
}

/**
 * If a selected plan style is not in the picker list (historic, still loading,
 * or omitted from the catalog list), keep it visible so the 3D control never
 * falls back to "No color styles".
 */
export function ensureSelectedColorStyleChoice(
  choices: readonly ColorStyleChoice[],
  selected: readonly { id: number | null | undefined; name?: string | null }[],
): ColorStyleChoice[] {
  const out = [...choices];
  const seen = new Set(out.map((choice) => choice.id));
  for (const item of selected) {
    if (item.id == null || item.id <= 0 || seen.has(item.id)) continue;
    const name = item.name?.trim() || `Color style ${item.id}`;
    out.push({ id: item.id, name });
    seen.add(item.id);
  }
  return out;
}

/**
 * The 3D door-sample URL for a design or cabinet. Prefer the face plan's door
 * image; if that plan has no URL, use the same finish swatch the 2D plan
 * already resolved. Null only when neither source has an image — the frozen 3D
 * renderer may then paste a catalog product photo on the front.
 */
export function resolvedCatalogDoorSampleUrl(
  facePlanDoorUrl: string | null | undefined,
  finishSwatchUrl: string | null | undefined,
): string | null {
  const face = facePlanDoorUrl?.trim() ?? "";
  if (face) return face;
  const swatch = finishSwatchUrl?.trim() ?? "";
  return swatch || null;
}

/** Per-cabinet 3D door samples, falling back to the design sample when a face has no doorUrl. */
export function cabinetDoorSampleUrlsFromFacePlans(
  faces: readonly (readonly [string, { doorUrl?: string | null }])[],
  fallbackUrl: string | null | undefined,
): Record<string, string> {
  const fallback = fallbackUrl?.trim() ?? "";
  return Object.fromEntries(faces.flatMap(([uid, plan]) => {
    const url = plan.doorUrl?.trim() || fallback;
    return url ? [[uid, url]] : [];
  }));
}
