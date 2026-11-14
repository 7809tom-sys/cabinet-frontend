/**
 * Auto Design finish picks from the intake ("What the customer wants").
 *
 * Tom, Nov 14 2026: every option picked in the Auto Design form must be placed
 * for real. Glass-door uppers and crown molding used to reach the plan only as
 * "not placed automatically" review lines. These helpers apply them with the
 * selected line's own catalog rows; a review line appears only when the line
 * lacks the SKU. Nothing here invents a SKU or a price.
 */
import { hasPreference, type AutoDesignIntake } from "./autoDesignFifteenRules";
import type { DesignerReviewFinding } from "./designerReviewFindings";
import { dim, isFillerItem, isGlassDoorCabinet, isPanelItem, type DesignCabinet, type PlacedCabinet } from "./design";

const HEIGHT_MATCH_IN = 0.5;
/**
 * The Designer's glass upgrade (the same one the "Glass door" button uses):
 * the plan keeps the solid catalog row and sets `glassDoor`, and the cart, the
 * price lookup and the 3D view order and draw the line's own `${code}GD` row.
 * So only a box whose GD row this line actually sells may be switched.
 */
const GLASS_SUFFIXES = ["GD"] as const;

function normalizedCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** The line's own GD catalog row for this solid-door wall cabinet, if it sells one. */
export function glassVariantRow(item: Pick<PlacedCabinet, "masterCode" | "width" | "height">, wallCatalog: readonly DesignCabinet[]): DesignCabinet | null {
  const base = normalizedCode(item.masterCode);
  for (const suffix of GLASS_SUFFIXES) {
    const row = wallCatalog.find((candidate) => candidate.id > 0 && candidate.placement === "wall"
      && normalizedCode(candidate.masterCode) === `${base}${suffix}`
      && Math.abs(dim(candidate.width, 0) - (Number(item.width) || 0)) <= 0.05
      && Math.abs(dim(candidate.height, 0) - (Number(item.height) || 0)) <= HEIGHT_MATCH_IN);
    if (row) return row;
  }
  return null;
}

/**
 * Glass cabinets above: every ordinary wall cabinet at the design height whose
 * line sells the same box as a GD row (W2430 -> W2430GD) gets the glass door,
 * so the plan, the 3D view and the cart all carry the real GD SKU and price. Shorter bridges and refrigerator caps, fillers and panels keep
 * their solid doors. A successful swap adds no review line; a width the line
 * does not sell in glass is named in one warning.
 */
export function applyGlassUpperPreference(input: {
  placed: readonly PlacedCabinet[];
  wallCatalog: readonly DesignCabinet[];
  intake: AutoDesignIntake | null | undefined;
  /** The real catalog height the upper run used (for example 30.25 for a 30" class). */
  wallHeightIn: number | null;
}): { placed: PlacedCabinet[]; switched: number; findings: DesignerReviewFinding[] } {
  const placed = [...input.placed];
  if (!hasPreference(input.intake, "glass-uppers")) return { placed, switched: 0, findings: [] };
  const height = input.wallHeightIn;
  let switched = 0;
  const missing = new Set<string>();
  const next = placed.map((item) => {
    if (item.placement !== "wall") return item;
    if (isFillerItem(item) || isPanelItem(item)) return item;
    if (isGlassDoorCabinet(item)) return item;
    if (height == null || Math.abs((Number(item.height) || 0) - height) > HEIGHT_MATCH_IN) return item;
    const row = glassVariantRow(item, input.wallCatalog);
    if (!row) {
      missing.add(item.masterCode);
      return item;
    }
    switched += 1;
    return { ...item, glassDoor: true, noDoor: false, glassDoorAddonCode: null } as PlacedCabinet;
  });
  const findings: DesignerReviewFinding[] = [];
  if (missing.size > 0) {
    findings.push({
      ruleId: "auto-design-rule-12",
      code: "preference-glass-uppers-unavailable",
      severity: "warning",
      title: "Customer pick: Glass cabinets above",
      detail: `This line sells no glass-door (GD) version of ${Array.from(missing).sort().join(", ")} at this height, so ${missing.size === 1 ? "it keeps its" : "they keep their"} solid door${missing.size === 1 ? "" : "s"}.`,
    });
  }
  return { placed: next, switched, findings };
}

/** Trim the designer turns on for the intake picks (crown molding along the top of the uppers). */
export function autoDesignTrimFromIntake(intake: AutoDesignIntake | null | undefined): { crown: boolean } {
  return { crown: hasPreference(intake, "crown-molding") };
}
