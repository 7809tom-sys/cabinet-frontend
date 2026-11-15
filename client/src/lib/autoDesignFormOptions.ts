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
import { dim, isFillerItem, isGlassDoorCabinet, isPanelItem, isStacker, resolvedDesignCabinetDimensions, type DesignCabinet, type PlacedCabinet, type RoomData } from "./design";
import { applyGlassStackerBulkPlacement, glassStackerBulkCeilingBlocksAtHeight, glassStackerBulkHeightOptions } from "./glassStackerBulkPlacement";

const HEIGHT_MATCH_IN = 0.5;
/** The line's real glass stacker rows (12–24 in tall glass wall boxes). */
export function glassStackerRows(catalog: readonly DesignCabinet[]): DesignCabinet[] {
  return catalog.filter((row) => {
    if (row.placement !== "wall" || !(row.id > 0)) return false;
    const { height } = resolvedDesignCabinetDimensions(row);
    return isStacker({ ...row, height }) && isGlassDoorCabinet(row) && height >= 12 && height <= 24;
  });
}

function isOrdinaryUpperAtHeight(item: PlacedCabinet, height: number | null): boolean {
  if (item.placement !== "wall") return false;
  if (isFillerItem(item) || isPanelItem(item)) return false;
  if (isGlassDoorCabinet(item) || isStacker(item) || item.stackedOnCabinetUid) return false;
  if (item.noDoor === true || item.islandFace) return false;
  return height != null && Math.abs((Number(item.height) || 0) - height) <= HEIGHT_MATCH_IN;
}

/**
 * The Designer's glass upgrade (the same one the "Glass door" button uses):
 * the plan keeps the solid catalog row and sets `glassDoor`, and the cart, the
 * price lookup and the 3D view order and draw the line's own `${code}GD` row.
 * Used only on a line that sells no glass stacker.
 */
export function glassVariantRow(item: Pick<PlacedCabinet, "masterCode" | "width" | "height">, wallCatalog: readonly DesignCabinet[]): DesignCabinet | null {
  const base = item.masterCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return wallCatalog.find((candidate) => candidate.id > 0 && candidate.placement === "wall"
    && candidate.masterCode.toUpperCase().replace(/[^A-Z0-9]/g, "") === `${base}GD`
    && Math.abs(dim(candidate.width, 0) - (Number(item.width) || 0)) <= 0.05
    && Math.abs(dim(candidate.height, 0) - (Number(item.height) || 0)) <= HEIGHT_MATCH_IN) ?? null;
}

/**
 * Glass cabinets above (Tom, Nov 15 2026: "understanding as a stacker").
 *
 * When the selected line sells glass stackers (W1812GD, W3012GD, DCW2412GD …),
 * the pick puts the line's own glass stacker ON TOP of every ordinary upper at
 * the design height: same width, same wall family, one height for the whole
 * kitchen (the height that fits the most uppers under the ceiling, the taller
 * one on a tie). The upper below keeps its solid door. An upper the line has no
 * stacker for, or that already reaches the ceiling, is named in one warning.
 *
 * A line that sells no glass stacker at all keeps the earlier door upgrade: an
 * upper whose same box the line sells as a GD row (W2430 -> W2430GD) gets the
 * glass door, and an upper it cannot glaze is named in one warning.
 * Nothing here invents a SKU or a price.
 */
export function applyGlassUpperPreference(input: {
  placed: readonly PlacedCabinet[];
  wallCatalog: readonly DesignCabinet[];
  intake: AutoDesignIntake | null | undefined;
  /** The real catalog height the upper run used (for example 30.25 for a 30" class). */
  wallHeightIn: number | null;
  /** The room ceiling is a hard limit for the glass stacker. */
  room: RoomData;
  /** Every wall row the line sells (stackers can live outside the wall palette). Defaults to `wallCatalog`. */
  stackerCatalog?: readonly DesignCabinet[];
  makeUid: () => string;
}): { placed: PlacedCabinet[]; switched: number; stacked: number; findings: DesignerReviewFinding[] } {
  const placed = [...input.placed];
  if (!hasPreference(input.intake, "glass-uppers")) return { placed, switched: 0, stacked: 0, findings: [] };
  const height = input.wallHeightIn;
  const room = input.room;
  const stackerRows = glassStackerRows(input.stackerCatalog ?? input.wallCatalog);
  const occupiedParents = new Set(placed.flatMap((item) => item.stackedOnCabinetUid ? [item.stackedOnCabinetUid] : []));
  const parents = placed.filter((item) => isOrdinaryUpperAtHeight(item, height) && !occupiedParents.has(item.uid));
  if (stackerRows.length === 0) {
    let switched = 0;
    const missing = new Set<string>();
    const parentUids = new Set(parents.map((item) => item.uid));
    const next = placed.map((item) => {
      if (!parentUids.has(item.uid)) return item;
      const row = glassVariantRow(item, input.wallCatalog);
      if (!row) {
        missing.add(item.masterCode);
        return item;
      }
      switched += 1;
      return { ...item, glassDoor: true, noDoor: false, glassDoorAddonCode: null } as PlacedCabinet;
    });
    const findings: DesignerReviewFinding[] = missing.size === 0 ? [] : [{
      ruleId: "auto-design-rule-12",
      code: "preference-glass-uppers-unavailable",
      severity: "warning",
      title: "Customer pick: Glass cabinets above",
      detail: `This line sells no glass stacker and no glass-door (GD) version of ${Array.from(missing).sort().join(", ")} at this height, so ${missing.size === 1 ? "it keeps its" : "they keep their"} solid door${missing.size === 1 ? "" : "s"}.`,
    }];
    return { placed: next, switched, stacked: 0, findings };
  }
  const parentUids = new Set(parents.map((item) => item.uid));
  const options = glassStackerBulkHeightOptions([...placed], room, stackerRows)
    .map((option) => ({ ...option, candidates: option.candidates.filter((candidate) => parentUids.has(candidate.parentUid)) }))
    .filter((option) => option.candidates.length > 0)
    .sort((left, right) => right.candidates.length - left.candidates.length || right.height - left.height);
  const chosen = options[0] ?? null;
  const next = chosen ? applyGlassStackerBulkPlacement([...placed], chosen.candidates, input.makeUid) : placed;
  const stackedParents = new Set(chosen?.candidates.map((candidate) => candidate.parentUid) ?? []);
  const missing = parents.filter((item) => !stackedParents.has(item.uid));
  const findings: DesignerReviewFinding[] = [];
  if (missing.length > 0) {
    const codes = Array.from(new Set(missing.map((item) => item.masterCode))).sort();
    const heights = Array.from(new Set(stackerRows.map((row) => resolvedDesignCabinetDimensions(row).height)));
    const ceilingBlocks = (chosen ? [chosen.height] : heights)
      .flatMap((stackerHeight) => glassStackerBulkCeilingBlocksAtHeight([...placed], room, stackerRows, stackerHeight))
      .filter((block) => parentUids.has(block.parentUid) && !stackedParents.has(block.parentUid));
    const blockedCodes = Array.from(new Set(ceilingBlocks.map((block) => block.parentCode))).sort();
    const blocked = new Set(blockedCodes);
    const noSkuCodes = codes.filter((code) => !blocked.has(code));
    const reasons = [
      blockedCodes.length > 0 ? `the ceiling leaves no room for a glass stacker above ${blockedCodes.join(", ")}` : null,
      noSkuCodes.length > 0 ? `this line sells no glass stacker of the same width and family${chosen ? ` at ${chosen.height}″` : ""} for ${noSkuCodes.join(", ")}` : null,
    ].filter(Boolean).join("; ");
    findings.push({
      ruleId: "auto-design-rule-12",
      code: "preference-glass-stacker-unavailable",
      severity: "warning",
      title: "Customer pick: Glass cabinets above",
      detail: `${chosen ? `A ${chosen.height}″ glass stacker was placed on ${stackedParents.size} wall cabinet${stackedParents.size === 1 ? "" : "s"}. ` : ""}No glass stacker was placed on ${codes.join(", ")}: ${reasons}.`,
    });
  }
  return { placed: next, switched: 0, stacked: stackedParents.size, findings };
}

/** Trim the designer turns on for the intake picks (crown molding along the top of the uppers). */
export function autoDesignTrimFromIntake(intake: AutoDesignIntake | null | undefined): { crown: boolean } {
  return { crown: hasPreference(intake, "crown-molding") };
}
