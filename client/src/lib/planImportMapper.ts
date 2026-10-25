import type { DesignCabinet, Placement, WallSide } from "@/lib/design";

export type InterpretedPlanCabinet = {
  label: string;
  cabinetType: string;
  widthInches: number;
  wall: string;
  confidence: number;
};

export type PlanCabinetMatch = {
  cabinet: DesignCabinet;
  placement: Placement;
  wall: WallSide;
};

const WALL_ALIASES: Array<[RegExp, WallSide]> = [
  [/\b(back|rear|north|top)\b/i, "top"],
  [/\b(front|south|bottom)\b/i, "bottom"],
  [/\b(left|west)\b/i, "left"],
  [/\b(right|east)\b/i, "right"],
];

const APPLIANCE_TERMS = ["range", "stove", "refrigerator", "fridge", "dishwasher", "microwave", "hood", "sink"];
const TALL_TERMS = ["tall", "pantry", "oven cabinet", "utility"];
const WALL_TERMS = ["wall", "upper", "uppers", "hanging"];
const BASE_TERMS = ["base", "lower", "vanity", "sink", "drawer", "blind", "corner"];

function normalizedText(item: Pick<InterpretedPlanCabinet, "label" | "cabinetType">) {
  return `${item.cabinetType} ${item.label}`.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

export function placementForInterpretedCabinet(item: Pick<InterpretedPlanCabinet, "label" | "cabinetType">): Placement {
  const text = normalizedText(item);
  if (text.includes("sink base")) return "base";
  if (includesAny(text, APPLIANCE_TERMS)) return "appliance";
  if (includesAny(text, TALL_TERMS)) return "tall";
  if (includesAny(text, WALL_TERMS)) return "wall";
  if (includesAny(text, BASE_TERMS)) return "base";
  return "base";
}

export function wallSideForInterpretedCabinet(wall?: string | null): WallSide {
  const value = wall ?? "";
  for (const [pattern, side] of WALL_ALIASES) {
    if (pattern.test(value)) return side;
  }
  return "top";
}

function semanticMatchScore(planText: string, candidate: DesignCabinet): number {
  const candidateText = `${candidate.masterCode} ${candidate.description} ${candidate.category ?? ""} ${candidate.subCategory ?? ""}`.toLowerCase();
  const terms = ["sink", "drawer", "pantry", "corner", "blind", "vanity", "oven", "range", "fridge", "refrigerator", "dishwasher", "microwave", "hood"];
  return terms.reduce((score, term) => {
    const requested = planText.includes(term);
    const offered = candidateText.includes(term);
    if (requested && offered) return score + 100;
    if (requested !== offered) return score - 100;
    return score;
  }, 0);
}

/**
 * Finds the best available purchasable cabinet for a readable plan note. The
 * cabinet type has priority over a close-but-wrong width; width then breaks
 * ties within the appropriate catalog category.
 */
export function findClosestPlanCabinet(
  item: InterpretedPlanCabinet,
  catalog: DesignCabinet[],
): PlanCabinetMatch | null {
  const placement = placementForInterpretedCabinet(item);
  const candidates = catalog.filter((cabinet) => cabinet.placement === placement);
  if (candidates.length === 0) return null;

  const requestedWidth = Number(item.widthInches);
  const planText = normalizedText(item);
  const sorted = [...candidates].sort((a, b) => {
    const semanticDiff = semanticMatchScore(planText, b) - semanticMatchScore(planText, a);
    if (semanticDiff !== 0) return semanticDiff;

    const aWidth = Number(a.width) || Number.POSITIVE_INFINITY;
    const bWidth = Number(b.width) || Number.POSITIVE_INFINITY;
    const aDistance = requestedWidth > 0 ? Math.abs(aWidth - requestedWidth) : 0;
    const bDistance = requestedWidth > 0 ? Math.abs(bWidth - requestedWidth) : 0;
    if (aDistance !== bDistance) return aDistance - bDistance;
    return aWidth - bWidth || a.description.localeCompare(b.description);
  });

  const cabinet = sorted[0];
  return cabinet ? { cabinet, placement, wall: wallSideForInterpretedCabinet(item.wall) } : null;
}
