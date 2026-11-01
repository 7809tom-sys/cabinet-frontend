// ─── Skin / decorative end-panel matching ──────────────────────────────────
//
// Hard rule: only hickory frameless cabinets get skins. canHaveSkins is the
// only decision. A style code, a saved name such as Forest Rust, or a forced
// flag cannot add a skin on its own.
//
// This module is PURE (no DB / React) so both the server (BOM resolver) and the
// client (Design Tool recommendation) can share one source of truth, and it is
// unit-tested in skinMatch.test.ts.

import { skinsAreNeeded, type SkinEligibilityInput } from "./canHaveSkins";

export type SkinPlacement = "base" | "wall" | "tall" | "island";

/** Which physical end(s) of a placed cabinet are visible / exposed. */
export type ExposedSides = {
  left?: boolean;
  right?: boolean;
  /** A back exposed (peninsula/island) needs a full-depth skin too. */
  back?: boolean;
};

export type SkinRequirement = {
  /** masterCode of the skin product to order (e.g. "WSV-42", "BSV"). */
  skinCode: string;
  /** How many of that skin panel are needed. */
  qty: number;
  /** Human-readable reason for the BOM / order note. */
  reason: string;
};

/**
 * Normalize a raw placement / placementType string into a SkinPlacement.
 * Accepts the DB's loose values ("wall", "accessory/trim", "base", "island", …).
 */
export function normalizeSkinPlacement(raw: string | null | undefined): SkinPlacement {
  const s = (raw || "").toLowerCase();
  if (s.includes("island")) return "island";
  if (s.includes("wall")) return "wall";
  if (s.includes("tall")) return "tall";
  return "base";
}

/**
 * Count how many exposed sides require a skin. (back only counts for
 * island/peninsula placements where the back is actually visible.)
 */
export function countExposedSides(
  exposed: ExposedSides,
  placement: SkinPlacement,
): number {
  let n = 0;
  if (exposed.left) n += 1;
  if (exposed.right) n += 1;
  if (exposed.back && (placement === "island")) n += 1;
  return n;
}

/**
 * Wall skins come in nominal widths (24/30/36/42"). A wall cabinet exposed side
 * is covered by the smallest wall skin whose width is >= the cabinet width.
 * Anything above 42" still uses the 42" panel (cut-to-fit guidance; never down-size).
 */
const WALL_SKIN_WIDTHS = [24, 30, 36, 42] as const;

export function wallSkinCodeForWidth(widthIn: number): string {
  const w = WALL_SKIN_WIDTHS.find((x) => x >= widthIn) ?? 42;
  return `WSV-${w}`;
}

/**
 * Resolve the matching skin product(s) for a single placed cabinet given its
 * placement, exposed sides, and dimensions. Returns one requirement per skin
 * code (qty aggregated). Empty array when nothing is exposed.
 *
 * - wall  -> WSV-{24|30|36|42} sized to the cabinet width, one per exposed side
 * - base  -> BSV (42" base/island skin, cut-to-fit), one per exposed side
 * - tall  -> S-24-96 (24x96 tall skin, cut-to-fit), one per exposed side
 * - island-> FPV-42-96 (full island panel), one per exposed side
 */
export function matchingSkinsForCabinet(args: {
  placement: SkinPlacement;
  exposed: ExposedSides;
  widthIn?: number;
  /** Required. Skins are omitted unless this style is hickory frameless. */
  style?: SkinEligibilityInput;
}): SkinRequirement[] {
  if (!skinsAreNeeded(args.style)) return [];
  const { placement, exposed } = args;
  const widthIn = args.widthIn ?? 0;
  const count = countExposedSides(exposed, placement);
  if (count <= 0) return [];

  let skinCode: string;
  let label: string;
  switch (placement) {
    case "wall":
      skinCode = wallSkinCodeForWidth(widthIn);
      label = "wall skin";
      break;
    case "tall":
      skinCode = "S-24-96";
      label = "tall skin / panel";
      break;
    case "island":
      skinCode = "FPV-42-96";
      label = "full island panel";
      break;
    case "base":
    default:
      skinCode = "BSV";
      label = "base / island skin";
      break;
  }

  const sides: string[] = [];
  if (exposed.left) sides.push("left");
  if (exposed.right) sides.push("right");
  if (exposed.back && placement === "island") sides.push("back");

  return [
    {
      skinCode,
      qty: count,
      reason: `Finish ${count} exposed ${sides.join(" + ")} side${count > 1 ? "s" : ""} with a matching ${label}`,
    },
  ];
}

/**
 * A style code alone is never enough. HS and RH used to force skins; they do
 * not anymore. Pass the style into skinsAreNeeded.
 */
export function requiresMandatorySkin(style: SkinEligibilityInput): boolean {
  return skinsAreNeeded(style);
}

/** True only when the name itself is hickory and frameless. A bare "Forest Rust" is not. */
export function isUnfinishedExteriorStyleName(styleName: string | null | undefined): boolean {
  return skinsAreNeeded({ ourName: styleName });
}

/**
 * Order note for a hickory frameless style only. Returns null for every other
 * style, including when a caller forces the old Hickory name list.
 */
export function unfinishedExteriorSkinNote(style: SkinEligibilityInput | string | null | undefined): string | null {
  const input = typeof style === "string" ? { ourName: style } : style;
  if (!skinsAreNeeded(input)) return null;
  const name = typeof style === "string"
    ? style
    : (style && "ourName" in style ? style.ourName : null) ?? "this style";
  return `FINISH NOTE (${name}): Only hickory frameless ships with skins. Every visible exposed side of this hickory frameless order must be ordered with a matching skin in the same finish, as a separate line item. Confirm exposed sides before production.`;
}
