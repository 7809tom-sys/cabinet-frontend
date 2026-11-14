/**
 * Corner cabinet choice for the measured build.
 *
 * Wherever the layout has a real corner, the homeowner picks the corner cabinet
 * themselves: first the TYPE, then the SIZE. The list comes from what the
 * selected line actually sells — a line with no diagonal upper never offers a
 * diagonal upper — and nothing is assumed or defaulted. The build waits for the
 * pick.
 *
 * Labels are written for a homeowner, not a cabinetmaker: "Lazy Susan corner",
 * "Angled corner", "Blind corner" — never a bare SKU, and never error text.
 */
import { isWallBlindCornerCabinet } from "./cabinetGraphics";
import type { AutoBuildCornerCandidate } from "./autoDesignCornerStage";
import type { DesignCabinet } from "./design";
import { kitchenRuleText } from "./kitchenRuleParameters";

/** The corner families a homeowner can be offered. */
export type CornerType =
  | "lazy-susan"
  | "diagonal"
  | "blind"
  | "angled-l"
  | "corner-drawer";

/** Plain labels, and one plain sentence on what the type is. */
export const CORNER_TYPE_COPY: Record<CornerType, { label: string; help: string }> = {
  "lazy-susan": {
    label: "Lazy Susan corner",
    help: "Round shelves that turn, in the corner itself. The easiest corner to reach into.",
  },
  diagonal: {
    label: "Angled corner",
    help: "A flat, angled door across the corner. Uses the corner itself and keeps the counters continuous.",
  },
  blind: {
    label: "Blind corner",
    help: "One door you can reach, with the far half of the corner tucked behind it. Uses the least space in the run.",
  },
  "angled-l": {
    label: "Two-door corner",
    help: "Two doors meeting at the corner, one on each wall.",
  },
  "corner-drawer": {
    label: "Corner drawers",
    help: "Drawers built across the corner, one stack on each side.",
  },
};

export type CornerChoiceOption = {
  id: number;
  masterCode: string;
  /** Plain size, e.g. "33 in wide". Never a bare SKU. */
  sizeLabel: string;
  widthIn: number;
  type: CornerType;
  /** The row the build places. */
  candidate: AutoBuildCornerCandidate;
};

export type CornerChoiceGroup = {
  type: CornerType;
  label: string;
  help: string;
  /** Sizes the line sells for this type, narrow to wide. */
  options: CornerChoiceOption[];
};

const CORNER_TYPE_ORDER: CornerType[] = ["lazy-susan", "diagonal", "blind", "angled-l", "corner-drawer"];

/**
 * The corner preference order the admin saved, filtered to real corner types.
 * A type the admin typed that the Designer does not know is dropped rather than
 * breaking the list, and a list with nothing usable keeps the code default.
 */
export function cornerTypeOrder(): CornerType[] {
  const configured = kitchenRuleText("corner_preference_order")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry): entry is CornerType => (CORNER_TYPE_ORDER as readonly string[]).includes(entry));
  const unique = [...new Set(configured)];
  return unique.length ? unique : [...CORNER_TYPE_ORDER];
}

function numericWidth(value: string | number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0;
}

/**
 * The type of one catalog corner row, from the drawing rules and the code, the
 * same way the rest of the Designer classifies corners.
 */
export function cornerTypeOf(candidate: AutoBuildCornerCandidate): CornerType {
  const code = (candidate.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const text = `${candidate.description ?? ""} ${candidate.subCategory ?? ""}`.toLowerCase();
  const stored = (candidate.cornerType ?? "").toLowerCase();
  if (stored === "lazy-susan" || stored === "easy-reach" || /^(?:LSB|LS|ERB|BER|LSUSAN)/.test(code) || /lazy\s*susan|easy\s*reach/.test(text)) {
    return "lazy-susan";
  }
  if (stored === "diagonal" || stored === "pie-cut" || /^(?:DCB|DCW|WDC|AG)/.test(code) || /diagonal|angled corner|pie\s*cut/.test(text)) {
    return "diagonal";
  }
  if (stored === "corner-drawer" || /^CDB/.test(code) || /corner drawer/.test(text)) return "corner-drawer";
  if (isWallBlindCornerCabinet(candidate) || stored === "blind-corner" || /^(?:BBC|WBC|BBL|BBR|WBL|WBR|BLB|BCB)/.test(code) || /blind\s*corner/.test(text)) {
    return "blind";
  }
  // An L-shaped corner with a door on each wall.
  return "angled-l";
}

/** Plain size text for a corner row, in inches. */
export function cornerSizeLabel(widthIn: number): string {
  if (!(widthIn > 0)) return "Size not published";
  const rounded = Math.round(widthIn * 8) / 8;
  const whole = Math.floor(rounded);
  const fraction = rounded - whole;
  const text = Math.abs(fraction - 0.5) < 0.01 ? `${whole}½` : Math.abs(fraction) < 0.01 ? `${whole}` : `${rounded}`;
  return `${text} in wide`;
}

/**
 * Every corner choice the selected line actually sells, grouped by type in a
 * fixed order, narrow to wide inside each type. An empty list means the line
 * sells no corner cabinet at all, which the pop-up says plainly.
 */
export function cornerChoiceGroups(
  options: readonly AutoBuildCornerCandidate[],
): CornerChoiceGroup[] {
  const groups = new Map<CornerType, CornerChoiceOption[]>();
  const seen = new Set<string>();
  for (const candidate of options) {
    const widthIn = numericWidth(candidate.width);
    if (!(widthIn > 0)) continue;
    const type = cornerTypeOf(candidate);
    const key = `${type}|${candidate.masterCode}|${widthIn}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const list = groups.get(type) ?? [];
    list.push({
      id: candidate.id,
      masterCode: candidate.masterCode,
      sizeLabel: cornerSizeLabel(widthIn),
      widthIn,
      type,
      candidate,
    });
    groups.set(type, list);
  }
  return cornerTypeOrder().flatMap((type) => {
    const list = groups.get(type);
    if (!list?.length) return [];
    return [{
      type,
      label: CORNER_TYPE_COPY[type].label,
      help: CORNER_TYPE_COPY[type].help,
      options: [...list].sort((left, right) => left.widthIn - right.widthIn || left.masterCode.localeCompare(right.masterCode)),
    }];
  });
}

/**
 * True when the corner cabinet this line sells is the same one on the wall side
 * as on the base side. The pop-up asks once for a shared corner and once for
 * each layer otherwise, so a diagonal upper is offered even where the base
 * corner is a blind box.
 */
export function cornerChoiceLayer(input: {
  placement: string | null | undefined;
}): "base" | "wall" | "tall" {
  const placement = (input.placement ?? "").toLowerCase();
  if (placement === "wall") return "wall";
  if (placement === "tall") return "tall";
  return "base";
}

/** Corner rows only: a straight box is never a corner choice. */
export function isCornerChoiceCandidate(
  candidate: DesignCabinet & { isCornerCabinet?: boolean | null; cornerType?: string | null },
): boolean {
  if (candidate.isCornerCabinet === true) return true;
  if (candidate.cornerType) return true;
  const code = (candidate.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^(?:LSB|LS|ERB|BER|DCB|DCW|WDC|BBC|WBC|BBL|BBR|WBL|WBR|BLB|BCB|CDB|AG)/.test(code);
}

/**
 * Every corner cabinet row of one layer (base, wall, or tall) that the selected
 * line actually sells.
 *
 * `autoBuildCornerCatalog` is base-only on purpose: it answers "which corner
 * boxes may the measured base run use". The pop-up has to ask about the UPPER
 * corners too, and a line's diagonal upper is a different product from its
 * diagonal base, so this filter keeps the requested layer and drops straight
 * boxes, end-return corners, and anything with no width.
 */
export function cornerCatalogForLayer(
  catalog: readonly (DesignCabinet & { placement?: string | null })[],
  layer: "base" | "wall" | "tall",
): (DesignCabinet & { isCornerCabinet?: boolean | null; cornerType?: string | null })[] {
  return catalog
    .filter((row) => row && row.placement === layer && isCornerChoiceCandidate(row))
    .sort((left, right) => numericWidth(right.width) - numericWidth(left.width));
}
